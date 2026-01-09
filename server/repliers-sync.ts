import { storage } from "./storage";
import { fetchMLSListing, fetchSimilarListings } from "./repliers";
import type { Transaction, InsertTransaction } from "@shared/schema";

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
  comparablesCount?: number;
  error?: string;
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

    const { mlsData, comparables } = mlsResult;
    
    let cmaData = comparables;
    if (!cmaData || cmaData.length === 0) {
      cmaData = await fetchSimilarListings(transaction.mlsNumber);
    }

    const updateData: Partial<InsertTransaction> & { mlsLastSyncedAt?: Date } = {
      mlsData: mlsData,
      propertyImages: mlsData.photos || mlsData.images || [],
      propertyDescription: mlsData.description || transaction.propertyDescription || undefined,
      mlsLastSyncedAt: new Date(),
    };

    if (mlsData.bedrooms) updateData.bedrooms = mlsData.bedrooms;
    if (mlsData.bathrooms) updateData.bathrooms = mlsData.bathrooms;
    if (mlsData.sqft) updateData.sqft = Number(mlsData.sqft) || undefined;
    if (mlsData.yearBuilt) updateData.yearBuilt = mlsData.yearBuilt;
    if (mlsData.propertyType) updateData.propertyType = mlsData.propertyType;
    if (mlsData.listPrice) updateData.listPrice = mlsData.listPrice;

    if (cmaData && cmaData.length > 0) {
      updateData.cmaData = cmaData;
    }

    await storage.updateTransaction(transaction.id, updateData as Partial<InsertTransaction>);

    await storage.createActivity({
      transactionId: transaction.id,
      type: "mls_auto_synced",
      description: `Auto-synced MLS data: ${mlsData.photos?.length || 0} photos, ${cmaData?.length || 0} comparables`,
    });

    result.success = true;
    result.photosCount = mlsData.photos?.length || 0;
    result.comparablesCount = cmaData?.length || 0;
    
    return result;
  } catch (error: any) {
    result.error = error.message || "Unknown error";
    console.error(`[ReplierSync] Error syncing transaction ${transaction.id}:`, error);
    return result;
  }
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runSync(): Promise<void> {
  if (isSyncing) {
    console.log("[ReplierSync] Sync already in progress, skipping...");
    return;
  }

  if (!process.env.REPLIERS_API_KEY) {
    console.log("[ReplierSync] REPLIERS_API_KEY not configured, skipping sync");
    return;
  }

  isSyncing = true;
  const startTime = Date.now();
  console.log("[ReplierSync] Starting automatic MLS data sync...");

  try {
    const transactions = await storage.getTransactions();
    
    const activeTransactions = transactions.filter(t => 
      t.mlsNumber && 
      t.status !== "closed" && 
      t.status !== "cancelled"
    );

    console.log(`[ReplierSync] Found ${activeTransactions.length} active transactions with MLS numbers`);

    const results: SyncResult[] = [];
    
    for (const transaction of activeTransactions) {
      console.log(`[ReplierSync] Syncing: ${transaction.propertyAddress} (MLS# ${transaction.mlsNumber})`);
      
      const result = await syncTransactionMLS(transaction);
      results.push(result);
      
      if (result.success) {
        console.log(`[ReplierSync] Success: ${result.address} - ${result.photosCount} photos, ${result.comparablesCount} comparables`);
      } else {
        console.log(`[ReplierSync] Failed: ${result.address} - ${result.error}`);
      }
      
      if (activeTransactions.indexOf(transaction) < activeTransactions.length - 1) {
        await delay(BATCH_DELAY_MS);
      }
    }

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    
    lastGlobalSyncAt = new Date();
    
    console.log(`[ReplierSync] Sync complete: ${successful} success, ${failed} failed, took ${duration}s`);
    
    await storage.upsertIntegrationSetting({
      integrationType: "repliers",
      isConnected: true,
      lastSyncAt: lastGlobalSyncAt,
      metadata: {
        lastSyncStats: {
          total: activeTransactions.length,
          successful,
          failed,
          durationSeconds: parseFloat(duration),
        },
      },
    });
    
  } catch (error) {
    console.error("[ReplierSync] Sync failed with error:", error);
  } finally {
    isSyncing = false;
  }
}

export function startRepliersSync(): void {
  if (syncIntervalId) {
    console.log("[ReplierSync] Sync already started");
    return;
  }

  console.log(`[ReplierSync] Starting automatic sync every ${SYNC_INTERVAL_MS / 60000} minutes`);
  
  setTimeout(() => {
    runSync();
  }, 5000);
  
  syncIntervalId = setInterval(() => {
    runSync();
  }, SYNC_INTERVAL_MS);
  
  console.log("[ReplierSync] Automatic sync scheduler initialized");
}

export function stopRepliersSync(): void {
  if (syncIntervalId) {
    clearInterval(syncIntervalId);
    syncIntervalId = null;
    console.log("[ReplierSync] Automatic sync stopped");
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
  console.log("[ReplierSync] Manual sync triggered");
  await runSync();
}
