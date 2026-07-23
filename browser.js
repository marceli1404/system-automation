const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const SCREENSHOTS_DIR = path.join(__dirname, 'screenshots');

async function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

async function launchBrowser(headless = false, viewport = { width: 1920, height: 1080 }) {
  await ensureDir(SCREENSHOTS_DIR);
  const browser = await puppeteer.launch({
    headless,
    args: [
      '--remote-debugging-port=9222',
      '--no-first-run',
      '--disable-extensions',
      '--disable-gpu',
      '--no-sandbox',
    ],
  });
  const page = await browser.newPage();
  await page.setViewport(viewport);
  return { browser, page };
}

// ── Bezier Curve for Natural Mouse Movement ────────────

function bezierCurve(t, p0, p1, p2, p3) {
  const u = 1 - t;
  return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
}

function generateBezierPath(startX, startY, endX, endY, steps = 20) {
  const midX = (startX + endX) / 2;
  const midY = (startY + endY) / 2;
  const cp1x = startX + (midX - startX) * 0.5 + (Math.random() - 0.5) * 50;
  const cp1y = startY + (midY - startY) * 0.5 + (Math.random() - 0.5) * 50;
  const cp2x = midX + (endX - midX) * 0.5 + (Math.random() - 0.5) * 50;
  const cp2y = midY + (endY - midY) * 0.5 + (Math.random() - 0.5) * 50;

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

function randomDelay(min = 5, max = 25) {
  return Math.floor(Math.random() * (max - min) + min);
}

// ── Mouse Emulation ───────────────────────────────────

async function mouseMove(url, startX, startY, endX, endY, options = {}) {
  const { steps = 20, delay = 10, screenshot = false } = options;
  const { browser, page } = await launchBrowser(false);
  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    const mousePath = generateBezierPath(startX, startY, endX, endY, steps);
    
    await page.mouse.move(startX, startY);
    
    for (const point of mousePath) {
      await page.mouse.move(point.x, point.y);
      await new Promise(r => setTimeout(r, delay + randomDelay()));
    }
    
    console.log(`Mouse moved from (${startX}, ${startY}) to (${endX}, ${endY})`);
    console.log(`Path: ${mousePath.length} steps`);
    
    if (screenshot) {
      const name = `mouse-move-${Date.now()}.png`;
      const outPath = path.join(SCREENSHOTS_DIR, name);
      await page.screenshot({ path: outPath, fullPage: false });
      console.log(`Screenshot: ${outPath}`);
    }
    
    return { steps: mousePath.length };
  } finally {
    await browser.close();
  }
}

