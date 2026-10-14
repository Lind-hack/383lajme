import test from 'node:test';
import assert from 'node:assert/strict';
import {approvedBotaImage,safeBotaImage} from './bota-image.mjs';
import {buildBotaSnapshot,validateBotaPublication} from './bota-publication.mjs';
const photo=()=>({imageUrl:'https://upload.wikimedia.org/wikipedia/commons/a/ab/Pristina_road.jpg',imageWidth:1600,imageHeight:900,imageSubject:'Pristina road',imageCaption:'Rruga në Prishtinë.',imageRights:{provider:'wikimedia-commons',source_page:'https://commons.wikimedia.org/wiki/File:Pristina_road.jpg',creator:'Test photographer',license:'CC BY 4.0',license_url:'https://creativecommons.org/licenses/by/4.0/',subject_evidence:'Pristina road',verified_at:new Date().toISOString(),sha256:'a'.repeat(64),distinct_from_source:true,source_images_checked:['https://publisher.example/news.jpg']}});
test('approved separate contextual photos keep their dimensions, licence and credit',()=>{
 const image=photo();assert.deepEqual(approvedBotaImage(image),image);
});
test('copied, unlicensed and incomplete photo evidence is rejected at publication',()=>{
 const mutations=[a=>a.imageUrl='https://publisher.example/news.jpg',a=>delete a.imageRights,a=>a.imageRights.distinct_from_source=false,a=>a.imageRights.license='CC BY-NC 4.0',a=>a.imageRights.license_url='https://example.org/claim',a=>a.imageRights.creator='',a=>a.imageCaption='',a=>a.imageRights.subject_evidence='',a=>a.imageWidth=100,a=>a.imageRights.sha256='bad',a=>a.imageRights.verified_at='bad',a=>a.imageRights.source_page='https://example.org/File:photo.jpg',a=>a.imageRights.source_images_checked=[a.imageUrl],a=>a.imageRights.source_images_checked=['https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Pristina_road.jpg/1200px-Pristina_road.jpg']];
 for(const change of mutations){const a=photo();change(a);assert.equal(approvedBotaImage(a),null);assert.equal(safeBotaImage(a).imageUrl,null);}
});
test('legacy photos disappear from snapshots without changing article counts or portrayal scores',()=>{
 const a={id:'a',country:'Britani',outlet:'Example',firstSeen:'2026-10-14',stanceVersion:5,sentiment:'neutral',imageUrl:'https://publisher.example/news.jpg'};
 const snapshot=buildBotaSnapshot([a],'2026-10-14');
 assert.equal(snapshot.outlets.totalArticles,1);assert.equal(snapshot.outlets.overallIndex,50);
 assert.equal(snapshot.outlets.countries.Britani.outlets[0].articles[0].imageUrl,null);
 assert.equal(a.imageUrl,'https://publisher.example/news.jpg');
});
test('publication rejects source photos, admits a cleared photo, and allows a photo-free article',()=>{
 const day='2026-10-14';const body=('Një tekst për testimin e leximit dhe publikimit në shqip, me fakte të verifikuara. ').repeat(12);
 const a={url:'https://publisher.example/kosovo',title:'Pristina road',albanianTitle:'Rruga në Prishtinë',outlet:'Example',country:'Britani',date:day,reason:'Raportim faktik.',blurb:'Një rrugë në Prishtinë.',sentiment:'neutral',evidence:'',paragraphs:[body,body],sourceHash:'a'.repeat(64),complete:true,actualModel:'gpt-6-luna',actualReasoningEffort:'xhigh'};
 const validate=(row)=>validateBotaPublication({date:day,model:'gpt-6-luna',reasoningEffort:'xhigh',articles:[row]},day).articles[0];
 assert.equal(validate(a).imageUrl,null);
 assert.throws(()=>validate({...a,imageUrl:'https://publisher.example/news.jpg'}),/reuse rights/);
 const result=validate({...a,...photo()});assert.equal(result.imageRights.creator,'Test photographer');assert.equal(result.imageCaption,'Rruga në Prishtinë.');
});
