const { chromium, firefox, webkit } = require('playwright');
const fs = require('fs');
const path = require('path');

const SCREENSHOTS_DIR = path.join(__dirname, 'screenshots');

async function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

const AD_BLOCK_DOMAINS = [
  'doubleclick.net',
  'googlesyndication.com',
  'googleadservices.com',
  'google-analytics.com',
  'pagead2.googlesyndication.com',
  'adservice.google.com',
  'facebook.com/tr',
  'analytics.twitter.com',
  'static.ads-twitter.com',
  'ads.linkedin.com',
  'bat.bing.com',
  'amazon-adsystem.com',
  'adnxs.com',
  'adsrvr.org',
  'demdex.net',
  'everesttech.net',
  'rubiconproject.com',
  'pubmatic.com',
  'openx.net',
  'criteo.com',
  'criteo.net',
  'taboola.com',
  'outbrain.com',
  'moatads.com',
  'scorecardresearch.com',
  'quantserve.com',
  'bluekai.com',
  'bidswitch.net',
  'casalemedia.com',
  'contextweb.com',
  'sharethrough.com',
  'spotxchange.com',
  'teads.tv',
  'lijit.com',
  'sail-horizon.com',
  'hotjar.com',
  'mouseflow.com',
  'crazyegg.com',
  'fullstory.com',
  'clarity.ms',
  'sentry.io',
  'optimizely.com',
  'newrelic.com',
  'nr-data.net',
  'chartbeat.com',
  'chartbeat.net',
  'parsely.com',
  'permutive.com',
  'bounceexchange.com',
  'cdn-gl.imrworldwide.com',
  'imrworldwide.com',
];

const COOKIE_BANNER_SELECTORS = [
  '[class*="cookie-consent"]',
  '[class*="cookie-banner"]',
  '[class*="cookie-notice"]',
  '[class*="cookie-popup"]',
  '[class*="cookie-modal"]',
  '[id*="cookie-consent"]',
  '[id*="cookie-banner"]',
  '[id*="cookie-notice"]',
  '[id*="cookie-popup"]',
  '[id*="cookie-modal"]',
  '[class*="consent-banner"]',
  '[class*="consent-popup"]',
  '[class*="consent-modal"]',
  '[id*="consent-banner"]',
  '[id*="consent-popup"]',
  '[id*="consent-modal"]',
  '[class*="cc-banner"]',
  '[id*="CybotCookiebotDialog"]',
  '[class*="onetrust"]',
  '[id*="onetrust"]',
  '[class*="osano"]',
  '[id*="osano"]',
  '[class*="iubenda"]',
  '[id*="iubenda"]',
  '[class*="gdpr"]',
  '[id*="gdpr"]',
  '[aria-label*="cookie" i]',
  '[aria-label*="consent" i]',
  '[data-testid*="cookie" i]',
  '[data-testid*="consent" i]',
];

const COOKIE_BANNER_DISMISS_TEXTS = [
  'accept all',
  'accept cookies',
  'accept',
  'agree',
  'got it',
  'ok',
  'okay',
  'allow all',
  'allow cookies',
  'allow',
  'i agree',
  'i accept',
  'close',
  'dismiss',
  'continue',
  'understood',
  'fine',
  'yes',
  'i understand',
  'enable all',
  'enable cookies',
];

async function launchBrowser(browserType = 'chromium', headless = false, useExtensions = false) {
  await ensureDir(SCREENSHOTS_DIR);
  const browserMap = { chromium, firefox, webkit };

  const launchOptions = { headless };
  const browser = await browserMap[browserType].launch(launchOptions);
  return browser;
}

async function setupAdBlocking(page) {
  await page.route('**/*', (route) => {
    const url = route.request().url();
    const resourceType = route.request().resourceType();
    const isAd = AD_BLOCK_DOMAINS.some(d => url.includes(d));
    const isAdScript = resourceType === 'script' && /ad[s]/.test(url);
    if (isAd || isAdScript) {
      route.abort();
    } else {
      route.continue();
    }
  });
}

