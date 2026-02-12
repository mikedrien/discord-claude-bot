# Discord Claude Bot

A Discord bot that bridges Discord threads with [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code), allowing you to chat with Claude in any project directory directly from Discord.

---

## Features

- **Slash commands** — `/chat`, `/sessions`, `/kill` with autocomplete
- **Thread-based sessions** — each session runs in its own Discord thread
- **Streaming responses** — real-time text and tool usage from Claude
- **Message queue** — messages are queued when Claude is busy, processed in order
- **File attachments** — upload images/files to pass to Claude (vision support)
- **Session stats** — cumulative token usage, cost, and duration tracking
- **Thread commands** — `!kill`, `!cost`, `!compact` inside threads
- **Emoji reactions** — hourglass while processing, checkmark on success, X on error
- **Long processing alerts** — notification after 2 minutes of processing
- **Session summary** — stats embed on kill/timeout (tokens, cost, duration)
- **Auto-reconnect** — logging and fallback for WebSocket disconnections
- **24h timeout** — inactive sessions auto-kill and archive

## Quick Start

### Interactive Setup Wizard (recommended)

The wizard guides you through every step — dependencies, Discord bot creation, configuration, and startup.

**Windows (double-click):**
```
setup.bat
```

**Windows (EXE):**
```
dist\discord-claude-setup.exe
```

**Linux/Mac:**
```bash
chmod +x setup.sh
./setup.sh
```

**Or directly with Node:**
```bash
npm run setup
```

### Building the EXE

To build a standalone `discord-claude-setup.exe` (requires Node.js):
```bash
npm install
npm run build:exe
```
The EXE is created in `dist/`. You can distribute it alongside the project files — it still needs the project directory to write config files and run the bot.

### Manual Setup

1. **Install Node.js** (v18+): https://nodejs.org
2. **Install Claude Code CLI**: `npm install -g @anthropic-ai/claude-code`
3. **Clone and install:**
   ```bash
   git clone <your-repo-url>
   cd discord_chat
   npm install
   ```
4. **Configure `.env`:**
   ```
   DISCORD_TOKEN=your-bot-token-here
   ```
5. **Configure `config.json`:**
   ```json
   {
     "channelId": "YOUR_CHANNEL_ID",
     "allowedUserId": "YOUR_DISCORD_USER_ID",
     "sessionTimeoutMs": 86400000,
     "aliases": {
       "myproject": "C:\\path\\to\\project"
     }
   }
   ```
6. **Start:**
   ```bash
   npm start
   ```

---

## Discord Bot Setup

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Create a new application
3. Go to **Bot** tab:
   - Click "Reset Token" and copy it — this is your `DISCORD_TOKEN`
   - Enable **Message Content Intent** under Privileged Gateway Intents
4. Go to **OAuth2 > URL Generator**:
   - Scopes: `bot`, `applications.commands`
   - Bot Permissions: `Send Messages`, `Create Public Threads`, `Manage Threads`, `Read Message History`, `Add Reactions`, `Use Slash Commands`
5. Open the generated URL and add the bot to your server
6. Get your **channel ID** (right-click channel > Copy Channel ID, enable Developer Mode in Discord settings)
7. Get your **user ID** (right-click yourself > Copy User ID)

---

## Configuration

### `config.json`

| Field | Description |
|-------|-------------|
| `channelId` | Discord channel ID where the bot listens for aliases |
| `allowedUserId` | Your Discord user ID (only this user can interact) |
| `sessionTimeoutMs` | Inactivity timeout in ms (default: 86400000 = 24h) |
| `aliases` | Map of alias name to project directory path |

### `.env`

| Variable | Description |
|----------|-------------|
| `DISCORD_TOKEN` | Your Discord bot token |

---

## Usage

### Creating a Session

**Slash command (recommended):**
```
/chat projekt:react
```

**Text (legacy):**
Type the alias name in the main channel:
```
react
```

Both create a new thread with a live Claude session in the specified project directory.

### Thread Commands

| Command | Description |
|---------|-------------|
| `!kill` | End session, show summary, archive thread |
| `!cost` | Show cumulative cost, tokens, duration |
| `!compact` | Compact Claude's context (saves tokens) |

### Slash Commands

| Command | Description |
|---------|-------------|
| `/chat` | Create a new session (with project autocomplete) |
| `/sessions` | List all active sessions with stats |
| `/kill` | End session in current thread |

### File Attachments

