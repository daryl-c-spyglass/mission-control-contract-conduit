import { createModuleLogger } from '../lib/logger';
import { storage } from '../storage.js';
import type { InsertActivity } from '@shared/schema';

const log = createModuleLogger('timeline');

function getCategoryFromType(eventType: string): string {
  if (eventType.startsWith('transaction_') || eventType === 'status_changed') return 'transaction';
  if (eventType.startsWith('mls_') || eventType === 'price_changed' || eventType === 'photos_updated') return 'mls';
  if (eventType.startsWith('document_')) return 'documents';
  if (eventType.includes('graphic') || eventType.includes('flyer') || eventType.includes('asset') || eventType === 'quick_create_all') return 'marketing';
  if (eventType.startsWith('cma_')) return 'cma';
  if (eventType.startsWith('coordinator_') || eventType === 'note_added') return 'team';
  if (eventType.includes('date') || eventType === 'deadline_approaching') return 'dates';
  if (eventType === 'email_sent' || eventType === 'slack_notification' || eventType === 'channel_created' || eventType === 'filter_created') return 'communication';
  return 'other';
}

export async function logTimelineEvent(
  transactionId: string,
  eventType: string,
  description: string,
  options?: {
    metadata?: Record<string, any>;
  }
) {
  try {
    const activity: InsertActivity = {
      transactionId,
      type: eventType,
      category: getCategoryFromType(eventType),
      description,
      metadata: options?.metadata,
    };

    return await storage.createActivity(activity);
  } catch (error) {
    log.error({ err: error }, 'Failed to log timeline event');
  }
}

export const TimelineLogger = {
  // Transaction events
  transactionCreated: (transactionId: string, address: string) =>
    logTimelineEvent(transactionId, 'transaction_created', `Transaction created for ${address}`),

  transactionArchived: (transactionId: string) =>
    logTimelineEvent(transactionId, 'transaction_archived', 'Transaction moved to archive'),

  transactionRestored: (transactionId: string) =>
    logTimelineEvent(transactionId, 'transaction_restored', 'Transaction restored from archive'),

  statusChanged: (transactionId: string, oldStatus: string, newStatus: string) =>
    logTimelineEvent(transactionId, 'status_changed', `Status changed from ${oldStatus} to ${newStatus}`, {
      metadata: { oldStatus, newStatus }
    }),

  // MLS events
  mlsSynced: (transactionId: string, photoCount: number, compCount: number) =>
    logTimelineEvent(transactionId, 'mls_synced', `MLS data synced: ${photoCount} photos, ${compCount} comparables`),

  mlsFetched: (transactionId: string, message: string) =>
    logTimelineEvent(transactionId, 'mls_fetched', message),

  priceChanged: (transactionId: string, oldPrice: number, newPrice: number) =>
    logTimelineEvent(transactionId, 'price_changed', `Price updated: $${oldPrice.toLocaleString()} → $${newPrice.toLocaleString()}`, {
      metadata: { oldPrice, newPrice, change: newPrice - oldPrice }
    }),

  mlsStatusChanged: (transactionId: string, newStatus: string) =>
    logTimelineEvent(transactionId, 'mls_status_changed', `MLS status changed to ${newStatus}`),

  photosUpdated: (transactionId: string, count: number) =>
    logTimelineEvent(transactionId, 'photos_updated', `${count} new photos added from MLS`),

  // Document events
  documentUploaded: (transactionId: string, filename: string) =>
    logTimelineEvent(transactionId, 'document_uploaded', `Document uploaded: ${filename}`),

  documentsUploaded: (transactionId: string, count: number) =>
    logTimelineEvent(transactionId, 'documents_batch_uploaded', `${count} documents uploaded`),

  documentDeleted: (transactionId: string, filename: string) =>
    logTimelineEvent(transactionId, 'document_deleted', `Document deleted: ${filename}`),

  documentDownloaded: (transactionId: string, filename: string) =>
    logTimelineEvent(transactionId, 'document_downloaded', `Document downloaded: ${filename}`),

  // Marketing events
  graphicCreated: (transactionId: string, format: string) =>
    logTimelineEvent(transactionId, 'graphic_created', `${format} graphic created`),

  flyerCreated: (transactionId: string) =>
    logTimelineEvent(transactionId, 'flyer_created', 'Print flyer generated'),

  flyerDownloaded: (transactionId: string) =>
    logTimelineEvent(transactionId, 'flyer_created', 'Print flyer downloaded'),

  quickCreateAll: (transactionId: string, count: number) =>
    logTimelineEvent(transactionId, 'quick_create_all', `Generated ${count} marketing graphics`),

  assetDeleted: (transactionId: string, type: string) =>
    logTimelineEvent(transactionId, 'asset_deleted', `Marketing asset deleted: ${type}`),

  assetCreated: (transactionId: string, type: string) =>
    logTimelineEvent(transactionId, 'asset_created', `Marketing asset created: ${type}`),

  // CMA events
  cmaCreated: (transactionId: string, compCount: number) =>
    logTimelineEvent(transactionId, 'cma_created', `CMA created with ${compCount} comparables`),

  cmaUpdated: (transactionId: string, message?: string) =>
    logTimelineEvent(transactionId, 'cma_updated', message || 'CMA updated'),

  cmaShared: (transactionId: string) =>
    logTimelineEvent(transactionId, 'cma_shared', 'CMA share link generated'),

  cmaShareRevoked: (transactionId: string) =>
    logTimelineEvent(transactionId, 'cma_share_revoked', 'CMA share link removed'),

  // Team events
  coordinatorAssigned: (transactionId: string, name: string) =>
    logTimelineEvent(transactionId, 'coordinator_assigned', `Coordinator assigned: ${name}`),

  coordinatorRemoved: (transactionId: string, name: string) =>
    logTimelineEvent(transactionId, 'coordinator_removed', `Coordinator removed: ${name}`),

  noteAdded: (transactionId: string) =>
    logTimelineEvent(transactionId, 'note_added', 'Note added to transaction'),

  // Date events
  contractDateSet: (transactionId: string, date: string) =>
    logTimelineEvent(transactionId, 'contract_date_set', `Contract date set: ${date}`),

  closingDateSet: (transactionId: string, date: string) =>
    logTimelineEvent(transactionId, 'closing_date_set', `Expected closing: ${date}`),

  dateUpdated: (transactionId: string, field: string, oldDate: string, newDate: string) =>
    logTimelineEvent(transactionId, 'date_updated', `${field} changed: ${oldDate} → ${newDate}`),

  // Communication events
  channelCreated: (transactionId: string, channelName: string) =>
    logTimelineEvent(transactionId, 'channel_created', `Slack channel created: ${channelName}`),

  emailSent: (transactionId: string, subject: string) =>
    logTimelineEvent(transactionId, 'email_sent', `Email sent: ${subject}`),
};
