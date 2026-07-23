#!/usr/bin/env node
require('dotenv').config();
const { google } = require('googleapis');
const express = require('express');
const fs = require('fs');
const https = require('https');
const http = require('http');
const {
  nav, getText, fillAndSubmit, execScript, downloadPage, cookies, headers, multiTab,
  screenshotFullPage, screenshotViewport, screenshotElement, screenshotClip,
  screenshotPdf, screenshotMultiple, screenshotCompare, crossBrowserTest,
  mouseMove, mouseClick, mouseDoubleClick, mouseRightClick, mouseDrag,
  mouseHover, mouseScroll, mousePath, mouseWiggle,
  getAccessibilityTree, interceptRequests,
  checkStealthHealth, wpLogin, wpGetUsers,
} = require('./playwright');

const { CLIENT_ID, CLIENT_SECRET, REDIRECT_URI } = process.env;
const TOKEN_PATH = 'token.json';

function getAuth() {
  const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
  if (fs.existsSync(TOKEN_PATH)) {
    oauth2Client.setCredentials(JSON.parse(fs.readFileSync(TOKEN_PATH)));
  }
  return oauth2Client;
}

function getGmail() {
  return google.gmail({ version: 'v1', auth: getAuth() });
}

function getCalendar() {
  return google.calendar({ version: 'v3', auth: getAuth() });
}

// ── Gmail ──────────────────────────────────────────────

async function gmailList(count) {
  const gmail = getGmail();
  const res = await gmail.users.messages.list({ userId: 'me', maxResults: count });
  const messages = res.data.messages || [];
  for (const msg of messages) {
    const full = await gmail.users.messages.get({ userId: 'me', id: msg.id });
    const headers = full.data.payload.headers;
    const subject = headers.find(h => h.name === 'Subject')?.value || '(no subject)';
    const from = headers.find(h => h.name === 'From')?.value || '(unknown)';
    console.log(`From: ${from} | Subject: ${subject}`);
  }
}

async function gmailSend(to, subject, body) {
  const gmail = getGmail();
  const raw = Buffer.from(
    `To: ${to}\nSubject: ${subject}\nContent-Type: text/plain; charset=utf-8\n\n${body}`
  ).toString('base64').replace(/\+/g, '-').replace(/\//g, '_');
  const res = await gmail.users.messages.send({ userId: 'me', resource: { raw } });
  console.log('Email sent! ID:', res.data.id);
}

async function gmailClear() {
  const gmail = getGmail();
  const res = await gmail.users.messages.list({ userId: 'me', maxResults: 100 });
  const messages = res.data.messages || [];
  console.log(`Found ${messages.length} emails`);
  for (const msg of messages) {
    await gmail.users.messages.delete({ userId: 'me', id: msg.id });
    console.log(`Deleted: ${msg.id}`);
  }
  console.log('Inbox cleared!');
}

// ── Calendar ───────────────────────────────────────────

async function calendarList(count) {
  const calendar = getCalendar();
  const res = await calendar.events.list({
    calendarId: 'primary',
    timeMin: new Date().toISOString(),
    maxResults: count,
    singleEvents: true,
    orderBy: 'startTime',
  });
  const events = res.data.items || [];
  if (events.length === 0) { console.log('No upcoming events found.'); return; }
  events.forEach((e) => {
    const start = e.start.dateTime || e.start.date;
    console.log(`${start} - ${e.summary}`);
  });
}

async function calendarCreate(summary, start, end, description) {
  const calendar = getCalendar();
  const event = {
    summary,
    description,
    start: { dateTime: start, timeZone: 'Europe/London' },
    end: { dateTime: end, timeZone: 'Europe/London' },
  };
  const res = await calendar.events.insert({ calendarId: 'primary', resource: event });
  console.log('Event created:', res.data.htmlLink);
}

async function calendarDelete(eventId) {
  const calendar = getCalendar();
  await calendar.events.delete({ calendarId: 'primary', eventId });
  console.log('Event deleted:', eventId);
}

async function calendarFree(date) {
  const calendar = getCalendar();
  const startOfDay = new Date(date);
  startOfDay.setHours(9, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(18, 0, 0, 0);

  const res = await calendar.freebusy.query({
    resource: {
      timeMin: startOfDay.toISOString(),
      timeMax: endOfDay.toISOString(),
      items: [{ id: 'primary' }],
    },
  });

  const busy = res.data.calendars.primary.busy;
  const freeSlots = [];
  let current = new Date(startOfDay);

  for (const slot of busy) {
    const busyStart = new Date(slot.start);
    if (current < busyStart) {
      freeSlots.push({
        start: current.toLocaleTimeString(),
        end: busyStart.toLocaleTimeString(),
        duration: (busyStart - current) / 60000,
      });
    }
    current = new Date(Math.max(current, new Date(slot.end)));
  }

  if (current < endOfDay) {
    freeSlots.push({
      start: current.toLocaleTimeString(),
      end: endOfDay.toLocaleTimeString(),
      duration: (endOfDay - current) / 60000,
    });
  }

  console.log('Free slots:');
  freeSlots.forEach((s) => console.log(`${s.start} - ${s.end} (${s.duration} min)`));
}

// ── Unsubscribe ────────────────────────────────────────

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data }));
    }).on('error', reject);
  });
}

