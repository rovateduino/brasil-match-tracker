export enum LogLevel {
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
  DEBUG = 'DEBUG',
}

export function log(level: LogLevel, message: string, meta?: any) {
  const timestamp = new Date().toISOString();
  const entry = {
    timestamp,
    level,
    message,
    ...(meta && { meta }),
  };
  // Em produção, poderia enviar para um serviço de logs
  console.log(JSON.stringify(entry));
}

export const logger = {
  info: (msg: string, meta?: any) => log(LogLevel.INFO, msg, meta),
  warn: (msg: string, meta?: any) => log(LogLevel.WARN, msg, meta),
  error: (msg: string, meta?: any) => log(LogLevel.ERROR, msg, meta),
  debug: (msg: string, meta?: any) => log(LogLevel.DEBUG, msg, meta),
};