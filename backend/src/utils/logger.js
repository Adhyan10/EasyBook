import { env } from '../config/env.js';

const replacer = (_key, value) =>
  value instanceof Error ? { name: value.name, message: value.message, stack: value.stack } : value;

function write(level, message, meta) {
  if (env.NODE_ENV === 'test') return;
  const line = JSON.stringify({ level, message, time: new Date().toISOString(), meta }, replacer);
  if (level === 'error') console.error(line);
  else console.info(line);
}

export const logger = {
  info: (message, meta) => write('info', message, meta),
  error: (message, meta) => write('error', message, meta),
};
