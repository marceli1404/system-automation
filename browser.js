const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const SCREENSHOTS_DIR = path.join(__dirname, 'screenshots');

async function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

async function launchBrowser() {
  await ensureDir(SCREENSHOTS_DIR);
  const browser = await puppeteer.launch({
    headless: false,
    args: [
      '--remote-debugging-port=9222',
      '--no-first-run',
      '--disable-extensions',
    ],
  });
  return browser;
}

async function nav(url) {
  const browser = await launchBrowser();
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: 'networkidle2' });
  const title = await page.title();
  console.log(`Title: ${title}`);
  console.log(`URL: ${page.url()}`);
  await browser.close();
  return { title, url: page.url() };
}

async function screenshotUrl(url, filename) {
  const browser = await launchBrowser();
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: 'networkidle2' });
  const name = filename || `screenshot-${Date.now()}.png`;
  const outPath = path.join(SCREENSHOTS_DIR, name);
  await page.screenshot({ path: outPath, fullPage: true });
  console.log(`Screenshot saved: ${outPath}`);
  console.log(`Title: ${await page.title()}`);
  await browser.close();
  return outPath;
}

async function getText(url) {
  const browser = await launchBrowser();
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: 'networkidle2' });
  const text = await page.evaluate(() => document.body.innerText);
  console.log(text);
  await browser.close();
  return text;
}

async function fillAndSubmit(url, selector, value) {
  const browser = await launchBrowser();
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: 'networkidle2' });
  await page.type(selector, value);
  await page.keyboard.press('Enter');
  await new Promise(r => setTimeout(r, 2000));
  const title = await page.title();
  console.log(`Submitted. Title: ${title}`);
  const name = `form-result-${Date.now()}.png`;
  const outPath = path.join(SCREENSHOTS_DIR, name);
  await page.screenshot({ path: outPath, fullPage: true });
  console.log(`Result screenshot: ${outPath}`);
  await browser.close();
  return { title, screenshot: outPath };
}

async function execScript(url, script) {
  const browser = await launchBrowser();
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: 'networkidle2' });
  const result = await page.evaluate(script);
  console.log(JSON.stringify(result, null, 2));
  await browser.close();
  return result;
}

async function downloadPage(url, output) {
  const browser = await launchBrowser();
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: 'networkidle2' });
  const html = await page.content();
  const name = output || `page-${Date.now()}.html`;
  const outPath = path.join(__dirname, name);
  fs.writeFileSync(outPath, html);
  console.log(`Page saved: ${outPath} (${html.length} bytes)`);
  await browser.close();
  return outPath;
}

async function multiTab(urls) {
  const browser = await launchBrowser();
  for (const url of urls) {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle2' });
    console.log(`${url} -> ${await page.title()}`);
  }
  const name = `multi-tab-${Date.now()}.png`;
  const outPath = path.join(SCREENSHOTS_DIR, name);
  const pages = await browser.pages();
  await pages[pages.length - 1].screenshot({ path: outPath, fullPage: true });
  console.log(`Last tab screenshot: ${outPath}`);
  await browser.close();
  return outPath;
}

// ── CLI Router ─────────────────────────────────────────

const [,, command, ...args] = process.argv;

function usage() {
  console.log(`
Usage: node browser.js <command> [args]

Commands:
  open <url>                       Navigate and print title
  screenshot <url> [filename]      Save full-page screenshot
  text <url>                       Extract page text
  fill <url> <selector> <value>    Fill input and submit
  exec <url> <js-expression>       Run JS in page context
  download <url> [filename]        Save page HTML
  tabs <url1> <url2> ...           Open multiple tabs, screenshot last
`);
}

(async () => {
  try {
    switch (command) {
      case 'open':
        await nav(args[0] || 'https://example.com');
        break;
      case 'screenshot':
        await screenshotUrl(args[0] || 'https://example.com', args[1]);
        break;
      case 'text':
        await getText(args[0] || 'https://example.com');
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
      case 'tabs':
        await multiTab(args);
        break;
      default:
        usage();
    }
  } catch (e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
})();