async function dismissCookieBanners(page) {
  await page.evaluate(({ selectors, texts }) => {
    function dismiss() {
      for (const sel of selectors) {
        const els = document.querySelectorAll(sel);
        for (const el of els) {
          if (el.offsetParent !== null || getComputedStyle(el).display !== 'none') {
            el.remove();
          }
        }
      }
      const buttons = document.querySelectorAll('button, a, [role="button"], input[type="button"], input[type="submit"]');
      for (const btn of buttons) {
        const text = (btn.textContent || btn.value || '').trim().toLowerCase();
        if (texts.some(t => text === t || text.includes(t))) {
          btn.click();
          return true;
        }
      }
      return false;
    }
    dismiss();
    setTimeout(dismiss, 1000);
    setTimeout(dismiss, 3000);
  }, { selectors: COOKIE_BANNER_SELECTORS, texts: COOKIE_BANNER_DISMISS_TEXTS });
}

async function gotoPage(page, url, useExtensions) {
  const waitUntil = useExtensions ? 'domcontentloaded' : 'networkidle';
  await page.goto(url, { waitUntil, timeout: 30000 });
  if (useExtensions) {
    await dismissCookieBanners(page);
    await new Promise(r => setTimeout(r, 1000));
  }
}

function randomDelay(min = 5, max = 25) {
  return Math.floor(Math.random() * (max - min) + min);
}

// ── Bezier Curve for Natural Mouse Movement ────────────

function bezierCurve(t, p0, p1, p2, p3) {
  const u = 1 - t;
  return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
}

function generateBezierPath(startX, startY, endX, endY, steps = 20) {
  const cp1x = startX + (endX - startX) * 0.5 + (Math.random() - 0.5) * 50;
  const cp1y = startY + (endY - startY) * 0.5 + (Math.random() - 0.5) * 50;
  const cp2x = (startX + endX) / 2 + (Math.random() - 0.5) * 50;
  const cp2y = (startY + endY) / 2 + (Math.random() - 0.5) * 50;

  const points = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    points.push({
      x: bezierCurve(t, startX, cp1x, cp2x, endX),
      y: bezierCurve(t, startY, cp1y, cp2y, endY),
    });
  }
  return points;
}

// ── Navigation ────────────────────────────────────────

async function nav(url, browserType = 'chromium', useExtensions = false) {
  const browser = await launchBrowser(browserType, false, useExtensions);
  try {
    const page = await browser.newPage();
    if (useExtensions) await setupAdBlocking(page);
    await gotoPage(page, url, useExtensions);
    const title = await page.title();
    console.log(`Title: ${title}`);
    console.log(`URL: ${page.url()}`);
    return { title, url: page.url() };
  } finally {
    await browser.close();
  }
}

async function getText(url, browserType = 'chromium', useExtensions = false) {
  const browser = await launchBrowser(browserType, false, useExtensions);
  try {
    const page = await browser.newPage();
    if (useExtensions) await setupAdBlocking(page);
    await gotoPage(page, url, useExtensions);
    const text = await page.evaluate(() => document.body.innerText);
    console.log(text);
    return text;
  } finally {
    await browser.close();
  }
}

async function fillAndSubmit(url, selector, value, browserType = 'chromium', useExtensions = false) {
  const browser = await launchBrowser(browserType, false, useExtensions);
  try {
    const page = await browser.newPage();
    if (useExtensions) await setupAdBlocking(page);
    await gotoPage(page, url, useExtensions);
    await page.fill(selector, value);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(2000);
    const title = await page.title();
    console.log(`Submitted. Title: ${title}`);
    const name = `form-result-${Date.now()}.png`;
    const outPath = path.join(SCREENSHOTS_DIR, name);
    await page.screenshot({ path: outPath, fullPage: true });
    console.log(`Result screenshot: ${outPath}`);
    return { title, screenshot: outPath };
  } finally {
    await browser.close();
  }
}

async function execScript(url, script, browserType = 'chromium', useExtensions = false) {
  const browser = await launchBrowser(browserType, false, useExtensions);
  try {
    const page = await browser.newPage();
    if (useExtensions) await setupAdBlocking(page);
    await gotoPage(page, url, useExtensions);
    const result = await page.evaluate(script);
    console.log(JSON.stringify(result, null, 2));
    return result;
  } finally {
    await browser.close();
  }
}

