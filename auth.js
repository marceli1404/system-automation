require('dotenv').config();
const { google } = require('googleapis');
const express = require('express');
const fs = require('fs');

const { CLIENT_ID, CLIENT_SECRET, REDIRECT_URI } = process.env;
const SCOPES = ['https://mail.google.com/', 'https://www.googleapis.com/auth/calendar'];
const TOKEN_PATH = 'token.json';

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

if (fs.existsSync(TOKEN_PATH)) {
  oauth2Client.setCredentials(JSON.parse(fs.readFileSync(TOKEN_PATH)));
  console.log('Already authenticated!');
  process.exit(0);
}

const app = express();

app.get('/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) {
    res.send('No code received');
    return;
  }
  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens));
  res.send('Authenticated! You can close this tab.');
  console.log('Token saved!');
  setTimeout(() => process.exit(0), 1000);
});

app.listen(3000, () => {
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  });
  console.log('Open this URL in your browser:\n');
  console.log(authUrl);
});
