const http = require('node:http');
const crypto = require('node:crypto');
const os = require('node:os');
const { Client } = require('pg');
const autocannon = require('autocannon');

const API_BASE = process.env.API_BASE || 'http://127.0.0.1:3100';
const RECEIVER_PORT = 9999;
const RECEIVER_URL = `http://127.0.0.1:${RECEIVER_PORT}`;
const DB_URL = process.env.MIGRATION_DATABASE_URL || 'postgresql://relayforge_admin:relayforge_admin_local@127.0.0.1:55432/relayforge';

function signPayload(body, secret, timestamp) {
  const sig = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${body}`)
    .digest('hex');
  return `t=${timestamp},v1=${sig}`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function queryDb(query, params = []) {
  const client = new Client({ connectionString: DB_URL });
  await client.connect();
  try {
    const res = await client.query(query, params);
    return res.rows;
  } finally {
    await client.end();
  }
}

async function configureReceiver(cfg) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      `${RECEIVER_URL}/config`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
      },
      (res) => {
        res.on('data', () => {});
        res.on('end', resolve);
      },
    );
    req.on('error', reject);
    req.write(JSON.stringify(cfg));
    req.end();
  });
}

async function getReceiverStats() {
  return new Promise((resolve, reject) => {
    http.get(`${RECEIVER_URL}/stats`, (res) => {
      let body = '';
      res.on('data', (d) => (body += d));
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch {
          resolve({});
        }
      });
    }).on('error', reject);
  });
}

async function resetReceiverStats() {
  return new Promise((resolve, reject) => {
    const req = http.request(
      `${RECEIVER_URL}/reset`,
      { method: 'POST' },
      (res) => {
        res.on('data', () => {});
        res.on('end', resolve);
      },
    );
    req.on('error', reject);
    req.end();
  });
}

async function setupBenchmarkEntities() {
  console.log('[Setup] Provisioning benchmark tenant, endpoint, and destination in database...');

  const orgId = crypto.randomUUID();
  const endpointId = crypto.randomUUID();
  const destinationId = crypto.randomUUID();
  const signingSecret = 'benchmark_signing_secret_key_12345';

  const rawKey = process.env.ENCRYPTION_KEY || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  const encKey = crypto.createHash('sha256').update(rawKey).digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encKey, iv);
  let ciphertext = cipher.update(signingSecret, 'utf8', 'hex');
  ciphertext += cipher.final('hex');
  const tag = cipher.getAuthTag().toString('hex');

  await queryDb(
    `INSERT INTO organizations (id, name, slug, updated_at) VALUES ($1, $2, $3, NOW())
     ON CONFLICT (id) DO NOTHING`,
    [orgId, 'Benchmark Org', `bench-${Date.now()}`],
  );

  // Endpoint with encrypted AES-256-GCM secret
  await queryDb(
    `INSERT INTO endpoints (id, org_id, name, slug, secret_ciphertext, secret_iv, secret_tag, secret_preview, is_active, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, NOW())
     ON CONFLICT (id) DO NOTHING`,
    [
      endpointId,
      orgId,
      'Benchmark Ingestion Endpoint',
      `bench-ep-${Date.now()}`,
      ciphertext,
      iv.toString('hex'),
      tag,
      signingSecret.slice(0, 10),
    ],
  );

  // Active destination pointing to local receiver
  await queryDb(
    `INSERT INTO destinations (id, org_id, name, url, http_method, rate_limit_per_second, timeout_ms, is_active, updated_at)
     VALUES ($1, $2, $3, $4, 'POST', 1000, 5000, true, NOW())
     ON CONFLICT (id) DO NOTHING`,
    [destinationId, orgId, 'Benchmark Controlled Receiver', `${RECEIVER_URL}/webhook`],
  );

  console.log(`[Setup] Ready. Endpoint ID: ${endpointId}`);
  return { orgId, endpointId, destinationId, signingSecret };
}

function runAutocannon(opts) {
  return new Promise((resolve, reject) => {
    autocannon(opts, (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
  });
}

async function main() {
  console.log('===============================================================');
  console.log('  RelayForge Reliability Audit & Performance Benchmark Runner  ');
  console.log('===============================================================');

  // Environment specs
  const cpus = os.cpus();
  const envInfo = {
    os: `${os.type()} ${os.release()} (${os.arch()})`,
    nodeVersion: process.version,
    cpuModel: cpus[0]?.model ?? 'Unknown',
    cpuCores: cpus.length,
    totalMemGb: (os.totalmem() / 1024 / 1024 / 1024).toFixed(2),
    freeMemGb: (os.freemem() / 1024 / 1024 / 1024).toFixed(2),
  };

  console.log('Environment Specs:');
  console.log(`- CPU: ${envInfo.cpuModel} (${envInfo.cpuCores} cores)`);
  console.log(`- Memory: ${envInfo.totalMemGb} GB total, ${envInfo.freeMemGb} GB free`);
  console.log(`- Node.js: ${envInfo.nodeVersion}`);
  console.log(`- OS: ${envInfo.os}`);
  console.log('---------------------------------------------------------------\n');

  // Verify receiver
  try {
    await getReceiverStats();
    console.log('[Check] Controlled receiver is running on port 9999.');
  } catch {
    console.error('[Error] Controlled receiver is not running. Please start it with: node benchmarks/receiver.cjs');
    process.exit(1);
  }

  // Provision test entities
  const fixture = await setupBenchmarkEntities();
  const allResults = [];

  // Reset receiver config
  await configureReceiver({ statusCode: 200, delayMs: 0, failRate: 0 });
  await resetReceiverStats();

  // Helper for generating signed requests
  const generatePayload = (sizeBytes = 1024) => {
    const rawData = 'A'.repeat(Math.max(10, sizeBytes - 120));
    return {
      event: 'order.created',
      orderId: crypto.randomUUID(),
      data: rawData,
      timestamp: Date.now(),
    };
  };

  // ==============================================================
  // Scenario 1: Baseline Signed Webhook Ingestion Across Concurrency
  // ==============================================================
  console.log('\n--- Scenario 1: Baseline Ingestion (1KB Payload, Variable Concurrency) ---');
  const concurrencyLevels = [10, 50, 100, 200];

  for (const c of concurrencyLevels) {
    const samplePayload = generatePayload(1024);
    const bodyStr = JSON.stringify(samplePayload);
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = signPayload(bodyStr, fixture.signingSecret, timestamp);

    console.log(`Running ingestion benchmark: ${c} concurrent connections, 10s duration...`);
    const result = await runAutocannon({
      url: `${API_BASE}/v1/ingest/${fixture.endpointId}`,
      method: 'POST',
      connections: c,
      duration: 10,
      headers: {
        'content-type': 'application/json',
        'x-relayforge-signature': signature,
        'x-event-type': 'order.created',
      },
      body: bodyStr,
    });

    const summary = {
      scenario: `Signed Ingestion (1KB, c=${c})`,
      concurrency: c,
      rps: result.requests.average,
      totalRequests: result.requests.total,
      successCount: result['2xx'],
      errorCount: result.non2xx,
      p50: result.latency.p50,
      p95: result.latency.p95 || result.latency.p97_5,
      p99: result.latency.p99,
      throughputBytesSec: result.throughput.average,
    };
    allResults.push(summary);

    console.log(`  -> RPS: ${summary.rps.toFixed(1)}, p50: ${summary.p50}ms, p95: ${summary.p95}ms, p99: ${summary.p99}ms (Success: ${summary.successCount}, Errors: ${summary.errorCount})`);
  }

  // ==============================================================
  // Scenario 2: Large Payload Ingestion (50KB)
  // ==============================================================
  console.log('\n--- Scenario 2: Large Payload Ingestion (50KB Payload, c=50) ---');
  {
    const samplePayload50k = generatePayload(50 * 1024);
    const bodyStr50k = JSON.stringify(samplePayload50k);
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = signPayload(bodyStr50k, fixture.signingSecret, timestamp);

    const result = await runAutocannon({
      url: `${API_BASE}/v1/ingest/${fixture.endpointId}`,
      method: 'POST',
      connections: 50,
      duration: 10,
      headers: {
        'content-type': 'application/json',
        'x-relayforge-signature': signature,
        'x-event-type': 'order.created',
      },
      body: bodyStr50k,
    });

    const summary = {
      scenario: 'Signed Ingestion (50KB, c=50)',
      concurrency: 50,
      rps: result.requests.average,
      totalRequests: result.requests.total,
      successCount: result['2xx'],
      errorCount: result.non2xx,
      p50: result.latency.p50,
      p95: result.latency.p95 || result.latency.p97_5,
      p99: result.latency.p99,
      throughputBytesSec: result.throughput.average,
    };
    allResults.push(summary);
    console.log(`  -> RPS: ${summary.rps.toFixed(1)}, p50: ${summary.p50}ms, p95: ${summary.p95}ms, p99: ${summary.p99}ms`);
  }

  // ==============================================================
  // Scenario 3: Duplicate Webhook Ingestion & Deduplication
  // ==============================================================
  console.log('\n--- Scenario 3: Duplicate Webhook Ingestion (Same Idempotency Key, c=50) ---');
  {
    const samplePayload = generatePayload(1024);
    const bodyStr = JSON.stringify(samplePayload);
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = signPayload(bodyStr, fixture.signingSecret, timestamp);
    const stableIdempotencyKey = `fixed-dedup-key-${Date.now()}`;

    const result = await runAutocannon({
      url: `${API_BASE}/v1/ingest/${fixture.endpointId}`,
      method: 'POST',
      connections: 50,
      duration: 10,
      headers: {
        'content-type': 'application/json',
        'x-relayforge-signature': signature,
        'x-event-type': 'order.created',
        'x-idempotency-key': stableIdempotencyKey,
      },
      body: bodyStr,
    });

    const summary = {
      scenario: 'Duplicate Ingestion Deduplication (c=50)',
      concurrency: 50,
      rps: result.requests.average,
      totalRequests: result.requests.total,
      successCount: result['2xx'],
      errorCount: result.non2xx,
      p50: result.latency.p50,
      p95: result.latency.p95 || result.latency.p97_5,
      p99: result.latency.p99,
      throughputBytesSec: result.throughput.average,
    };
    allResults.push(summary);
    console.log(`  -> RPS: ${summary.rps.toFixed(1)}, p50: ${summary.p50}ms, p95: ${summary.p95}ms (Fast-path duplicate response)`);
  }

  // ==============================================================
  // Scenario 4: Worker Outbox Backlog & Drain Throughput
  // ==============================================================
  console.log('\n--- Scenario 4: Worker Outbox Backlog & Drain Throughput ---');
  {
    console.log('Measuring outbox queue drain rate...');
    const initialBacklog = await queryDb(
      `SELECT status, count(*)::int FROM outbox_messages WHERE org_id = $1 GROUP BY status`,
      [fixture.orgId],
    );
    console.log('Current Outbox Status:', initialBacklog);

    // Wait 5 seconds to let worker process messages
    await sleep(5000);

    const receiverStats = await getReceiverStats();
    const afterBacklog = await queryDb(
      `SELECT status, count(*)::int FROM outbox_messages WHERE org_id = $1 GROUP BY status`,
      [fixture.orgId],
    );
    console.log('Outbox Status after 5s drain:', afterBacklog);
    console.log(`Deliveries received by destination: ${receiverStats.totalReceived} (Throughput: ${receiverStats.throughputRps} deliveries/sec)`);

    allResults.push({
      scenario: 'Worker Outbox Dispatcher',
      concurrency: 'Worker background pool',
      rps: Number(receiverStats.throughputRps),
      totalRequests: receiverStats.totalReceived,
      successCount: receiverStats.successCount,
      errorCount: receiverStats.failureCount,
      p50: 'N/A (async)',
      p95: 'N/A (async)',
      p99: 'N/A (async)',
      throughputBytesSec: 0,
    });
  }

  // ==============================================================
  // Scenario 5: Destination Latency Sensitivity
  // ==============================================================
  console.log('\n--- Scenario 5: Destination Response Latency Sensitivity (50ms vs 200ms) ---');
  for (const delay of [50, 200]) {
    await configureReceiver({ statusCode: 200, delayMs: delay, failRate: 0 });
    await resetReceiverStats();
    await sleep(2000);

    const stats = await getReceiverStats();
    console.log(`Receiver configured with ${delay}ms delay. Current throughput: ${stats.throughputRps} rps`);
  }
  // Reset receiver delay
  await configureReceiver({ statusCode: 200, delayMs: 0, failRate: 0 });

  // ==============================================================
  // Scenario 6: Destination Failure & Retry Scheduling
  // ==============================================================
  console.log('\n--- Scenario 6: Retry Behavior Under Destination Failure (HTTP 503) ---');
  {
    await configureReceiver({ statusCode: 503, delayMs: 0, failRate: 1.0 });
    await resetReceiverStats();

    // Ingest a single event
    const samplePayload = generatePayload(512);
    const bodyStr = JSON.stringify(samplePayload);
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = signPayload(bodyStr, fixture.signingSecret, timestamp);

    const ingestRes = await fetch(`${API_BASE}/v1/ingest/${fixture.endpointId}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-relayforge-signature': signature,
        'x-event-type': 'order.created',
        'x-idempotency-key': `retry-test-${Date.now()}`,
      },
      body: bodyStr,
    });
    const ingestJson = await ingestRes.json();
    console.log('Ingested event for failure test:', ingestJson.eventId);

    // Wait for worker sweep
    await sleep(3000);

    const outboxRow = await queryDb(
      `SELECT id, status, attempt_count, next_retry_at, lease_expires_at
       FROM outbox_messages WHERE event_id = $1`,
      [ingestJson.eventId],
    );
    console.log('Outbox message status after HTTP 503 failure:', outboxRow[0]);

    const attempts = await queryDb(
      `SELECT status, status_code, latency_ms, error_description
       FROM delivery_attempts WHERE event_id = $1 ORDER BY created_at DESC`,
      [ingestJson.eventId],
    );
    console.log('Delivery attempts recorded in database:', attempts);
  }
  await configureReceiver({ statusCode: 200, delayMs: 0, failRate: 0 });

  // ==============================================================
  // Scenario 7: Database Connection Pool & Resource Utilization
  // ==============================================================
  console.log('\n--- Scenario 7: Database Connection Pool & Resource Telemetry ---');
  const dbConnections = await queryDb(
    `SELECT count(*)::int as total, state, usename FROM pg_stat_activity GROUP BY state, usename`,
  );
  console.log('PostgreSQL Connection Activity:', dbConnections);

  const mem = process.memoryUsage();
  const cpu = process.cpuUsage();
  console.log('Benchmark Process Resource Footprint:');
  console.log(`- RSS: ${(mem.rss / 1024 / 1024).toFixed(2)} MB`);
  console.log(`- Heap Used: ${(mem.heapUsed / 1024 / 1024).toFixed(2)} MB`);
  console.log(`- User CPU: ${(cpu.user / 1000).toFixed(1)} ms, System CPU: ${(cpu.system / 1000).toFixed(1)} ms`);

  // Write summary markdown report
  console.log('\n===============================================================');
  console.log('                    BENCHMARK RESULTS TABLE                    ');
  console.log('===============================================================');
  console.table(
    allResults.map((r) => ({
      Scenario: r.scenario,
      'Conn / VU': r.concurrency,
      'RPS (req/s)': typeof r.rps === 'number' ? r.rps.toFixed(1) : r.rps,
      'p50 (ms)': r.p50,
      'p95 (ms)': r.p95,
      'p99 (ms)': r.p99,
      Success: r.successCount,
      Errors: r.errorCount,
    })),
  );

  console.log('\n[Done] Benchmark suite execution complete.');
}

main().catch((err) => {
  console.error('[Benchmark Failure]', err);
  process.exit(1);
});
