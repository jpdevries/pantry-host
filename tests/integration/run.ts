import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import {
  writeFileSync,
  unlinkSync,
  readdirSync,
  mkdtempSync,
  rmSync,
  existsSync,
} from 'node:fs';
import { createServer, type AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { once } from 'node:events';
import { run } from 'node:test';
import { spec } from 'node:test/reporters';
import { startMockServer, type MockServer } from './helpers/mock-server.ts';

const HERE = import.meta.dirname;
const REPO_ROOT = join(HERE, '..', '..');
const APP_DIR = join(REPO_ROOT, 'packages', 'app');
const SERVER_DIR = join(REPO_ROOT, 'packages', 'server');
// Workspace target dir lives at the repo root, not under packages/server.
const SERVER_BIN = join(REPO_ROOT, 'target', 'debug', 'pantry-server');
const HARNESS_FILE = join(HERE, '__harness__.json');

// Docker mode: set INTEGRATION_SERVER_IMAGE=<tag> to run the suite against a
// pre-built container image instead of the native binary. INTEGRATION_SERVER_PLATFORM
// optionally pins the docker platform (e.g. linux/arm/v7) so foreign-arch
// images run under QEMU. Used by packages/server/scripts/build-pi.sh.
const SERVER_IMAGE = process.env.INTEGRATION_SERVER_IMAGE ?? '';
const SERVER_PLATFORM = process.env.INTEGRATION_SERVER_PLATFORM ?? '';
const DOCKER_MODE = SERVER_IMAGE.length > 0;

// Watchdogs. This suite used to hang forever rather than report a failure:
// run()'s stream never emitted `end`, so the `once(reporter, 'end')` await in
// main() blocked indefinitely — no output past "[harness] Server ready",
// teardown() never reached, an orphaned server and a temp DB dir left behind
// per run. The specific cause is fixed (see safeListener below), but a stalled
// stream is unobservable from the outside, so these caps stand as a backstop:
// whatever wedges the run, it ends as a loud failure. Foreign-arch containers
// under QEMU are slow, so docker mode gets much longer windows.
const TEST_TIMEOUT_MS = Number(
  process.env.INTEGRATION_TEST_TIMEOUT_MS ?? (DOCKER_MODE ? 600_000 : 120_000),
);
const IDLE_TIMEOUT_MS = Number(
  process.env.INTEGRATION_IDLE_TIMEOUT_MS ?? (DOCKER_MODE ? 900_000 : 180_000),
);
const SUITE_TIMEOUT_MS = Number(
  process.env.INTEGRATION_SUITE_TIMEOUT_MS ?? (DOCKER_MODE ? 3_600_000 : 1_200_000),
);

function buildRustServer(): void {
  console.log('[harness] Building Rust server (cargo build)…');
  const r = spawnSync('cargo', ['build', '-p', 'pantry-server'], {
    cwd: REPO_ROOT,
    stdio: 'inherit',
  });
  if (r.status !== 0) {
    throw new Error(`cargo build failed with code ${r.status}`);
  }
  if (!existsSync(SERVER_BIN)) {
    throw new Error(`built but missing binary at ${SERVER_BIN}`);
  }

  // rust-embed reads `static/client/` at runtime in dev profile, so the
  // build above succeeds even when the folder only contains `.gitkeep`.
  // With an empty embed the SPA serve path falls through to the bare
  // placeholder HTML, and `frontend.test.ts` stalls node:test's run()
  // stream waiting for shell-bearing pages that never materialize. Catch
  // that ahead of time with a clear pointer at the build script.
  const clientManifest = join(SERVER_DIR, 'static', 'client', 'manifest.json');
  if (!existsSync(clientManifest)) {
    throw new Error(
      `[harness] packages/server/static/client/manifest.json is missing — the\n` +
        `embedded Rex frontend isn't populated. Run:\n\n` +
        `  packages/server/scripts/sync-frontend.sh --build\n\n` +
        `then re-run the suite. (The Rex build output is gitignored, so this\n` +
        `step is required after a fresh clone or whenever packages/app changes.)`,
    );
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.unref();
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const port = (srv.address() as AddressInfo).port;
      srv.close(() => resolve(port));
    });
  });
}

