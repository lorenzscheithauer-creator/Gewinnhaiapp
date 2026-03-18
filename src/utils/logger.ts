import { ENV } from '../config/env';
import { getSafeErrorDetails } from './error';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const levelRank: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40
};

const configuredLevel: LogLevel = ENV.appEnv === 'production' ? 'warn' : 'debug';

function shouldLog(level: LogLevel): boolean {
  return levelRank[level] >= levelRank[configuredLevel];
}

function sanitizeValue(value: unknown, seen: WeakSet<object>, depth: number): unknown {
  if (value == null) return value;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;

  if (value instanceof Error) {
    return getSafeErrorDetails(value);
  }

  if (depth >= 3) {
    return '[truncated]';
  }

  if (Array.isArray(value)) {
    return value.slice(0, 10).map((entry) => sanitizeValue(entry, seen, depth + 1));
  }

  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;

    if (seen.has(record)) {
      return '[circular]';
    }

    seen.add(record);

    const safeKeys = ['message', 'status', 'endpoint', 'code', 'method', 'url', 'count', 'found', 'top3', 'newest', 'stats', 'params', 'detail'];
    const keys = Object.keys(record)
      .filter((key) => safeKeys.includes(key))
      .slice(0, 12);

    const output: Record<string, unknown> = {};

    for (const key of keys) {
      output[key] = sanitizeValue(record[key], seen, depth + 1);
    }

    return output;
  }

  return String(value);
}

function normalizeContext(context?: unknown): unknown {
  if (!context) return undefined;

  return sanitizeValue(context, new WeakSet<object>(), 0);
}

export function log(level: LogLevel, message: string, context?: unknown): void {
  if (!shouldLog(level)) return;

  const payload = normalizeContext(context);
  const line = `[Gewinnhai][${level.toUpperCase()}] ${message}`;

  if (level === 'error') {
    console.error(line, payload ?? '');
    return;
  }

  if (level === 'warn') {
    console.warn(line, payload ?? '');
    return;
  }

  console.log(line, payload ?? '');
}
