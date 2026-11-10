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

CWD = Path(__file__).with_name('cwd')
SYSTEM = ('You are the newsroom model inside an automated Albanian news pipeline. Follow the task in the '
          'user message exactly. Return only what it asks for, with the exact markers it names. '
          'Do not ask questions and do not add commentary outside the requested output.')


def ask(prompt, image=None):
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