async function waitForServer(url: string, deadlineMs = 10_000): Promise<void> {
  const start = Date.now();
  let lastErr: unknown;
  while (Date.now() - start < deadlineMs) {
    try {
      const r = await fetch(`${url}/graphql`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ query: '{ __typename }' }),
      });
      if (r.ok) {
        const j = (await r.json()) as { data?: { __typename?: string } };
        if (j.data?.__typename === 'Query') return;
      }
    } catch (err) {
      lastErr = err;
    }
    await sleep(250);
  }
  throw new Error(
    `GraphQL server did not become ready within ${deadlineMs}ms at ${url}` +
      (lastErr ? `\nLast error: ${(lastErr as Error).message}` : ''),
  );
}

/**
 * Mark first-boot setup complete so the `route_by_setup` middleware
 * stops 307-redirecting GETs to `/setup`. Without this, every frontend
 * test that expects a 308 → `/` redirect (and every page-render
 * assertion) fails because the installer wizard intercepts first.
 */
async function markSetupComplete(url: string): Promise<void> {
  const r = await fetch(`${url}/api/setup-complete`, { method: 'POST' });
  if (!r.ok) {
    throw new Error(`POST /api/setup-complete failed: HTTP ${r.status}`);
  }
}

interface Handle {
  dbDir: string;
  mock: MockServer;
  child?: ChildProcess;       // native mode
  containerId?: string;       // docker mode
}

async function setup(): Promise<Handle> {
  if (!DOCKER_MODE) {
    buildRustServer();
  } else {
    console.log(`[harness] Docker mode: image=${SERVER_IMAGE} platform=${SERVER_PLATFORM || '(default)'}`);
  }

  const dbDir = mkdtempSync(join(tmpdir(), 'pantry-host-integration-'));
  const dbPath = join(dbDir, 'pantry.db');
  console.log(`\n[harness] SQLite database: ${dbPath}`);

  console.log('[harness] Starting mock HTTP server…');
  const mock = await startMockServer();
  console.log(`[harness] Mock server ready: ${mock.url}`);

  const port = await getFreePort();
  const url = `http://127.0.0.1:${port}`;
  const uploadsDir = join(APP_DIR, 'public', 'uploads');

  const handle: Handle = { dbDir, mock };

  // In docker mode the mock URL embedded in test request bodies has to be
  // reachable *from inside the container* — 127.0.0.1 there is the container's
  // own loopback. Tests that embed mockUrl in /fetch-recipe payloads need this
  // rewritten to host.docker.internal so the container's reqwest client can
  // resolve it. Host-side fetches against the server still go to the mapped
  // 127.0.0.1:${port}, which is `url`.
  const mockPort = new URL(mock.url).port;
  const serverFacingMockUrl = DOCKER_MODE
    ? `http://host.docker.internal:${mockPort}`
    : mock.url;

  try {
    if (DOCKER_MODE) {
      handle.containerId = await spawnContainer({
        port,
        dbDir,
        uploadsDir,
        mockUrl: serverFacingMockUrl,
      });
    } else {
      handle.child = spawnNativeServer({ port, dbPath, uploadsDir, mockUrl: mock.url, dbDir });
    }
    // Foreign-arch containers under QEMU need a longer ready window; native is fast.
    await waitForServer(url, DOCKER_MODE ? 60_000 : 10_000);
    await markSetupComplete(url);
  } catch (err) {
    await teardown(handle).catch(() => {});
    throw err;
  }
  console.log('[harness] Server ready (setup marked complete).\n');

  writeFileSync(
    HARNESS_FILE,
    JSON.stringify(
      {
        url,
        dbPath,
        mockUrl: serverFacingMockUrl,
        serverPid: handle.child?.pid,
        containerId: handle.containerId,
      },
      null,
      2,
    ),
  );

  return handle;
}

