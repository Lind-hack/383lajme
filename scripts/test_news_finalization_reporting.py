from pathlib import Path
import unittest
from unittest.mock import patch

import codex_automation_support as support


class FinalizationReportingTests(unittest.TestCase):
    def run_finalizer(self, name, *, health=0, content_error=None, publish=0):
        calls=[]
        def publication(path):
            calls.append('publish')
            return publish
        def check(path):
            calls.append('content')
            if content_error:
                raise content_error
        with patch.object(support,'validate_batch',return_value=[{}]), \
                patch.object(support,'dedupe_published',return_value=0), \
                patch.object(support,'publish_supabase',side_effect=publication), \
                patch.object(support,'git_publish',side_effect=publication), \
                patch.object(support,'verify_public_site',side_effect=lambda path:calls.append('health') or health), \
                patch('news_publication_readback.verify_live',side_effect=check), \
                patch.object(support,'send_report',side_effect=lambda path:calls.append('email') or 0):
            result=getattr(support,name)(Path('2026-10-28T17.json'))
        return result,calls

    def test_both_finalizers_verify_visible_copy_before_sending_completion_email(self):
        for name in ('finalize','finalize_supabase'):
            with self.subTest(path=name):
                code,calls=self.run_finalizer(name)
                self.assertEqual(code,0)
                self.assertEqual(calls,['publish','health','content','email'])

    def test_failed_health_or_visible_content_never_sends_a_success_report(self):
        for name in ('finalize','finalize_supabase'):
            for kwargs in ({'health':1},{'content_error':RuntimeError('Unreviewed body paragraph')}):
                with self.subTest(path=name,kwargs=kwargs):
                    code,calls=self.run_finalizer(name,**kwargs)
                    self.assertEqual(code,1)
                    self.assertNotIn('email',calls)

    def test_failed_git_publication_never_proceeds_to_site_or_completion_checks(self):
        code,calls=self.run_finalizer('finalize',publish=1)
        self.assertEqual(code,1)
        self.assertEqual(calls,['publish'])


if __name__=='__main__':
    unittest.main()
