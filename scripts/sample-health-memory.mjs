import fs from 'fs';
import path from 'path';

function printHelp() {
  console.log(`Usage: node scripts/sample-health-memory.mjs [options]

Options:
  --url <url>           Health endpoint to poll
                        Default: http://localhost:3000/api/health/memory
  --interval-ms <ms>    Poll interval in milliseconds
                        Default: 30000
  --samples <count>     Number of samples to capture before exiting
                        Default: 20
  --out <path>          Output JSONL file path
                        Default: tmp/health/memory-<timestamp>.jsonl
  --help                Show this message
`);
}

function parseArgs(argv) {
  const options = {
    url: 'http://localhost:3000/api/health/memory',
    intervalMs: 30_000,
    samples: 20,
    out: '',
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help') {
      printHelp();
      process.exit(0);
    }
    if (arg === '--url') {
      options.url = argv[i + 1] || options.url;
      i += 1;
      continue;
    }
    if (arg === '--interval-ms') {
      options.intervalMs = Number(argv[i + 1] || options.intervalMs);
      i += 1;
      continue;
    }
    if (arg === '--samples') {
      options.samples = Number(argv[i + 1] || options.samples);
      i += 1;
      continue;
    }
    if (arg === '--out') {
      options.out = argv[i + 1] || options.out;
      i += 1;
    }
  }

  if (!Number.isFinite(options.intervalMs) || options.intervalMs <= 0) {
    throw new Error('--interval-ms must be a positive number');
  }
  if (!Number.isFinite(options.samples) || options.samples <= 0) {
    throw new Error('--samples must be a positive number');
  }

  return options;
}

function ensureOutputPath(outPath) {
  const resolved = path.resolve(
    outPath || path.join('tmp', 'health', `memory-${new Date().toISOString().replace(/[:.]/g, '-')}.jsonl`),
  );
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  return resolved;
}

function summarize(samples) {
  const rssValues = samples.map((sample) => sample.memory?.rssMb).filter((value) => typeof value === 'number');
  const heapValues = samples.map((sample) => sample.memory?.heapUsedMb).filter((value) => typeof value === 'number');
  const socketValues = samples.map((sample) => sample.sockets?.connectedSockets).filter((value) => typeof value === 'number');

  const stats = (values) => {
    if (values.length === 0) return null;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const avg = Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 100) / 100;
    return { min, max, avg };
  };

  return {
    rssMb: stats(rssValues),
    heapUsedMb: stats(heapValues),
    connectedSockets: stats(socketValues),
  };
}

async function captureSample(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }
  const body = await response.json();
  return {
    capturedAt: new Date().toISOString(),
    ...body,
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const outputPath = ensureOutputPath(options.out);
  const samples = [];

  console.log(`Sampling ${options.url}`);
  console.log(`Interval: ${options.intervalMs}ms | Samples: ${options.samples}`);
  console.log(`Writing JSONL to ${outputPath}`);

  for (let index = 0; index < options.samples; index += 1) {
    try {
      const sample = await captureSample(options.url);
      samples.push(sample);
      fs.appendFileSync(outputPath, `${JSON.stringify(sample)}\n`);

      const rssMb = sample.memory?.rssMb ?? 'n/a';
      const heapUsedMb = sample.memory?.heapUsedMb ?? 'n/a';
      const sockets = sample.sockets?.connectedSockets ?? 'n/a';
      console.log(
        `[${index + 1}/${options.samples}] ${sample.capturedAt} rss=${rssMb}MB heapUsed=${heapUsedMb}MB sockets=${sockets}`,
      );
    } catch (error) {
      const failure = {
        capturedAt: new Date().toISOString(),
        error: error instanceof Error ? error.message : String(error),
      };
      samples.push(failure);
      fs.appendFileSync(outputPath, `${JSON.stringify(failure)}\n`);
      console.error(`[${index + 1}/${options.samples}] sample failed: ${failure.error}`);
    }

    if (index < options.samples - 1) {
      await new Promise((resolve) => setTimeout(resolve, options.intervalMs));
    }
  }

  const successSamples = samples.filter((sample) => sample.memory);
  const summary = summarize(successSamples);
  console.log('Summary:', JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
