import fs from 'node:fs';
import path from 'node:path';
import pino, { type Logger } from 'pino';
import { config } from '../config.js';

let logger: Logger | null = null;

export function getLogger(): Logger {
  if (logger) return logger;

  const streams: pino.StreamEntry[] = [{ level: 'info', stream: process.stdout }];

  if (config.isProduction) {
    try {
      fs.mkdirSync(config.logDir, { recursive: true });
      streams.push({
        level: 'info',
        stream: pino.destination({ dest: path.join(config.logDir, 'app.log'), sync: true, mkdir: true }),
      });
    } catch {
      // Falls das Log-Verzeichnis nicht beschreibbar ist, bleibt stdout (journald).
    }
  }

  logger = pino(
    {
      level: config.env === 'development' ? 'debug' : 'info',
      base: { service: '3d-mir' },
      redact: {
        paths: ['req.headers.cookie', 'req.headers.authorization', 'password', '*.password', '*.pass'],
        censor: '[redacted]',
      },
    },
    pino.multistream(streams),
  );
  return logger;
}