function spawnNativeServer(opts: {
  port: number;
  dbPath: string;
  uploadsDir: string;
  mockUrl: string;
  dbDir: string;
}): ChildProcess {
  console.log(`[harness] Spawning Rust GraphQL server on :${opts.port}…`);
  // The Rust server writes uploads relative to its cwd (default
  // `../app/public/uploads`), so run it from packages/server to match.
  const child = spawn(SERVER_BIN, [], {
    cwd: SERVER_DIR,
    env: {
      ...process.env,
      SQLITE_DB_PATH: opts.dbPath,
      GRAPHQL_PORT: String(opts.port),
      ANTHROPIC_BASE_URL: opts.mockUrl,
      AI_API_KEY: 'test-key-anthropic-mock',
      ENABLE_IMAGE_PROCESSING: 'false',
      UPLOADS_DIR: opts.uploadsDir,
      RUST_LOG: process.env.RUST_LOG ?? 'warn',
      // /api/* routes added in the SPA-embed port. Deterministic test
      // values for the keys settings-read masks; isolated paths for the
      // overrides + cache so each run starts clean.
      RECIPE_API_KEY: 'rapi_test_secret_12345_long_enough_to_mask',
      PIXABAY_API_KEY: 'pixabay_test_secret_67890_long_enough',
      OVERRIDES_PATH: join(opts.dbDir, '.settings-overrides.json'),
      CACHE_DIR: join(opts.dbDir, '.cache'),
      OFF_BASE_URL: opts.mockUrl,
      WIKIBOOKS_BASE_URL: opts.mockUrl,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  pipeChildLogs(child);
  child.on('exit', (code, signal) => {
    if (code != null && code !== 0 && code !== 143) {
      console.error(`[harness] Server exited unexpectedly (code=${code}, signal=${signal})`);
    }
  });
  return child;
}

async function spawnContainer(opts: {
  port: number;
  dbDir: string;
  uploadsDir: string;
  mockUrl: string;
}): Promise<string> {
  // `--add-host host.docker.internal:host-gateway` makes the host reachable
  // from inside the container on both Docker Desktop (where the name
  // pre-exists) and Linux native Docker (where it doesn't).
  const args: string[] = ['run', '-d', '--rm'];
  if (SERVER_PLATFORM) args.push('--platform', SERVER_PLATFORM);
  args.push(
    '--add-host', 'host.docker.internal:host-gateway',
    '-p', `127.0.0.1:${opts.port}:4001`,
    '-v', `${opts.dbDir}:/data`,
    '-v', `${opts.uploadsDir}:/uploads`,
    '-e', 'SQLITE_DB_PATH=/data/pantry.db',
    '-e', 'GRAPHQL_PORT=4001',
    '-e', 'UPLOADS_DIR=/uploads',
    '-e', `ANTHROPIC_BASE_URL=${opts.mockUrl}`,
    '-e', 'AI_API_KEY=test-key-anthropic-mock',
    '-e', 'ENABLE_IMAGE_PROCESSING=false',
    '-e', `RUST_LOG=${process.env.RUST_LOG ?? 'warn'}`,
    // /api/* route env (mirror spawnNativeServer). OVERRIDES_PATH +
    // CACHE_DIR live under /data so they share the bind-mount lifetime.
    '-e', 'RECIPE_API_KEY=rapi_test_secret_12345_long_enough_to_mask',
    '-e', 'PIXABAY_API_KEY=pixabay_test_secret_67890_long_enough',
    '-e', 'OVERRIDES_PATH=/data/.settings-overrides.json',
    '-e', 'CACHE_DIR=/data/.cache',
    '-e', `OFF_BASE_URL=${opts.mockUrl}`,
    '-e', `WIKIBOOKS_BASE_URL=${opts.mockUrl}`,
    SERVER_IMAGE,
  );

  console.log(`[harness] docker ${args.join(' ')}`);
  const r = spawnSync('docker', args, { encoding: 'utf8' });
  if (r.status !== 0) {
    throw new Error(`docker run failed (${r.status}): ${r.stderr || r.stdout}`);
  }
  const containerId = r.stdout.trim();
  console.log(`[harness] Container started: ${containerId.slice(0, 12)}`);

  // Stream container logs to stderr with a [server] prefix so failures are debuggable.
  const logTail = spawn('docker', ['logs', '-f', containerId], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  pipeChildLogs(logTail);

  return containerId;
}

function pipeChildLogs(child: ChildProcess): void {
  const prefix = (chunk: Buffer) => {
    for (const line of chunk.toString().split('\n')) {
      if (line.trim()) process.stderr.write(`[server] ${line}\n`);
    }
  };
  child.stdout?.on('data', prefix);
  child.stderr?.on('data', prefix);
}

/** Resolves true if `p` settles within `ms`, false on timeout. */
function settlesWithin(p: Promise<unknown>, ms: number): Promise<boolean> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(false), ms);
    const done = () => {
      clearTimeout(timer);
      resolve(true);
    };
    p.then(done, done);
  });
}

/**
 * ChildProcess#killed only means "a signal was delivered", not "the process is
 * gone", so the old `if (!child.killed) kill('SIGKILL')` fallback could never
 * fire — SIGTERM set `killed`, and the escalation was skipped. A server slow to
 * shut down (killed mid-request, say) therefore outlived the harness, which is
 * how stale `target/debug/pantry-server` processes piled up. Wait for the real
 * exit instead, and escalate if it doesn't come.
 */
