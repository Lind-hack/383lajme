import test from 'node:test';
import assert from 'node:assert/strict';
import {botaArticleId,validateBotaPublication,buildBotaSnapshot} from './bota-publication.mjs';
const day='2026-10-01';
const paragraph=('Një tekst provues i shkruar vetëm për testimin e përkthimit dhe leximit në faqen e Kosovës. ').repeat(8);
const article={url:'https://example.org/kosovo',title:'Kosovo reporting',albanianTitle:'Raportimi për Kosovën',outlet:'Test publication',country:'Britani',date:day,reason:'Raportim faktik pa gjuhë armiqësore.',blurb:'Artikulli paraqet faktet.',sentiment:'neutral',evidence:'',paragraphs:[paragraph,paragraph],sourceHash:'a'.repeat(64),complete:true,actualModel:'gpt-6-luna',actualReasoningEffort:'xhigh'};
const packet=()=>({date:day,model:'gpt-6-luna',reasoningEffort:'xhigh',articles:[structuredClone(article)]});

test('100 distinct translations are accepted, 101 rejected; country and minimum counts are truthful',()=>{
 const p=packet();p.articles=Array.from({length:100},(_,i)=>({...article,url:`https://example.org/kosovo/${i}`,country:i%2?'Indi':'Serbi'}));
 const s=buildBotaSnapshot(validateBotaPublication(p,day).articles,day);
 assert.equal(s.outlets.totalArticles,100);assert.equal(s.outlets.countryCount,2);assert.equal(s.outlets.dailyTarget.met,true);
 p.articles.push({...article,url:'https://example.org/overflow'});assert.throws(()=>validateBotaPublication(p,day),/1–100/);
 assert.equal(buildBotaSnapshot(validateBotaPublication(packet(),day).articles,day).outlets.dailyTarget.met,false);
});
test('publication needs complete translated bodies and exact model/date provenance',()=>{
 const p=packet();const result=validateBotaPublication(p,day);assert.equal(result.articles[0].id,botaArticleId(article.url));
 for(const change of [p=>p.date='2026-09-30',p=>p.model='gpt-6.1-sol',p=>p.articles[0].actualReasoningEffort='high',p=>p.articles[0].paragraphs=['summary'],p=>p.articles[0].complete=false,p=>p.articles[0].date='2020-01-01',p=>p.articles.push(p.articles[0])]){const bad=packet();change(bad);assert.throws(()=>validateBotaPublication(bad,day));}
});
test('new portrayal snapshots exclude legacy event scores, retain neutral counts and on-site readers',()=>{
 const current=validateBotaPublication(packet(),day).articles;
 const snapshot=buildBotaSnapshot([...current,{...current[0],id:'b'.repeat(64),sentiment:'negative',stanceVersion:4}],day);
 assert.equal(snapshot.outlets.totalArticles,1);assert.equal(snapshot.history[0].day.neutral,1);assert.equal(snapshot.history[0].overallIndex,50);
 const card=snapshot.outlets.countries.Britani.outlets[0].articles[0];assert.equal(card.readerUrl,`/bota-per-kosoven/artikull/${current[0].id}`);assert.equal(card.paragraphs,undefined);assert.equal(card.sourceHash,undefined);
});
test('history preserves separate daily counts and does not blend yesterday into today',()=>{
 const current=validateBotaPublication(packet(),day).articles[0];const old={...current,id:'b'.repeat(64),firstSeen:'2026-09-30',sentiment:'negative'};
 const s=buildBotaSnapshot([old,current],day);assert.equal(s.history.length,2);assert.equal(s.history[0].day.negative,1);assert.equal(s.history[1].day.neutral,1);assert.equal(s.outlets.totalArticles,1);
});
