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
          body: JSON.stringify({url: request.url()}), signal: AbortSignal.timeout(23000)});
        if (!response.ok) throw new Error('public resource unavailable');
        const resource = await response.json();
        if (resource.url !== request.url()) {
          return route.fulfill({status: 302, headers: {location: resource.url}});
        }
        if (request.resourceType() === 'stylesheet'
            && resource.content_type.split(';')[0].trim().toLowerCase() !== 'text/css') {
          throw new Error('public stylesheet did not return CSS');
        }
        await route.fulfill({status: 200, contentType: resource.content_type,
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
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(750);
    const extracted = await page.evaluate(() => {
      const rows = [], discovered = [];
      const headings = 'h1,h2,h3,h4,[role="heading"]';
      for (const link of document.querySelectorAll('a[href]')) {
        if (link.closest('nav,footer,form,[role="navigation"]')) continue;
        const heading = link.querySelector(headings) || link.closest(headings);
        if (!heading) continue;
        const text = (heading.innerText || heading.textContent || '').trim().replace(/\s+/g, ' ');
        if (text.split(' ').length < 2) continue;
        discovered.push({url: link.href, title: text, published: ''});
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
          const urls = new Set([...node.querySelectorAll('a[href]')].filter(a =>
            a.querySelector(headings) || a.closest(headings)).map(a => a.href));
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
    });
    if (config.screenshot) await page.screenshot({path: config.screenshot});
    process.stdout.write(JSON.stringify({url: page.url(), articles: extracted.articles,
      discovered_articles: extracted.discovered, requests, failed_resources: failed,
      failed_stylesheets: failedStylesheets,
      viewport: {width: 1440, height: 1000}, method: 'public_browser_geometry'}));
  } finally {
    if (browser) await browser.close();
    clearTimeout(deadline);
  }
}

main(JSON.parse(fs.readFileSync(0, 'utf8'))).catch(error => {
  process.stderr.write(String(error.message).slice(0, 500));
  process.exitCode = 1;
});