async function downloadPage(url, output, browserType = 'chromium', useExtensions = false) {
  const browser = await launchBrowser(browserType, false, useExtensions);
  try {
    const page = await browser.newPage();
    if (useExtensions) await setupAdBlocking(page);
    await gotoPage(page, url, useExtensions);
    const html = await page.content();
    const name = output || `page-${Date.now()}.html`;
    const outPath = path.join(__dirname, name);
    fs.writeFileSync(outPath, html);
    console.log(`Page saved: ${outPath} (${html.length} bytes)`);
    return outPath;
  } finally {
    await browser.close();
  }
}

async function cookies(url, browserType = 'chromium', useExtensions = false) {
  const browser = await launchBrowser(browserType, false, useExtensions);
  try {
    const page = await browser.newPage();
    if (useExtensions) await setupAdBlocking(page);
    await gotoPage(page, url, useExtensions);
    const cookies = await page.context().cookies();
    console.log(JSON.stringify(cookies, null, 2));
    return cookies;
  } finally {
    await browser.close();
  }
}

async function headers(url, browserType = 'chromium', useExtensions = false) {
  const browser = await launchBrowser(browserType, false, useExtensions);
  try {
    const page = await browser.newPage();
    if (useExtensions) await setupAdBlocking(page);
    await gotoPage(page, url, useExtensions);
    const title = await page.title();
    const meta = await page.evaluate(() => {
      const metas = document.querySelectorAll('meta');
      return Array.from(metas).map(m => ({
        name: m.getAttribute('name'),
        content: m.getAttribute('content'),
      }));
    });
    console.log(`Title: ${title}`);
    console.log('Meta tags:');
    meta.forEach(m => console.log(`  ${m.name}: ${m.content}`));
    return { title, meta };
  } finally {
    await browser.close();
  }
}

async function multiTab(urls, browserType = 'chromium', useExtensions = false) {
  const browser = await launchBrowser(browserType, false, useExtensions);
  try {
    const context = await browser.newContext();
    for (const url of urls) {
      const page = await context.newPage();
      if (useExtensions) await setupAdBlocking(page);
      await gotoPage(page, url, useExtensions);
      console.log(`${url} -> ${await page.title()}`);
    }
    const pages = context.pages();
    const name = `multi-tab-${Date.now()}.png`;
    const outPath = path.join(SCREENSHOTS_DIR, name);
    await pages[pages.length - 1].screenshot({ path: outPath, fullPage: true });
    console.log(`Last tab screenshot: ${outPath}`);
    return outPath;
  } finally {
    await browser.close();
  }
}

// ── Screenshots ───────────────────────────────────────

async function screenshotFullPage(url, filename, browserType = 'chromium', useExtensions = false) {
  const browser = await launchBrowser(browserType, false, useExtensions);
  try {
    const page = await browser.newPage();
    if (useExtensions) await setupAdBlocking(page);
    await gotoPage(page, url, useExtensions);
    const name = filename || `fullpage-${Date.now()}.png`;
    const outPath = path.join(SCREENSHOTS_DIR, name);
    await page.screenshot({ path: outPath, fullPage: true });
    console.log(`Full page screenshot: ${outPath}`);
    return outPath;
  } finally {
    await browser.close();
  }
}

async function screenshotViewport(url, filename, options = {}, browserType = 'chromium', useExtensions = false) {
  const { width = 1920, height = 1080 } = options;
  const browser = await launchBrowser(browserType, false, useExtensions);
  try {
    const context = await browser.newContext({ viewport: { width, height } });
    const page = await context.newPage();
    if (useExtensions) await setupAdBlocking(page);
    await gotoPage(page, url, useExtensions);
    const name = filename || `viewport-${Date.now()}.png`;
    const outPath = path.join(SCREENSHOTS_DIR, name);
    await page.screenshot({ path: outPath, fullPage: false });
    console.log(`Viewport screenshot (${width}x${height}): ${outPath}`);
    return outPath;
  } finally {
    await browser.close();
  }
}

