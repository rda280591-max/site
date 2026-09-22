// ORBIT — لاگر ساختاریافته
import { ENV } from './config';
import { isOrbitError, normalizeError } from './errors';

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  SILENT = 4,
}

const ACTIVE_LEVEL: LogLevel = ENV.isProd ? LogLevel.WARN : LogLevel.DEBUG;

interface LogRecord {
  level: keyof typeof LogLevel;
  scope: string;
  message: string;
  timestamp: string;
  data?: unknown;
}

const COLORS: Record<string, string> = {
  DEBUG: '\x1b[36m',
  INFO: '\x1b[32m',
  WARN: '\x1b[33m',
  ERROR: '\x1b[31m',
  RESET: '\x1b[0m',
  DIM: '\x1b[2m',
};

export function createLogger(scope: string) {
  const write = (level: LogLevel, message: string, data?: unknown) => {
    if (level < ACTIVE_LEVEL) return;

    const levelName = LogLevel[level] as keyof typeof LogLevel;
    const record: LogRecord = {
      level: levelName,
      scope,
      message,
      timestamp: new Date().toISOString(),
      data: data instanceof Error ? normalizeError(data).toJSON() : data,
    };

    if (ENV.isDev) {
      const color = COLORS[levelName] ?? '';
      const prefix = `${color}[ORBIT:${levelName}]${COLORS.RESET} ${COLORS.DIM}${scope}${COLORS.RESET}`;
      const args: unknown[] = [prefix, message];
      if (data !== undefined) args.push(data);
      if (level === LogLevel.ERROR) console.error(...args);
      else if (level === LogLevel.WARN) console.warn(...args);
      else console.log(...args);
    } else {
      console.log(JSON.stringify(record));
    }
  };

  return {
    debug: (msg: string, data?: unknown) => write(LogLevel.DEBUG, msg, data),
    info: (msg: string, data?: unknown) => write(LogLevel.INFO, msg, data),
    warn: (msg: string, data?: unknown) => write(LogLevel.WARN, msg, data),
    error: (msg: string, data?: unknown) => {
      const normalized = isOrbitError(data) ? data.toJSON() : data;
      write(LogLevel.ERROR, msg, normalized);
    },
    child: (sub: string) => createLogger(`${scope}:${sub}`),
  };
}

export const logger = createLogger('orbit');