async function stopChild(child: ChildProcess, graceMs = 3_000): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return;
  const exited = once(child, 'exit');
  child.kill('SIGTERM');
  if (await settlesWithin(exited, graceMs)) return;
  console.error('[harness] Server ignored SIGTERM; sending SIGKILL.');
  child.kill('SIGKILL');
  if (!(await settlesWithin(exited, graceMs))) {
    console.error(`[harness] Server pid ${child.pid} still alive after SIGKILL.`);
  }
}

async function teardown(h: Handle): Promise<void> {
  if (h.containerId) {
    spawnSync('docker', ['kill', h.containerId], { stdio: 'ignore' });
  }
  if (h.child) await stopChild(h.child);
  await h.mock.stop().catch((err) => console.error('[harness] mock stop failed:', err));
  try {
    unlinkSync(HARNESS_FILE);
  } catch { /* gone already */ }
  // Only safe once the server is confirmed gone: it does a create_dir_all on
  // write, so a server still shutting down recreates this directory straight
  // after the rmSync and the temp dir leaks. That is what used to litter
  // $TMPDIR with pantry-host-integration-* dirs on an interrupted run.
  rmSync(h.dbDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}

function discoverTestFiles(): string[] {
  // Optional filters: `node tests/integration/run.ts frontend menus` runs only
  // the test files whose names contain one of the arguments.
  const filters = process.argv.slice(2);
  const all = readdirSync(HERE)
    .filter((f) => f.endsWith('.test.ts'))
    .sort();
  const picked = all.filter((f) => filters.length === 0 || filters.some((x) => f.includes(x)));
  // A filter that matches nothing used to run zero files and exit 0, which
  // reads exactly like a green suite. Say so instead.
  if (picked.length === 0) {
    throw new Error(
      filters.length > 0
        ? `No test files matched ${JSON.stringify(filters)}. Available:\n` +
          all.map((f) => `  ${f}`).join('\n')
        : `No *.test.ts files found in ${HERE}`,
    );
  }
  return picked.map((f) => join(HERE, f));
}

/**
 * node:test's named events hand the listener the payload *directly* — a
 * `test:fail` listener gets `{ name, file, details, … }`, not `{ data: … }`.
 * Reading a `.data` that isn't there throws inside `emit()`, and because that
 * throw lands in the middle of node:test's own stream processing it wedges the
 * pipeline: no further events, no `end`, so `once(reporter, 'end')` waits
 * forever. That is exactly how this runner used to hang — a first failing file
 * tripped the listener and the suite sat silent for hours.
 *
 * So every listener below reads the payload directly, and runs inside this
 * wrapper: a listener must never be the reason the run stops reporting.
 */
function safeListener<T>(label: string, fn: (event: T) => void): (event: T) => void {
  return (event: T) => {
    try {
      fn(event);
    } catch (err) {
      console.error(`[harness] ${label} listener threw (continuing):`, err);
    }
  };
}

interface TestEventPayload {
  file?: string;
  name?: string;
  message?: string;
  details?: { error?: unknown };
}

async function main(): Promise<void> {
  const files = discoverTestFiles();
  // Printed before the run so a stall is attributable from the log alone:
  // with `concurrency: false` the files execute in exactly this order.
  console.log(`[harness] ${files.length} test file(s), in order:`);
  for (const f of files) console.log(`[harness]   - ${basename(f)}`);

  const handle = await setup();

  let failed = 0;
  let settled = false;

  // teardown() kills the spawned server and removes the temp DB dir, so it has
  // to run on every exit path — the normal one, a watchdog trip, a stream
  // error — and exactly once.
  let tornDown = false;
  async function teardownOnce(): Promise<void> {
    if (tornDown) return;
    tornDown = true;
    await teardown(handle).catch((err) => console.error('[harness] teardown failed:', err));
  }

  const known = new Set(files);
  // Files node:test produced a pass/fail outcome for. Anything missing when
  // the run ends never reported a result — a child that died before node:test
  // could hear from it — which is a crash, not a pass.
  const accounted = new Set<string>();
  // Files we have seen any event for, for progress output and attribution.
  const started = new Set<string>();
  // Trailing child stderr per file, so a crash report can quote the reason.
  const stderrTail = new Map<string, string[]>();
  let lastFile: string | null = null;

  function touch(file: string | undefined): void {
    if (!file || !known.has(file)) return;
    if (!started.has(file)) {
      started.add(file);
      console.log(`[harness] → ${basename(file)}`);
    }
    lastFile = file;
  }

  let idleTimer: NodeJS.Timeout | undefined;
  let suiteTimer: NodeJS.Timeout | undefined;

  function clearWatchdogs(): void {
    if (idleTimer) clearTimeout(idleTimer);
    if (suiteTimer) clearTimeout(suiteTimer);
  }

  // Any event is progress; the idle watchdog only fires once the stream has
  // gone completely quiet.
  function bumpIdle(): void {
    if (settled) return;
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      void bail(`No test events for ${IDLE_TIMEOUT_MS}ms — the run is wedged.`);
    }, IDLE_TIMEOUT_MS);
  }

  async function bail(reason: string): Promise<void> {
    if (settled) return;
    settled = true;
    clearWatchdogs();
    const suspect = files.find((f) => !accounted.has(f)) ?? null;
    console.error(`\n[harness] ${reason}`);
    console.error(
      `[harness] Last file to report: ${lastFile ? basename(lastFile) : '(none — stalled before the first file reported)'}`,
    );
    if (suspect) {
      console.error(`[harness] First file with no result, most likely culprit: ${basename(suspect)}`);
    }
    const tail = (suspect ? stderrTail.get(suspect) : undefined) ?? (lastFile ? stderrTail.get(lastFile) : undefined);
    if (tail?.length) {
      console.error('[harness] Last stderr from that file:');
      for (const line of tail) console.error(`[harness]   ${line}`);
    }
    console.error(
      '[harness] Windows are tunable: INTEGRATION_IDLE_TIMEOUT_MS, INTEGRATION_SUITE_TIMEOUT_MS, INTEGRATION_TEST_TIMEOUT_MS.',
    );
    await teardownOnce();
    process.exit(1);
  }

  try {
    const stream = run({
      files,
      concurrency: false,
      // Caps each individual test, so one hung assertion fails rather than
      // holding the whole suite open.
      timeout: TEST_TIMEOUT_MS,
    });

    for (const name of ['test:dequeue', 'test:start', 'test:stdout', 'test:diagnostic'] as const) {
      stream.on(
        name,
        safeListener<TestEventPayload>(name, (event) => {
          touch(event?.file);
          bumpIdle();
        }),
      );
    }

    stream.on(
      'test:pass',
      safeListener<TestEventPayload>('test:pass', (event) => {
        touch(event?.file);
        if (event?.file && known.has(event.file)) accounted.add(event.file);
        bumpIdle();
      }),
    );

    stream.on(
      'test:fail',
      safeListener<TestEventPayload>('test:fail', (event) => {
        touch(event?.file);
        if (event?.file && known.has(event.file)) accounted.add(event.file);
        bumpIdle();
        if (event?.details?.error) failed++;
      }),
    );

    // A child that dies at load time writes its stack to stderr, so this is
    // where the reason for a crash shows up.
    stream.on(
      'test:stderr',
      safeListener<TestEventPayload>('test:stderr', (event) => {
        touch(event?.file);
        bumpIdle();
        const key = event?.file;
        if (!key) return;
        const lines = stderrTail.get(key) ?? [];
        for (const line of String(event.message ?? '').split('\n')) {
          if (line.trim()) lines.push(line);
        }
        // Keep the tail bounded; a crash stack is short and it is the last
        // lines that matter.
        stderrTail.set(key, lines.slice(-40));
      }),
    );

    stream.on('error', (err: Error) => {
      void bail(`node:test stream errored: ${err?.message ?? err}`);
    });

    suiteTimer = setTimeout(() => {
      void bail(`Suite exceeded ${SUITE_TIMEOUT_MS}ms overall.`);
    }, SUITE_TIMEOUT_MS);
    bumpIdle();

    const reporter = stream.compose(spec);
    reporter.pipe(process.stdout);
    await once(reporter, 'end');
    settled = true;
    clearWatchdogs();

    // A file that never produced a pass or a fail crashed before node:test
    // could run it. Count it, so a dead test file can't read as a green suite.
    const silent = files.filter((f) => !accounted.has(f));
    if (silent.length > 0) {
      failed += silent.length;
      console.error(
        `\n[harness] ${silent.length} test file(s) produced no result — they crashed before node:test could run them:`,
      );
      for (const f of silent) {
        console.error(`[harness]   ✖ ${basename(f)}`);
        for (const line of stderrTail.get(f) ?? []) console.error(`[harness]       ${line}`);
      }
    }
  } finally {
    clearWatchdogs();
    await teardownOnce();
  }

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
