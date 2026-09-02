import { logger } from './logger';

export function trackLatency(endpoint: string, duration: number) {
  logger.debug(`Latency: ${endpoint}`, {
    endpoint,
    duration: `${duration}ms`,
  });
}
