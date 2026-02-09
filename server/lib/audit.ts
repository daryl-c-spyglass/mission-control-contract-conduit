import { db } from '../db';
import { auditLogs } from '@shared/schema';
import { createModuleLogger } from './logger';

const log = createModuleLogger('audit');

interface AuditEntry {
  requestId?: string;
  action: string;
  actor: string;
  target?: string;
  metadata?: Record<string, any>;
  status: 'success' | 'failure' | 'skipped';
  errorMessage?: string;
  transactionId?: string;
}

export async function logAudit(entry: AuditEntry): Promise<void> {
  try {
    await db.insert(auditLogs).values({
      requestId: entry.requestId,
      action: entry.action,
      actor: entry.actor,
      target: entry.target,
      metadata: entry.metadata,
      status: entry.status,
      errorMessage: entry.errorMessage,
      transactionId: entry.transactionId,
    });
    
    log.info({ 
      action: entry.action, 
      status: entry.status, 
      target: entry.target 
    }, 'Audit entry recorded');
  } catch (err) {
    log.error({ err, entry }, 'Failed to write audit log');
  }
}
