import { storage } from "./storage";
import { fetchMLSListing } from "./repliers";
import { isRentalOrLease } from "../shared/lib/listings";
import type { Transaction, InsertTransaction } from "@shared/schema";
import { createModuleLogger } from './lib/logger';

const log = createModuleLogger('repliers-sync');

const SYNC_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes
const BATCH_DELAY_MS = 2000; // 2 seconds between API calls to respect rate limits

let syncIntervalId: NodeJS.Timeout | null = null;
let isSyncing = false;
let lastGlobalSyncAt: Date | null = null;

interface SyncResult {
  transactionId: string;
  address: string;
  success: boolean;
  photosCount?: number;
  error?: string;
  skippedAsRental?: boolean;
}

async function syncTransactionMLS(transaction: Transaction): Promise<SyncResult> {
  const result: SyncResult = {
    transactionId: transaction.id,
    address: transaction.propertyAddress,
    success: false,
  };

  if (!transaction.mlsNumber) {
    result.error = "No MLS number";
    return result;
  }

  try {
    const mlsResult = await fetchMLSListing(transaction.mlsNumber);
    
    if (!mlsResult) {
      result.error = "No data returned from Repliers API";
      return result;
    }

    const { mlsData } = mlsResult;
    
    // GLOBAL RENTAL EXCLUSION: Skip rental/lease listings during sync
    // Check both rawData and mlsData itself (rawData may be absent for cached/normalized records)
    if (isRentalOrLease(mlsData.rawData ?? mlsData)) {
      result.skippedAsRental = true;
      result.error = "Skipped: Rental/Lease listing";
      log.info({ mlsNumber: transaction.mlsNumber }, 'Skipping rental/lease listing');
      return result;
    }

    const updateData: Partial<InsertTransaction> & { mlsLastSyncedAt?: Date } = {
      mlsData: mlsData,
      // Note: propertyImages is for user uploads ONLY - MLS photos are accessed via mlsData.images
      propertyDescription: mlsData.description || transaction.propertyDescription || undefined,
      mlsLastSyncedAt: new Date(),
    };

    if (mlsData.bedrooms) updateData.bedrooms = mlsData.bedrooms;
    if (mlsData.bathrooms) updateData.bathrooms = mlsData.bathrooms;
    if (mlsData.sqft) updateData.sqft = Number(mlsData.sqft) || undefined;
    if (mlsData.yearBuilt) updateData.yearBuilt = mlsData.yearBuilt;
    if (mlsData.propertyType) updateData.propertyType = mlsData.propertyType;
    if (mlsData.listPrice) updateData.listPrice = mlsData.listPrice;

    await storage.updateTransaction(transaction.id, updateData as Partial<InsertTransaction>);

    result.success = true;
    result.photosCount = mlsData.photos?.length || 0;
    
    return result;
  } catch (error: any) {
    result.error = error.message || "Unknown error";
    log.error({ err: error, transactionId: transaction.id }, 'Error syncing transaction');
    return result;
  }
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runSync(): Promise<void> {
  if (isSyncing) {
    log.info('Sync already in progress, skipping');
    return;
  }

  if (!process.env.REPLIERS_API_KEY) {
    log.info('REPLIERS_API_KEY not configured, skipping sync');
    return;
  }

  isSyncing = true;
  const startTime = Date.now();
  log.info('Starting automatic MLS data sync');

  try {
    const transactions = await storage.getTransactions();
    
    const activeTransactions = transactions.filter(t => 
      t.mlsNumber && 
      (t.status === "active" || t.status === "in_contract")
    );

    log.info({ count: activeTransactions.length }, 'Found active transactions with MLS numbers');

    const results: SyncResult[] = [];
    
    for (const transaction of activeTransactions) {
      log.info({ address: transaction.propertyAddress, mlsNumber: transaction.mlsNumber }, 'Syncing transaction');
      
      const result = await syncTransactionMLS(transaction);
      results.push(result);
      
      if (result.success) {
        log.info({ address: result.address, photosCount: result.photosCount }, 'Sync success');
      } else {
        log.warn({ address: result.address, error: result.error }, 'Sync failed');
      }
      
      if (activeTransactions.indexOf(transaction) < activeTransactions.length - 1) {
        await delay(BATCH_DELAY_MS);
      }
    }

    const successful = results.filter(r => r.success).length;
    const skippedLeaseCount = results.filter(r => r.skippedAsRental).length;
    const failed = results.filter(r => !r.success && !r.skippedAsRental).length;
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    
    lastGlobalSyncAt = new Date();
    
    log.info({ successful, skippedLeaseCount, failed, durationSeconds: duration }, 'Sync complete');
    
    await storage.upsertIntegrationSetting({
      integrationType: "repliers",
      isConnected: true,
      lastSyncAt: lastGlobalSyncAt,
      metadata: {
        lastSyncStats: {
          total: activeTransactions.length,
          successful,
          skippedLeaseCount,
          failed,
          durationSeconds: parseFloat(duration),
        },
      },
    });
    
  } catch (error) {
    log.error({ err: error }, 'Sync failed with error');
  } finally {
    isSyncing = false;
  }
}

export function startRepliersSync(): void {
  if (syncIntervalId) {
    log.info('Sync already started');
    return;
  }

  log.info({ intervalMinutes: SYNC_INTERVAL_MS / 60000 }, 'Starting automatic sync');
  
  setTimeout(() => {
    runSync();
  }, 5000);
  
  syncIntervalId = setInterval(() => {
    runSync();
  }, SYNC_INTERVAL_MS);
  
  log.info('Automatic sync scheduler initialized');
}

export function stopRepliersSync(): void {
  if (syncIntervalId) {
    clearInterval(syncIntervalId);
    syncIntervalId = null;
    log.info('Automatic sync stopped');
  }
}

export function getSyncStatus(): {
  isRunning: boolean;
  isSyncing: boolean;
  lastSyncAt: Date | null;
  intervalMinutes: number;
} {
  return {
    isRunning: syncIntervalId !== null,
    isSyncing,
    lastSyncAt: lastGlobalSyncAt,
    intervalMinutes: SYNC_INTERVAL_MS / 60000,
  };
}

export async function triggerManualSync(): Promise<void> {
  log.info('Manual sync triggered');
  await runSync();
}
