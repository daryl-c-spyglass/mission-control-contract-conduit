import rateLimit from 'express-rate-limit';
import { createModuleLogger } from '../lib/logger';

const log = createModuleLogger('security');

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    log.warn({ 
      ip: req.ip, 
      requestId: (req as any).requestId,
      path: req.originalUrl 
    }, 'Rate limit exceeded');
    res.status(429).json({ 
      error: 'Too many requests, please try again later.',
      retryAfter: res.getHeader('Retry-After') 
    });
  }
});

export const transactionCreateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    log.warn({ 
      ip: req.ip, 
      requestId: (req as any).requestId 
    }, 'Transaction creation rate limit exceeded');
    res.status(429).json({ error: 'Too many transaction creation attempts.' });
  }
});

export const generationLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    log.warn({ 
      ip: req.ip, 
      requestId: (req as any).requestId 
    }, 'Generation rate limit exceeded');
    res.status(429).json({ error: 'Too many generation requests. Please wait.' });
  }
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
});
