import request from 'supertest';
import { app } from '../src/index';
import { pool, runMigrations } from '../src/db';
import { AuthService } from '../src/modules/auth/auth.service';

beforeAll(async () => {
  await runMigrations();
});

afterAll(async () => {
  await pool.end();
});

describe('Phase 6 Load Testing & Concurrency Benchmark Suite', () => {
  let tenant: any;

  beforeAll(async () => {
    tenant = await AuthService.signup(`load_${Date.now()}@example.com`, 'Pass123456!', 'Load User', 'Org Load Test');
  });

  it('should execute concurrent request load test and calculate P50, P95, P99 latency', async () => {
    const CONCURRENCY = 20;
    const latencies: number[] = [];
    let successCount = 0;
    let errorCount = 0;

    const promises = Array.from({ length: CONCURRENCY }).map(async () => {
      const start = Date.now();
      try {
        const res = await request(app)
          .get('/api/v1/organizations')
          .set('Authorization', `Bearer ${tenant.tokens.accessToken}`);

        const duration = Date.now() - start;
        latencies.push(duration);

        if (res.status === 200) {
          successCount++;
        } else {
          errorCount++;
        }
      } catch (err) {
        errorCount++;
      }
    });

    await Promise.all(promises);

    // Sort latencies to compute percentiles
    latencies.sort((a, b) => a - b);
    const p50 = latencies[Math.floor(latencies.length * 0.5)];
    const p95 = latencies[Math.floor(latencies.length * 0.95)];
    const p99 = latencies[Math.floor(latencies.length * 0.99)];

    console.log(`[LOAD BENCHMARK SUMMARY] Total: ${CONCURRENCY} reqs | Success: ${successCount} | Errors: ${errorCount}`);
    console.log(`[LATENCY STATS] P50: ${p50}ms | P95: ${p95}ms | P99: ${p99}ms`);

    expect(successCount).toBe(CONCURRENCY);
    expect(errorCount).toBe(0);
    expect(p95).toBeLessThan(1000); // P95 latency under 1 second
  });
});
