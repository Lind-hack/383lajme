import unittest
from unittest.mock import patch
import bota_photo as b

class PhotoTests(unittest.TestCase):
    def fixture(self):
        source={'id':'test','title':'Pristina road upgrade','outlet':'Example News','sourceParagraphs':['The Pristina road is being upgraded.'],'imageUrl':'https://publisher.example/copied.jpg'}
        result={'photoPlan':{'subject':'Pristina road','subjectEvidence':'The Pristina road is being upgraded.'}}
        return source,result

    def test_specific_subject_is_grounded_and_source_photo_is_comparison_only(self):
        source,result=self.fixture()
        selected={'image_url':'https://upload.wikimedia.org/photo.jpg','image_width':1600,'image_height':900,'image_subject':'Pristina road','image_caption':'Pristina road','image_rights':{'license':'CC0'}}
        with patch('news_image_policy.select_photo',return_value=selected) as select:
            photo=b.select_bota_photo(source,result)
            self.assertEqual(photo['imageUrl'],selected['image_url'])
            self.assertEqual(photo['imageRights'],selected['image_rights'])
            lead,evidence,_=select.call_args.args
            self.assertEqual(lead['photo_plan']['queries'],['Pristina road'])
            self.assertEqual(evidence['image_url'],source['imageUrl'])

    def test_unrelated_subject_and_missing_plan_never_fall_back_to_publisher_photo(self):
        source,result=self.fixture()
        for plan in [None,{'subject':'Football','subjectEvidence':'Invented football report'}, {'subject':'Example News','subjectEvidence':'Example News'}]:
            with patch('news_image_policy.select_photo') as select:
                self.assertEqual(b.select_bota_photo(source,{'photoPlan':plan}),{'imageUrl':None})
                select.assert_not_called()

    def test_no_cleared_candidate_keeps_the_article_without_a_photo(self):
        source,result=self.fixture()
        with patch('news_image_policy.select_photo',return_value={}):
            self.assertEqual(b.select_bota_photo(source,result),{'imageUrl':None})

if __name__=='__main__':unittest.main()
