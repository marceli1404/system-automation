const puppeteer = require('puppeteer');

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--start-maximized']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  console.log('Opening Google Cloud Console...');
  await page.goto('https://console.cloud.google.com/');
  await delay(3000);

  console.log('Creating new project...');
  await page.goto('https://console.cloud.google.com/projectcreate');
  await delay(2000);

  await page.type('input[ng-model="$ctrl.projectName"]', 'gmail-automation', { delay: 50 });
  await delay(1000);
  await page.click('button[ng-click="$ctrl.create()"]');
  await delay(5000);

  console.log('Enabling Gmail API...');
  await page.goto('https://console.cloud.google.com/apis/library/gmail.googleapis.com');
  await delay(3000);
  await page.click('button[aria-label="Enable"]');
  await delay(5000);

  console.log('Creating OAuth credentials...');
  await page.goto('https://console.cloud.google.com/apis/credentials');
  await delay(3000);
  await page.click('button[ng-click="$ctrl.onAddCredential()"]');
  await delay(2000);
  await page.click('div[ng-click="$ctrl.createOAuthClient()"]');
  await delay(2000);

  await page.select('select[ng-model="$ctrl.applicationType"]', 'web_app');
  await delay(500);
  await page.type('input[ng-model="$ctrl.name"]', 'Gmail Automation', { delay: 50 });
  await delay(500);
  await page.type('input[ng-model="$ctrl.authorizedOrigins"]', 'http://localhost:3000', { delay: 50 });
  await delay(500);
  await page.type('input[ng-model="$ctrl.redirectUris"]', 'http://localhost:3000/callback', { delay: 50 });
  await delay(1000);
  await page.click('button[ng-click="$ctrl.save()"]');
  await delay(3000);

  console.log('Setup complete! Credentials should be visible on screen.');
  console.log('Press Ctrl+C when done copying credentials.');

  await delay(300000);
  await browser.close();
})();