async function mouseClick(url, x, y, options = {}) {
  const { button = 'left', clickCount = 1, delay = 100 } = options;
  const { browser, page } = await launchBrowser(false);
  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    
    await page.mouse.move(x, y, { steps: 10 });
    await new Promise(r => setTimeout(r, delay));
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

async function mouseDoubleClick(url, x, y) {
  return mouseClick(url, x, y, { clickCount: 2 });
}

async function mouseRightClick(url, x, y) {
  return mouseClick(url, x, y, { button: 'right' });
}

async function mouseDrag(url, startX, startY, endX, endY, options = {}) {
  const { steps = 30, delay = 10 } = options;
  const { browser, page } = await launchBrowser(false);
  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    
    await page.mouse.move(startX, startY, { steps: 5 });
    await new Promise(r => setTimeout(r, 100));
    await page.mouse.down();
    
    const dragPath = generateBezierPath(startX, startY, endX, endY, steps);
    for (const point of dragPath) {
      await page.mouse.move(point.x, point.y);
      await new Promise(r => setTimeout(r, delay + randomDelay()));
    }
    
    await new Promise(r => setTimeout(r, 100));
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

async function mouseHover(url, x, y, options = {}) {
  const { duration = 1000, screenshot = false } = options;
  const { browser, page } = await launchBrowser(false);
  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    
    await page.mouse.move(x, y, { steps: 15 });
    console.log(`Hovering at (${x}, ${y}) for ${duration}ms`);
    await new Promise(r => setTimeout(r, duration));
    
    if (screenshot) {
      const name = `hover-${Date.now()}.png`;
      const outPath = path.join(SCREENSHOTS_DIR, name);
      await page.screenshot({ path: outPath, fullPage: false });
      console.log(`Screenshot: ${outPath}`);
    }
    
    return { x, y, duration };
  } finally {
    await browser.close();
  }
}

async function mouseScroll(url, x, y, scrollX, scrollY) {
  const { browser, page } = await launchBrowser(false);
  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    
    await page.mouse.move(x, y);
    await page.mouse.wheel({ deltaX: scrollX, deltaY: scrollY });
    
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

async function mousePath(url, points, options = {}) {
  const { delay = 15, screenshot = false } = options;
  const { browser, page } = await launchBrowser(false);
  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    
    for (let i = 0; i < points.length - 1; i++) {
      const from = points[i];
      const to = points[i + 1];
      const pathSegment = generateBezierPath(from.x, from.y, to.x, to.y, 15);
      
      for (const point of pathSegment) {
        await page.mouse.move(point.x, point.y);
        await new Promise(r => setTimeout(r, delay + randomDelay()));
      }
    }
    
    console.log(`Moved through ${points.length} points`);
    
    if (screenshot) {
      const name = `path-${Date.now()}.png`;
      const outPath = path.join(SCREENSHOTS_DIR, name);
      await page.screenshot({ path: outPath, fullPage: false });
      console.log(`Screenshot: ${outPath}`);
    }
    
    return { points: points.length };
  } finally {
    await browser.close();
  }
}

async function mouseWiggle(url, x, y, options = {}) {
  const { radius = 20, duration = 2000, screenshot = false } = options;
  const { browser, page } = await launchBrowser(false);
  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    
    const startTime = Date.now();
    const steps = Math.floor(duration / 30);
    
    for (let i = 0; i < steps; i++) {
      const angle = (i / steps) * Math.PI * 4;
      const offsetX = Math.cos(angle) * radius * (1 - i / steps);
      const offsetY = Math.sin(angle) * radius * (1 - i / steps);
      await page.mouse.move(x + offsetX, y + offsetY);
      await new Promise(r => setTimeout(r, 30));
    }
    
    await page.mouse.move(x, y);
    console.log(`Wiggled at (${x}, ${y}) for ${duration}ms`);
    
    if (screenshot) {
      const name = `wiggle-${Date.now()}.png`;
      const outPath = path.join(SCREENSHOTS_DIR, name);
      await page.screenshot({ path: outPath, fullPage: false });
      console.log(`Screenshot: ${outPath}`);
    }
    
    return { x, y, duration };
  } finally {
    await browser.close();
  }
}

// ── Enhanced Screenshots ──────────────────────────────

async function screenshotViewport(url, filename, options = {}) {
  const { width = 1920, height = 1080, scale = 1 } = options;
  const { browser, page } = await launchBrowser(false, { width, height });
  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    await page.setViewport({ width, height, deviceScaleFactor: scale });
    
    const name = filename || `viewport-${Date.now()}.png`;
    const outPath = path.join(SCREENSHOTS_DIR, name);
    await page.screenshot({ path: outPath, fullPage: false });
    console.log(`Viewport screenshot (${width}x${height}): ${outPath}`);
    return outPath;
  } finally {
    await browser.close();
  }
}

async function screenshotFullPage(url, filename) {
  const { browser, page } = await launchBrowser(false);
  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    
    const name = filename || `fullpage-${Date.now()}.png`;
    const outPath = path.join(SCREENSHOTS_DIR, name);
    await page.screenshot({ path: outPath, fullPage: true });
    console.log(`Full page screenshot: ${outPath}`);
    return outPath;
  } finally {
    await browser.close();
  }
}

async function screenshotClip(url, filename, clip) {
  const { browser, page } = await launchBrowser(false);
  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    
    const name = filename || `clip-${Date.now()}.png`;
    const outPath = path.join(SCREENSHOTS_DIR, name);
    await page.screenshot({ path: outPath, clip });
    console.log(`Clipped screenshot: ${outPath}`);
    return outPath;
  } finally {
    await browser.close();
  }
}

async function screenshotElement(url, filename, selector) {
  const { browser, page } = await launchBrowser(false);
  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
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

async function screenshotPdf(url, filename) {
  const { browser, page } = await launchBrowser(true);
  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    
    const name = filename || `page-${Date.now()}.pdf`;
    const outPath = path.join(SCREENSHOTS_DIR, name);
    await page.pdf({ path: outPath, format: 'A4', printBackground: true });
    console.log(`PDF screenshot: ${outPath}`);
    return outPath;
  } finally {
    await browser.close();
  }
}

