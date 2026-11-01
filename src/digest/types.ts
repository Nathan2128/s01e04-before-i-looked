// Plan morning-digest § 1. The contract every part of § 2 builds against: the reader fills it,
// the page, the JSON and the board only read it.

export type RunStatus = 'ok' | 'retry' | 'fail';

// One line of runs/<night>.jsonl.
export type RunLine = {
  at: string;
  job: string;
  status: RunStatus;
  owner: string | null;
  error?: string;
};

// One row per job for the night.
export type DigestRow = {
  job: string;
  owner: string | null; // null is kept; views show it as '—'
  runs: number;
  retries: number;
  lastStatus: RunStatus;
  lastError: string | null;
  firstAt: string;
  lastAt: string;
};

export type Night = {
  night: string;
  rows: DigestRow[]; // sorted by job
  badLines: number; // lines that didn't parse: counted, never thrown
};

// Returns null when runs/<night>.jsonl doesn't exist (the routes turn that into a 404).
// An empty file gives { rows: [], badLines: 0 }.
export type ReadNight = (runsDir: string, night: string) => Night | null;
