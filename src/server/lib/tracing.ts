// OTEL tracing stub. In ESM (tsx/ts-node), HTTP instrumentation requires
// --import @opentelemetry/instrumentation/hook.mjs to patch before modules load.
// The pino mixin in logger.ts already reads traceId/spanId from the active span
// when a provider is registered via this mechanism.
// Wire a real NodeTracerProvider here when deploying with the proper --import flag.

export function startTracing() {}
export async function stopTracing() {}