Upload any file or image in a thread — the bot downloads it and passes the path to Claude. Images are supported via Claude's vision capability.

---

## Project Structure

```
discord_chat/
├── src/
│   ├── index.js            # Bot entry point, event handlers
│   ├── commands.js          # Slash command definitions
│   ├── messageHandler.js    # Message routing, formatting, attachments
│   ├── sessionManager.js    # Session lifecycle, process management, queue
│   ├── config.js            # Config loader (.env + config.json)
│   └── logger.js            # File + console logging
├── docs/plans/              # Architecture docs
├── config.json              # Bot configuration
├── .env                     # Discord token (gitignored)
├── .env.example             # Template for .env
├── setup.bat                # Windows one-click installer
├── setup.sh                 # Linux/Mac one-click installer
├── package.json
└── .gitignore
```

---

## Requirements

- **Node.js** v18 or higher
- **Claude Code CLI** installed and authenticated (`claude` command available in terminal)
- **Discord bot** with Message Content Intent enabled
- **Git Bash** (Windows) — Claude CLI runs via bash

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Bot doesn't respond | Check `DISCORD_TOKEN` in `.env`, ensure Message Content Intent is enabled |
| Slash commands not showing | Wait 1-2 minutes after first start, or restart Discord |
| "Failed to spawn claude" | Ensure `claude` CLI is installed and available in PATH |
| Bot disconnects | Check `bot.log` for reconnect events, ensure stable internet |
| No thread created | Verify `channelId` and `allowedUserId` in `config.json` |

---

---

# Discord Claude Bot (SK)

Discord bot, ktory prepaja Discord thready s [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code). Umoznuje chatovat s Claude v lubovolnom projektovom adresari priamo z Discordu.

---

## Funkcie

- **Slash prikazy** — `/chat`, `/sessions`, `/kill` s autocomplete
- **Thread sessions** — kazda session bezi vo vlastnom Discord threade
- **Streaming odpovedi** — real-time text a pouzitie nastrojov od Claude
- **Fronta sprav** — spravy sa zaradia do fronty ked je Claude zaneprazdneny
- **Prilohy** — upload obrazkov/suborov, ktore sa predaju Claude (podpora vizie)
- **Statistiky sessions** — kumulativne tokeny, naklady a trvanie
- **Thread prikazy** — `!kill`, `!cost`, `!compact` v threadoch
- **Emoji reakcie** — presypacie hodiny pri spracovani, fajka pri uspesnom dokonceni
- **Notifikacia dlheho spracovania** — upozornenie po 2 minutach
- **Suhrn session** — embed so statistikami pri ukonceni
- **Auto-reconnect** — logovanie a fallback pre WebSocket odpojenia
- **24h timeout** — neaktivne sessions sa automaticky ukoncuju

## Rychly Start

### Interaktivny Setup Wizard (odporucany)

Wizard ta prevedie kazdym krokom — zavislosti, vytvorenie Discord bota, konfiguracia, spustenie.

**Windows (dvojklik):**
```
setup.bat
```

**Windows (EXE):**
```
dist\discord-claude-setup.exe
```

**Linux/Mac:**
```bash
chmod +x setup.sh
./setup.sh
```

**Alebo priamo cez Node:**
```bash
npm run setup
```

### Buildovanie EXE

Na vytvorenie standalone `discord-claude-setup.exe` (potrebujes Node.js):
```bash
npm install
npm run build:exe
```
EXE sa vytvori v `dist/`. Mozes ho distribuovat spolu so subormi projektu — stale potrebuje projektovy adresar na zapis konfiguracie a spustenie bota.

### Manualna Instalacia

1. **Nainstaluj Node.js** (v18+): https://nodejs.org
2. **Nainstaluj Claude Code CLI**: `npm install -g @anthropic-ai/claude-code`
3. **Klonuj a nainstaluj:**
   ```bash
   git clone <url-repozitara>
   cd discord_chat
   npm install
   ```
4. **Nastav `.env`:**
   ```
   DISCORD_TOKEN=tvoj-bot-token
   ```
5. **Nastav `config.json`:**
   ```json
   {
     "channelId": "ID_TVOJHO_KANALA",
     "allowedUserId": "TVOJE_DISCORD_USER_ID",
     "sessionTimeoutMs": 86400000,
     "aliases": {
       "mojprojekt": "C:\\cesta\\k\\projektu"
     }
   }
   ```
6. **Spusti:**
   ```bash
   npm start
   ```

