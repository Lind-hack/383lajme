"""Bounded Luna/max calls through the isolated Hermes Codex OAuth account.

There is no API client, API key lookup or alternate-provider fallback. The
hourly preflight configures max effort in HERMES_HOME before any call.
"""
from __future__ import annotations

import json
import os
import signal
import subprocess
import threading
import time
from pathlib import Path
import news_model_quota
import hashlib

MODEL = "gpt-6-luna"
PROVIDER = "openai-codex"
_ACTIVE: set[subprocess.Popen] = set()
_LOCK = threading.RLock()
_CLEANUP_INSTALLED = False
_MAIN_SPAWNING = False
_PENDING_TERMINATION = None


def _stop(process: subprocess.Popen) -> None:
    try:
        if os.name == "posix":
            os.killpg(process.pid, signal.SIGTERM)
        else:
            process.terminate()
        process.communicate(timeout=2)
    except subprocess.TimeoutExpired:
        if os.name == "posix":
            os.killpg(process.pid, signal.SIGKILL)
        else:
            process.kill()
        process.communicate()
    except ProcessLookupError:
        pass


def install_termination_cleanup() -> None:
    """The outer worker deadline must also stop isolated model process groups."""
    global _CLEANUP_INSTALLED
    if _CLEANUP_INSTALLED or threading.current_thread() is not threading.main_thread():
        return
    previous = signal.getsignal(signal.SIGTERM)
    def terminate(signum, frame):
        global _PENDING_TERMINATION
        if _MAIN_SPAWNING:
            # Do not interrupt Popen before its child can be registered. Do
            # not block SIGTERM either: subprocesses inherit blocked signals.
            _PENDING_TERMINATION = (signum, frame)
            return
        with _LOCK:
            active = list(_ACTIVE)
        for process in active:
            _stop(process)
        if callable(previous):
            previous(signum, frame)
        raise SystemExit(128 + signum)
    signal.signal(signal.SIGTERM, terminate)
    _CLEANUP_INSTALLED = True


def stage_deadline(seconds: float) -> float:
    """One shared monotonic cutoff for queued work, calls and retries."""
    install_termination_cleanup()
    remaining = seconds
    if os.environ.get("L383_MODEL_DEADLINE_EPOCH"):
        remaining = min(remaining, float(os.environ["L383_MODEL_DEADLINE_EPOCH"]) - time.time())
    return time.monotonic() + max(0, remaining)


def run_process(command: list[str], timeout: float, *, deadline: float | None = None) -> subprocess.CompletedProcess:
    global _MAIN_SPAWNING, _PENDING_TERMINATION
    install_termination_cleanup()
    cutoff = min(stage_deadline(timeout), deadline) if deadline is not None else stage_deadline(timeout)
    remaining = cutoff - time.monotonic()
    if remaining <= 0:
        raise subprocess.TimeoutExpired(command, 0)
    # A termination handler in the main thread must not observe a just-spawned
    # worker before it is registered. Worker threads hold this lock across both.
    main_thread = threading.current_thread() is threading.main_thread()
    if main_thread:
        _MAIN_SPAWNING = True
    try:
        with _LOCK:
            if news_model_quota.exhausted():
                return subprocess.CompletedProcess(command, 75, '', '383 MODEL QUOTA: account usage limit already reached in this run')
            process = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                                       text=True, encoding="utf-8", start_new_session=os.name == "posix")
            _ACTIVE.add(process)
    finally:
        if main_thread:
            _MAIN_SPAWNING = False
            if _PENDING_TERMINATION:
                pending, _PENDING_TERMINATION = _PENDING_TERMINATION, None
                signal.getsignal(signal.SIGTERM)(*pending)
    try:
        stdout, stderr = process.communicate(timeout=remaining)
        if process.returncode:
            news_model_quota.observe_failure(stdout, stderr)
        return subprocess.CompletedProcess(command, process.returncode, stdout, stderr)
    except subprocess.TimeoutExpired:
        _stop(process)
        raise
    finally:
        with _LOCK:
            _ACTIVE.discard(process)


def model_args(arguments: list[str]) -> list[str]:
    """Prevent provider/model/config overrides from introducing billed paths."""
    if any(arg.split("=", 1)[0] in {"--ignore-user-config", "--ignore-config"} for arg in arguments):
        raise ValueError("News calls must retain the isolated max-effort configuration")
    for flag, expected in (("--provider", PROVIDER), ("--model", MODEL)):
        supplied = []
        for index, value in enumerate(arguments):
            if value == flag:
                supplied.append(arguments[index + 1] if index + 1 < len(arguments) else "")
            elif value.startswith(flag + "="):
                supplied.append(value.split("=", 1)[1])
        if any(value != expected for value in supplied):
            raise ValueError(f"News calls require {flag} {expected}")
        if not supplied:
            arguments = [flag, expected, *arguments]
    return arguments


def rows(answer) -> list:
    if isinstance(answer, dict):
        answer = next((value for value in answer.values() if isinstance(value, list)), None)
    if not isinstance(answer, list):
        raise ValueError("model answer is not a JSON array")
    return answer


def ask_rows(prompt: str, brief: Path, hermes_args: list[str], timeout: int,
             *, deadline: float | None = None, image_path: Path | None = None,
             inline_brief: bool = False) -> list:
    command = [os.environ.get("L383_HERMES_BIN", "/opt/hermes/.venv/bin/hermes"), "chat",
               *model_args(hermes_args), prompt]
    if inline_brief and image_path is None:
        from news_model_context import contextual_command
        command,_ = contextual_command(command,[brief])
    if image_path is not None:
        complete = prompt + '\n\nThe complete brief follows; use it directly without file tools:\n' + brief.read_text(encoding='utf-8')
        if len(complete.encode('utf-8')) > 96_000:
            raise ValueError('native photo brief exceeds complete-context limit')
        prompt_file = image_path.with_suffix('.prompt.txt')
        prompt_file.write_text(complete, encoding='utf-8')
        command = ['/opt/hermes/.venv/bin/python', str(Path(__file__).with_name('news_native_pixels.py')),
                   '--image', str(image_path.resolve()), '--prompt', str(prompt_file.resolve())]
    result = run_process(command, timeout, deadline=deadline)
    if result.returncode:
        raise ValueError("Codex OAuth model call failed")
    if image_path is not None:
        prefix = '383_NATIVE_PIXELS_VERIFIED '
        proof = next((json.loads(line[len(prefix):]) for line in (result.stderr or '').splitlines() if line.startswith(prefix)), {})
        if (not isinstance(proof,dict) or proof.get('provider') != PROVIDER or proof.get('model') != MODEL or proof.get('effort') != 'max'
                or type(proof.get('wire_requests')) is not int or proof['wire_requests'] < 1
                or proof.get('image_sha256') != hashlib.sha256(image_path.read_bytes()).hexdigest()):
            raise ValueError('native photo response has no matching verified pixel request')
    start = result.stdout.rfind("383_JSON_BEGIN")
    end = result.stdout.find("383_JSON_END", start + 14)
    if start < 0 or end < 0:
        raise ValueError("model returned no complete JSON")
    return rows(json.loads(result.stdout[start + 14:end]))
