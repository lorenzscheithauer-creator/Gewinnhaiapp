import { ENV } from '../config/env';

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

function normalizeContext(context?: unknown): unknown {
  if (!context) return undefined;

  if (context instanceof Error) {
    return {
      name: context.name,
      message: context.message,
      stack: context.stack
    };
  }

  return context;
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
