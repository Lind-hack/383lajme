import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import news_quality_report as quality


class QualityOutcomeTests(unittest.TestCase):
    def test_quota_outcome_replaces_stale_metrics_without_counting_unreviewed_drafts(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder);batch=root/'2026-10-24T17.json'
            batch.write_text(json.dumps([{'category':'Sport','url':'https://skysports.com/draft'}]))
            with patch.object(quality,'__file__',str(root/'scripts/news_quality_report.py')):
                result=quality.report(batch,'model_quota')
            self.assertEqual(result['status'],'model_quota')
            self.assertEqual(result['article_count'],0)
            self.assertTrue(all(count==0 for count in result['categories'].values()))
            latest=json.loads((root/'.last30days/hourly-quality-latest.json').read_text())
            archived=json.loads((root/'.last30days/hourly-runs/2026-10-24T17.quality.json').read_text())
            self.assertEqual(latest,archived)


if __name__=='__main__':unittest.main()
