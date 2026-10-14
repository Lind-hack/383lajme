import unittest
from unittest.mock import patch,Mock
import bota_repair_photos as b

class RepairTests(unittest.TestCase):
    def article(self):return {'id':'a'*64,'sourceHash':'b'*64,'url':'https://publisher.example/article','title':'Pristina road','outlet':'Example','paragraphs':['Pristina road is being upgraded.'],'imageUrl':'https://publisher.example/copied.jpg'}
    def photo(self):return {'imageUrl':'https://upload.wikimedia.org/photo.jpg','imageRights':{'license':'CC0'},'imageSubject':'Pristina road'}
    def test_patch_contains_photo_and_identity_only_not_article_text(self):
        with patch.object(b,'fetch_source',side_effect=ValueError()),patch.object(b,'editorial_request',return_value=({'photoPlan':{}},{})),patch.object(b,'select_bota_photo',return_value=self.photo()),patch.object(b.httpx,'patch') as request:
            request.return_value.json.return_value={'updated':True}
            result=b.repair_one(self.article(),{},{});self.assertEqual(result['status'],'updated')
            packet=request.call_args.kwargs['json']
            self.assertEqual(packet['sourceHash'],'b'*64);self.assertNotIn('paragraphs',packet);self.assertNotIn('title',packet)
    def test_no_cleared_photo_and_dry_run_never_write(self):
        for photo in [{'imageUrl':None},self.photo()]:
            with patch.object(b,'fetch_source',side_effect=ValueError()),patch.object(b,'editorial_request',return_value=({'photoPlan':{}},{})),patch.object(b,'select_bota_photo',return_value=photo),patch.object(b.httpx,'patch') as request:
                b.repair_one(self.article(),{}, {},dry_run=True);request.assert_not_called()
    def test_empty_page_of_cleared_photos_does_not_hide_later_candidates(self):
        pages=[{'articles':[],'after':'a'*64,'hasMore':True},{'articles':[self.article()],'after':'b'*64,'hasMore':False}]
        def get(*args,**kwargs):response=Mock();response.json.return_value=pages.pop(0);return response
        with patch.object(b,'secret',return_value='test'),patch.object(b,'resolve_runtime',return_value={}),patch.object(b.httpx,'get',side_effect=get) as read,patch.object(b,'repair_one',return_value={'status':'updated'}):
            summary=b.run();self.assertEqual(summary['updated'],1)
            self.assertEqual(read.call_args.kwargs['params'],{'after':'a'*64})
    def test_failed_requests_cannot_report_a_successful_repair(self):
        response=Mock();response.json.return_value={'articles':[self.article()],'hasMore':False}
        with patch.object(b,'secret',return_value='test'),patch.object(b,'resolve_runtime',return_value={}),patch.object(b.httpx,'get',return_value=response),patch.object(b,'repair_one',side_effect=RuntimeError()):
            self.assertEqual(b.run()['status'],'failed')

if __name__=='__main__':unittest.main()
