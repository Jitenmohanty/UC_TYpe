import pino from 'pino';
import { env } from '../../config/env';

export const logger = pino({
  level: env.LOG_LEVEL,
  transport:
    env.NODE_ENV === 'development'
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'HH:MM:ss Z',
            ignore: 'pid,hostname',
          },
        }
      : undefined,
  formatters: {
    level(label) {
      return { level: label };
    },
  },
  base: {
    env: env.NODE_ENV,
  },
  serializers: {
    error: pino.stdSerializers.err,
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res,
  },
  redact: {
    paths: ['req.headers.authorization', 'password', 'passwordHash', 'refreshToken', 'token'],
    censor: '[REDACTED]',
  },
});
