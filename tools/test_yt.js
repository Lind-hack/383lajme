const https = require('https');
const NEWS_BLOCK = [
  // International
  'euronews','cnn','bbc','reuters','ap news','associated press',
  'sky news','al jazeera','fox news','msnbc','nbc news','abc news',
  'cbs news','france 24','dw news','bloomberg','channel 4',
  'itv news','rt ','rt.com','cgtn','trt world','wion','ndtv',
  'times now','nhk world','arirang','inside edition','vice news',
  'the guardian','independent','afp','politico','axios',
  'wall street journal','washington post','new york times','forbes',
  'business insider','cnbc','the economist','time magazine','newsweek',
  'vox','vox media','vice','the atlantic','the intercept','slate',
  // Albanian / Kosovo
  'euronews albania','klan','rtv klan','top channel','a2 cnn','ora news',
  'report tv','abc news albania','nsmtv','pamfleti','tvsh','rtk','bbc shqip',
  'zeri','koha','shekulli','news 24','tv 7','jeta ne kosove','express',
  'vizion plus','balkan insight','birn','n1 info','nova tv','pink tv',
  'prva tv','rts ','radio free europe','rfe/rl','crux','drm news',
  'new china tv','shanghaieye','times now','cgtn','aptn','apt news',
];
function isNews(name) { return NEWS_BLOCK.some(b => name.toLowerCase().includes(b)); }

const q = process.argv[2] || 'Vucic Kosovo China';
console.log('Query:', q);
https.get('https://www.youtube.com/results?search_query=' + encodeURIComponent(q),
  { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' } },
  (res) => {
    let data = '';
    res.on('data', d => data += d);
    res.on('end', () => {
      const re = /"videoRenderer":\{/g;
      let m, i = 0, firstOK = null;
      while ((m = re.exec(data)) !== null && i < 15) {
        i++;
        const chunk = data.slice(m.index, m.index + 8000);
        const vid = chunk.match(/"videoId":"([A-Za-z0-9_-]{11})"/);
        const ch = chunk.match(/"ownerText":\{"runs":\[\{"text":"([^"]+)"/);
        if (vid) {
          const channel = ch ? ch[1] : '?';
          const blocked = isNews(channel);
          if (!blocked && !firstOK) firstOK = vid[1] + ' | ' + channel;
          console.log(i + ': ' + vid[1] + ' | ' + channel + (blocked ? '  BLOCKED' : '  OK'));
        }
      }
      console.log('\nFirst non-news result:', firstOK ?? 'NONE (returns null)');
    });
  }).on('error', console.error);
