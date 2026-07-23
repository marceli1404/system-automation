require('dotenv').config();
const { google } = require('googleapis');
const fs = require('fs');
const https = require('https');
const http = require('http');

const { CLIENT_ID, CLIENT_SECRET, REDIRECT_URI } = process.env;
const TOKEN_PATH = 'token.json';

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
oauth2Client.setCredentials(JSON.parse(fs.readFileSync(TOKEN_PATH)));

const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

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

async function unsubscribeFromAll() {
  const res = await gmail.users.messages.list({ userId: 'me', maxResults: 50 });
  const messages = res.data.messages || [];
  console.log(`Checking ${messages.length} emails...\n`);

  let count = 0;
  for (const msg of messages) {
    const full = await gmail.users.messages.get({ userId: 'me', id: msg.id, format: 'full' });
    const headers = full.data.payload.headers;
    const from = headers.find(h => h.name === 'From')?.value || '';
    const subject = headers.find(h => h.name === 'Subject')?.value || '';
    const unsubscribeHeader = headers.find(h => h.name === 'List-Unsubscribe');

    if (unsubscribeHeader) {
      const match = unsubscribeHeader.value.match(/<(https?:\/\/[^>]+)>/);
      if (match) {
        const url = match[1];
        console.log(`Unsubscribing from: ${from}`);
        try {
          await fetchUrl(url);
          console.log(`  ✓ Done`);
          count++;
        } catch (e) {
          console.log(`  ✗ Failed: ${e.message}`);
        }
      }
    }
  }
  console.log(`\nUnsubscribed from ${count} mailing lists`);
}

unsubscribeFromAll();