async function screenshotElement(url, filename, selector, browserType = 'chromium', useExtensions = false) {
  const browser = await launchBrowser(browserType, false, useExtensions);
  try {
    const page = await browser.newPage();
    if (useExtensions) await setupAdBlocking(page);
    await gotoPage(page, url, useExtensions);
    await page.waitForSelector(selector);
    const element = await page.$(selector);
    const name = filename || `element-${Date.now()}.png`;
    const outPath = path.join(SCREENSHOTS_DIR, name);
    await element.screenshot({ path: outPath });
    console.log(`Element screenshot: ${outPath}`);
    return outPath;
  } finally {
    await browser.close();
  }
}

async function screenshotClip(url, filename, clip, browserType = 'chromium', useExtensions = false) {
  const browser = await launchBrowser(browserType, false, useExtensions);
  try {
    const page = await browser.newPage();
    if (useExtensions) await setupAdBlocking(page);
    await gotoPage(page, url, useExtensions);
    const name = filename || `clip-${Date.now()}.png`;
    const outPath = path.join(SCREENSHOTS_DIR, name);
    await page.screenshot({ path: outPath, clip });
    console.log(`Clipped screenshot: ${outPath}`);
    return outPath;
  } finally {
    await browser.close();
  }
}

async function screenshotPdf(url, filename, browserType = 'chromium', useExtensions = false) {
  const browser = await launchBrowser(browserType, true, useExtensions);
  try {
    const page = await browser.newPage();
    if (useExtensions) await setupAdBlocking(page);
    await gotoPage(page, url, useExtensions);
    const name = filename || `page-${Date.now()}.pdf`;
    const outPath = path.join(SCREENSHOTS_DIR, name);
    await page.pdf({ path: outPath, format: 'A4', printBackground: true });
    console.log(`PDF screenshot: ${outPath}`);
    return outPath;
  } finally {
    await browser.close();
  }
}

async function screenshotMultiple(url, count = 3, interval = 1000, browserType = 'chromium', useExtensions = false) {
  const browser = await launchBrowser(browserType, false, useExtensions);
  try {
    const page = await browser.newPage();
    if (useExtensions) await setupAdBlocking(page);
    await gotoPage(page, url, useExtensions);
    const screenshots = [];
    for (let i = 0; i < count; i++) {
      const name = `multi-${Date.now()}-${i}.png`;
      const outPath = path.join(SCREENSHOTS_DIR, name);
      await page.screenshot({ path: outPath, fullPage: false });
      screenshots.push(outPath);
      console.log(`Screenshot ${i + 1}: ${outPath}`);
      if (i < count - 1) await page.waitForTimeout(interval);
    }
    return screenshots;
  } finally {
    await browser.close();
  }
}

async function screenshotCompare(url1, url2, browserType = 'chromium', useExtensions = false) {
  const browser = await launchBrowser(browserType, false, useExtensions);
  try {
    const page1 = await browser.newPage();
    if (useExtensions) await setupAdBlocking(page1);
    await gotoPage(page1, url1, useExtensions);
    const name1 = `compare-a-${Date.now()}.png`;
    const outPath1 = path.join(SCREENSHOTS_DIR, name1);
    await page1.screenshot({ path: outPath1, fullPage: true });
    console.log(`Screenshot A: ${outPath1}`);

    const page2 = await browser.newPage();
    if (useExtensions) await setupAdBlocking(page2);
    await gotoPage(page2, url2, useExtensions);
    const name2 = `compare-b-${Date.now()}.png`;
    const outPath2 = path.join(SCREENSHOTS_DIR, name2);
    await page2.screenshot({ path: outPath2, fullPage: true });
    console.log(`Screenshot B: ${outPath2}`);

    return { a: outPath1, b: outPath2 };
  } finally {
    await browser.close();
  }
}

// ── Mouse Emulation ───────────────────────────────────

