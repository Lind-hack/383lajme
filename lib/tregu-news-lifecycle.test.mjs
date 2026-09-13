import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildRepricePlan } from './tregu-automation.mjs';
import { validateNewsProposition } from './tregu-news-contract.mjs';
import { containsNamedEntity } from './tregu-news-search.mjs';

const now = new Date('2026-09-13T10:00:00Z');
const market = {
  id:'ai', status:'open', category:'bote', market_type:'binary', market_classification:'general_news',
  question:'OpenAI dhe Anthropic do të nënshkruajnë një marrëveshje zyrtare për ngadalësimin e zhvillimit të AI-së?',
  slug:'openai-dhe-anthropic-do-te-nenshkruajne-nje-marreveshje-zyrt-20260913-1',
  q_yes:0, q_no:0, b:400, closes_at:'2026-11-12T05:20:40Z', source_article_slugs:[],
  pre_match_analysis:{contract_version:'news-event-v3',proposition:{
    entities:['OpenAI','Anthropic','Sam Altman','Dario Amodei'],
    decision:'A formal agreement to slow AI development', resolution_mode:'deadline_occurrence',
    yes_condition:'Joint formal agreement signed', no_condition:'Mungesa e një marrëveshjeje brenda afatit 60-ditor.',
    geography:'World',resolution_source:'Official company announcements',review_policy:'pause_for_review',
  }},
};
function article(slug='source-one', host='one.example') {
  return {slug,source:host,url:`https://${host}/${slug}`,category:'Shqipëri',publishedAt:'2026-09-13T08:00:00Z',
    title:'Amodei kërkon ngadalësim të AI-së, Altman e mbështet',excerpt:'Kompanitë diskutojnë një pakt sigurie.',
    body:'OpenAI and Anthropic are discussing an agreement to slow down advanced AI development. The statement describes negotiations, not a signed agreement. Both companies say discussions are continuing and no binding commitment has yet been announced publicly by either company.'};
}
function plan(articles) {return buildRepricePlan({markets:[market],verifiedArticles:articles,now})[0];}
test('contract entities admit relevant coverage across newsroom categories',()=>{
  assert.equal(plan([article()]).evidence.length,1);
  assert.equal(plan([{...article(),title:'OpenAI launches a phone',excerpt:'New hardware',body:'OpenAI and Anthropic publish phone specifications. '.repeat(15)}]).evidence.length,0);
});
test('positive and negative evidence move the same market in opposite bounded directions',()=>{
  const item=plan([article()]);
  assert.equal(item.scoreSuccess({probability:.8,cited_slugs:['source-one']}).snapshot.market_prob,.52);
  assert.equal(item.scoreSuccess({probability:.2,cited_slugs:['source-one']}).snapshot.market_prob,.48);
});
test('only corroborated final outcomes request settlement; high odds alone do not',()=>{
  const item=plan([article(),article('source-two','two.example')]);
  const score={probability:1,evidence_level:'decisive',resolution_action:'settle_po',cited_slugs:['source-one','source-two']};
  assert.equal(item.scoreSuccess(score).settlement.outcome,'PO');
  assert.equal(item.scoreSuccess({...score,probability:0,resolution_action:'settle_jo'}).settlement.outcome,'JO');
  assert.equal(item.scoreSuccess({...score,resolution_action:'unresolved'}).settlement,undefined);
  assert.equal(plan([article()]).scoreSuccess(score).settlement,undefined);
  assert.equal(plan([article(),article('source-two')]).scoreSuccess(score).settlement,undefined);
  assert.equal(plan([article(),{...article('source-two','two.example'),truncated:true}]).scoreSuccess(score).settlement,undefined);
  assert.throws(()=>item.scoreSuccess({...score,probability:NaN}),/Non-finite/);
});

test('legacy bilateral matching requires named parties, not dates and slug suffixes',()=>{
  const legacy={...market,pre_match_analysis:null,question:'Rusia dhe Ukraina do të nënshkruajnë armëpushim brenda shtatorit?',slug:'rusia-dhe-ukraina-armepushim-20260913-1'};
  const report={...article(),category:'Botë',title:'Russia and Ukraine discuss ceasefire',excerpt:'Peace talks continue.',body:'Russia and Ukraine are discussing a ceasefire agreement. '.repeat(10)};
  assert.equal(buildRepricePlan({markets:[legacy],verifiedArticles:[report],now})[0].evidence.length,1);
  assert.equal(buildRepricePlan({markets:[legacy],verifiedArticles:[{...report,title:'Russia proposes ceasefire',body:'Russia proposes a ceasefire. '.repeat(10)}],now})[0].evidence.length,0);
});
test('absence by a deadline cannot masquerade as an event-pair contract',()=>{
  assert.equal(validateNewsProposition({proposition:market.pre_match_analysis.proposition}),null);
  assert.equal(validateNewsProposition({proposition:{...market.pre_match_analysis.proposition,resolution_mode:'event_pair'}}),'event_pair_requires_explicit_negative_outcome');
  assert.equal(validateNewsProposition({proposition:{...market.pre_match_analysis.proposition,resolution_mode:'event_pair',no_condition:'Pa marrëveshje deri më 1 nëntor'}}),'event_pair_requires_explicit_negative_outcome');
});
test('entity boundaries distinguish Iran from Tirana and keep country acronyms',()=>{
  assert.equal(containsNamedEntity('Tirana agrees to the proposal','Iran'),false);
  assert.equal(containsNamedEntity('Iran agrees to the proposal','Iran'),true);
  assert.equal(containsNamedEntity('EU announces agreement','EU'),true);
  assert.equal(containsNamedEntity('Help us decide','US'),false);
});
