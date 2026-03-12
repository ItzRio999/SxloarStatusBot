# Sxloar Status Bot

Discord bot and API for the live ticket-status pill used on `https://lurkedaccounts.site`.

## Features

- Slash command: `/ticketstatus`
- Ephemeral Discord UI with status dropdown
- Express API for:
  - `GET /api/ticket-status`
  - `GET /api/ticket-status/stream`
  - `GET /api/discord-profile`
- Server-sent events for instant website updates
- Local JSON storage for the current ticket status

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create `.env` from `.env.example`.

3. Start the bot and API:

```bash
npm run dev
```

## Required Environment Variables

```env
VITE_DISCORD_USER_ID=1222660230572277862
VITE_DISCORD_BANNER_URL=
DISCORD_BOT_TOKEN=YOUR_DISCORD_BOT_TOKEN
DISCORD_APPLICATION_ID=1481483226882117745
DISCORD_GUILD_ID=1356477545964372048
DISCORD_OWNER_USER_ID=1222660230572277862
PUBLIC_SITE_URL=https://lurkedaccounts.site
ALLOWED_ORIGIN=https://lurkedaccounts.site
PORT=3001
```

## Notes

- `data/` is created automatically at runtime.
- `.env` is ignored by git.
- Use Cloudflare Tunnel or a reverse proxy to expose the API publicly.