async function mouseMove(url, startX, startY, endX, endY, options = {}, browserType = 'chromium', useExtensions = false) {
  const { steps = 20, delay = 10 } = options;
  const browser = await launchBrowser(browserType, false, useExtensions);
  try {
    const page = await browser.newPage();
    if (useExtensions) await setupAdBlocking(page);
    await gotoPage(page, url, useExtensions);
    
    const movePath = generateBezierPath(startX, startY, endX, endY, steps);
    await page.mouse.move(startX, startY);
    
    for (const point of movePath) {
      await page.mouse.move(point.x, point.y);
      await page.waitForTimeout(delay + randomDelay());
    }
    
    console.log(`Mouse moved from (${startX}, ${startY}) to (${endX}, ${endY})`);
    console.log(`Path: ${movePath.length} steps`);
    return { steps: movePath.length };
  } finally {
    await browser.close();
  }
}

async function mouseClick(url, x, y, options = {}, browserType = 'chromium', useExtensions = false) {
  const { button = 'left', clickCount = 1 } = options;
  const browser = await launchBrowser(browserType, false, useExtensions);
  try {
    const page = await browser.newPage();
    if (useExtensions) await setupAdBlocking(page);
    await gotoPage(page, url, useExtensions);
    
    await page.mouse.move(x, y, { steps: 10 });
    await page.waitForTimeout(100);
    await page.mouse.click(x, y, { button, clickCount });
    
    console.log(`Clicked at (${x}, ${y}) with ${button} button`);
    
    const name = `click-${Date.now()}.png`;
    const outPath = path.join(SCREENSHOTS_DIR, name);
    await page.screenshot({ path: outPath, fullPage: false });
    console.log(`Screenshot: ${outPath}`);
    
    return { x, y, button };
  } finally {
    await browser.close();
  }
}

async function mouseDoubleClick(url, x, y, browserType = 'chromium', useExtensions = false) {
  return mouseClick(url, x, y, { clickCount: 2 }, browserType, useExtensions);
}

async function mouseRightClick(url, x, y, browserType = 'chromium', useExtensions = false) {
  return mouseClick(url, x, y, { button: 'right' }, browserType, useExtensions);
}

async function mouseDrag(url, startX, startY, endX, endY, options = {}, browserType = 'chromium', useExtensions = false) {
  const { steps = 30, delay = 10 } = options;
  const browser = await launchBrowser(browserType, false, useExtensions);
  try {
    const page = await browser.newPage();
    if (useExtensions) await setupAdBlocking(page);
    await gotoPage(page, url, useExtensions);
    
    await page.mouse.move(startX, startY, { steps: 5 });
    await page.waitForTimeout(100);
    await page.mouse.down();
    
    const dragPath = generateBezierPath(startX, startY, endX, endY, steps);
    for (const point of dragPath) {
      await page.mouse.move(point.x, point.y);
      await page.waitForTimeout(delay + randomDelay());
    }
    
    await page.waitForTimeout(100);
    await page.mouse.up();
    
    console.log(`Dragged from (${startX}, ${startY}) to (${endX}, ${endY})`);
    
    const name = `drag-${Date.now()}.png`;
    const outPath = path.join(SCREENSHOTS_DIR, name);
    await page.screenshot({ path: outPath, fullPage: false });
    console.log(`Screenshot: ${outPath}`);
    
    return { startX, startY, endX, endY };
  } finally {
    await browser.close();
  }
}

async function mouseHover(url, x, y, options = {}, browserType = 'chromium', useExtensions = false) {
  const { duration = 1000 } = options;
  const browser = await launchBrowser(browserType, false, useExtensions);
  try {
    const page = await browser.newPage();
    if (useExtensions) await setupAdBlocking(page);
    await gotoPage(page, url, useExtensions);
    
    await page.mouse.move(x, y, { steps: 15 });
    console.log(`Hovering at (${x}, ${y}) for ${duration}ms`);
    await page.waitForTimeout(duration);
    
    return { x, y, duration };
  } finally {
    await browser.close();
  }
}

