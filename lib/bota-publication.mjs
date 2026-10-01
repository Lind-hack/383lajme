import { createHash } from 'node:crypto';

export const BOTA_VERSION = 5;
export const botaArticleId = url => createHash('sha256').update(url).digest('hex');
export const kosovoDay = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Belgrade' }).format(new Date());
export function validateBotaPublication(input, today = kosovoDay()) {
  if (input?.date !== today || input?.model !== 'gpt-6-luna' || input?.reasoningEffort !== 'xhigh') throw new Error('Current Kosovo date and exact GPT-6 Luna/xhigh provenance required.');
  if (!Array.isArray(input.articles) || input.articles.length < 1 || input.articles.length > 50) throw new Error('Publish 1–50 fully translated articles.');
  const ids = new Set();
  const articles = input.articles.map(a => {
    const u = new URL(a.url);
    if (u.protocol !== 'https:' || u.username || u.password || u.port || /^(localhost|127\.|10\.|192\.168\.|169\.254\.|\[)/.test(u.hostname)) throw new Error('An original public HTTPS publisher URL is required.');
    const id = botaArticleId(a.url);
    if (ids.has(id)) throw new Error('Duplicate publisher article.'); ids.add(id);
    if (!['positive','neutral','negative'].includes(a.sentiment)) throw new Error('Invalid portrayal rating.');
    for (const [key, max] of [['title',500],['albanianTitle',500],['outlet',150],['country',100],['reason',1200],['blurb',700]]) {
      if (typeof a[key] !== 'string' || !a[key].trim() || a[key].length > max) throw new Error(`Invalid ${key}.`);
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(a.date) || a.date > today || a.date < new Date(Date.parse(today+'T00:00:00Z')-7*86400000).toISOString().slice(0,10)) throw new Error('Article is outside the current seven-day discovery window.');
    if (!Array.isArray(a.paragraphs) || a.paragraphs.length < 2 || a.paragraphs.length > 120 || a.paragraphs.some(p=>typeof p !== 'string' || !p.trim() || p.length > 12000) || a.paragraphs.join(' ').split(/\s+/).length < 120 || a.paragraphs.join(' ').length > 100000) throw new Error('A complete translated article body is required.');
    if (!/^[a-f0-9]{64}$/.test(a.sourceHash) || a.complete !== true || a.actualModel !== 'gpt-6-luna' || a.actualReasoningEffort !== 'xhigh') throw new Error('Verified full-text/model provenance required.');
    if (typeof a.evidence !== 'string' || a.evidence.split(/\s+/).filter(Boolean).length > 20) throw new Error('Evidence must be a short attributed excerpt.');
    let imageUrl=null;
    if(typeof a.imageUrl==='string' && a.imageUrl.length<3000){try{const image=new URL(a.imageUrl);if(image.protocol==='https:'&&!image.username&&!image.password)imageUrl=image.toString();}catch{/* Missing photo does not invalidate an article. */}}
    return {id,url:a.url,title:a.title,albanianTitle:a.albanianTitle,outlet:a.outlet,country:a.country,date:a.date,firstSeen:today,sentiment:a.sentiment,reason:a.reason,blurb:a.blurb,evidence:a.evidence,paragraphs:a.paragraphs,sourceHash:a.sourceHash,imageUrl,stanceVersion:BOTA_VERSION,model:a.actualModel,reasoningEffort:a.actualReasoningEffort};
  });
  return {date:today,model:input.model,reasoningEffort:input.reasoningEffort,articles};
}

export function buildBotaSnapshot(articles, day) {
  const countries = {};
  for (const a of articles) {
    if (a.stanceVersion !== BOTA_VERSION) continue;
    const slot = countries[a.country] ??= {outlets:[], summary:null};
    let outlet = slot.outlets.find(o=>o.name===a.outlet);
    if (!outlet) slot.outlets.push(outlet={name:a.outlet,articles:[],articleCount:0,sentiment:'neutral'});
    const {paragraphs,sourceHash,model,reasoningEffort,...card}=a;
    outlet.articles.push({...card,readerUrl:`/bota-per-kosoven/artikull/${a.id}`});outlet.articleCount++;
  }
  const summary = rows => {
    const n=rows.length;const positive=rows.filter(a=>a.sentiment==='positive').length;const negative=rows.filter(a=>a.sentiment==='negative').length;const neutral=n-positive-negative;
    return {index:n?Math.round(50+50*(positive-negative)/(positive+negative+3)):null,positive,negative,neutral,n,sourceCount:new Set(rows.map(a=>a.outlet)).size,confident:n>=3,excluded:0,stanceVersion:BOTA_VERSION};
  };
  const todays=articles.filter(a=>a.firstSeen===day && a.stanceVersion===BOTA_VERSION);
  for (const [country,slot] of Object.entries(countries)) {
    const rows=todays.filter(a=>a.country===country),s=summary(rows);
    slot.summary={...s,positive:s.n?Math.round(s.positive*100/s.n):0,negative:s.n?Math.round(s.negative*100/s.n):0,neutral:s.n?Math.round(s.neutral*100/s.n):0};
  }
  const days=[...new Set(articles.filter(a=>a.stanceVersion===BOTA_VERSION).map(a=>a.firstSeen))].sort();
  const history=days.map(date=>{const rows=articles.filter(a=>a.firstSeen===date && a.stanceVersion===BOTA_VERSION);const s=summary(rows);return {date,stanceVersion:BOTA_VERSION,overallIndex:s.index,totalArticles:s.n,sourceCount:s.sourceCount,day:{...s,unknown:0},headlines:rows.slice(0,8).map(a=>({title:a.albanianTitle,source:a.outlet,country:a.country,flag:'',url:`/bota-per-kosoven/artikull/${a.id}`,sentiment:a.sentiment})),countries:Object.fromEntries(Object.keys(countries).map(c=>[c,summary(rows.filter(a=>a.country===c))]))};});
  const overall=summary(todays);
  return {outlets:{lastUpdated:day,overallIndex:overall.index,totalArticles:overall.n,sourceCount:overall.sourceCount,stanceVersion:BOTA_VERSION,countries},history};
}