async function screenshotMultiple(url, count = 3, interval = 1000) {
  const { browser, page } = await launchBrowser(false);
  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    
    const screenshots = [];
    for (let i = 0; i < count; i++) {
      const name = `multi-${Date.now()}-${i}.png`;
      const outPath = path.join(SCREENSHOTS_DIR, name);
      await page.screenshot({ path: outPath, fullPage: false });
      screenshots.push(outPath);
      console.log(`Screenshot ${i + 1}: ${outPath}`);
      if (i < count - 1) await new Promise(r => setTimeout(r, interval));
    }
    
    return screenshots;
  } finally {
    await browser.close();
  }
}

async function screenshotCompare(url1, url2, filename) {
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox'],
  });
  
  try {
    const page1 = await browser.newPage();
    await page1.goto(url1, { waitUntil: 'networkidle2', timeout: 30000 });
    const name1 = `compare-a-${Date.now()}.png`;
    const outPath1 = path.join(SCREENSHOTS_DIR, name1);
    await page1.screenshot({ path: outPath1, fullPage: true });
    console.log(`Screenshot A: ${outPath1}`);
    
    const page2 = await browser.newPage();
    await page2.goto(url2, { waitUntil: 'networkidle2', timeout: 30000 });
    const name2 = `compare-b-${Date.now()}.png`;
    const outPath2 = path.join(SCREENSHOTS_DIR, name2);
    await page2.screenshot({ path: outPath2, fullPage: true });
    console.log(`Screenshot B: ${outPath2}`);
    
    return { a: outPath1, b: outPath2 };
  } finally {
    await browser.close();
  }
}

// ── Existing Commands ─────────────────────────────────

async function nav(url) {
  const { browser, page } = await launchBrowser();
  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    const title = await page.title();
    console.log(`Title: ${title}`);
    console.log(`URL: ${page.url()}`);
    return { title, url: page.url() };
  } finally {
    await browser.close();
  }
}

async function getText(url) {
  const { browser, page } = await launchBrowser();
  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    const text = await page.evaluate(() => document.body.innerText);
    console.log(text);
    return text;
  } finally {
    await browser.close();
  }
}

async function fillAndSubmit(url, selector, value) {
  const { browser, page } = await launchBrowser();
  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    await page.type(selector, value);
    await page.keyboard.press('Enter');
    await new Promise(r => setTimeout(r, 2000));
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

async function execScript(url, script) {
  const { browser, page } = await launchBrowser();
  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    const result = await page.evaluate(script);
    console.log(JSON.stringify(result, null, 2));
    return result;
  } finally {
    await browser.close();
  }
}

async function downloadPage(url, output) {
  const { browser, page } = await launchBrowser();
  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
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

async function multiTab(urls) {
  const { browser, page } = await launchBrowser();
  try {
    for (const url of urls) {
      const newPage = await browser.newPage();
      await newPage.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
      console.log(`${url} -> ${await newPage.title()}`);
    }
    const pages = await browser.pages();
    const name = `multi-tab-${Date.now()}.png`;
    const outPath = path.join(SCREENSHOTS_DIR, name);
    await pages[pages.length - 1].screenshot({ path: outPath, fullPage: true });
    console.log(`Last tab screenshot: ${outPath}`);
    return outPath;
  } finally {
    await browser.close();
  }
}

async function cookies(url) {
  const { browser, page } = await launchBrowser();
  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    const cookies = await page.cookies();
    console.log(JSON.stringify(cookies, null, 2));
    return cookies;
  } finally {
    await browser.close();
  }
}

