/* Public-page geometry only. All HTTP goes through the Python public fetcher. */
const { chromium } = require('playwright-core');
const fs = require('node:fs');

async function main(config) {
  let browser;
  const deadline = setTimeout(() => {process.stderr.write('homepage renderer exceeded 35 seconds'); process.exit(2);}, 35000);
  let requests = 0, failed = 0, failedStylesheets = 0;
  try {
    browser = await chromium.launch({executablePath: config.chromium, headless: true,
      args: ['--disable-dev-shm-usage', '--disable-background-networking']});
    const context = await browser.newContext({viewport: {width: 1440, height: 1000},
      serviceWorkers: 'block', acceptDownloads: false, userAgent: '383LajmeDiscovery/2.0 (+https://383ks.com)'});
    await context.routeWebSocket('**/*', socket => socket.close());
    await context.addInitScript(() => {
      for (const name of ['RTCPeerConnection', 'webkitRTCPeerConnection', 'WebTransport']) {
        Object.defineProperty(globalThis, name, {value: undefined, configurable: false});
      }
    });
    await context.route('**/*', async route => {
      const request = route.request();
      if (request.method() !== 'GET' || !/^https?:\/\//.test(request.url())
          || ['media', 'eventsource'].includes(request.resourceType()) || ++requests > 256) {
        failed++;
        if (request.resourceType() === 'stylesheet') failedStylesheets++;
        return route.abort();
      }
      try {
        if (request.isNavigationRequest() && request.frame() !== context.pages()[0].mainFrame()) {
          return route.abort();
        }
        const response = await fetch(config.bridge, {method: 'POST',
          body: JSON.stringify({url: request.url(),resource_type:request.resourceType()}),
          signal: AbortSignal.timeout(request.resourceType() === 'stylesheet' ? 10000 : 7000)});
        if (!response.ok) throw new Error('public resource unavailable');
        const resource = await response.json();
        if (resource.url !== request.url()) {
          return route.fulfill({status: 302, headers: {location: resource.url}});
        }
        if (request.resourceType() === 'stylesheet'
            && resource.content_type.split(';')[0].trim().toLowerCase() !== 'text/css') {
          throw new Error('public stylesheet did not return CSS');
        }
        await route.fulfill({status: 200, headers: resource.headers || {}, contentType: resource.content_type,
          body: Buffer.from(resource.payload, 'base64')});
      } catch (_) {
        failed++;
        if (request.resourceType() === 'stylesheet') failedStylesheets++;
        await route.abort().catch(() => {});
      }
    });
    const page = await context.newPage();
    await page.goto(config.url, {waitUntil: 'domcontentloaded', timeout: 25000});
    await page.waitForLoadState('load', {timeout: 5000}).catch(() => {});
    let pendingStylesheets = false;
    await page.waitForFunction(() => [...document.querySelectorAll('link[rel~="stylesheet"]')].every(link =>
      link.disabled || link.media && !matchMedia(link.media).matches || link.sheet !== null),
      null,{timeout:5000}).catch(() => {
        pendingStylesheets=true;
        if (!config.allow_partial) throw new Error('rendered layout incomplete: applicable stylesheet still pending');
      });
    await page.evaluate(() => Promise.race([document.fonts.ready,new Promise(resolve=>setTimeout(resolve,1000))]));
    await page.waitForTimeout(750);
    const pendingFonts = await page.evaluate(() => document.fonts.status !== 'loaded');
    let articleView;
    if (config.article) {
      articleView = await page.evaluate(() => {
        const containers = [...document.querySelectorAll('article')];
        containers.sort((a,b)=>(b.innerText || '').length-(a.innerText || '').length);
        const root = containers[0] || document.querySelector('main') || document.body;
        return {title: (document.querySelector('h1')?.innerText || document.title).trim(),
          visible_text: root.innerText || '', page_height: document.documentElement.scrollHeight,
          breaking_labels: [...root.querySelectorAll('[class*="breaking"],[data-testid*="breaking"]')]
            .map(node=>node.innerText.trim()).filter(Boolean).slice(0,10)};
      });
    }
    const extracted = await page.evaluate(({excluded,utilities,tracking,prefixes,categories}) => {
      const rows = [], discovered = [], candidates = [];
      const headings = 'h1,h2,h3,h4,h5,h6,[role="heading"]';
      const articleTarget = link => {
        if (!['http:','https:'].includes(link.protocol)) return false;
        const path = (link.pathname || '').replace(/\/$/,''), parts = path.split('/').filter(Boolean);
        const queryArticle = /^\d+$/.test(new URLSearchParams(link.search).get('p') || '');
        return (parts.length>0 || queryArticle) && !excluded.includes(path.toLowerCase().split('.').pop())
          && !utilities.includes(path.toLowerCase().split('/').pop()) && !prefixes.includes(parts[0])
          && !(categories.includes(parts[0]) && parts.length<=2);
      };
      // Compare the same URL equivalence as publication, without rewriting the
      // original request URL. Trackers share the Python publication policy.
      const cardTargetIdentity = link => {
        const query = [...new URLSearchParams(link.search)].filter(([key]) =>
          !key.toLowerCase().startsWith('utm_') && !tracking.includes(key.toLowerCase()));
        query.sort((a,b) => a[0]<b[0] ? -1 : a[0]>b[0] ? 1 : a[1]<b[1] ? -1 : a[1]>b[1] ? 1 : 0);
        return JSON.stringify([link.protocol,link.hostname.toLowerCase().replace(/^www\./,''),link.port,
          link.pathname.replace(/;[^/]*$/,'').replace(/\/{2,}/g,'/').replace(/\/+$/,'') || '/',query]);
      };
      const styles = new WeakMap(), labels = new WeakMap();
      const styleOf = node => {
        if (!styles.has(node)) styles.set(node,getComputedStyle(node));
        return styles.get(node);
      };
      const clipped = (element, rect) => {
        let left = Math.max(0,rect.left), right = Math.min(innerWidth,rect.right);
        let top = rect.top, bottom = rect.bottom;
        for (let node = element; node; node = node.parentElement) {
          const style = styleOf(node);
          if (style.display === 'none' || style.visibility !== 'visible' || Number(style.opacity) === 0
              || node.hidden || node.getAttribute('aria-hidden') === 'true') return false;
          if (node !== document.body && node !== document.documentElement) {
            const box = node.getBoundingClientRect();
            if (/^(hidden|clip|auto|scroll)$/.test(style.overflowX)) {
              left = Math.max(left,box.left+node.clientLeft);
              right = Math.min(right,box.left+node.clientLeft+node.clientWidth);
            }
            if (/^(hidden|clip|auto|scroll)$/.test(style.overflowY)) {
              top = Math.max(top,box.top+node.clientTop);
              bottom = Math.min(bottom,box.top+node.clientTop+node.clientHeight);
            }
          }
        }
        return right-left >= Math.min(rect.width,20) && bottom-top >= Math.min(rect.height,8)
          && right-left > 1 && bottom-top > 1;
      };
      const visibleText = node => {
        if (!labels.has(node)) {
          const walker = document.createTreeWalker(node,NodeFilter.SHOW_TEXT), parts = [];
          for (let text = walker.nextNode(); text; text = walker.nextNode()) {
            if (!text.nodeValue.trim()) continue;
            const range = document.createRange();
            range.selectNodeContents(text);
            if ([...range.getClientRects()].some(rect => clipped(text.parentElement,rect))) parts.push(text.nodeValue);
          }
          labels.set(node,parts.join(' ').trim().replace(/\s+/g,' '));
        }
        return labels.get(node);
      };
      for (const link of document.querySelectorAll('a[href]')) {
        if (link.closest('nav,footer,form,[role="navigation"]')) continue;
        if (!articleTarget(link)) continue;
        let heading = link.querySelector(headings) || link.closest(headings);
        const textOf = node => (node.innerText || node.textContent || '').trim().replace(/\s+/g, ' ');
        const label = textOf(heading || link) || link.getAttribute('aria-label') || '';
        const discovery = {url: link.href, title: label, published: ''};
        if (label.split(' ').length >= 2) discovered.push(discovery);
        if (heading && visibleText(heading).split(' ').length < 2) heading = null;
        if (!heading) {
          // Adapt to cards whose titles are styled spans/divs rather than h-tags.
          // Typography is measured, not matched to a publisher's fragile classes.
          const options = [link, ...link.querySelectorAll('span,div,p,strong,b')].filter(node => {
            const style = styleOf(node);
            const words = visibleText(node).split(' ').length, size = parseFloat(style.fontSize);
            const parent = link.parentElement;
            const parentLinks = parent ? new Set([...parent.querySelectorAll('a[href]')].filter(articleTarget).map(cardTargetIdentity)) : new Set();
            const pictured = link.querySelector('img,picture') || link.closest('article')
              || parentLinks.size === 1 && parent.querySelector('img,picture');
            const listed = link.closest('li,[role="listitem"]');
            return words >= 2 && size >= 20
              || words >= 4 && (size >= 18 || size >= 16 && parseInt(style.fontWeight,10) >= 500
                || (pictured || listed) && size >= 14);
          });
          options.sort((a,b) => parseFloat(styleOf(b).fontSize)-parseFloat(styleOf(a).fontSize)
            || visibleText(a).length-visibleText(b).length);
          heading = options[0];
        }
        if (!heading && clipped(link,link.getBoundingClientRect())) {
          // Some cards put the headline beside an image/"Read more" link.
          // Associate only a single distinct non-media target in that card.
          for (let node = link.parentElement, depth = 0; node && depth < 6; node = node.parentElement, depth++) {
            if (['BODY','HTML'].includes(node.tagName)) break;
            const targets = new Set([...node.querySelectorAll('a[href]')].filter(articleTarget).map(cardTargetIdentity));
            if (targets.size > 1) break;
            if (!targets.has(cardTargetIdentity(link))) continue;
            const titles = [...node.querySelectorAll(headings)].filter(h => visibleText(h).split(' ').length >= 2);
            titles.sort((a,b) => parseFloat(styleOf(b).fontSize)-parseFloat(styleOf(a).fontSize));
            if (titles.length) {
              heading = titles[0];
              discovery.title = visibleText(heading);
              if (!discovered.includes(discovery)) discovered.push(discovery);
              break;
            }
          }
        }
        if (heading && visibleText(heading).split(' ').length >= 2) candidates.push({link,heading,text:visibleText(heading)});
      }
      const headlineLinks = new Set(candidates.map(row => row.link));
      for (const {link,heading,text} of candidates) {
        if (link.closest('[hidden],[aria-hidden="true"]')) continue;
        let rect = heading.getBoundingClientRect();
        const style = getComputedStyle(heading);
        if (rect.width < 20 || rect.height < 8 || style.visibility !== 'visible' || Number(style.opacity) === 0) continue;
        let invisible = false;
        for (let parent = heading.parentElement; parent; parent = parent.parentElement) {
          const s = getComputedStyle(parent);
          if (s.display === 'none' || s.visibility !== 'visible' || Number(s.opacity) === 0) {invisible = true; break;}
        }
        if (invisible || rect.right <= 0 || rect.left >= innerWidth) continue;
        // Ascend through a single-headline picture card, never borrow a whole
        // multi-story section's top edge for a lower headline inside it.
        let card = heading;
        for (let node = heading.parentElement, depth = 0; node && depth < 6; node = node.parentElement, depth++) {
          if (['BODY','HTML','MAIN'].includes(node.tagName)) break;
          const urls = new Set([...node.querySelectorAll('a[href]')].filter(a => headlineLinks.has(a)).map(cardTargetIdentity));
          if (urls.size > 1) break;
          if (node.querySelector('img,picture') && node.getBoundingClientRect().height < 1400) card = node;
        }
        const box = card.getBoundingClientRect();
        rows.push({url: link.href, title: text, published: '',
          geometry: {top: Math.max(0, Math.min(rect.top, box.top) + scrollY),
            left: Math.max(0, box.left), width: box.width, height: box.height,
            headline_top: rect.top + scrollY, font_size: parseFloat(style.fontSize)}});
      }
      return {discovered, articles: rows.sort((a, b) => a.geometry.top-b.geometry.top
        || b.geometry.font_size-a.geometry.font_size
        || b.geometry.width*b.geometry.height-a.geometry.width*a.geometry.height
        || a.geometry.left-b.geometry.left)};
    },{excluded: config.excluded_extensions,utilities: config.utility_paths,tracking: config.tracking_keys,
      prefixes: config.excluded_prefixes,categories: config.category_prefixes});
    let screenshotHeight = 0;
    if (config.screenshot) {
      // Preserve the original page pixels; no synthetic "article" illustration.
      // CDP captures the current surface without Playwright waiting indefinitely
      // for a publisher's webfonts. Pending fonts explicitly make layout partial.
      // https://playwright.dev/docs/api/class-cdpsession
      const session = await context.newCDPSession(page);
      const snapshot = async (path,height) => {
        const shot = await session.send('Page.captureScreenshot',{format:'png',fromSurface:true,
          captureBeyondViewport:true,clip:{x:0,y:0,width:1440,height,scale:1}});
        fs.writeFileSync(path,Buffer.from(shot.data,'base64'));
      };
      await snapshot(config.screenshot,1000);
      if (config.article) {
        screenshotHeight = Math.min(articleView.page_height,16000);
        await snapshot(config.screenshot.replace(/\.png$/,'.full.png'),screenshotHeight);
      }
      await session.detach();
    }
    process.stdout.write(JSON.stringify({url: page.url(), articles: extracted.articles,
      article_view: articleView, screenshot_height: screenshotHeight,
      discovered_articles: extracted.discovered, requests, failed_resources: failed,
      failed_stylesheets: failedStylesheets,
      pending_stylesheets:pendingStylesheets,
      pending_fonts:pendingFonts,
      layout_complete:!pendingStylesheets && failedStylesheets===0 && !pendingFonts,
      viewport: {width: 1440, height: 1000},
      method:pendingStylesheets || failedStylesheets || pendingFonts ? 'public_browser_partial' : 'public_browser_geometry'}));
  } finally {
    if (browser) await browser.close();
    clearTimeout(deadline);
  }
}

main(JSON.parse(fs.readFileSync(0, 'utf8'))).catch(error => {
  process.stderr.write(String(error.message).slice(0, 500));
  process.exitCode = 1;
});
