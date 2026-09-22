// ORBIT — کلاس‌های خطا
export enum ErrorCode {
  UNKNOWN = 'E_UNKNOWN',
  NETWORK = 'E_NETWORK',
  TIMEOUT = 'E_TIMEOUT',
  UNAUTHORIZED = 'E_UNAUTHORIZED',
  FORBIDDEN = 'E_FORBIDDEN',
  NOT_FOUND = 'E_NOT_FOUND',
  VALIDATION = 'E_VALIDATION',
  RATE_LIMIT = 'E_RATE_LIMIT',
  SERVER = 'E_SERVER',
  PARSE = 'E_PARSE',
  STORAGE = 'E_STORAGE',
  CACHE = 'E_CACHE',
  CONFIG = 'E_CONFIG',
}

export interface ErrorContext { [key: string]: unknown }

export class OrbitError extends Error {
  public readonly code: ErrorCode;
  public readonly context?: ErrorContext;
  public readonly timestamp: number;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    code: ErrorCode = ErrorCode.UNKNOWN,
    options: { context?: ErrorContext; cause?: unknown; isOperational?: boolean } = {},
  ) {
    super(message);
    this.name = 'OrbitError';
    this.code = code;
    this.context = options.context;
    this.timestamp = Date.now();
    this.isOperational = options.isOperational ?? true;
    if (options.cause instanceof Error) {
      this.stack = `${this.stack}\nCaused by: ${options.cause.stack}`;
    }
    Object.setPrototypeOf(this, new.target.prototype);
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      context: this.context,
      timestamp: this.timestamp,
      isOperational: this.isOperational,
    };
  }
}

export class NetworkError extends OrbitError {
  constructor(message = 'خطای شبکه رخ داد.', context?: ErrorContext, cause?: unknown) {
    super(message, ErrorCode.NETWORK, { context, cause });
    this.name = 'NetworkError';
  }
}

export class TimeoutError extends OrbitError {
  constructor(message = 'زمان درخواست به پایان رسید.', context?: ErrorContext) {
    super(message, ErrorCode.TIMEOUT, { context });
    this.name = 'TimeoutError';
  }
}

export class ValidationError extends OrbitError {
  constructor(message = 'داده ورودی نامعتبر است.', context?: ErrorContext) {
    super(message, ErrorCode.VALIDATION, { context });
    this.name = 'ValidationError';
  }
}

export class StorageError extends OrbitError {
  constructor(message = 'خطا در ذخیره‌سازی.', context?: ErrorContext, cause?: unknown) {
    super(message, ErrorCode.STORAGE, { context, cause });
    this.name = 'StorageError';
  }
}

export class ParseError extends OrbitError {
  constructor(message = 'خطا در تجزیه داده.', context?: ErrorContext, cause?: unknown) {
    super(message, ErrorCode.PARSE, { context, cause });
    this.name = 'ParseError';
  }
}

export class ConfigError extends OrbitError {
  constructor(message = 'خطای پیکربندی.', context?: ErrorContext) {
    super(message, ErrorCode.CONFIG, { context });
    this.name = 'ConfigError';
  }
}

export function isOrbitError(value: unknown): value is OrbitError {
  return value instanceof OrbitError;
}

export function normalizeError(value: unknown): OrbitError {
  if (isOrbitError(value)) return value;
  if (value instanceof Error) {
    return new OrbitError(value.message, ErrorCode.UNKNOWN, {
      cause: value,
      isOperational: false,
    });
  }
  if (typeof value === 'string') {
    return new OrbitError(value, ErrorCode.UNKNOWN, { isOperational: false });
  }
  return new OrbitError('خطای ناشناخته رخ داد.', ErrorCode.UNKNOWN, {
    context: { raw: value },
    isOperational: false,
  });
}