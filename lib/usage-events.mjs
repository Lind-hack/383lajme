export const FEATURES = {
  home: 'Homepage', tregu: 'Tregu', perty: 'Për Ty', quiz: 'Quiz', bota: 'Bota për Kosovën',
  dosje: 'Dosje', search: 'Search', xhep: 'Kosova në Xhep', visit: 'Visit / travel',
  articles: 'Articles', categories: 'News categories', video: 'Video', other: 'Other pages',
};
const routes = { tregu: 'tregu', 'per-ty': 'perty', kuiz: 'quiz', 'bota-per-kosoven': 'bota',
  dosje: 'dosje', kerko: 'search', xhep: 'xhep', visit: 'visit', article: 'articles',
  kategori: 'categories', video: 'video' };
export const BUTTONS = {
  menu_open: ['Open menu', 'hap menunë'], menu_close: ['Close menu', 'mbyll menunë'],
  search_open: ['Open search', 'kërko', 'kerko'], share: ['Share', 'ndaje', 'shpërndaje'],
  like: ['Like', 'pëlqej'], react: ['React', 'reago'], comment: ['Comment', 'komento'],
  save: ['Save', 'ruaj', 'ruaje'], more: ['Load more', 'më shumë', 'shiko më shumë'],
  video_play: ['Play video', 'luaj'], video_pause: ['Pause video', 'ndalo'],
  video_close: ['Close video', 'mbyll videon'], video_next: ['Next video', 'videoja tjetër', 'videot e tjera'],
  video_previous: ['Previous video', 'videoja e mëparshme', 'videot e mëparshme'],
  video_sound: ['Enable sound', 'aktivizo zërin'], yes: ['Choose yes', 'po'], no: ['Choose no', 'jo'],
  buy: ['Buy / predict', 'blej', 'parashiko'], sell: ['Sell', 'shit'],
  confirm: ['Confirm', 'konfirmo'], cancel: ['Cancel', 'anulo'], close: ['Close', 'mbyll'],
  next: ['Next', 'vazhdo', 'tjetra', 'tjetër'], previous: ['Previous', 'mbrapa'],
  refresh: ['Refresh', 'rifresko'], filter: ['Filter', 'filtro', 'filtrat'],
  bonus: ['Claim bonus', 'merr bonusin'], reset: ['Reset', 'rivendos'],
  download: ['Download', 'shkarko'], other: ['Other button'],
  quiz_answer: ['Answer quiz'], quiz_next: ['Next quiz question', 'pyetja tjetër'],
};
export function publicPath(value) {
  if (typeof value !== 'string' || value.length > 600) return null;
  try {
    const url = new URL(value, 'https://383ks.com');
    if (!['383ks.com', 'www.383ks.com'].includes(url.hostname) || !['http:', 'https:'].includes(url.protocol)) return null;
    const path = url.pathname;
    if (path.length > 180 || /^\/(admin|api|auth|hyr|profili)(\/|$)/.test(path)) return null;
    if (/^\/visit\/r\/[^/]+/.test(path)) return '/visit/r/[invite]';
    if (/^\/gazeta\/[^/]+/.test(path)) return '/gazeta/[paper]';
    if (/^\/xhep\/rooms\/[^/]+/.test(path)) return '/xhep/rooms/[invite]';
    return path;
  } catch { return null; }
}
export function featureForPath(path) {
  if (!path || path === '/') return 'home';
  return routes[path.split('/')[1]] || 'other';
}
export function buttonAction(label) {
  const text = String(label || '').toLowerCase().trim().replace(/\s+/g, ' ');
  if (/^po(?:\s|$)/.test(text)) return 'button:yes';
  if (/^jo(?:\s|$)/.test(text)) return 'button:no';
  if (/^blej(?:\s|$)/.test(text)) return 'button:buy';
  if (/^shit(?:\s|$)/.test(text)) return 'button:sell';
  if (/^(ndaj|ndaje|shpërndaj|shpërndaje)(?:\s|$)/.test(text)) return 'button:share';
  const key = Object.keys(BUTTONS).find(k => k === text || BUTTONS[k].some(v => v.toLowerCase() === text));
  return `button:${key || 'other'}`;
}
const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
export function parseUsageBatch(body) {
  if (!body || body.consent !== 'granted' || !uuid(body.visitor) || !uuid(body.session) ||
      !Array.isArray(body.events) || body.events.length < 1 || body.events.length > 20) return null;
  const events = [];
  for (const input of body.events) {
    if (!input || !uuid(input.id) || !['page', 'click', 'active'].includes(input.kind)) return null;
    const path = publicPath(input.path);
    if (!path) return null;
    let action = null, target_path = null;
    if (input.kind === 'click') {
      if (input.action === 'link') {
        action = 'link';
        target_path = publicPath(input.target);
        if (!target_path) return null;
      } else if (typeof input.action === 'string' && input.action.startsWith('button:') &&
                 Object.hasOwn(BUTTONS, input.action.slice(7))) action = input.action;
      else return null;
    }
    if (input.kind === 'active' && (!Number.isInteger(input.seconds) || input.seconds < 1 || input.seconds > 30)) return null;
    events.push({ id: input.id, path, feature: featureForPath(path), kind: input.kind,
      action, target_path, seconds: input.kind === 'active' ? input.seconds : 0 });
  }
  return { visitor: body.visitor, session: body.session, events };
}