---

## Nastavenie Discord Bota

1. Chod na [Discord Developer Portal](https://discord.com/developers/applications)
2. Vytvor novu aplikaciu
3. V zalozke **Bot**:
   - Klikni "Reset Token" a skopiruj — toto je tvoj `DISCORD_TOKEN`
   - Zapni **Message Content Intent** v casti Privileged Gateway Intents
4. Chod na **OAuth2 > URL Generator**:
   - Scopes: `bot`, `applications.commands`
   - Bot Permissions: `Send Messages`, `Create Public Threads`, `Manage Threads`, `Read Message History`, `Add Reactions`, `Use Slash Commands`
5. Otvor vygenerovanu URL a pridaj bota na server
6. Ziskaj **channel ID** (prave tlacidlo na kanal > Copy Channel ID, zapni Developer Mode v nastaveniach Discordu)
7. Ziskaj **user ID** (prave tlacidlo na seba > Copy User ID)

---

## Konfiguracia

### `config.json`

| Pole | Popis |
|------|-------|
| `channelId` | ID Discord kanala kde bot pocuva na aliasy |
| `allowedUserId` | Tvoje Discord user ID (len tento pouzivatel moze interagovat) |
| `sessionTimeoutMs` | Timeout neaktivity v ms (default: 86400000 = 24h) |
| `aliases` | Mapa nazov aliasu -> cesta k projektovemu adresaru |

### `.env`

| Premenna | Popis |
|----------|-------|
| `DISCORD_TOKEN` | Token tvojho Discord bota |

---

## Pouzivanie

### Vytvorenie Session

**Slash prikaz (odporucany):**
```
/chat projekt:react
```

**Text (stary sposob):**
Napis nazov aliasu v hlavnom kanali:
```
react
```

Oba sposoby vytvoria novy thread so zivou Claude session v danom projektovom adresari.

### Prikazy v Threade

| Prikaz | Popis |
|--------|-------|
| `!kill` | Ukonci session, ukaz suhrn, archivuj thread |
| `!cost` | Zobraz kumulativne naklady, tokeny, trvanie |
| `!compact` | Kompaktuj kontext Claude (usetri tokeny) |

### Slash Prikazy

| Prikaz | Popis |
|--------|-------|
| `/chat` | Vytvor novu session (s autocomplete projektov) |
| `/sessions` | Zobraz vsetky aktivne sessions so statistikami |
| `/kill` | Ukonci session v aktualnom threade |

### Prilohy

Uploadni subor alebo obrazok v threade — bot ho stiahne a preda cestu Claude. Obrazky su podporovane cez Claude vision.

---

## Struktura Projektu

```
discord_chat/
├── src/
│   ├── index.js            # Vstupny bod bota, event handlery
│   ├── commands.js          # Definicie slash prikazov
│   ├── messageHandler.js    # Smerovanie sprav, formatovanie, prilohy
│   ├── sessionManager.js    # Zivotny cyklus sessions, procesy, fronta
│   ├── config.js            # Nacitanie konfiguracie (.env + config.json)
│   └── logger.js            # Logovanie do suboru + konzoly
├── docs/plans/              # Architekturna dokumentacia
├── config.json              # Konfiguracia bota
├── .env                     # Discord token (v gitignore)
├── .env.example             # Sablona pre .env
├── setup.bat                # Windows instalator jednym kliknutim
├── setup.sh                 # Linux/Mac instalator jednym kliknutim
├── package.json
└── .gitignore
```

---

## Poziadavky

- **Node.js** v18 alebo novsi
- **Claude Code CLI** nainstalovany a autentifikovany (prikaz `claude` dostupny v terminali)
- **Discord bot** so zapnutym Message Content Intent
- **Git Bash** (Windows) — Claude CLI bezi cez bash

---

## Riesenie Problemov

| Problem | Riesenie |
|---------|----------|
| Bot nereaguje | Skontroluj `DISCORD_TOKEN` v `.env`, over ze Message Content Intent je zapnuty |
| Slash prikazy sa nezobrazuju | Pockaj 1-2 minuty po prvom spusteni, alebo restartuj Discord |
| "Failed to spawn claude" | Over ze `claude` CLI je nainstalovany a dostupny v PATH |
| Bot sa odpaja | Skontroluj `bot.log` pre reconnect eventy, over stabilne pripojenie |
| Thread sa nevytvori | Over `channelId` a `allowedUserId` v `config.json` |
