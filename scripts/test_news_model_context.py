import tempfile
import unittest
from pathlib import Path
from news_model_context import inline_context, contextual_command, MAX_PROMPT_BYTES


class ModelContextTests(unittest.TestCase):
    def test_complete_authoritative_documents_and_untrusted_facts_are_not_clipped(self):
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary)/'facts.md'
            text = 'Fakte të verifikuara. ' * 300 + ' https://example.com/exact-source?x=1&y=2'
            path.write_text(text, encoding='utf-8')
            result = inline_context('Original strict task and JSON markers', [path])
            self.assertIn(text, result)
            self.assertIn('Original strict task and JSON markers', result)
            self.assertIn('Tools are disabled', result)

    def test_no_context_keeps_the_existing_file_based_route_exactly_unchanged(self):
        self.assertEqual(inline_context('Original prompt', []), 'Original prompt')

    def test_oversize_utf8_context_fails_instead_of_truncating_verification_material(self):
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary)/'source.md'
            path.write_text('ë' * (MAX_PROMPT_BYTES//2), encoding='utf-8')
            with self.assertRaises(ValueError):
                inline_context('task', [path])

    def test_complete_context_disables_tools_without_changing_provider_or_model(self):
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary)/'facts.md';path.write_text('Every supplied fact.',encoding='utf-8')
            command=['hermes','chat','--provider','openai-codex','--model','gpt-6-luna','-t','file','-q','task']
            result, inlined=contextual_command(command,[path])
            self.assertTrue(inlined)
            self.assertEqual(result[:-1],command[:-4]+['-t','none','-q'])
            self.assertIn('Every supplied fact.',result[-1])
            self.assertEqual(command[-1],'task')

    def test_large_context_keeps_the_complete_file_reading_task_and_does_not_truncate(self):
        with tempfile.TemporaryDirectory() as temporary:
            path=Path(temporary)/'source.md';path.write_text('x'*MAX_PROMPT_BYTES,encoding='utf-8')
            command=['hermes','chat','-t','none','-q','Read the complete source.md']
            result,inlined=contextual_command(command,[path])
            self.assertFalse(inlined)
            self.assertEqual(result,['hermes','chat','-t','file','-q','Read the complete source.md'])

    def test_missing_reference_cannot_be_replaced_by_invented_or_partial_context(self):
        with tempfile.TemporaryDirectory() as temporary:
            with self.assertRaises(FileNotFoundError):
                contextual_command(['hermes','chat','-q','task'],[Path(temporary)/'missing.md'])

    def test_added_tool_selection_does_not_become_the_query_value(self):
        with tempfile.TemporaryDirectory() as temporary:
            path=Path(temporary)/'facts.md';path.write_text('Complete facts',encoding='utf-8')
            command,inlined=contextual_command(['hermes','chat','-q','task'],[path])
            self.assertTrue(inlined)
            self.assertEqual(command[:-1],['hermes','chat','-t','none','-q'])


if __name__=='__main__':
    unittest.main()
