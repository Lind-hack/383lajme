"""Offline audience-ranking replay; never writes drafts or publishes news."""
import argparse
from datetime import datetime
import json
from pathlib import Path

from news_desk_policy import select_candidates, local_interest


def replay(folder, category):
    data = json.loads((folder / 'discovery.json').read_text(encoding='utf-8'))
    report = json.loads((folder / 'review.json').read_text(encoding='utf-8'))
    raw = data.get('raw_leads', data.get('leads', []))
    evidence = data.get('retrieved_evidence', {})
    candidates = [lead for lead in raw if lead.get('category') == category
                  and evidence.get(lead['url'], {}).get('status') == 'text_extracted']
    now = datetime.fromisoformat(data['generated_at'])
    from news_story_review import story_current
    candidates = select_candidates([a for a in candidates if story_current(a, now)], evidence,
                                   limit=len(candidates), now=now)
    selected = select_candidates(candidates, evidence, limit=5, now=now)
    return dict(category=category, readable_candidates=len(candidates),
                readable_publishers=len({lead['source'] for lead in candidates}),
                preferred_local_candidates=sum(local_interest(lead, evidence.get(lead['url'])) for lead in candidates),
                priority_queue=[dict(title=a.get('title'), url=a['url'], source=a['source'],
                    local_interest=local_interest(a, evidence.get(a['url']))) for a in selected],
                recorded_evals=report.get('summary', {}).get('reviewed_articles', 0),
                replay_only=True, new_model_evals=0, drafts=0, publications=0,
                limitation='Ranking replay uses captured text and recorded Evals; it does not simulate new writing or approval.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('folder', type=Path)
    parser.add_argument('--category', choices=['Showbiz', 'Ekonomi', 'Botë'], required=True)
    args = parser.parse_args()
    print(json.dumps(replay(args.folder, args.category), ensure_ascii=False, indent=2))
