import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export type NightCounts = { ok: number; retry: number; fail: number };

// Counts run lines per status in runs/<night>.jsonl. Lines that don't parse are skipped.
// Returns null when the file doesn't exist.
export function countNight(runsDir: string, night: string): NightCounts | null {
  let text: string;
  try {
    text = readFileSync(join(runsDir, `${night}.jsonl`), 'utf8');
  } catch {
    return null;
  }
  const counts: NightCounts = { ok: 0, retry: 0, fail: 0 };
  for (const raw of text.split('\n')) {
    if (raw.trim() === '') continue;
    try {
      const s: unknown = JSON.parse(raw)?.status;
      if (s === 'ok' || s === 'retry' || s === 'fail') counts[s]++;
    } catch {
      // skip
    }
  }
  return counts;
}
