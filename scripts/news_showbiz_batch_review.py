"""Review complete articles and labelled publisher-page or source-image pixels in small batches."""
import hashlib
import json
import time
from pathlib import Path
from PIL import Image,ImageDraw,ImageOps
from news_model import ask_rows


def native_batch_review(brief,image,deadline):
    from news_story_review import editorial_prompt
    prompt=editorial_prompt().replace('Return one JSON object in an array','Return one JSON object per supplied review_id in an array').replace('{decision:','{review_id: string, decision:')
    prompt+=' Judge EACH story separately against its own complete text and labelled visual evidence. Return every supplied review_id exactly once. A strong story must not rescue a weak sibling; compare only the supplied related articles for that story.'
    return ask_rows(prompt,brief,['--provider','openai-codex','--model','gpt-6-luna','--ignore-rules',
        '-t','none','--yolo','--max-turns','1','-Q','-q'],timeout=180,deadline=deadline,image_path=image)


def review_batch(items,folder,index,deadline,now,reviewer):
    from news_story_review import story_id,validate_verdict
    records={lead['url']:record for lead,record in items}
    root=Path(folder)/'batches';root.mkdir(exist_ok=True)
    try:
        if time.monotonic()>=deadline:raise TimeoutError('review deadline before batch dispatch')
        payload=[]
        for lead,record in items:
            payload.append({'review_id':story_id(lead['url']),**json.loads(Path(record['review_brief']).read_text(encoding='utf-8'))})
        data=json.dumps(payload,ensure_ascii=False,indent=2)
        if len(data.encode('utf-8'))>85000:raise ValueError('complete article context exceeds safe batch limit; no text truncated')
        width,height=1440,550
        sheet=Image.new('RGB',(width*min(2,len(items)),height*((len(items)+1)//2)),'white')
        draw=ImageDraw.Draw(sheet)
        for n,(lead,record) in enumerate(items):
            x=(n%2)*width;y=(n//2)*height
            kind=record.get('capture',{}).get('visual_evidence_kind')
            label='original article image; no page layout' if kind in {'source_article_image','source_article_photo'} else 'publisher page capture'
            draw.text((x+8,y+5),story_id(lead['url'])+' | '+lead['source']+' | '+label,fill='black')
            with Image.open(record['review_image']) as original:
                sheet.paste(ImageOps.contain(original.convert('RGB'),(width,height-28)),(x,y+28))
        import io
        buffer=io.BytesIO();sheet.save(buffer,format='PNG');pixels=buffer.getvalue()
        digest=hashlib.sha256(pixels).hexdigest()
        image=root/f'pages-{index}-{digest[:16]}.png';image.write_bytes(pixels)
        brief=root/f'brief-{index}-{digest[:16]}.json';brief.write_text(data,encoding='utf-8')
        rows=reviewer(brief,image,deadline)
        allowed={item['review_id'] for item in payload}
        if not isinstance(rows,list) or any(not isinstance(r,dict) or r.get('review_id') not in allowed for r in rows):
            raise ValueError('batch reviewer returned an unknown story identity')
        for (lead,record),source in zip(items,payload):
            matches=[r for r in rows if r['review_id']==source['review_id']]
            try:
                record['review']=validate_verdict(matches,lead,source['related_articles'],record['capture'],now)
                record.update(status='reviewed',error='',review_image=str(image.resolve()),review_image_sha256=digest)
            except ValueError as exc:record.update(status='pending_review',error=str(exc))
    except Exception as exc:
        for record in records.values():record.update(status='pending_review',error=type(exc).__name__+': '+str(exc)[:300])
    for url,record in records.items():
        (Path(folder)/'articles'/story_id(url)/'review.json').write_text(json.dumps(record,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print('383 SHOWBIZ BATCH '+json.dumps({'stories':len(items),'reviewed':sum(r['status']=='reviewed' for r in records.values())}),flush=True)
    return records
