/**
 * Script de benchmark simples para POST /api/logs.
 * Uso: BENCHMARK_API_KEY=sua-chave bun run benchmark
 * Requer servidor rodando (ex.: bun run dev).
 */

const BASE_URL = process.env.BENCHMARK_BASE_URL ?? "http://localhost:3000";
const API_KEY = process.env.BENCHMARK_API_KEY ?? "";
const REQUESTS = Number(process.env.BENCHMARK_REQUESTS ?? "100");

if (!API_KEY) {
  console.error("Defina BENCHMARK_API_KEY com uma API key válida.");
  console.error("Ex.: BENCHMARK_API_KEY=sua-chave bun run benchmark");
  process.exit(1);
}

const latencies: number[] = [];

async function run(): Promise<void> {
  console.log(`Benchmark: ${REQUESTS} requisições para ${BASE_URL}/api/logs\n`);

  const start = performance.now();
  for (let i = 0; i < REQUESTS; i++) {
    const t0 = performance.now();
    const res = await fetch(`${BASE_URL}/api/logs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
      },
      body: JSON.stringify({
        level: "info",
        message: `benchmark-${i}`,
        metadata: { run: "benchmark" },
      }),
    });
    const t1 = performance.now();
    latencies.push((t1 - t0) * 1000); // ms
    if (!res.ok) {
      console.error(`Request ${i + 1} falhou: ${res.status} ${await res.text()}`);
    }
  }
  const totalMs = performance.now() - start;

  latencies.sort((a, b) => a - b);
  const avg = latencies.reduce((s, n) => s + n, 0) / latencies.length;
  const p95 = latencies[Math.floor(latencies.length * 0.95)] ?? 0;

  console.log("Resultados:");
  console.log(`  Requisições:  ${REQUESTS}`);
  console.log(`  Tempo total:   ${totalMs.toFixed(2)} ms`);
  console.log(`  Throughput:   ${(REQUESTS / (totalMs / 1000)).toFixed(2)} req/s`);
  console.log(`  Latência avg: ${avg.toFixed(2)} ms`);
  console.log(`  Latência p95: ${p95.toFixed(2)} ms`);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
