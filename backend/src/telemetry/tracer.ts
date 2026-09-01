import { trace, Tracer } from '@opentelemetry/api';
import { logger } from '../utils/logger';

// OpenTelemetry tracer instance setup
export const tracer: Tracer = trace.getTracer('rag-saas-backend', '1.0.0');

export function initTelemetry() {
  logger.info('OpenTelemetry Tracing initialized for rag-saas-backend');
}