async function mouseScroll(url, x, y, scrollX, scrollY, browserType = 'chromium', useExtensions = false) {
  const browser = await launchBrowser(browserType, false, useExtensions);
  try {
    const page = await browser.newPage();
    if (useExtensions) await setupAdBlocking(page);
    await gotoPage(page, url, useExtensions);
    
    await page.mouse.move(x, y);
    await page.mouse.wheel(scrollX, scrollY);
    
    console.log(`Scrolled at (${x}, ${y}): dx=${scrollX}, dy=${scrollY}`);
    
    const name = `scroll-${Date.now()}.png`;
    const outPath = path.join(SCREENSHOTS_DIR, name);
    await page.screenshot({ path: outPath, fullPage: false });
    console.log(`Screenshot: ${outPath}`);
    
    return { x, y, scrollX, scrollY };
  } finally {
    await browser.close();
  }
}

async function mousePath(url, points, options = {}, browserType = 'chromium', useExtensions = false) {
  const { delay = 15 } = options;
  const browser = await launchBrowser(browserType, false, useExtensions);
  try {
    const page = await browser.newPage();
    if (useExtensions) await setupAdBlocking(page);
    await gotoPage(page, url, useExtensions);
    
    for (let i = 0; i < points.length - 1; i++) {
      const from = points[i];
      const to = points[i + 1];
      const movePath = generateBezierPath(from.x, from.y, to.x, to.y, 15);
      
      for (const point of movePath) {
        await page.mouse.move(point.x, point.y);
        await page.waitForTimeout(delay + randomDelay());
      }
    }
    
    console.log(`Moved through ${points.length} points`);
    return { points: points.length };
  } finally {
    await browser.close();
  }
}

async function mouseWiggle(url, x, y, options = {}, browserType = 'chromium', useExtensions = false) {
  const { radius = 20, duration = 2000 } = options;
  const browser = await launchBrowser(browserType, false, useExtensions);
  try {
    const page = await browser.newPage();
    if (useExtensions) await setupAdBlocking(page);
    await gotoPage(page, url, useExtensions);
    
    const steps = Math.floor(duration / 30);
    for (let i = 0; i < steps; i++) {
      const angle = (i / steps) * Math.PI * 4;
      const offsetX = Math.cos(angle) * radius * (1 - i / steps);
      const offsetY = Math.sin(angle) * radius * (1 - i / steps);
      await page.mouse.move(x + offsetX, y + offsetY);
      await page.waitForTimeout(30);
    }
    
    await page.mouse.move(x, y);
    console.log(`Wiggled at (${x}, ${y}) for ${duration}ms`);
    return { x, y, duration };
  } finally {
    await browser.close();
  }
}

// ── Accessibility Tree (Playwright Special) ───────────

async function getAccessibilityTree(url, browserType = 'chromium', useExtensions = false) {
  const browser = await launchBrowser(browserType, false, useExtensions);
  try {
    const page = await browser.newPage();
    if (useExtensions) await setupAdBlocking(page);
    await gotoPage(page, url, useExtensions);
    const snapshot = await page.accessibility.snapshot();
    console.log(JSON.stringify(snapshot, null, 2));
    return snapshot;
  } finally {
    await browser.close();
  }
}

// ── Network Interception ──────────────────────────────

async function interceptRequests(url, resourceTypes = ['image'], browserType = 'chromium', useExtensions = false) {
  const browser = await launchBrowser(browserType, false, useExtensions);
  try {
    const page = await browser.newPage();
    const intercepted = [];
    
    await page.route('**/*', (route) => {
      if (resourceTypes.includes(route.request().resourceType())) {
        intercepted.push(route.request().url());
        route.abort();
      } else {
        route.continue();
      }
    });
    
    await gotoPage(page, url, useExtensions);
    console.log(`Intercepted ${intercepted.length} requests:`);
    intercepted.forEach(u => console.log(`  ${u}`));
    return intercepted;
  } finally {
    await browser.close();
  }
}

// ── Multi-Browser Comparison ──────────────────────────

