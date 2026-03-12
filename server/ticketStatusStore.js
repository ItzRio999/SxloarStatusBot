import { promises as fs } from 'node:fs';
import path from 'node:path';

export const STATUS_OPTIONS = [
  {
    key: 'answering_online',
    label: 'Answering & Online',
    description: 'Online and actively answering tickets.',
    pillText: 'Answering & Online',
    tone: 'active',
    emoji: '\u{1F7E2}',
  },
  {
    key: 'answering_away',
    label: 'Answering & Away',
    description: 'Still answering, but replies may be delayed.',
    pillText: 'Answering & Away',
    tone: 'away',
    emoji: '\u{1F4AC}',
  },
  {
    key: 'not_answering_busy',
    label: 'Not Answering & Busy',
    description: 'Currently busy and not answering tickets.',
    pillText: 'Not Answering & Busy',
    tone: 'busy',
    emoji: '\u{1F534}',
  },
];

const defaultStatus = {
  key: 'answering_online',
  updatedAt: new Date(0).toISOString(),
};

const dataDir = path.resolve(process.cwd(), 'data');
const dataFile = path.join(dataDir, 'ticket-status.json');

function getStatusConfig(key) {
  return STATUS_OPTIONS.find((option) => option.key === key) || STATUS_OPTIONS[0];
}

function toPublicStatus(record) {
  const config = getStatusConfig(record.key);

  return {
    key: config.key,
    label: config.label,
    description: config.description,
    pillText: config.pillText,
    tone: config.tone,
    emoji: config.emoji,
    updatedAt: record.updatedAt,
  };
}

export async function ensureStatusFile() {
  await fs.mkdir(dataDir, { recursive: true });

  try {
    await fs.access(dataFile);
  } catch {
    await fs.writeFile(dataFile, JSON.stringify(defaultStatus, null, 2));
  }
}

export async function readTicketStatus() {
  await ensureStatusFile();
  const raw = await fs.readFile(dataFile, 'utf8');

  try {
    const parsed = JSON.parse(raw);
    return toPublicStatus({
      key: parsed.key || defaultStatus.key,
      updatedAt: parsed.updatedAt || defaultStatus.updatedAt,
    });
  } catch {
    return toPublicStatus(defaultStatus);
  }
}

export async function writeTicketStatus(key) {
  const config = getStatusConfig(key);
  const nextRecord = {
    key: config.key,
    updatedAt: new Date().toISOString(),
  };

  await ensureStatusFile();
  await fs.writeFile(dataFile, JSON.stringify(nextRecord, null, 2));
  return toPublicStatus(nextRecord);
}
