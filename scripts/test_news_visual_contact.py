import hashlib
import os
import tempfile
import time
import unittest
from datetime import datetime,timedelta,timezone
from io import BytesIO
from pathlib import Path
from unittest.mock import patch

from PIL import Image
import news_visual_contact as contact
import news_image_policy as policy
import news_video_policy as video


def option(tier='fresh',url='https://upload.wikimedia.org/photo.jpg'):
    return {'tier':tier,'page':{},'photo':{'image_url':url,'image_subject':'Named person','image_caption':'Archive photo',
            'image_rights':{'provider':'wikimedia-commons','license':'CC0','license_url':policy.LICENSES['CC0']}}}


class VisualContactTests(unittest.TestCase):
    def setUp(self):contact._thumbnail.cache_clear()

    def test_bounded_shortlist_keeps_available_tiers_and_only_readable_pixels_get_numbers(self):
        options=[option(tier,f'https://upload.wikimedia.org/{tier}-{i}.jpg')
                 for tier in ('press','fresh','older','place','asset') for i in range(4)]
        chosen=contact.balanced_options(options)
        self.assertEqual(len(chosen),contact.MAX_VISIBLE)
        self.assertEqual({options[n-1]['tier'] for n in chosen},{'press','fresh','older','place','asset'})
        image=Image.new('RGB',(1600,1000),'green');buffer=BytesIO();image.save(buffer,format='JPEG');payload=buffer.getvalue()
        good,bad=option(),option(url='https://upload.wikimedia.org/bad.jpg')
        def fetch(url):
            if url.endswith('bad.jpg'):raise ValueError('unreadable image')
            return payload
        with tempfile.TemporaryDirectory() as folder,patch.object(policy,'photo_payload',side_effect=fetch):
            sheet,visible=contact.prepare({'story-001':{'options':[bad,good]}},Path(folder),0,time.monotonic()+10)
            self.assertEqual(visible,{'story-001':[2]})
            self.assertTrue(sheet.is_file());self.assertNotIn('_visual_source_sha256',bad)
            self.assertEqual(good['_visual_source_sha256'],hashlib.sha256(payload).hexdigest())
            proof=contact.attestation(good,sheet)
            rights={'sha256':good['_visual_source_sha256'],'visual_review':proof}
            self.assertTrue(contact.valid_record(rights))
            self.assertFalse(contact.valid_record({**rights,'sha256':'changed'}))
            for key,value in [('provider','openai'),('effort','low'),('model','other'),
                              ('reviewed_at',(datetime.now(timezone.utc)-timedelta(hours=2)).isoformat())]:
                self.assertFalse(contact.valid_record({**rights,'visual_review':{**proof,key:value}}))

    def test_expired_contact_does_not_download_or_offer_unseen_options(self):
        with tempfile.TemporaryDirectory() as folder,patch.object(contact,'_thumbnail') as download:
            self.assertEqual(contact.prepare({'story-001':{'options':[option()]}},Path(folder),0,time.monotonic()-1),
                             (None,{'story-001':[]}))
            download.assert_not_called()

    def test_sixteen_sparse_stories_keep_sixty_four_original_size_cells(self):
        buffer=BytesIO();Image.new('RGB',(1600,1000),'green').save(buffer,format='JPEG')
        by_id={f'story-{i:03d}':{'options':[option() for _ in range(4)]} for i in range(16)}
        with tempfile.TemporaryDirectory() as folder,patch.object(policy,'photo_payload',return_value=buffer.getvalue()):
            sheet,visible=contact.prepare(by_id,Path(folder),0,time.monotonic()+10)
            with Image.open(sheet) as image:self.assertEqual(image.size,(1600,1200))
        self.assertTrue(all(numbers==[1,2,3,4] for numbers in visible.values()))

    def test_finalization_requires_pixel_review_and_refuses_changed_source_bytes(self):
        item=option();item['_visual_review']={'policy':contact.POLICY,'provider':'openai-codex','model':'gpt-6-luna',
            'effort':'max','image_sha256':'a'*64,'contact_sheet_sha256':'c'*64,'reviewed_at':datetime.now(timezone.utc).isoformat()}
        with patch.dict(os.environ,{'L383_HOURLY_NEWS':'1'}),patch.object(policy,'photo_fingerprint',return_value=(1600,1000,'b'*64,123)):
            self.assertEqual(policy.finalize_photo({},item),{})
        with patch.dict(os.environ,{'L383_HOURLY_NEWS':'1'}),patch.object(policy,'photo_fingerprint',return_value=(1600,1000,'a'*64,123)):
            photo=policy.finalize_photo({},item)
            self.assertTrue(contact.valid_record(photo['image_rights']))
            with patch.object(policy,'trusted_photo',return_value=photo):self.assertEqual(policy.image_errors(photo),[])
            del item['_visual_review']
            self.assertEqual(policy.finalize_photo({},item),{})

    def test_video_posters_require_the_same_byte_bound_native_review(self):
        proof={'policy':contact.POLICY,'provider':'openai-codex','model':'gpt-6-luna',
               'effort':'max','image_sha256':'a'*64,'contact_sheet_sha256':'c'*64,
               'reviewed_at':datetime.now(timezone.utc).isoformat()}
        item={'tier':'video','name':'Named subject','video':{'video_id':'aaaaaaaaaaa',
              'title':'Named subject at the event','channel':'Official channel',
              'channel_id':'official','published':datetime.now(timezone.utc).isoformat()}}
        with patch.dict(os.environ,{'L383_HOURLY_NEWS':'1'}),patch.object(video,'embeddable',return_value=True), \
                patch.object(policy,'photo_fingerprint',return_value=(1280,720,'a'*64,0)):
            self.assertEqual(video.finalize_video({},item),{})
            item['_visual_review']=proof
            self.assertTrue(contact.valid_record(video.finalize_video({},item)['image_rights']))
            item['_visual_review']={**proof,'image_sha256':'b'*64}
            self.assertEqual(video.finalize_video({},item),{})
            item['_visual_review']={**proof,'provider':'other'}
            self.assertEqual(video.finalize_video({},item),{})


if __name__=='__main__':unittest.main()
