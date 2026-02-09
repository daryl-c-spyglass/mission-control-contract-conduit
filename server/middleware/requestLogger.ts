import { Request, Response, NextFunction } from 'express';
import { createModuleLogger } from '../lib/logger';

const log = createModuleLogger('http');

export function requestLoggerMiddleware(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    
    if (!req.originalUrl.startsWith('/api')) {
      return;
    }
    
    const logData = {
      requestId: req.requestId,
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      duration,
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    };
    
    if (res.statusCode >= 500) {
      log.error(logData, 'Request failed');
    } else if (res.statusCode >= 400) {
      log.warn(logData, 'Request client error');
    } else {
      log.info(logData, 'Request completed');
    }
  });
  
  next();
}
