# System Automation Graph

```
┌─────────────────────────────────────────────────────────────────┐
│                    YOUR SYSTEM                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │   Process    │    │    Temp      │    │    Gmail     │      │
│  │   Manager    │    │    Cleaner   │    │   Manager    │      │
│  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘      │
│         │                   │                   │               │
│         ▼                   ▼                   ▼               │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │ Kill Apps    │    │ Delete Files │    │ OAuth2 Auth  │      │
│  │ (Spotify,    │    │ (%TEMP%,     │    │ (Google API) │      │
│  │  Discord)    │    │  Windows\Temp│    │              │      │
│  └──────────────┘    └──────────────┘    └──────┬───────┘      │
│                                                  │               │
│                            ┌─────────────────────┼─────────┐   │
│                            │                     │         │   │
│                            ▼                     ▼         ▼   │
│                    ┌──────────────┐    ┌──────────────┐        │
│                    │   Unsubscribe│    │  List/Clear  │        │
│                    │   from Lists │    │    Inbox     │        │
│                    │ (42 lists)   │    │  (100 emails)│        │
│                    └──────────────┘    └──────────────┘        │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                     TOOLS & SCRIPTS                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    PowerShell CLI                        │   │
│  │  • Get-Process  • Remove-Item  • Stop-Process           │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                  │
│                              ▼                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                      Node.js                             │   │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐   │   │
│  │  │ Puppet- │  │ google- │  │ dotenv  │  │ express │   │   │
│  │  │ eer     │  │ apis    │  │         │  │         │   │   │
│  │  └─────────┘  └─────────┘  └─────────┘  └─────────┘   │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                     Your Scripts                         │   │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐   │   │
│  │  │auth.js  │  │gmail.js │  │demo.js  │  │unsub-   │   │   │
│  │  │         │  │         │  │         │  │scribe.js│   │   │
│  │  └─────────┘  └─────────┘  └─────────┘  └─────────┘   │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                       API CONNECTIONS                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                  Google OAuth2                           │   │
│  │                                                         │   │
│  │   Client ID: 448804566470-...                           │   │
│  │   Scopes: gmail.modify, gmail.send                      │   │
│  │   Token: token.json (refresh token)                     │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                  Gmail API Endpoints                     │   │
│  │                                                         │   │
│  │   GET  /users/me/messages          → List emails        │   │
│  │   GET  /users/me/messages/{id}     → Read email         │   │
│  │   POST /users/me/messages/send     → Send email         │   │
│  │   DEL  /users/me/messages/{id}     → Delete email       │   │
│  │   GET  /users/me/labels            → Get labels         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                     DATA FLOW                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   User Request                                                  │
│        │                                                        │
│        ▼                                                        │
│   ┌─────────┐     ┌─────────┐     ┌─────────┐                 │
│   │  CLI    │────▶│ Node.js │────▶│ Google  │                 │
│   │ Command │     │ Script  │     │   API   │                 │
│   └─────────┘     └─────────┘     └─────────┘                 │
│        │                │                │                     │
│        │                │                │                     │
│        ▼                ▼                ▼                     │
│   ┌─────────┐     ┌─────────┐     ┌─────────┐                 │
│   │Terminal │     │ .env    │     │ Gmail   │                 │
│   │ Output  │     │ (creds) │     │ Server  │                 │
│   └─────────┘     └─────────┘     └─────────┘                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## File Structure

```
Default Project/
├── .env                 # OAuth credentials (KEEP PRIVATE)
├── token.json           # Google auth token
├── auth.js              # OAuth2 authentication server
├── gmail.js             # Email operations (list/clear/send)
├── unsubscribe.js       # Unsubscribe from mailing lists
├── demo.js              # Puppeteer demo script
├── screenshot.png       # Captured screenshot
└── node_modules/        # Dependencies
    ├── googleapis/      # Google API client
    ├── dotenv/          # Environment variables
    ├── express/         # HTTP server for OAuth
    └── puppeteer/       # Browser automation
```

## Commands Cheat Sheet

| Task | Command |
|------|---------|
| View emails | `node gmail.js list` |
| Clear inbox | `node gmail.js clear` |
| Send email | `node gmail.js send recipient@email.com "Subject" "Body"` |
| Unsubscribe | `node unsubscribe.js` |
| Auth refresh | `node auth.js` |
| Browser demo | `node demo.js` |