async function headers(url) {
  const { browser, page } = await launchBrowser();
  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
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

module.exports = {
  launchBrowser,
  nav,
  getText,
  fillAndSubmit,
  execScript,
  downloadPage,
  multiTab,
  cookies,
  headers,
  mouseMove,
  mouseClick,
  mouseDoubleClick,
  mouseRightClick,
  mouseDrag,
  mouseHover,
  mouseScroll,
  mousePath,
  mouseWiggle,
  screenshotViewport,
  screenshotFullPage,
  screenshotClip,
  screenshotElement,
  screenshotPdf,
  screenshotMultiple,
  screenshotCompare,
};

const [,, command, ...args] = process.argv;

function usage() {
  console.log(`
Usage: node browser.js <command> [args]

Navigation:
  open <url>                       Navigate and print title
  text <url>                       Extract page text
  fill <url> <selector> <value>    Fill input and submit
  exec <url> <js-expression>       Run JS in page context
  download <url> [filename]        Save page HTML
  cookies <url>                    Get page cookies
  headers <url>                    Get page meta tags
  tabs <url1> <url2> ...           Open multiple tabs

Screenshots:
  screenshot <url> [file]          Full-page screenshot
  viewport <url> [file] [WxH]      Viewport screenshot (default 1920x1080)
  element <url> [file] <selector>  Screenshot specific element
  clip <url> [file] {x,y,w,h}     Screenshot clipped region
  compare <url1> <url2>            Compare two pages
  pdf <url> [file]                 Save as PDF
  multi-shot <url> [count] [ms]    Multiple screenshots over time

Mouse Emulation:
  move <url> x1 y1 x2 y2 [steps]  Move mouse along bezier curve
  click <url> x y [left|right]     Click at coordinates
  double-click <url> x y           Double-click at coordinates
  right-click <url> x y            Right-click at coordinates
  drag <url> x1 y1 x2 y2          Drag from point to point
  hover <url> x y [ms]             Hover at coordinates
  scroll <url> x y dx dy           Scroll at coordinates
  path <url> x1,y1 x2,y2 ...      Move through multiple points
  wiggle <url> x y [radius] [ms]   Wiggle mouse around point
`);
}

(async () => {
  try {
    switch (command) {
      case 'open':
        await nav(args[0]);
        break;
      case 'text':
        await getText(args[0]);
        break;
      case 'fill':
        await fillAndSubmit(args[0], args[1], args.slice(2).join(' '));
        break;
      case 'exec':
        await execScript(args[0], args.slice(1).join(' '));
        break;
      case 'download':
        await downloadPage(args[0], args[1]);
        break;
      case 'cookies':
        await cookies(args[0]);
        break;
      case 'headers':
        await headers(args[0]);
        break;
      case 'tabs':
        await multiTab(args);
        break;
      case 'screenshot':
        await screenshotFullPage(args[0], args[1]);
        break;
      case 'viewport':
        const [vw, vh] = (args[2] || '1920x1080').split('x').map(Number);
        await screenshotViewport(args[0], args[1], { width: vw, height: vh });
        break;
      case 'element':
        await screenshotElement(args[0], args[1], args[2]);
        break;
      case 'clip':
        const clip = JSON.parse(args[2] || '{}');
        await screenshotClip(args[0], args[1], clip);
        break;
      case 'compare':
        await screenshotCompare(args[0], args[1]);
        break;
      case 'pdf':
        await screenshotPdf(args[0], args[1]);
        break;
      case 'multi-shot':
        await screenshotMultiple(args[0], parseInt(args[1]) || 3, parseInt(args[2]) || 1000);
        break;
      case 'move':
        await mouseMove(args[0], parseInt(args[1]), parseInt(args[2]), parseInt(args[3]), parseInt(args[4]), { steps: parseInt(args[5]) || 20 });
        break;
      case 'click':
        await mouseClick(args[0], parseInt(args[1]), parseInt(args[2]), { button: args[3] || 'left' });
        break;
      case 'double-click':
        await mouseDoubleClick(args[0], parseInt(args[1]), parseInt(args[2]));
        break;
      case 'right-click':
        await mouseRightClick(args[0], parseInt(args[1]), parseInt(args[2]));
        break;
      case 'drag':
        await mouseDrag(args[0], parseInt(args[1]), parseInt(args[2]), parseInt(args[3]), parseInt(args[4]));
        break;
      case 'hover':
        await mouseHover(args[0], parseInt(args[1]), parseInt(args[2]), { duration: parseInt(args[3]) || 1000 });
        break;
      case 'scroll':
        await mouseScroll(args[0], parseInt(args[1]), parseInt(args[2]), parseInt(args[3]) || 0, parseInt(args[4]) || 100);
        break;
      case 'path':
        const points = args.slice(1).map(a => {
          const [x, y] = a.split(',').map(Number);
          return { x, y };
        });
        await mousePath(args[0], points);
        break;
      case 'wiggle':
        await mouseWiggle(args[0], parseInt(args[1]), parseInt(args[2]), { radius: parseInt(args[3]) || 20, duration: parseInt(args[4]) || 2000 });
        break;
      default:
        usage();
    }
  } catch (e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
})();
