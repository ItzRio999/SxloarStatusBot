import dotenv from 'dotenv';
import express from 'express';
import { startDiscordBot } from './discordBot.js';
import { ensureStatusFile, readTicketStatus } from './ticketStatusStore.js';

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 3001);
const ticketStatusSubscribers = new Set();
const discordUserId = process.env.VITE_DISCORD_USER_ID;
const fallbackBannerUrl = process.env.VITE_DISCORD_BANNER_URL || '';
const allowedOrigin = process.env.ALLOWED_ORIGIN || '*';

await ensureStatusFile();

app.use(express.json());
app.use((request, response, next) => {
  response.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  response.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (request.method === 'OPTIONS') {
    response.status(204).end();
    return;
  }

  next();
});

function getDiscordBannerUrl(user) {
  if (!user?.id || !user?.banner) {
    return '';
  }

  const extension = user.banner.startsWith('a_') ? 'gif' : 'png';
  return `https://cdn.discordapp.com/banners/${user.id}/${user.banner}.${extension}?size=1024`;
}

async function fetchDiscordBanner() {
  if (!discordUserId || !process.env.DISCORD_BOT_TOKEN) {
    return fallbackBannerUrl;
  }

  try {
    const response = await fetch(`https://discord.com/api/v10/users/${discordUserId}`, {
      headers: {
        Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
      },
    });

    if (!response.ok) {
      return fallbackBannerUrl;
    }

    const user = await response.json();
    return getDiscordBannerUrl(user) || fallbackBannerUrl;
  } catch {
    return fallbackBannerUrl;
  }
}

function broadcastTicketStatus(status) {
  const payload = `data: ${JSON.stringify(status)}\n\n`;

  for (const response of ticketStatusSubscribers) {
    response.write(payload);
  }
}

app.get('/api/ticket-status', async (_request, response) => {
  const status = await readTicketStatus();
  response.json(status);
});

app.get('/api/discord-profile', async (_request, response) => {
  response.json({
    bannerUrl: await fetchDiscordBanner(),
  });
});

app.get('/api/ticket-status/stream', async (_request, response) => {
  response.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'Access-Control-Allow-Origin': allowedOrigin,
  });

  response.write(': connected\n\n');
  ticketStatusSubscribers.add(response);
  response.write(`data: ${JSON.stringify(await readTicketStatus())}\n\n`);

  const heartbeat = setInterval(() => {
    response.write(': heartbeat\n\n');
  }, 25000);

  response.on('close', () => {
    clearInterval(heartbeat);
    ticketStatusSubscribers.delete(response);
    response.end();
  });
});

app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});

await startDiscordBot({
  token: process.env.DISCORD_BOT_TOKEN,
  applicationId: process.env.DISCORD_APPLICATION_ID,
  guildId: process.env.DISCORD_GUILD_ID,
  ownerUserId: process.env.DISCORD_OWNER_USER_ID || process.env.VITE_DISCORD_USER_ID,
  onStatusChange: broadcastTicketStatus,
  siteUrl: process.env.PUBLIC_SITE_URL,
});
