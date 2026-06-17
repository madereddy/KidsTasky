import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { NoopSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';

function hasOtlpEndpoint(): boolean {
  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  const exporter = process.env.OTEL_TRACES_EXPORTER;
  if (exporter === 'none') return false;
  if (exporter && exporter !== 'none') return true;
  return Boolean(endpoint);
}

let sdk: NodeSDK | null = null;

export function startTracing() {
  sdk = new NodeSDK({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: process.env.OTEL_SERVICE_NAME || 'kidtasker',
    }),
    // Without OTLP endpoint, use NoopSpanProcessor so spans are created
    // (trace/span IDs available for log correlation) but never exported.
    // This avoids repeated connection errors to the default localhost:4318.
    ...(!hasOtlpEndpoint() && { spanProcessors: [new NoopSpanProcessor()] }),
    instrumentations: [
      getNodeAutoInstrumentations({
        // fs instrumentation creates too much noise (pino, sqlite reads)
        '@opentelemetry/instrumentation-fs': { enabled: false },
      }),
    ],
  });
  try {
    sdk.start();
  } catch {
    sdk = null;
  }
}

export async function stopTracing() {
  if (!sdk) return;
  await sdk.shutdown().catch(() => {});
  sdk = null;
}
