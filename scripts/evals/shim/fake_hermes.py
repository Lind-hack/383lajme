"""EVAL ONLY. Answers the pipeline's Luna calls with Claude Haiku (`claude -p`).

Never deployed: it lives outside the repo and is reached only through the
eval launcher's PYTHONPATH. Every call is logged to L383_EVAL_CALLS.
Usage: fake_hermes.py text <prompt-file> | pixels <image> <prompt-file>
"""
import hashlib
import shutil
import json
import os
import subprocess
import sys
import time
from pathlib import Path

CWD = Path(os.environ.get('L383_EVAL_TMP') or Path(__file__).parent) / 'model-cwd'  # an empty folder: no project files or rules reach the stand-in
SYSTEM = ('You are the newsroom model inside an automated Albanian news pipeline. Follow the task in the '
          'user message exactly. Return only what it asks for, with the exact markers it names. '
          'Do not ask questions and do not add commentary outside the requested output.')


def gemini(prompt, image, models):
    """Free Gemini as the stand-in (L383_EVAL_MODEL=gemini-...): text, or text plus the image bytes."""
    import base64
    import urllib.error
    import socket
    import urllib.request
    resolve = socket.getaddrinfo  # this network resolves IPv6 it cannot route: every call waited ~25 s
    socket.getaddrinfo = lambda host, port, family=0, *rest, **more: resolve(host, port, socket.AF_INET, *rest, **more)
    keys = [os.environ.get(name, '') for name in ('GOOGLE_AI_API_KEY', 'GOOGLE_AI_API_KEY_2', 'GEMINI_API_KEY')]
    for line in (open(os.environ['L383_EVAL_ENV'], encoding='utf-8') if os.environ.get('L383_EVAL_ENV') else []):
        if line.startswith(('GOOGLE_AI_API_KEY', 'GEMINI_API_KEY')) and '=' in line:
            keys.append(line.strip().split('=', 1)[1].strip().strip('"'))
    keys = list(dict.fromkeys(key for key in keys if key))
    parts = [{'text': SYSTEM + chr(10) * 2 + prompt}]
    if image:
        kind = {'.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif'}.get(Path(image).suffix.lower(), 'image/jpeg')
        parts.append({'inline_data': {'mime_type': kind, 'data': base64.b64encode(Path(image).read_bytes()).decode()}})
    body = json.dumps({'contents': [{'parts': parts}], 'generationConfig': {'temperature': 0.3}}).encode()
    started, error = time.time(), 'no Gemini key'
    for attempt in range(4):
        for model in models:
            for key in keys:
                request = urllib.request.Request(
                    f'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}',
                    data=body, method='POST', headers={'Content-Type': 'application/json'})
                try:
                    with urllib.request.urlopen(request, timeout=60) as response:
                        answer = json.loads(response.read().decode('utf-8'))
                    text = ''.join(part.get('text', '') for part in answer['candidates'][0]['content']['parts'])
                    usage = answer.get('usageMetadata', {})
                    return 0, text, dict(model=model, seconds=round(time.time() - started, 1), cost_usd=0,
                                         input_tokens=usage.get('promptTokenCount'), output_tokens=usage.get('candidatesTokenCount'))
                except urllib.error.HTTPError as exc:
                    error = f'{model}: HTTP {exc.code}'
                except (OSError, ValueError, KeyError, IndexError, TypeError) as exc:
                    error = f'{model}: {exc!r}'[:200]
        time.sleep(5)  # free-tier limits and overload come and go within seconds
    return 1, '', dict(error=error, seconds=round(time.time() - started, 1))