async function unsubscribe(maxEmails) {
  const gmail = getGmail();
  const res = await gmail.users.messages.list({ userId: 'me', maxResults: maxEmails });
  const messages = res.data.messages || [];
  console.log(`Checking ${messages.length} emails...\n`);

  let count = 0;
  for (const msg of messages) {
    const full = await gmail.users.messages.get({ userId: 'me', id: msg.id, format: 'full' });
    const headers = full.data.payload.headers;
    const from = headers.find(h => h.name === 'From')?.value || '';
    const unsub = headers.find(h => h.name === 'List-Unsubscribe');
    if (unsub) {
      const match = unsub.value.match(/<(https?:\/\/[^>]+)>/);
      if (match) {
        console.log(`Unsubscribing from: ${from}`);
        try {
          await fetchUrl(match[1]);
          console.log(`  Done`);
          count++;
        } catch (e) {
          console.log(`  Failed: ${e.message}`);
        }
      }
    }
  }
  console.log(`\nUnsubscribed from ${count} mailing lists`);
}

// ── Auth ───────────────────────────────────────────────

function auth() {
  if (fs.existsSync(TOKEN_PATH)) {
    console.log('Already authenticated!');
    return;
  }
  const SCOPES = ['https://mail.google.com/', 'https://www.googleapis.com/auth/calendar'];
  const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
  const app = express();

  app.get('/callback', async (req, res) => {
    const { code } = req.query;
    if (!code) { res.send('No code received'); return; }
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);
    fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens));
    res.send('Authenticated! You can close this tab.');
    console.log('Token saved!');
    setTimeout(() => process.exit(0), 1000);
  });

  app.listen(3000, () => {
    const authUrl = oauth2Client.generateAuthUrl({ access_type: 'offline', scope: SCOPES });
    console.log('Open this URL in your browser:\n');
    console.log(authUrl);
  });
}

// ── CLI Router ─────────────────────────────────────────

const [,, cmd, sub, ...rawArgs] = process.argv;

const useExt = rawArgs.includes('--ext');
const useStealth = !rawArgs.includes('--no-stealth');
const filteredArgs = rawArgs.filter(a => a !== '--ext' && a !== '--stealth');

const VALID_BROWSERS = ['chromium', 'firefox', 'webkit'];
const lastArg = filteredArgs[filteredArgs.length - 1];
const browserType = VALID_BROWSERS.includes(lastArg) ? lastArg : 'chromium';
const cmdArgs = VALID_BROWSERS.includes(lastArg) ? filteredArgs.slice(0, -1) : filteredArgs;