async function crossBrowserTest(url, browsers = ['chromium', 'firefox', 'webkit'], useExtensions = false) {
  const results = {};
  for (const browserType of browsers) {
    const browser = await launchBrowser(browserType, true, useExtensions);
    try {
      const page = await browser.newPage();
      if (useExtensions) await setupAdBlocking(page);
      await gotoPage(page, url, useExtensions);
      const title = await page.title();
      const name = `cross-${browserType}-${Date.now()}.png`;
      const outPath = path.join(SCREENSHOTS_DIR, name);
      await page.screenshot({ path: outPath, fullPage: true });
      results[browserType] = { title, screenshot: outPath };
      console.log(`${browserType}: ${title} -> ${outPath}`);
    } finally {
      await browser.close();
    }
  }
  return results;
}

module.exports = {
  launchBrowser,
  nav,
  getText,
  fillAndSubmit,
  execScript,
  downloadPage,
  cookies,
  headers,
  multiTab,
  screenshotFullPage,
  screenshotViewport,
  screenshotElement,
  screenshotClip,
  screenshotPdf,
  screenshotMultiple,
  screenshotCompare,
  mouseMove,
  mouseClick,
  mouseDoubleClick,
  mouseRightClick,
  mouseDrag,
  mouseHover,
  mouseScroll,
  mousePath,
  mouseWiggle,
  getAccessibilityTree,
  interceptRequests,
  crossBrowserTest,
};

const [,, command, ...args] = process.argv;

function usage() {
  console.log(`
Usage: node playwright.js <command> [args] [--ext]

  --ext    Enable built-in ad blocking + cookie banner dismissal (via route interception)

Navigation:
  open <url> [browser]             Navigate (chromium/firefox/webkit)
  text <url> [browser]             Extract page text
  fill <url> <sel> <val> [browser] Fill input and submit
  exec <url> <js> [browser]        Run JS in page
  download <url> [file] [browser]  Save page HTML
  cookies <url> [browser]          Get page cookies
  headers <url> [browser]          Get meta tags
  tabs <url1> <url2> ...           Open multiple tabs

Screenshots:
  screenshot <url> [file]          Full-page screenshot
  viewport <url> [file] [WxH]      Custom resolution
  element <url> [file] <selector>  Screenshot element
  clip <url> [file] {x,y,w,h}     Clipped region
  compare <url1> <url2>            Compare two pages
  pdf <url> [file]                 Save as PDF
  multi-shot <url> [count] [ms]    Multiple screenshots
  cross-browser <url>              Test all browsers

Mouse Emulation:
  move <url> x1 y1 x2 y2 [steps]  Move mouse (bezier)
  click <url> x y [btn]            Click at coordinates
  double-click <url> x y           Double-click
  right-click <url> x y            Right-click
  drag <url> x1 y1 x2 y2          Drag with bezier path
  hover <url> x y [ms]             Hover at coordinates
  scroll <url> x y dx dy           Mouse wheel
  path <url> x1,y1 x2,y2 ...      Multiple waypoints
  wiggle <url> x y [r] [ms]        Human-like idle

Advanced:
  a11y <url>                        Accessibility tree
  intercept <url> [types]          Block resource types
`);
}