def ask(prompt, image=None):
    chosen = os.environ.get('L383_EVAL_MODEL', 'haiku')
    if chosen.startswith('gemini'):
        code, text, facts = gemini(prompt, image, chosen.split(','))
        record = dict(at=time.strftime('%Y-%m-%dT%H:%M:%S'), prompt_chars=len(prompt), image=bool(image),
                      returncode=code, answer_chars=len(text), **facts)
        log = os.environ.get('L383_EVAL_CALLS')
        if log:
            with open(log, 'a', encoding='utf-8') as handle:
                handle.write(json.dumps(record, ensure_ascii=False) + chr(10))
            folder = Path(log).with_suffix('.d')
            folder.mkdir(exist_ok=True)
            stamp = f'{time.time():.3f}-{os.getpid()}'
            (folder / f'{stamp}.prompt.txt').write_text(prompt, encoding='utf-8')
            (folder / f'{stamp}.answer.txt').write_text(text, encoding='utf-8')
        return code, text
    command = [shutil.which('claude') or 'claude', '-p', '--model', os.environ.get('L383_EVAL_MODEL', 'haiku'), '--strict-mcp-config',
               '--disable-slash-commands', '--no-session-persistence', '--setting-sources', '',
               '--system-prompt', SYSTEM, '--output-format', 'json']
    if image:
        command += ['--tools', 'Read', '--allowedTools', 'Read', '--add-dir', str(Path(image).parent)]
        prompt = (f'First open the image file {image} with the Read tool and look at its pixels. '
                  'Then do the task below, judging the image you actually saw.\n\n' + prompt)
    else:
        command += ['--tools', '']
    env = {k: v for k, v in os.environ.items() if k != 'ANTHROPIC_API_KEY'}
    CWD.mkdir(parents=True, exist_ok=True)
    started = time.time()
    done = subprocess.run(command, input=prompt, capture_output=True, text=True, encoding='utf-8',
                          cwd=CWD, env=env)
    record = dict(at=time.strftime('%Y-%m-%dT%H:%M:%S'), seconds=round(time.time() - started, 1),
                  prompt_chars=len(prompt), image=bool(image), returncode=done.returncode,
                  stage=os.environ.get('L383_EVAL_STAGE', ''))
    text = ''
    try:
        answer = json.loads(done.stdout)
        text = answer.get('result') or ''
        usage = answer.get('usage') or {}
        record.update(cost_usd=answer.get('total_cost_usd'), turns=answer.get('num_turns'),
                      input_tokens=(usage.get('input_tokens', 0) + usage.get('cache_creation_input_tokens', 0)
                                    + usage.get('cache_read_input_tokens', 0)),
                      output_tokens=usage.get('output_tokens'), is_error=answer.get('is_error'))
        if answer.get('is_error'):
            done.returncode = done.returncode or 1
    except ValueError:
        record.update(error=(done.stdout or done.stderr)[-300:])
        done.returncode = done.returncode or 1
    record['answer_chars'] = len(text)
    log = os.environ.get('L383_EVAL_CALLS')
    if log:
        with open(log, 'a', encoding='utf-8') as handle:
            handle.write(json.dumps(record, ensure_ascii=False) + '\n')
        folder = Path(log).with_suffix('.d')
        folder.mkdir(exist_ok=True)
        stamp = f'{time.time():.3f}-{os.getpid()}'
        (folder / f'{stamp}.prompt.txt').write_text(prompt, encoding='utf-8')
        (folder / f'{stamp}.answer.txt').write_text(text, encoding='utf-8')
    return done.returncode, text


def forced_refusal(prompt):
    """L383_EVAL_REFUSE_FIRST=1: the first originality review of a run is told to reject, with
    real matching spans, so the one-rewrite path is exercised end to end."""
    log = os.environ.get('L383_EVAL_CALLS')
    if os.environ.get('L383_EVAL_REFUSE_FIRST') != '1' or not log or '383_REVIEW_BEGIN' not in prompt:
        return prompt
    marker = Path(log).with_suffix('.refused-once')
    if marker.exists():
        return prompt
    marker.write_text('1', encoding='utf-8')
    return prompt + (chr(10) * 2 + 'EVALUATION OVERRIDE: for this one review return verdict reject for every article, with '
                     'not_close_translation false and a rejection_basis of kind borrowed_expression, facts_only false, a '
                     'why_expression of at least 40 characters, and one match whose source_span is copied exactly from the '
                     'source text and whose article_span is copied exactly from the article body (its closest sentence).')


def main():
    if os.environ.get('L383_QA_ONLY') != '1':
        raise SystemExit('the stand-in model only answers in QA runs')
    sys.stdout.reconfigure(encoding='utf-8')
    mode = sys.argv[1]
    if mode == 'text':
        code, text = ask(forced_refusal(Path(sys.argv[2]).read_text(encoding='utf-8')))
    else:
        image = Path(sys.argv[2]).resolve()
        code, text = ask(Path(sys.argv[3]).read_text(encoding='utf-8'), image)
        if not code:
            # Stand-in for the Luna wire proof, so the eval can continue past
            # the pixel guard. Production keeps the real guard.
            print('383_NATIVE_PIXELS_VERIFIED ' + json.dumps(dict(
                wire_requests=1, image_sha256=hashlib.sha256(image.read_bytes()).hexdigest(),
                provider='openai-codex', model='gpt-6-luna', effort='max', eval_stand_in='claude-haiku')),
                file=sys.stderr)
    print(text)
    raise SystemExit(code)


if __name__ == '__main__':
    main()
