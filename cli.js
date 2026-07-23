#!/usr/bin/env node
require('dotenv').config();
const { google } = require('googleapis');
const express = require('express');
const fs = require('fs');
const https = require('https');
const http = require('http');

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

// ── Screenshot ─────────────────────────────────────────

async function screenshot(url, output) {
  const puppeteer = require('puppeteer');
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();
  await page.goto(url);
  console.log('Page title:', await page.title());
  await page.screenshot({ path: output, fullPage: true });
  console.log(`Screenshot saved to ${output}`);
  await browser.close();
}

// ── CLI Router ─────────────────────────────────────────

const [,, cmd, sub, ...args] = process.argv;

function usage() {
  console.log(`
Usage: node cli.js <command> <subcommand> [args]

Commands:
  gmail list [count]              List recent emails
  gmail send <to> <subject> <body>  Send an email
  gmail clear                     Delete first 100 emails

  calendar list [count]           List upcoming events
  calendar create <title> <start> <end> [desc]  Create event
  calendar delete <eventId>       Delete an event
  calendar free [date]            Find free slots (YYYY-MM-DD)

  unsubscribe [maxEmails]         Unsubscribe from mailing lists

  auth                            Authenticate with Google

  screenshot <url> [output]       Take a screenshot of a URL
`);
}

(async () => {
  try {
    switch (cmd) {
      case 'gmail':
        if (sub === 'list') await gmailList(parseInt(args[0]) || 10);
        else if (sub === 'send') await gmailSend(args[0], args[1], args.slice(2).join(' '));
        else if (sub === 'clear') await gmailClear();
        else usage();
        break;
      case 'calendar':
        if (sub === 'list') await calendarList(parseInt(args[0]) || 10);
        else if (sub === 'create') await calendarCreate(args[0], args[1], args[2], args.slice(3).join(' ') || '');
        else if (sub === 'delete') await calendarDelete(args[0]);
        else if (sub === 'free') await calendarFree(args[0] || new Date().toISOString().split('T')[0]);
        else usage();
        break;
      case 'unsubscribe':
        await unsubscribe(parseInt(sub) || 50);
        break;
      case 'auth':
        auth();
        break;
      case 'screenshot':
        await screenshot(args[0] || 'https://example.com', args[1] || 'screenshot.png');
        break;
      default:
        usage();
    }
  } catch (e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
})();
