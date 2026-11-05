"""Write and independently approve one prepared World story; never publish."""
import json
import os
import subprocess
import sys
from pathlib import Path

from news_approved_reserve import Reserve
from news_json_state import atomic
from news_reliable_desks import ProductionPort


def run(request, response):
    from news_model import install_termination_cleanup
    install_termination_cleanup()
    from codex_automation_support import load_env
    load_env()
    job = json.loads(Path(request).read_text(encoding='utf-8'))
    work = Path(job['work'])
    work.mkdir(parents=True, exist_ok=True)
    os.environ['L383_REVIEW_REJECTED'] = str(work / 'copyright-rejected.json')
    if os.environ.get('L383_REJECTION_LEDGER'):
        os.environ['L383_REJECTION_LOCK'] = os.environ['L383_REJECTION_LEDGER'] + '.lock'
    port = ProductionPort('Botë', Reserve(job['reserve_root'], 'Botë'), work,
                          job['deadline'], job['qa'])
    entries, error = [], None
    try:
        for entry in port.write_ready([job['lead']], job['data'], work, 1,
                                      evidence_folder=Path(job['evidence_folder'])):
            entries.append(entry)
            atomic(response, dict(entries=entries, metrics=port.metrics, error=None))
    except (OSError, ValueError, RuntimeError, subprocess.SubprocessError) as exc:
        error = str(exc)
    finally:
        atomic(response, dict(entries=entries, metrics=port.metrics, error=error))


if __name__ == '__main__':
    run(*sys.argv[1:])
