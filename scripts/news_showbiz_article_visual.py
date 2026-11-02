"""Complete public HTML text plus the publisher's actual article photograph.

This is explicitly a photo capture, never a reconstructed publisher-page layout.
"""
import hashlib
import json
from datetime import datetime,timezone
from io import BytesIO
from pathlib import Path
from PIL import Image,ImageOps
from read_news_source import fetch_public,extract
from news_ingestion_protocol import owned
from news_story_attention import linked_posts


def capture_article_photo(url,publisher,folder,*,fetcher=fetch_public,image_fetcher=None,public_evidence=None):
    from news_image_policy import article_photo_options,photo_payload
    from news_homepage_priority import homepage_article_identity
    image_fetcher=image_fetcher or photo_payload
    folder=Path(folder);folder.mkdir(parents=True,exist_ok=True)
    checked=datetime.now(timezone.utc).isoformat()
    evidence=None;posts=[]
    try:
        age=(datetime.now(timezone.utc)-datetime.fromisoformat(public_evidence['fetched_at'])).total_seconds()
        if (0<=age<=3600 and public_evidence.get('status')=='text_extracted' and not public_evidence.get('truncated')
                and owned(public_evidence['url'],publisher)
                and homepage_article_identity(public_evidence.get('requested_url',public_evidence['url']))==homepage_article_identity(url)):
            evidence=dict(public_evidence);posts=evidence.get('linked_social_posts',[])
    except (TypeError,KeyError,ValueError):pass
    if evidence is None:
        response=fetcher(url,max_bytes=8_000_000)
        if not owned(response['url'],publisher):raise ValueError('article redirected outside its publisher')
        evidence=extract(response['payload'],response['url'],max_text_chars=None)
        evidence['fetched_at']=checked
        evidence['requested_url']=url
        posts=linked_posts(response['payload'],response['url'])
    if evidence.get('status')!='text_extracted' or evidence.get('truncated'):
        raise ValueError('complete public article text unavailable: '+str(evidence.get('status')))
    options=article_photo_options({'category':'Showbiz','url':url,'title':evidence.get('title','')},evidence)
    errors=[]
    for option in options:
        try:
            image_url=option['photo']['image_url'];raw=image_fetcher(image_url)
            with Image.open(BytesIO(raw)) as original:
                dimensions=original.size
                if original.width<300 or original.height<200 or original.width*original.height>50_000_000:
                    raise ValueError('source photo dimensions unsuitable')
                photo=ImageOps.contain(ImageOps.exif_transpose(original).convert('RGB'),(1440,1000))
                screenshot=folder/'source-article-photo.png';photo.save(screenshot)
            sha=hashlib.sha256(screenshot.read_bytes()).hexdigest()
            record={'url':url,'resolved_url':evidence['url'],'captured_at':checked,'evidence':evidence,
                'method':'public_html_and_original_article_image','visual_evidence_kind':'source_article_image',
                'source_image_url':image_url,'source_image_sha256':hashlib.sha256(raw).hexdigest(),
                'source_image_dimensions':dimensions,'screenshot':str(screenshot.resolve()),'screenshot_sha256':sha,
                'full_screenshot':str(screenshot.resolve()),'full_screenshot_sha256':sha,
                'visual_layout_complete':False,'visual_page_complete':False,'article_text_visible':False,
                'complete_public_text':True,'linked_social_posts':posts}
            (folder/'capture.json').write_text(json.dumps(record,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
            return record
        except Exception as exc:errors.append(type(exc).__name__)
    raise ValueError('original article photo unavailable: '+','.join(errors))
