import json
from pathlib import Path
import tempfile
import unittest

from news_model_response import save_response


class WriterSourceIdentityTests(unittest.TestCase):
    def setUp(self):
        folder=tempfile.TemporaryDirectory(); self.addCleanup(folder.cleanup)
        self.root=Path(folder.name); self.batch=self.root/'batch.json'; self.manifest=self.root/'sources.json'
        self.url='https://top-channel.tv/2026/10/24/a-verified-complete-source-story-ne-oborr'
        self.records=[{'pair_id':'Shqipëri-04','category':'Shqipëri','url':self.url},
                      {'pair_id':'Shqipëri-05','category':'Shqipëri','url':'https://rtsh.al/another-prepared-story'}]
        self.manifest.write_text(json.dumps(self.records),encoding='utf-8')
        self.article={'source_pair_id':'Shqipëri-04','category':'Shqipëri','url':self.url,
                      'title':'Test title','body':'Exact unreviewed copy','slug':'test-story'}
        self.batch.write_text('[{"existing":"preserve"}]',encoding='utf-8')

    def save(self, article, mode='replace'):
        return save_response('383_JSON_BEGIN '+json.dumps([article])+' 383_JSON_END',self.batch,mode,self.manifest)

    def test_known_short_identity_recovers_truncated_url_without_changing_prose(self):
        row={**self.article,'url':self.url.removesuffix('-ne-oborr')}
        self.assertEqual(self.save(row),1)
        actual=json.loads(self.batch.read_text())[0]
        self.assertEqual(actual,{k:v for k,v in self.article.items() if k!='source_pair_id'})
        self.assertEqual(row['url'],self.url.removesuffix('-ne-oborr'))

    def test_known_identity_can_resolve_a_missing_url(self):
        row={k:v for k,v in self.article.items() if k!='url'}
        self.save(row)
        self.assertEqual(json.loads(self.batch.read_text())[0]['url'],self.url)

    def test_old_response_requires_exact_prepared_url_and_category(self):
        row={k:v for k,v in self.article.items() if k!='source_pair_id'}
        self.save(row)
        before=self.batch.read_bytes()
        with self.assertRaises(ValueError): self.save({**row,'url':self.url.removesuffix('-ne-oborr')})
        self.assertEqual(self.batch.read_bytes(),before)

    def test_unknown_identity_wrong_category_and_conflicting_urls_fail_closed(self):
        for change in ({'source_pair_id':'unknown'}, {'source_pair_id':[]}, {'category':'Kosovë'},
                       {'url':'https://rtsh.al/another-prepared-story'}, {'url':'https://unknown.example/story'},
                       {'url':'https://top-channel.tv/a-different-story'}, {'url':'https://top-channel.tv'}):
            before=self.batch.read_bytes()
            with self.subTest(change=change),self.assertRaises(ValueError):self.save({**self.article,**change})
            self.assertEqual(self.batch.read_bytes(),before)

    def test_manifest_cannot_cross_categories_or_repeat_an_identity(self):
        for records in ([{**self.records[0],'category':'Kosovë'}], [self.records[0],self.records[0]], []):
            self.manifest.write_text(json.dumps(records),encoding='utf-8')
            before=self.batch.read_bytes()
            with self.assertRaises(ValueError):self.save(self.article)
            self.assertEqual(self.batch.read_bytes(),before)

    def test_resolution_never_changes_approved_editor_or_append_records(self):
        for mode in ('append','editor','editor-decisions'):
            before=self.batch.read_bytes()
            with self.assertRaises(ValueError):self.save(self.article,mode)
            self.assertEqual(self.batch.read_bytes(),before)
