const {
  launchBrowser,
  screenshotViewport,
  screenshotFullPage,
  screenshotElement,
  mouseMove,
  mouseClick,
  mouseHover,
  mouseWiggle,
  mouseDrag,
  getText,
  execScript,
  screenshotCompare,
} = require('./browser');
const path = require('path');
const fs = require('fs');

const DEMO_DIR = path.join(__dirname, 'demo-screenshots');

async function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function runDemo() {
  await ensureDir(DEMO_DIR);
  console.log('=== Complex Browser Harness Demo ===\n');

  // ── Step 1: Launch and navigate ─────────────────────
  console.log('Step 1: Launching browser and navigating to GitHub...');
  const { browser, page } = await launchBrowser(false, { width: 1920, height: 1080 });
  
  await page.goto('https://github.com/marceli1404', { waitUntil: 'networkidle2', timeout: 30000 });
  console.log('  Page loaded:', await page.title());

  // ── Step 2: Take viewport screenshot ────────────────
  console.log('\nStep 2: Taking viewport screenshot...');
  await page.screenshot({ path: path.join(DEMO_DIR, '01-github-profile.png'), fullPage: false });
  console.log('  Saved: 01-github-profile.png');

  // ── Step 3: Natural mouse movement to repo ──────────
  console.log('\nStep 3: Moving mouse naturally to repo link...');
  
  // Move from top-left corner to the first repo link
  await page.mouse.move(100, 100);
  await sleep(200);
  
  // Bezier curve movement to the repo
  const startX = 100, startY = 100;
  const endX = 400, endY = 500;
  const steps = 30;
  
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = startX + (endX - startX) * t + Math.sin(t * Math.PI) * 50;
    const y = startY + (endY - startY) * t + Math.cos(t * Math.PI) * 30;
    await page.mouse.move(x, y);
    await sleep(20 + Math.random() * 20);
  }
  
  await page.screenshot({ path: path.join(DEMO_DIR, '02-mouse-moved.png'), fullPage: false });
  console.log('  Mouse moved with bezier curve');

  // ── Step 4: Hover over profile picture ──────────────
  console.log('\nStep 4: Hovering over profile picture...');
  try {
    const avatar = await page.$('.avatar-user, .avatar');
    if (avatar) {
      const box = await avatar.boundingBox();
      if (box) {
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 15 });
        await sleep(1000);
        await page.screenshot({ path: path.join(DEMO_DIR, '03-hover-avatar.png'), fullPage: false });
        console.log('  Hovered and captured');
      }
    }
  } catch (e) {
    console.log('  Avatar not found, continuing...');
  }

  // ── Step 5: Click on a tab and take element screenshot
  console.log('\nStep 5: Clicking on Repos tab and capturing element...');
  try {
    const reposTab = await page.$('a[data-tab-item="repositories"], [href$="tab=repositories"]');
    if (reposTab) {
      await reposTab.click();
      await sleep(2000);
      await page.screenshot({ path: path.join(DEMO_DIR, '04-repos-tab.png'), fullPage: false });
      console.log('  Repos tab clicked and captured');
    }
  } catch (e) {
    console.log('  Tab not found, continuing...');
  }

  // ── Step 6: Extract repository data with JS ─────────
  console.log('\nStep 6: Extracting repository data with JavaScript...');
  const repoData = await page.evaluate(() => {
    const repos = document.querySelectorAll('.repo-list-item, [class*="repo"]');
    return Array.from(repos).slice(0, 5).map(repo => {
      const name = repo.querySelector('a')?.textContent?.trim() || 'Unknown';
      const desc = repo.querySelector('p')?.textContent?.trim() || 'No description';
      const lang = repo.querySelector('[class*="language"]')?.textContent?.trim() || 'Unknown';
      return { name, desc, lang };
    });
  });
  
  console.log('  Found repositories:');
  repoData.forEach((repo, i) => {
    console.log(`    ${i + 1}. ${repo.name} (${repo.lang})`);
  });

  // ── Step 7: Wiggle mouse while "reading" ────────────
  console.log('\nStep 7: Simulating reading behavior (wiggle)...');
  await page.mouse.move(960, 400);
  await sleep(300);
  for (let i = 0; i < 3; i++) {
    // Wiggle around each repo
    const y = 350 + i * 100;
    await page.mouse.move(960, y);
    await sleep(200);
    // Small circular motion
    for (let j = 0; j < 10; j++) {
      const angle = (j / 10) * Math.PI * 2;
      await page.mouse.move(960 + Math.cos(angle) * 15, y + Math.sin(angle) * 15);
      await sleep(30);
    }
    await sleep(500);
  }
  await page.screenshot({ path: path.join(DEMO_DIR, '05-reading-complete.png'), fullPage: false });
  console.log('  Reading simulation complete');

  // ── Step 8: Drag to select text ─────────────────────
  console.log('\nStep 8: Simulating text selection via drag...');
  await page.mouse.move(300, 300);
  await sleep(100);
  await page.mouse.down();
  await sleep(100);
  for (let i = 0; i < 20; i++) {
    await page.mouse.move(300 + i * 10, 300);
    await sleep(10);
  }
  await page.mouse.up();
  await sleep(300);
  await page.screenshot({ path: path.join(DEMO_DIR, '06-text-selected.png'), fullPage: false });
  console.log('  Text selection simulated');

  // ── Step 9: Scroll down with mouse wheel ────────────
  console.log('\nStep 9: Scrolling down the page...');
  await page.mouse.move(960, 540);
  for (let i = 0; i < 5; i++) {
    await page.mouse.wheel({ deltaY: 300 });
    await sleep(400);
  }
  await page.screenshot({ path: path.join(DEMO_DIR, '07-scrolled.png'), fullPage: false });
  console.log('  Page scrolled');

  // ── Step 10: Multi-viewport comparison ──────────────
  console.log('\nStep 10: Taking desktop vs mobile screenshots...');
  await page.setViewport({ width: 1920, height: 1080 });
  await sleep(500);
  await page.screenshot({ path: path.join(DEMO_DIR, '08-desktop.png'), fullPage: false });
  
  await page.setViewport({ width: 375, height: 812 });
  await sleep(1000);
  await page.screenshot({ path: path.join(DEMO_DIR, '09-mobile.png'), fullPage: false });
  console.log('  Desktop and mobile screenshots captured');

  // ── Step 11: Full page screenshot ───────────────────
  console.log('\nStep 11: Taking full-page screenshot...');
  await page.setViewport({ width: 1920, height: 1080 });
  await sleep(500);
  await page.screenshot({ path: path.join(DEMO_DIR, '10-fullpage.png'), fullPage: true });
  console.log('  Full page screenshot saved');

  // ── Step 12: Final metrics ──────────────────────────
  console.log('\nStep 12: Final page metrics...');
  const metrics = await page.evaluate(() => ({
    title: document.title,
    links: document.querySelectorAll('a').length,
    images: document.querySelectorAll('img').length,
    height: document.body.scrollHeight,
    width: document.body.scrollWidth,
  }));
  
  console.log('  Page metrics:');
  console.log(`    Title: ${metrics.title}`);
  console.log(`    Links: ${metrics.links}`);
  console.log(`    Images: ${metrics.images}`);
  console.log(`    Height: ${metrics.height}px`);
  console.log(`    Width: ${metrics.width}px`);

  await browser.close();

  // ── Summary ─────────────────────────────────────────
  console.log('\n=== Demo Complete ===');
  console.log(`Screenshots saved to: ${DEMO_DIR}`);
  
  const files = fs.readdirSync(DEMO_DIR);
  console.log(`Total screenshots: ${files.length}`);
  files.forEach(f => console.log(`  - ${f}`));
}

runDemo().catch(console.error);
