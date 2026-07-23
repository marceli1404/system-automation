require('dotenv').config();
const { google } = require('googleapis');
const fs = require('fs');

const { CLIENT_ID, CLIENT_SECRET, REDIRECT_URI } = process.env;
const TOKEN_PATH = 'token.json';

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
oauth2Client.setCredentials(JSON.parse(fs.readFileSync(TOKEN_PATH)));

const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

async function sendEmail(to, subject, body) {
  const raw = Buffer.from(
    `To: ${to}\nSubject: ${subject}\nContent-Type: text/plain; charset=utf-8\n\n${body}`
  ).toString('base64').replace(/\+/g, '-').replace(/\//g, '_');

  const res = await gmail.users.messages.send({
    userId: 'me',
    resource: { raw },
  });
  console.log('Email sent! ID:', res.data.id);
}

async function clearInbox() {
  const res = await gmail.users.messages.list({ userId: 'me', maxResults: 100 });
  const messages = res.data.messages || [];
  console.log(`Found ${messages.length} emails`);

  for (const msg of messages) {
    await gmail.users.messages.delete({ userId: 'me', id: msg.id });
    console.log(`Deleted: ${msg.id}`);
  }
  console.log('Inbox cleared!');
}

async function listEmails(max = 10) {
  const res = await gmail.users.messages.list({ userId: 'me', maxResults: max });
  const messages = res.data.messages || [];

  for (const msg of messages) {
    const full = await gmail.users.messages.get({ userId: 'me', id: msg.id });
    const headers = full.data.payload.headers;
    const subject = headers.find(h => h.name === 'Subject')?.value || '(no subject)';
    const from = headers.find(h => h.name === 'From')?.value || '(unknown)';
    console.log(`From: ${from} | Subject: ${subject}`);
  }
}

const [,, command, ...args] = process.argv;

switch (command) {
  case 'send':
    sendEmail(args[0], args[1], args[2]);
    break;
  case 'clear':
    clearInbox();
    break;
  case 'list':
    listEmails(parseInt(args[0]) || 10);
    break;
  default:
    console.log('Usage:');
    console.log('  node gmail.js send <to> <subject> <body>');
    console.log('  node gmail.js clear');
    console.log('  node gmail.js list [count]');
}