function usage() {
  console.log(`
Usage: node cli.js <command> <subcommand> [args] [--ext] [--stealth]

Gmail:
  gmail list [count]                 List recent emails
  gmail send <to> <subject> <body>   Send an email
  gmail clear                        Delete first 100 emails

Calendar:
  calendar list [count]              List upcoming events
  calendar create <title> <start> <end> [desc]  Create event
  calendar delete <eventId>          Delete an event
  calendar free [date]               Find free slots (YYYY-MM-DD)

Browser Navigation (Playwright):
  browser open <url> [engine]        Navigate (chromium/firefox/webkit)
  browser text <url> [engine]        Extract page text
  browser fill <url> <sel> <val>     Fill input and submit
  browser exec <url> <js> [engine]   Run JS in page
  browser download <url> [file]      Save page HTML
  browser cookies <url> [engine]     Get page cookies
  browser headers <url> [engine]     Get meta tags
  browser tabs <url1> <url2> ...     Open multiple tabs

Screenshots:
  browser screenshot <url> [file]    Full-page screenshot
  browser viewport <url> [WxH]       Custom resolution
  browser element <url> <selector>   Screenshot element
  browser clip <url> {x,y,w,h}      Clipped region
  browser compare <url1> <url2>      Compare two pages
  browser pdf <url> [file]           Save as PDF
  browser multi-shot <url> [n] [ms]  Multiple screenshots
  browser cross-browser <url>        Test all browsers

Mouse Emulation:
  browser move <url> x1 y1 x2 y2    Move mouse (bezier)
  browser click <url> x y [btn]      Click at coordinates
  browser double-click <url> x y     Double-click
  browser right-click <url> x y      Right-click
  browser drag <url> x1 y1 x2 y2    Drag with bezier path
  browser hover <url> x y [ms]       Hover at coordinates
  browser scroll <url> x y dx dy     Mouse wheel
  browser path <url> x1,y1 x2,y2    Multiple waypoints
  browser wiggle <url> x y [r] [ms]  Human-like idle

Advanced:
  browser a11y <url>                 Accessibility tree
  browser intercept <url> [types]    Block resource types

Other:
  unsubscribe [maxEmails]            Unsubscribe from mailing lists
  auth                               Authenticate with Google
  stealth-health                     Check rayobrowse daemon status

WordPress:
  wp-login <url> [opts]              Bypass WP login (AJAX or form)
    --user-id=<id>                   Login as user ID (bypass-login plugin)
    --username=<user>                Login with username (form fallback)
    --password=<pass>                Login with password (form fallback)
  wp-users <url>                     List available users on login page

Flags:
  --ext                              Enable ad/tracker blocking + cookie dismissal
  --no-stealth                       Disable rayobrowse stealth browser

Append engine name to use Firefox/WebKit: ... chromium (default)
`);
}

