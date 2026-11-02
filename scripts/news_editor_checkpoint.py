"""Retain only byte-verified editorial chunks, including at a stage timeout."""
import argparse
import json
import os
import hashlib
from pathlib import Path

from editor_completion import acknowledge, verify, receipt_path


def pending_path(batch: Path) -> Path:
    # Article loaders scan adjacent *.json. Unapproved drafts must never be
    # mistaken for a public fallback batch, even during an eventual Git archive.
    root = Path(os.environ.get('L383_EDITOR_PENDING_ROOT',str(batch.parent / '.editor-pending')))
    # Refill and repair rounds can share a filename but have different scopes.
    key = hashlib.sha256(str(batch.resolve()).encode()).hexdigest()[:12]
    return root / f'{batch.stem}-{key}.json'


def checkpoint(batch: Path, work: Path) -> int:
    original = json.loads((work / 'input.json').read_text(encoding='utf-8'))
    allowed = {a['url']: a for a in original}
    retained, completed = {}, set()
    for folder in sorted(work.glob('chunk-*')):
        chunk = folder / batch.name
        try:
            rows = json.loads(chunk.read_text(encoding='utf-8'))
            if rows:
                verify(chunk)
            elif rows != [] or not (folder/'finished').exists() or (folder/'failed').exists():
                raise ValueError('empty chunk has no completed drop decisions')
            identities = json.loads((folder / 'input.json').read_text(encoding='utf-8'))
            scope = {a['url'] for a in identities}
            if any(a['url'] not in scope or a['url'] not in allowed for a in rows):
                raise ValueError('editor chunk left its original scope')
            for a in rows:
                old = allowed[a['url']]
                for field in ('id', 'slug', 'url', 'category', 'dispatch', 'published_at',
                              'created_at', 'corroborating_sources'):
                    if a.get(field) != old.get(field):
                        raise ValueError('editor checkpoint changed immutable identity')
            if len({a['url'] for a in rows}) != len(rows) or scope & completed:
                raise ValueError('duplicate editor chunk identity')
            retained.update({a['url']: a for a in rows})
            completed.update(scope)
        except (OSError, ValueError, KeyError, TypeError):
            # A missing, stale or partially written acknowledgement is never approval.
            continue
    rows = [retained[a['url']] for a in original if a['url'] in retained]
    pending = [a for a in original if a['url'] not in completed]
    # One parent coordinator writes this checkpoint. Readers either see the
    # old valid bytes or the complete new batch; every change invalidates old receipts.
    temporary = batch.with_suffix('.checkpoint.tmp')
    temporary.write_text(json.dumps(rows, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
    os.replace(temporary, batch)
    receipt_path(batch).unlink(missing_ok=True)
    if rows:
        acknowledge(batch)
    pending_file = pending_path(batch)
    pending_file.parent.mkdir(parents=True,exist_ok=True)
    temporary = pending_file.with_suffix('.tmp')
    temporary.write_text(json.dumps(pending, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
    os.replace(temporary, pending_file)
    print(f'383 EDITOR CHECKPOINT retained={len(rows)} pending={len(pending)}', flush=True)
    return len(rows)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('batch', type=Path)
    parser.add_argument('work', type=Path)
    args = parser.parse_args()
    checkpoint(args.batch, args.work)
