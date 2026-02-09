import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV === 'development' 
    ? { target: 'pino-pretty', options: { colorize: true } }
    : undefined,
  redact: {
    paths: [
      'email',
      'phone', 
      'req.headers.authorization',
      'req.headers.cookie',
      '*.email',
      '*.phone',
      '*.phoneNumber',
      '*.agentEmail',
      '*.agentPhone',
      '*.contactEmail',
      '*.contactPhone',
    ],
    censor: '[REDACTED]'
  },
  serializers: {
    err: pino.stdSerializers.err,
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res,
  },
  base: {
    service: 'contract-conduit',
    env: process.env.NODE_ENV || 'development',
  }
});

export default logger;

export function createModuleLogger(module: string) {
  return logger.child({ module });
}
