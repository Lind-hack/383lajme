"""Seven independent hourly news jobs, sharing only input inventory and capacity."""
from __future__ import annotations

import concurrent.futures
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import signal
import subprocess
import threading

from news_batch_identity import DESKS


def desk_environment(code: Path, state: Path, stamp: str, slug: str, base: dict) -> dict:
    root = state / 'desks' / slug
    runtime = root / 'runtime'
    runtime.mkdir(parents=True, exist_ok=True)
    for name in ('scripts', 'docs'):
        link = runtime / name
        target = code / name
        if link.is_symlink() and link.resolve() == target:
            continue
        if link.is_symlink():
            link.unlink()
        link.symlink_to(target, target_is_directory=True)
    (runtime / '.last30days').mkdir(exist_ok=True)
    (runtime / 'data' / 'auto-articles').mkdir(parents=True, exist_ok=True)
    (runtime / 'data' / 'automation').mkdir(parents=True, exist_ok=True)
    # This is incoming daily research, not a category's mutable evidence output.
    social = runtime / '.last30days' / 'agent-social-research-current.md'
    incoming = code / '.last30days' / social.name
    if slug == 'showbiz' and not social.exists() and not social.is_symlink():
        social.symlink_to(incoming)
    env = dict(base)
    env.update({
        'L383_REPO': str(runtime), 'L383_RUN_DESK': slug,
        'L383_NEWS_CATEGORIES': DESKS[slug], 'STAMP': stamp,
        'L383_STATE_ROOT': str(root / 'hourly-runs'),
        'L383_QA_BATCH_ROOT': str(root / 'qa-batches'),
        'L383_INGESTION_STATE': base.get('L383_INGESTION_STATE') or str(state / 'source-inventory.sqlite'),
        'L383_MODEL_SLOT_DB': str(state / 'model-slots.sqlite'),
        'L383_MODEL_QUOTA_FILE': str(state / 'hourly-runs' / f'{stamp}-mode{base.get("L383_QA_ONLY", "0")}.quota'),
    })
    # Each child starts its own full deadline; never inherit an outer stage cutoff.
    for name in ('L383_DEADLINE_ACTIVE', 'L383_MODEL_DEADLINE_EPOCH', 'L383_REVIEW_RECEIPT',
                 'L383_REVIEW_REJECTED', 'L383_REJECTION_LEDGER'):
        env.pop(name, None)
    return env


def run_desks(code: Path, state: Path, stamp: str, base: dict, command=None) -> dict:
    logs = state / 'hourly-runs' / f'{stamp}-desks-mode{base.get("L383_QA_ONLY", "0")}'
    logs.mkdir(parents=True, exist_ok=True)
    processes = set()
    lock = threading.Lock()
    stopping = threading.Event()

    def signal_process(process, signum):
        try:
            if os.name == 'posix':
                os.killpg(process.pid, signum)
            elif signum == signal.SIGTERM:
                process.terminate()
            else:
                process.kill()
        except ProcessLookupError:
            pass

    def stop(signum, frame):
        stopping.set()
        with lock:
            for process in processes:
                signal_process(process, signal.SIGTERM)

    prior = {}
    if threading.current_thread() is threading.main_thread():
        for sig in (signal.SIGTERM, signal.SIGINT):
            prior[sig] = signal.signal(sig, stop)

    def run(slug):
        log = logs / f'{slug}.log'
        try:
            env = desk_environment(code, state, stamp, slug, base)
            # Make timeout the process-group leader, so cancellation reaches
            # its entire shell tree as well as each model wrapper's cleanup.
            args = command or ['timeout', '--signal=TERM', '--kill-after=30s', '3300s',
                               'env', 'L383_DEADLINE_ACTIVE=1', 'bash',
                               str(code / 'scripts' / 'run-hourly-news.sh')]
            with log.open('a', encoding='utf-8') as output:
                with lock:
                    if stopping.is_set():
                        return {'category': DESKS[slug], 'status': 'cancelled', 'returncode': 143}
                    process = subprocess.Popen(args, env=env, cwd=env['L383_REPO'], stdout=output,
                                               stderr=subprocess.STDOUT, start_new_session=os.name == 'posix')
                    processes.add(process)
                try:
                    rc = process.wait(timeout=3360)
                except subprocess.TimeoutExpired:
                    signal_process(process, signal.SIGTERM)
                    try:
                        process.wait(timeout=30)
                    except subprocess.TimeoutExpired:
                        signal_process(process, signal.SIGKILL)
                        process.wait()
                    rc = 124
                finally:
                    with lock:
                        processes.discard(process)
            slot = Path(env['L383_STATE_ROOT']) / f'{stamp}-mode{base.get("L383_QA_ONLY", "0")}.json'
            outcome = json.loads(slot.read_text(encoding='utf-8')) if slot.is_file() else {}
            status = outcome.get('status', 'failed' if rc else 'skipped')
            if rc and status not in {'published', 'complete'}:
                status = 'failed'
            published = 0
            if status in {'published', 'complete'} and outcome.get('batch'):
                published = len(json.loads(Path(outcome['batch']).read_text(encoding='utf-8')))
            return {**outcome, 'category': DESKS[slug], 'returncode': rc, 'log': str(log),
                    'status': status, 'published_count': published}
        except Exception as exc:
            # Infrastructure failure in one desk must not cancel six other futures.
            return {'category': DESKS[slug], 'status': 'failed', 'returncode': 75,
                    'error': f'{type(exc).__name__}: {exc}', 'log': str(log)}

    try:
        with concurrent.futures.ThreadPoolExecutor(max_workers=len(DESKS)) as pool:
            futures = {pool.submit(run, slug): slug for slug in DESKS}
            outcomes = {}
            for future in concurrent.futures.as_completed(futures):
                slug = futures[future]
                outcomes[slug] = future.result()
                print(f'383 DESK OUTCOME {slug}: {json.dumps(outcomes[slug], ensure_ascii=False)}', flush=True)
                temporary = logs / 'outcomes.tmp'
                temporary.write_text(json.dumps(outcomes, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
                temporary.replace(logs / 'outcomes.json')
        return outcomes
    finally:
        for sig, handler in prior.items():
            signal.signal(sig, handler)


def main():
    code = Path(__file__).resolve().parents[1]
    state = Path(os.environ.get('L383_DESK_STATE_ROOT',
                 '/opt/data/qa/383/category-runs' if os.environ.get('L383_QA_ONLY') == '1'
                 else '/opt/data/news-pipeline-state'))
    stamp = os.environ.get('STAMP', datetime.now(timezone.utc).strftime('%Y-%m-%dT%H'))
    datetime.strptime(stamp, '%Y-%m-%dT%H')
    results = run_desks(code, state, stamp, dict(os.environ))
    return int(any(row['returncode'] for row in results.values()))


if __name__ == '__main__':
    raise SystemExit(main())
