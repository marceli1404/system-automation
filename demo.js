const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();

  await page.goto('https://example.com');
  console.log('Page title:', await page.title());

  await page.screenshot({ path: 'screenshot.png', fullPage: true });
  console.log('Screenshot saved!');

  await browser.close();
})();
