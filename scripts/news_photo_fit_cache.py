"""Reuse exact image-fit judgments without renewing their review timestamp."""
from datetime import datetime, timezone
import json
from news_json_state import atomic, age
from news_copyright_review import digest

POLICY = '383-photo-fit-context-v1'


class PhotoFitCache:
    def __init__(self, path):
        self.path = path
        try:
            self.rows = json.loads(path.read_text(encoding='utf-8'))
        except (OSError, ValueError):
            self.rows = {}

    def get(self, context):
        row = self.rows.get(digest([POLICY, context]))
        return row if row and 0 <= age(row['saved_at'], datetime.now(timezone.utc)) < 3600 else None

    def save(self, context, picks, proofs):
        now = datetime.now(timezone.utc)
        self.rows = {k: v for k, v in self.rows.items() if 0 <= age(v.get('saved_at'), now) < 3600}
        self.rows[digest([POLICY, context])] = dict(picks=picks, proofs=proofs, saved_at=now.isoformat())
        atomic(self.path, self.rows)
