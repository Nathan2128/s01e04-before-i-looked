import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DigestRow, Night, ReadNight, RunLine, RunStatus } from './types.js';

const STATUSES: RunStatus[] = ['ok', 'retry', 'fail'];

function parseLine(text: string): RunLine | null {
  try {
    const o = JSON.parse(text);
    if (typeof o?.at !== 'string' || typeof o.job !== 'string' || !STATUSES.includes(o.status)) return null;
    if (o.owner !== null && typeof o.owner !== 'string') return null;
    return o as RunLine;
  } catch {
    return null;
  }
}

// Plan morning-digest § 1: runs/<night>.jsonl → one row per job.
export const readNight: ReadNight = (runsDir, night) => {
  let text: string;
  try {
    text = readFileSync(join(runsDir, `${night}.jsonl`), 'utf8');
  } catch {
    return null;
  }

  const byJob = new Map<string, DigestRow>();
  let badLines = 0;
  for (const raw of text.split('\n')) {
    if (raw.trim() === '') continue;
    const line = parseLine(raw);
    if (!line) {
      badLines++;
      continue;
    }
    const row = byJob.get(line.job);
    if (!row) {
      byJob.set(line.job, {
        job: line.job,
        owner: line.owner,
        runs: 1,
        retries: line.status === 'retry' ? 1 : 0,
        lastStatus: line.status,
        lastError: line.error ?? null,
        firstAt: line.at,
        lastAt: line.at,
      });
      continue;
    }
    row.runs++;
    if (line.status === 'retry') row.retries++;
    if (Date.parse(line.at) < Date.parse(row.firstAt)) row.firstAt = line.at;
    if (Date.parse(line.at) >= Date.parse(row.lastAt)) {
      row.lastAt = line.at;
      row.lastStatus = line.status;
      row.lastError = line.error ?? null;
      row.owner = line.owner;
    }
  }

  const rows = [...byJob.values()].sort((a, b) => a.job.localeCompare(b.job));
  return { night, rows, badLines } satisfies Night;
};

// Views show a null owner as '—'.
export const ownerLabel = (owner: string | null) => owner ?? '—';
