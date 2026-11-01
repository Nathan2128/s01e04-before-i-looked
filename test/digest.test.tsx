import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

// Route tests for plan morning-digest § 2a (page) and § 2b (JSON). Fixtures live in a temp dir;
// runs/ is read-only and never touched.
let runsDir: string;

const line = (at: string, job: string, status: string, owner: string | null, error?: string) =>
  JSON.stringify({ at, job, status, owner, ...(error ? { error } : {}) });

const config = { adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir: '' };
const app = () => createApp({ ...config, runsDir });

// Job names in the order the page's table rows show them.
const pageRows = (html: string) =>
  [...html.matchAll(/<tr(?: class="([^"]+)")?><td>([^<]*)<\/td>/g)].map((m) => ({ cls: m[1], job: m[2] }));

beforeAll(() => {
  runsDir = mkdtempSync(join(tmpdir(), 'rig-digest-test-'));

  // Normal night: three jobs. notes/backup ends on a fail, fixtures/refresh has 3 retries.
  writeFileSync(
    join(runsDir, '2026-10-30.jsonl'),
    [
      line('2026-10-30T01:00:00Z', 'notes/backup', 'ok', 'ana'),
      line('2026-10-30T02:00:00Z', 'fixtures/refresh', 'retry', 'ben'),
      line('2026-10-30T02:05:00Z', 'fixtures/refresh', 'retry', 'ben'),
      line('2026-10-30T02:10:00Z', 'fixtures/refresh', 'retry', 'ben'),
      line('2026-10-30T02:15:00Z', 'fixtures/refresh', 'ok', 'ben'),
      line('2026-10-30T03:00:00Z', 'digest/render', 'ok', null),
      line('2026-10-30T04:00:00Z', 'notes/backup', 'fail', 'ana', 'quota exceeded'),
      '',
    ].join('\n'),
  );

  // Empty night.
  writeFileSync(join(runsDir, '2026-10-29.jsonl'), '');

  // Bad-line night: one unparseable line among valid ones.
  writeFileSync(
    join(runsDir, '2026-10-31.jsonl'),
    [
      line('2026-10-31T01:00:00Z', 'digest/render', 'ok', null),
      'this is not json',
      line('2026-10-31T02:00:00Z', 'mail/sync', 'ok', 'cy'),
      '',
    ].join('\n'),
  );
});

afterAll(() => {
  rmSync(runsDir, { recursive: true, force: true });
});

describe('GET /digest/:night (page)', () => {
  it('renders the jobs of a night with a file', async () => {
    const res = await app().request('/digest/2026-10-30');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('digest · 2026-10-30');
    expect(html).toContain('notes/backup');
    expect(html).toContain('fixtures/refresh');
    expect(html).toContain('digest/render');
  });

  it('lists the rows sorted by job', async () => {
    const html = await (await app().request('/digest/2026-10-30')).text();
    expect(pageRows(html).map((r) => r.job)).toEqual(['digest/render', 'fixtures/refresh', 'notes/backup']);
  });

  it('marks a job with 3+ retries or a fail row as warn, not the others', async () => {
    const html = await (await app().request('/digest/2026-10-30')).text();
    const rows = pageRows(html);
    expect(rows.find((r) => r.job === 'fixtures/refresh')?.cls).toBe('warn');
    expect(rows.find((r) => r.job === 'notes/backup')?.cls).toBe('warn');
    expect(rows.find((r) => r.job === 'digest/render')?.cls).toBeUndefined();
  });

  it('returns 404 for a night with no file', async () => {
    const res = await app().request('/digest/2026-12-31');
    const html = await res.text();
    expect(res.status).toBe(404);
    expect(html).toContain('no run log for that night (2026-12-31)');
  });

  it('says "nothing ran" for an empty night', async () => {
    const res = await app().request('/digest/2026-10-29');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('nothing ran');
    expect(pageRows(html)).toEqual([]);
  });

  it('still renders the valid jobs for a night with a bad line', async () => {
    const res = await app().request('/digest/2026-10-31');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('1 line didn&#39;t parse');
    expect(pageRows(html).map((r) => r.job)).toEqual(['digest/render', 'mail/sync']);
  });
});

describe('GET /api/digest/:night (JSON)', () => {
  it('returns the rows of a night with a file, sorted by job', async () => {
    const res = await app().request('/api/digest/2026-10-30');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { night: string; rows: { job: string }[]; badLines: number };
    expect(body.night).toBe('2026-10-30');
    expect(body.rows.map((r) => r.job)).toEqual(['digest/render', 'fixtures/refresh', 'notes/backup']);
    expect(body.badLines).toBe(0);
  });

  it('JSON jobs match the page table rows in the same order', async () => {
    const html = await (await app().request('/digest/2026-10-30')).text();
    const body = (await (await app().request('/api/digest/2026-10-30')).json()) as { rows: { job: string }[] };
    expect(body.rows.map((r) => r.job)).toEqual(pageRows(html).map((r) => r.job));
  });

  it('returns 404 for a night with no file', async () => {
    const res = await app().request('/api/digest/2026-12-31');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'no run log for 2026-12-31' });
  });

  it('returns empty rows and badLines 0 for an empty night', async () => {
    const res = await app().request('/api/digest/2026-10-29');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ night: '2026-10-29', rows: [], badLines: 0 });
  });

  it('still returns 200 with badLines 1 and the valid rows for a bad-line night', async () => {
    const res = await app().request('/api/digest/2026-10-31');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { rows: { job: string }[]; badLines: number };
    expect(body.badLines).toBe(1);
    expect(body.rows.map((r) => r.job)).toEqual(['digest/render', 'mail/sync']);
  });
});