(async () => {
  const useExtensions = args.includes('--ext');
  const filteredArgs = args.filter(a => a !== '--ext');
  
  const browserType = filteredArgs[filteredArgs.length - 1];
  const validBrowsers = ['chromium', 'firefox', 'webkit'];
  const browser = validBrowsers.includes(browserType) ? browserType : 'chromium';
  const cmdArgs = validBrowsers.includes(browserType) ? filteredArgs.slice(0, -1) : filteredArgs;

  try {
    switch (command) {
      case 'open':
        await nav(cmdArgs[0], browser, useExtensions);
        break;
      case 'text':
        await getText(cmdArgs[0], browser, useExtensions);
        break;
      case 'fill':
        await fillAndSubmit(cmdArgs[0], cmdArgs[1], cmdArgs.slice(2).join(' '), browser, useExtensions);
        break;
      case 'exec':
        await execScript(cmdArgs[0], cmdArgs.slice(1).join(' '), browser, useExtensions);
        break;
      case 'download':
        await downloadPage(cmdArgs[0], cmdArgs[1], browser, useExtensions);
        break;
      case 'cookies':
        await cookies(cmdArgs[0], browser, useExtensions);
        break;
      case 'headers':
        await headers(cmdArgs[0], browser, useExtensions);
        break;
      case 'tabs':
        await multiTab(cmdArgs, browser, useExtensions);
        break;
      case 'screenshot':
        await screenshotFullPage(cmdArgs[0], cmdArgs[1], browser, useExtensions);
        break;
      case 'viewport':
        const [vw, vh] = (cmdArgs[2] || '1920x1080').split('x').map(Number);
        await screenshotViewport(cmdArgs[0], cmdArgs[1], { width: vw, height: vh }, browser, useExtensions);
        break;
      case 'element':
        await screenshotElement(cmdArgs[0], cmdArgs[1], cmdArgs[2], browser, useExtensions);
        break;
      case 'clip':
        const clip = JSON.parse(cmdArgs[2] || '{}');
        await screenshotClip(cmdArgs[0], cmdArgs[1], clip, browser, useExtensions);
        break;
      case 'compare':
        await screenshotCompare(cmdArgs[0], cmdArgs[1], browser, useExtensions);
        break;
      case 'pdf':
        await screenshotPdf(cmdArgs[0], cmdArgs[1], browser, useExtensions);
        break;
      case 'multi-shot':
        await screenshotMultiple(cmdArgs[0], parseInt(cmdArgs[1]) || 3, parseInt(cmdArgs[2]) || 1000, browser, useExtensions);
        break;
      case 'cross-browser':
        await crossBrowserTest(cmdArgs[0]);
        break;
      case 'move':
        await mouseMove(cmdArgs[0], parseInt(cmdArgs[1]), parseInt(cmdArgs[2]), parseInt(cmdArgs[3]), parseInt(cmdArgs[4]), { steps: parseInt(cmdArgs[5]) || 20 }, browser, useExtensions);
        break;
      case 'click':
        await mouseClick(cmdArgs[0], parseInt(cmdArgs[1]), parseInt(cmdArgs[2]), { button: cmdArgs[3] || 'left' }, browser, useExtensions);
        break;
      case 'double-click':
        await mouseDoubleClick(cmdArgs[0], parseInt(cmdArgs[1]), parseInt(cmdArgs[2]), browser, useExtensions);
        break;
      case 'right-click':
        await mouseRightClick(cmdArgs[0], parseInt(cmdArgs[1]), parseInt(cmdArgs[2]), browser, useExtensions);
        break;
      case 'drag':
        await mouseDrag(cmdArgs[0], parseInt(cmdArgs[1]), parseInt(cmdArgs[2]), parseInt(cmdArgs[3]), parseInt(cmdArgs[4]), {}, browser, useExtensions);
        break;
      case 'hover':
        await mouseHover(cmdArgs[0], parseInt(cmdArgs[1]), parseInt(cmdArgs[2]), { duration: parseInt(cmdArgs[3]) || 1000 }, browser, useExtensions);
        break;
      case 'scroll':
        await mouseScroll(cmdArgs[0], parseInt(cmdArgs[1]), parseInt(cmdArgs[2]), parseInt(cmdArgs[3]) || 0, parseInt(cmdArgs[4]) || 100, browser, useExtensions);
        break;
      case 'path':
        const points = cmdArgs.slice(1).map(a => {
          const [x, y] = a.split(',').map(Number);
          return { x, y };
        });
        await mousePath(cmdArgs[0], points, {}, browser, useExtensions);
        break;
      case 'wiggle':
        await mouseWiggle(cmdArgs[0], parseInt(cmdArgs[1]), parseInt(cmdArgs[2]), { radius: parseInt(cmdArgs[3]) || 20, duration: parseInt(cmdArgs[4]) || 2000 }, browser, useExtensions);
        break;
      case 'a11y':
        await getAccessibilityTree(cmdArgs[0], browser, useExtensions);
        break;
      case 'intercept':
        await interceptRequests(cmdArgs[0], cmdArgs[1] ? cmdArgs[1].split(',') : ['image'], browser, useExtensions);
        break;
      default:
        usage();
    }
  } catch (e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
})();
