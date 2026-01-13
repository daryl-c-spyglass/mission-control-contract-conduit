import { Home, Package, RefreshCw, DollarSign, BarChart3, Camera, FileText, Trash2, Download, FolderUp, Palette, Newspaper, Sparkles, TrendingUp, Pencil, Link, Ban, User, StickyNote, Calendar, Target, Clock, Mail, MessageSquare, Pin, FileCheck } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface TimelineEventConfig {
  icon: LucideIcon;
  color: string;
  bgColor: string;
  label: string;
}

export const TIMELINE_EVENT_CONFIG: Record<string, TimelineEventConfig> = {
  // Transaction events
  'transaction_created': { icon: Home, color: 'text-green-600', bgColor: 'bg-green-100 dark:bg-green-900/30', label: 'Created' },
  'transaction_archived': { icon: Package, color: 'text-gray-600', bgColor: 'bg-gray-100 dark:bg-gray-800/50', label: 'Archived' },
  'transaction_restored': { icon: RefreshCw, color: 'text-blue-600', bgColor: 'bg-blue-100 dark:bg-blue-900/30', label: 'Restored' },
  'status_changed': { icon: RefreshCw, color: 'text-purple-600', bgColor: 'bg-purple-100 dark:bg-purple-900/30', label: 'Status' },
  
  // MLS events
  'mls_synced': { icon: RefreshCw, color: 'text-blue-600', bgColor: 'bg-blue-100 dark:bg-blue-900/30', label: 'MLS Sync' },
  'mls_fetched': { icon: RefreshCw, color: 'text-blue-600', bgColor: 'bg-blue-100 dark:bg-blue-900/30', label: 'MLS Fetch' },
  'mls_refreshed': { icon: RefreshCw, color: 'text-blue-600', bgColor: 'bg-blue-100 dark:bg-blue-900/30', label: 'MLS Refresh' },
  'mls_auto_synced': { icon: RefreshCw, color: 'text-blue-500', bgColor: 'bg-blue-50 dark:bg-blue-900/20', label: 'Auto Sync' },
  'price_changed': { icon: DollarSign, color: 'text-yellow-600', bgColor: 'bg-yellow-100 dark:bg-yellow-900/30', label: 'Price' },
  'mls_status_changed': { icon: BarChart3, color: 'text-orange-600', bgColor: 'bg-orange-100 dark:bg-orange-900/30', label: 'MLS Status' },
  'photos_updated': { icon: Camera, color: 'text-pink-600', bgColor: 'bg-pink-100 dark:bg-pink-900/30', label: 'Photos' },
  
  // Document events
  'document_uploaded': { icon: FileText, color: 'text-blue-600', bgColor: 'bg-blue-100 dark:bg-blue-900/30', label: 'Upload' },
  'document_deleted': { icon: Trash2, color: 'text-red-600', bgColor: 'bg-red-100 dark:bg-red-900/30', label: 'Deleted' },
  'document_downloaded': { icon: Download, color: 'text-green-600', bgColor: 'bg-green-100 dark:bg-green-900/30', label: 'Download' },
  'documents_batch_uploaded': { icon: FolderUp, color: 'text-blue-600', bgColor: 'bg-blue-100 dark:bg-blue-900/30', label: 'Batch Upload' },
  
  // Marketing events
  'graphic_created': { icon: Palette, color: 'text-pink-600', bgColor: 'bg-pink-100 dark:bg-pink-900/30', label: 'Graphic' },
  'flyer_created': { icon: Newspaper, color: 'text-orange-600', bgColor: 'bg-orange-100 dark:bg-orange-900/30', label: 'Flyer' },
  'quick_create_all': { icon: Sparkles, color: 'text-purple-600', bgColor: 'bg-purple-100 dark:bg-purple-900/30', label: 'Quick Create' },
  'asset_downloaded': { icon: Download, color: 'text-green-600', bgColor: 'bg-green-100 dark:bg-green-900/30', label: 'Download' },
  'asset_deleted': { icon: Trash2, color: 'text-red-600', bgColor: 'bg-red-100 dark:bg-red-900/30', label: 'Deleted' },
  'asset_created': { icon: Palette, color: 'text-pink-600', bgColor: 'bg-pink-100 dark:bg-pink-900/30', label: 'Asset' },
  
  // CMA events
  'cma_created': { icon: TrendingUp, color: 'text-green-600', bgColor: 'bg-green-100 dark:bg-green-900/30', label: 'CMA Created' },
  'cma_updated': { icon: Pencil, color: 'text-blue-600', bgColor: 'bg-blue-100 dark:bg-blue-900/30', label: 'CMA Updated' },
  'cma_shared': { icon: Link, color: 'text-purple-600', bgColor: 'bg-purple-100 dark:bg-purple-900/30', label: 'CMA Shared' },
  'cma_share_revoked': { icon: Ban, color: 'text-red-600', bgColor: 'bg-red-100 dark:bg-red-900/30', label: 'Share Revoked' },
  
  // Team events
  'coordinator_assigned': { icon: User, color: 'text-blue-600', bgColor: 'bg-blue-100 dark:bg-blue-900/30', label: 'Assigned' },
  'coordinator_removed': { icon: User, color: 'text-gray-600', bgColor: 'bg-gray-100 dark:bg-gray-800/50', label: 'Removed' },
  'coordinator_added': { icon: User, color: 'text-blue-600', bgColor: 'bg-blue-100 dark:bg-blue-900/30', label: 'Added' },
  'note_added': { icon: StickyNote, color: 'text-yellow-600', bgColor: 'bg-yellow-100 dark:bg-yellow-900/30', label: 'Note' },
  
  // Dates events
  'contract_date_set': { icon: Calendar, color: 'text-blue-600', bgColor: 'bg-blue-100 dark:bg-blue-900/30', label: 'Contract Date' },
  'closing_date_set': { icon: Target, color: 'text-green-600', bgColor: 'bg-green-100 dark:bg-green-900/30', label: 'Closing Date' },
  'date_updated': { icon: Pencil, color: 'text-orange-600', bgColor: 'bg-orange-100 dark:bg-orange-900/30', label: 'Date Updated' },
  'deadline_approaching': { icon: Clock, color: 'text-red-600', bgColor: 'bg-red-100 dark:bg-red-900/30', label: 'Deadline' },
  
  // Communication events
  'email_sent': { icon: Mail, color: 'text-blue-600', bgColor: 'bg-blue-100 dark:bg-blue-900/30', label: 'Email' },
  'slack_notification': { icon: MessageSquare, color: 'text-purple-600', bgColor: 'bg-purple-100 dark:bg-purple-900/30', label: 'Slack' },
  'channel_created': { icon: MessageSquare, color: 'text-purple-600', bgColor: 'bg-purple-100 dark:bg-purple-900/30', label: 'Channel' },
  'filter_created': { icon: FileCheck, color: 'text-blue-600', bgColor: 'bg-blue-100 dark:bg-blue-900/30', label: 'Filter' },
  
  // Default fallback
  'default': { icon: Pin, color: 'text-gray-600', bgColor: 'bg-gray-100 dark:bg-gray-800/50', label: 'Activity' },
};

export function getEventConfig(eventType: string): TimelineEventConfig {
  return TIMELINE_EVENT_CONFIG[eventType] || TIMELINE_EVENT_CONFIG['default'];
}

export function getCategoryFromType(eventType: string): string {
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

export const CATEGORY_FILTERS = [
  { value: 'all', label: 'All Activities' },
  { value: 'transaction', label: 'Transaction' },
  { value: 'mls', label: 'MLS Data' },
  { value: 'documents', label: 'Documents' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'cma', label: 'CMA' },
  { value: 'team', label: 'Team' },
  { value: 'dates', label: 'Dates' },
  { value: 'communication', label: 'Communication' },
];