(async () => {
  try {
    switch (cmd) {
      case 'gmail':
        if (sub === 'list') await gmailList(parseInt(cmdArgs[0]) || 10);
        else if (sub === 'send') await gmailSend(cmdArgs[0], cmdArgs[1], cmdArgs.slice(2).join(' '));
        else if (sub === 'clear') await gmailClear();
        else usage();
        break;
      case 'calendar':
        if (sub === 'list') await calendarList(parseInt(cmdArgs[0]) || 10);
        else if (sub === 'create') await calendarCreate(cmdArgs[0], cmdArgs[1], cmdArgs[2], cmdArgs.slice(3).join(' ') || '');
        else if (sub === 'delete') await calendarDelete(cmdArgs[0]);
        else if (sub === 'free') await calendarFree(cmdArgs[0] || new Date().toISOString().split('T')[0]);
        else usage();
        break;
      case 'browser':
        if (sub === 'open') await nav(cmdArgs[0], browserType, useExt, useStealth);
        else if (sub === 'text') await getText(cmdArgs[0], browserType, useExt, useStealth);
        else if (sub === 'fill') await fillAndSubmit(cmdArgs[0], cmdArgs[1], cmdArgs.slice(2).join(' '), browserType, useExt, useStealth);
        else if (sub === 'exec') await execScript(cmdArgs[0], cmdArgs.slice(1).join(' '), browserType, useExt, useStealth);
        else if (sub === 'download') await downloadPage(cmdArgs[0], cmdArgs[1], browserType, useExt, useStealth);
        else if (sub === 'cookies') await cookies(cmdArgs[0], browserType, useExt, useStealth);
        else if (sub === 'headers') await headers(cmdArgs[0], browserType, useExt, useStealth);
        else if (sub === 'tabs') await multiTab(cmdArgs, browserType, useExt, useStealth);
        else if (sub === 'screenshot') await screenshotFullPage(cmdArgs[0], cmdArgs[1], browserType, useExt, useStealth);
        else if (sub === 'viewport') {
          const [w, h] = (cmdArgs[1] || '1920x1080').split('x').map(Number);
          await screenshotViewport(cmdArgs[0], null, { width: w, height: h }, browserType, useExt, useStealth);
        }
        else if (sub === 'element') await screenshotElement(cmdArgs[0], null, cmdArgs[1], browserType, useExt, useStealth);
        else if (sub === 'clip') await screenshotClip(cmdArgs[0], null, JSON.parse(cmdArgs[1] || '{}'), browserType, useExt, useStealth);
        else if (sub === 'compare') await screenshotCompare(cmdArgs[0], cmdArgs[1], browserType, useExt, useStealth);
        else if (sub === 'pdf') await screenshotPdf(cmdArgs[0], cmdArgs[1], browserType, useExt, useStealth);
        else if (sub === 'multi-shot') await screenshotMultiple(cmdArgs[0], parseInt(cmdArgs[1]) || 3, parseInt(cmdArgs[2]) || 1000, browserType, useExt, useStealth);
        else if (sub === 'cross-browser') await crossBrowserTest(cmdArgs[0], undefined, useExt, useStealth);
        else if (sub === 'move') await mouseMove(cmdArgs[0], parseInt(cmdArgs[1]), parseInt(cmdArgs[2]), parseInt(cmdArgs[3]), parseInt(cmdArgs[4]), { steps: parseInt(cmdArgs[5]) || 20 }, browserType, useExt, useStealth);
        else if (sub === 'click') await mouseClick(cmdArgs[0], parseInt(cmdArgs[1]), parseInt(cmdArgs[2]), { button: cmdArgs[3] || 'left' }, browserType, useExt, useStealth);
        else if (sub === 'double-click') await mouseDoubleClick(cmdArgs[0], parseInt(cmdArgs[1]), parseInt(cmdArgs[2]), browserType, useExt, useStealth);
        else if (sub === 'right-click') await mouseRightClick(cmdArgs[0], parseInt(cmdArgs[1]), parseInt(cmdArgs[2]), browserType, useExt, useStealth);
        else if (sub === 'drag') await mouseDrag(cmdArgs[0], parseInt(cmdArgs[1]), parseInt(cmdArgs[2]), parseInt(cmdArgs[3]), parseInt(cmdArgs[4]), {}, browserType, useExt, useStealth);
        else if (sub === 'hover') await mouseHover(cmdArgs[0], parseInt(cmdArgs[1]), parseInt(cmdArgs[2]), { duration: parseInt(cmdArgs[3]) || 1000 }, browserType, useExt, useStealth);
        else if (sub === 'scroll') await mouseScroll(cmdArgs[0], parseInt(cmdArgs[1]), parseInt(cmdArgs[2]), parseInt(cmdArgs[3]) || 0, parseInt(cmdArgs[4]) || 100, browserType, useExt, useStealth);
        else if (sub === 'path') {
          const points = cmdArgs.slice(1).map(a => {
            const [x, y] = a.split(',').map(Number);
            return { x, y };
          });
          await mousePath(cmdArgs[0], points, {}, browserType, useExt, useStealth);
        }
        else if (sub === 'wiggle') await mouseWiggle(cmdArgs[0], parseInt(cmdArgs[1]), parseInt(cmdArgs[2]), { radius: parseInt(cmdArgs[3]) || 20, duration: parseInt(cmdArgs[4]) || 2000 }, browserType, useExt, useStealth);
        else if (sub === 'a11y') await getAccessibilityTree(cmdArgs[0], browserType, useExt, useStealth);
        else if (sub === 'intercept') await interceptRequests(cmdArgs[0], cmdArgs[1] ? cmdArgs[1].split(',') : ['image'], browserType, useExt, useStealth);
        else usage();
        break;
      case 'unsubscribe':
        await unsubscribe(parseInt(sub) || 50);
        break;
      case 'auth':
        auth();
        break;
      case 'stealth-health':
        await checkStealthHealth();
        break;
      case 'wp-login': {
        const url = sub;
        const userIdFlag = cmdArgs.find(a => a.startsWith('--user-id='));
        const usernameFlag = cmdArgs.find(a => a.startsWith('--username='));
        const passwordFlag = cmdArgs.find(a => a.startsWith('--password='));
        const opts = {};
        if (userIdFlag) opts.userId = userIdFlag.split('=')[1];
        if (usernameFlag) opts.username = usernameFlag.split('=')[1];
        if (passwordFlag) opts.password = passwordFlag.split('=')[1];
        const result = await wpLogin(url, opts, browserType, useExt, useStealth);
        console.log(JSON.stringify(result, null, 2));
        break;
      }
      case 'wp-users': {
        const url = sub;
        const result = await wpGetUsers(url, browserType, useExt, useStealth);
        console.log(JSON.stringify(result, null, 2));
        break;
      }
      default:
        usage();
    }
  } catch (e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
})();
