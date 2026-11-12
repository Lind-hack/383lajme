"""Unapproved work checkpoints. These records never grant publication permission."""
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
from news_json_state import atomic
from news_approved_reserve import source_age, time_sensitive_story

POLICY = '383-pending-draft-v1'
STAGES = ('new', 'written', 'prepared', 'edited', 'originality')

def file_hash(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()

PREPARATION_POLICY = '383-prepared-story-v1'

def bind_preparation(lead):
    lead['preparation_receipt'] = dict(policy=PREPARATION_POLICY,files={
        str(Path(lead[key]).resolve()):file_hash(lead[key])
        for key in ('evidence_path','facts_path') if lead.get(key)})
    return lead

def prepared_unchanged(lead):
    proof=lead.get('preparation_receipt',{})
    if proof.get('policy') != PREPARATION_POLICY or not proof.get('files'):
        return False
    try:
        required={str(Path(lead[key]).resolve()) for key in ('evidence_path','facts_path') if lead.get(key)}
        actual={str(Path(path).resolve()) for path in proof['files']}
        return actual==required and all(file_hash(path)==expected for path,expected in proof['files'].items())
    except (OSError,TypeError):
        return False

class Progress:
    def __init__(self, path, job):
        self.path = Path(path)
        if self.path.exists():
            self.data = json.loads(self.path.read_text(encoding='utf-8'))
            if self.data.get('policy') != POLICY or self.data['lead'] != job['lead']:
                raise ValueError('pending work policy or prepared story changed')
        else:
            self.data = dict(job, policy=POLICY, created_at=datetime.now(timezone.utc).isoformat(),
                             attempt=0, stage='new', terminal=False, refusal='')
            self.data['inputs'] = {str(Path(job['lead'][key]).resolve()):file_hash(job['lead'][key])
                                   for key in ('evidence_path','facts_path') if job['lead'].get(key)}
            atomic(self.path, self.data)

    def valid(self):
        if self.data.get('terminal') or self.data.get('policy') != POLICY:
            return False
        lead = self.data['lead']
        now = datetime.now(timezone.utc)
        limit = 3600 if time_sensitive_story(lead,self.data.get('time_sensitive')) else 86400
        if source_age(lead.get('published'), now) > limit or source_age(self.data['created_at'], now) > 86400:
            return False
        for path, expected in {**self.data.get('inputs', {}), **self.data.get('files', {})}.items():
            try:
                if file_hash(path) != expected: return False
            except OSError: return False
        return True

    def completed(self, stage):
        return STAGES.index(self.data['stage']) >= STAGES.index(stage)

    def save(self, stage, batch):
        files = [Path(batch), Path(batch).with_suffix('.editor-sources.json')]
        self.data.update(stage=stage, files={str(p.resolve()):file_hash(p) for p in files if p.exists()})
        atomic(self.path, self.data)

    def finish(self):
        self.data['terminal'] = True
        atomic(self.path, self.data)

    def rewrite(self, refusal):
        self.data.update(attempt=1, stage='new', refusal=refusal, files={})
        atomic(self.path, self.data)
