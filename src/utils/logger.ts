import { ENV } from '../config/env';
import { AppError, getSafeErrorContext } from './errors';

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

function normalizePrimitive(value: unknown): string | number | boolean | null | undefined {
  if (value == null) return value as null | undefined;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  return undefined;
}

function normalizeContext(context?: unknown): unknown {
  if (!context) return undefined;

  if (context instanceof Error || context instanceof AppError) {
    return getSafeErrorContext(context);
  }

  if (typeof context !== 'object') {
    return normalizePrimitive(context);
  }

  const safeEntries = Object.entries(context as Record<string, unknown>)
    .map(([key, value]) => [key, normalizePrimitive(value)])
    .filter(([, value]) => value !== undefined);

  return Object.fromEntries(safeEntries);
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
