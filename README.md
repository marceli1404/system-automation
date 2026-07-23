# System Automation

Gmail automation, Puppeteer browser control, and system cleanup tools.

## Quick Start

```bash
npm install
node auth.js          # Authenticate with Google
node gmail.js list    # View emails
node gmail.js clear   # Delete all emails
node unsubscribe.js   # Unsubscribe from mailing lists
```

## System Automation Link Tree

```mermaid
graph TD
    ROOT[System Automation Hub] --> PROC[Process Manager]
    ROOT --> CLEAN[Temp Cleaner]
    ROOT --> GMAIL[Gmail Manager]
    ROOT --> PUP[Puppeteer]

    PROC --> KILL1[Kill Spotify]
    PROC --> KILL2[Kill Discord]
    PROC --> MONITOR[Monitor Usage]

    CLEAN --> USER_TEMP[User Temp Files]
    CLEAN --> WIN_TEMP[Windows Temp]
    CLEAN --> DNS[Flush DNS]

    GMAIL --> AUTH[OAuth2 Auth]
    GMAIL --> LIST[List Emails]
    GMAIL --> CLEAR[Clear Inbox]
    GMAIL --> SEND[Send Email]
    GMAIL --> UNSUB[Unsubscribe]

    PUP --> DEMO[Demo Script]
    PUP --> SCREENSHOT[Take Screenshots]

    AUTH --> CLIENT[Client ID]
    AUTH --> SECRET[Client Secret]
    AUTH --> TOKEN[Token Storage]

    LIST --> API[Gmail API]
    CLEAR --> API
    SEND --> API
    UNSUB --> API
    API --> GOOGLE[Google Servers]

    style ROOT fill:#ff6b6b,stroke:#333,color:white
    style GMAIL fill:#4ecdc4,stroke:#333,color:white
    style PROC fill:#45b7d1,stroke:#333,color:white
    style CLEAN fill:#96ceb4,stroke:#333,color:white
    style PUP fill:#feca57,stroke:#333,color:white
    style API fill:#ff9ff3,stroke:#333,color:white
    style GOOGLE fill:#54a0ff,stroke:#333,color:white
```

## File & Dependency Graph

```mermaid
graph LR
    subgraph Files[".env Files"]
        ENV1[.env<br/>OAuth Credentials]
        ENV2[token.json<br/>Auth Token]
    end

    subgraph Scripts["Node.js Scripts"]
        S1[auth.js<br/>OAuth Server]
        S2[gmail.js<br/>Email Operations]
        S3[unsubscribe.js<br/>List Cleanup]
        S4[demo.js<br/>Browser Demo]
    end

    subgraph Dependencies["npm Packages"]
        D1[googleapis]
        D2[dotenv]
        D3[express]
        D4[puppeteer]
    end

    subgraph Commands["CLI Commands"]
        C1[node gmail.js list]
        C2[node gmail.js clear]
        C3[node gmail.js send]
        C4[node unsubscribe.js]
        C5[node auth.js]
        C6[node demo.js]
    end

    ENV1 --> S1
    ENV1 --> S2
    ENV1 --> S3
    ENV2 --> S2
    ENV2 --> S3

    S1 --> D1
    S1 --> D2
    S1 --> D3
    S2 --> D1
    S2 --> D2
    S3 --> D1
    S3 --> D2
    S4 --> D4

    C1 --> S2
    C2 --> S2
    C3 --> S2
    C4 --> S3
    C5 --> S1
    C6 --> S4

    style ENV1 fill:#e74c3c,color:white
    style ENV2 fill:#e74c3c,color:white
    style S1 fill:#3498db,color:white
    style S2 fill:#3498db,color:white
    style S3 fill:#3498db,color:white
    style S4 fill:#3498db,color:white
```

## Request Flow

```mermaid
flowchart TD
    START([User Request]) --> TYPE{Request Type}

    TYPE -->|System| SYS[System Cleanup]
    TYPE -->|Email| EMAIL[Email Operations]
    TYPE -->|Browser| BROW[Browser Automation]

    SYS --> P1[Get Processes]
    P1 --> P2{High Usage?}
    P2 -->|Yes| P3[Kill Process]
    P2 -->|No| P4[Skip]
    P3 --> P5[Log Result]

    SYS --> T1[Find Temp Files]
    T1 --> T2[Delete Files]
    T2 --> T3[Flush DNS]

    EMAIL --> E1{Auth Valid?}
    E1 -->|No| E2[Run auth.js]
    E2 --> E3[OAuth Flow]
    E3 --> E4[Save Token]
    E1 -->|Yes| E5{Action?}
    E5 -->|List| E6[Fetch Messages]
    E5 -->|Clear| E7[Delete All]
    E5 -->|Send| E8[Compose & Send]
    E5 -->|Unsub| E9[Find Unsub Links]
    E9 --> E10[Hit URLs]

    BROW --> B1[Launch Chrome]
    B1 --> B2[Navigate]
    B2 --> B3[Take Screenshot]
    B3 --> B4[Save File]

    START --> DONE([Complete])

    style START fill:#2ecc71,color:white
    style DONE fill:#e74c3c,color:white
```
