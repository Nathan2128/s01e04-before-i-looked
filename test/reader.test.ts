import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ownerLabel, readNight } from '../src/digest/reader.js';

describe('run log reader', () => {
  it('reads 2026-10-28 into 5 jobs and counts 1 bad line', () => {
    const night = readNight('runs', '2026-10-28')!;
    expect(night.rows).toHaveLength(5);
    expect(night.badLines).toBe(1);
    expect(night.rows.map((r) => r.job)).toEqual([...night.rows.map((r) => r.job)].sort((a, b) => a.localeCompare(b)));
  });

  it('counts runs and retries, keeps the last status and error', () => {
    const rows = readNight('runs', '2026-10-28')!.rows;
    const refresh = rows.find((r) => r.job === 'fixtures/refresh')!;
    expect(refresh).toMatchObject({ runs: 4, retries: 3, lastStatus: 'ok', lastError: null });
    const backup = rows.find((r) => r.job === 'notes/backup')!;
    expect(backup).toMatchObject({ lastStatus: 'fail', lastError: 'quota exceeded' });
  });

  it('keeps a row with a null owner and shows it as —', () => {
    const row = readNight('runs', '2026-10-28')!.rows.find((r) => r.job === 'digest/render')!;
    expect(row.owner).toBeNull();
    expect(ownerLabel(row.owner)).toBe('—');
  });

  it('returns null for a night with no file, no rows for an empty file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rig-runs-'));
    writeFileSync(join(dir, '2026-01-01.jsonl'), '');
    expect(readNight(dir, '2026-01-02')).toBeNull();
    expect(readNight(dir, '2026-01-01')).toEqual({ night: '2026-01-01', rows: [], badLines: 0 });
  });
});
