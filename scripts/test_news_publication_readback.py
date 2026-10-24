import copy
import unittest

from news_publication_readback import verify_rows


def rows():
    return [{'id':str(i), 'slug':f'story-{i}', 'category':category, 'body':f'Own reporting {i}',
             'image_url':f'https://images.example/photo-{i}.jpg', 'image_width':1600, 'image_height':1000,
             'published_at':'2026-10-24T18:00:00+02:00',
             'raw_article':{'image_rights':{'creator':'Photographer','license':'CC BY 4.0'},
                            'image_subject':f'Subject {i}', 'image_caption':'Dated photo'}}
            for i,category in enumerate(('Sport','Ekonomi'),1)]


class PublicationReadbackTests(unittest.TestCase):
    def test_exact_id_associations_content_category_and_photo_provenance_are_required(self):
        expected = rows()
        verify_rows(expected, copy.deepcopy(expected), 'slot')
        for field,value in [('slug','story-2'),('category','Showbiz'),('body','Different claims'),
                            ('image_url','https://images.example/chart.jpg'),('image_width',900),('image_height',400)]:
            saved=copy.deepcopy(expected);saved[0][field]=value
            if field=='slug':saved[1]['slug']='story-1'
            with self.subTest(field=field), self.assertRaises(RuntimeError):verify_rows(expected,saved,'slot')
        for field,value in [('image_caption','Today'),('image_subject','Someone else'),('image_rights',{'license':'Unknown'})]:
            saved=copy.deepcopy(expected);saved[0]['raw_article'][field]=value
            with self.subTest(field=field), self.assertRaises(RuntimeError):verify_rows(expected,saved,'slot')

    def test_wire_timezone_normalization_is_allowed_but_raw_provenance_stays_exact(self):
        expected=rows();saved=copy.deepcopy(expected)
        saved[0]['published_at']='2026-10-24T16:00:00.000000Z'
        verify_rows(expected,saved,'slot')
        saved[0]['published_at']='2026-10-24T17:00:00Z'
        with self.assertRaises(RuntimeError):verify_rows(expected,saved,'slot')

    def test_missing_extra_or_repeated_database_rows_fail(self):
        expected=rows()
        for saved in (expected[:1],expected+[expected[0]],expected+[dict(expected[0],id='extra')]):
            with self.assertRaises(RuntimeError):verify_rows(expected,saved,'slot')


if __name__=='__main__':unittest.main()
