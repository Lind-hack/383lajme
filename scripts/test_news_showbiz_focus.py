import unittest
from datetime import datetime,timezone
from cloud_news_discovery import select_hourly_leads
from prepare_editor_sources import prioritize_grounded_leads
from news_reader_value import reader_value
from news_showbiz_focus import focus,ARTISTS,EDITORIAL_GUIDANCE
from news_source_policy import source_error


class ShowbizFocusTests(unittest.TestCase):
    def test_requested_artists_and_albanian_case_endings_are_recognized(self):
        for name in ('Dua Lipa','Dua Lipës','Rita Orën','Bebe Rexhës'):
            self.assertEqual(focus({'category':'Showbiz','title':name+' poston foto të reja'})['priority'],3)

    def test_public_photo_and_statement_topics_are_not_automatically_reserves(self):
        for title in ('Dua Lipa ndan foto me bikini në Instagram',
                      'Rita Ora reagon ndaj thashethemeve në postimin e saj',
                      'Bebe Rexha publikon fotot e veshjes së re'):
            value=reader_value({'category':'Showbiz','title':title})
            self.assertFalse(value['reserve_genre'])
            self.assertGreater(value['score'],2)
            self.assertNotIn('viral',value)

    def test_other_desks_and_sponsored_content_keep_their_existing_rules(self):
        self.assertTrue(reader_value({'category':'Sport','title':'Transfer rumours and gossip'})['reserve_genre'])
        self.assertTrue(reader_value({'category':'Showbiz','title':'Dua Lipa sponsored shopping coupon'})['reserve_genre'])
        self.assertEqual(focus({'category':'Botë','title':'Dua Lipa speaks'})['priority'],0)

    def test_passing_name_drop_and_forged_priority_do_not_promote_unrelated_copy(self):
        lead={'category':'Showbiz','title':'Foreign film financing conference',
              'summary':'Unrelated facts. '*50+'Dua Lipa','audience_focus':{'priority':999}}
        self.assertEqual(focus(lead)['priority'],0)

    def test_artist_priority_survives_source_selection_and_photo_preparation(self):
        now=datetime.now(timezone.utc)
        common={'category':'Showbiz','published':now.isoformat(),
                'primary_evidence':{'status':'text_extracted','text':'Verified public facts. '*100}}
        remote=dict(common,title='Foreign rock band postpones a concert',source='NME',url='https://www.nme.com/news/music/foreign-band')
        artist=dict(common,title='Bebe Rexha shares a new outfit on Instagram',source='Consequence',url='https://consequence.net/2026/11/bebe-rexha-outfit')
        self.assertEqual(select_hourly_leads([remote,artist],now=now)[0]['url'],artist['url'])
        self.assertEqual(prioritize_grounded_leads([remote,artist],now=now)[0]['url'],artist['url'])

    def test_unverified_profile_targets_are_not_guessed_and_sources_stay_locked(self):
        pending=[a for a in ARTISTS if a.get('profile_status')=='pending_verification']
        self.assertTrue(pending)
        self.assertTrue(all(not a.get('instagram') for a in pending))
        self.assertIsNotNone(source_error('Showbiz','https://www.instagram.com/p/example/'))
        self.assertIn('adult',EDITORIAL_GUIDANCE)


if __name__=='__main__':unittest.main()
