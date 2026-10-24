import unittest
from unittest.mock import Mock

import codex_automation_support as support
from news_sibling_dedup import distinct


class SiblingDedupTests(unittest.TestCase):
    def test_same_event_from_two_sources_is_removed_without_changing_first_copy(self):
        body = ('Këshilli miratoi projektin për autobusët elektrikë në Tiranë. Financimi mbulon automjetet e reja, '
                'stacionet e karikimit dhe linjat urbane. Zbatimi nis në nëntor me buxhet prej pesë milionë eurosh.')
        first={'id':'one','slug':'first','url':'https://source.example/first','title':'Tirana miraton autobusë elektrikë',
               'body':body,'image_subject':'Tirana'}
        second={**first,'id':'two','slug':'second','url':'https://other.example/second','title':'Autobusë elektrikë për Tiranën'}
        self.assertTrue(support._same_story(second,first))
        judge=Mock(side_effect=AssertionError('clear repeats need no model call'))
        kept,rejected=distinct([first,second],same_story=support._same_story,overlap=support._story_overlap,
                               clear_repeat=support.CLEAR_REPEAT,judge=judge)
        self.assertEqual(kept,[first]);self.assertIs(kept[0],first)
        self.assertEqual(rejected,[(1,0)]);judge.assert_not_called()

    def test_uncertain_development_uses_existing_judge_and_missing_decision_stays_closed(self):
        first={'id':'approved','body':'Exact previously reviewed copy'}
        second={'id':'new','body':'A separate new decision about the same subject'}
        for verdict,expected in [(True,[first,second]),(False,[first])]:
            judge=Mock(return_value=[verdict])
            kept,_=distinct([first,second],same_story=lambda *_:True,overlap=lambda *_:.2,
                            clear_repeat=.4,judge=judge)
            self.assertEqual(kept,expected);self.assertIs(kept[0],first)
            judge.assert_called_once_with([(second,first)])
        kept,_=distinct([first,second],same_story=lambda *_:True,overlap=lambda *_:.2,
                        clear_repeat=.4,judge=lambda _:[])
        self.assertEqual(kept,[first])

    def test_unrelated_stories_require_no_extra_judge_call(self):
        rows=[{'id':'first'},{'id':'second'}]
        judge=Mock(side_effect=AssertionError('unrelated stories need no model call'))
        self.assertEqual(distinct(rows,same_story=lambda *_:False,overlap=lambda *_:0,
                                  clear_repeat=.4,judge=judge),(rows,[]))
        judge.assert_not_called()


if __name__=='__main__':unittest.main()
