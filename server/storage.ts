import {
  type Transaction,
  type InsertTransaction,
  type Coordinator,
  type InsertCoordinator,
  type IntegrationSetting,
  type InsertIntegrationSetting,
  type Activity,
  type InsertActivity,
  type MarketingAsset,
  type InsertMarketingAsset,
  type ContractDocument,
  type InsertContractDocument,
  type Cma,
  type InsertCma,
  type CmaReportConfig,
  type InsertCmaReportConfig,
  type CmaReportTemplate,
  type InsertCmaReportTemplate,
  type NotificationSetting,
  type InsertNotificationSetting,
  type AgentProfile,
  type UpdateAgentProfile,
  type AgentResource,
  type InsertAgentResource,
  type UserNotificationPreferences,
  type AgentMarketingProfile,
  type InsertAgentMarketingProfile,
  transactions,
  coordinators,
  integrationSettings,
  activities,
  marketingAssets,
  contractDocuments,
  cmas,
  cmaReportConfigs,
  cmaReportTemplates,
  notificationSettings,
  agentProfiles,
  agentResources,
  userNotificationPreferences,
  agentMarketingProfiles,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, isNull, and } from "drizzle-orm";

export interface IStorage {
  // Transactions
  getTransactions(): Promise<Transaction[]>;
  getTransaction(id: string): Promise<Transaction | undefined>;
  createTransaction(transaction: InsertTransaction): Promise<Transaction>;
  updateTransaction(id: string, transaction: Partial<InsertTransaction>): Promise<Transaction | undefined>;
  deleteTransaction(id: string): Promise<boolean>;

  // Coordinators
  getCoordinators(): Promise<Coordinator[]>;
  getCoordinator(id: string): Promise<Coordinator | undefined>;
  createCoordinator(coordinator: InsertCoordinator): Promise<Coordinator>;
  updateCoordinator(id: string, coordinator: Partial<InsertCoordinator>): Promise<Coordinator | undefined>;
  deleteCoordinator(id: string): Promise<boolean>;

  // Integration Settings
  getIntegrationSettings(): Promise<IntegrationSetting[]>;
  getIntegrationSetting(type: string): Promise<IntegrationSetting | undefined>;
  saveIntegrationSetting(setting: InsertIntegrationSetting): Promise<IntegrationSetting>;
  updateIntegrationSetting(type: string, setting: Partial<InsertIntegrationSetting>): Promise<IntegrationSetting | undefined>;
  upsertIntegrationSetting(setting: InsertIntegrationSetting): Promise<IntegrationSetting>;

  // Activities
  getActivitiesByTransaction(transactionId: string): Promise<Activity[]>;
  createActivity(activity: InsertActivity): Promise<Activity>;

  // Marketing Assets
  getMarketingAssetsByTransaction(transactionId: string): Promise<MarketingAsset[]>;
  getMarketingAsset(id: string): Promise<MarketingAsset | undefined>;
  createMarketingAsset(asset: InsertMarketingAsset): Promise<MarketingAsset>;
  updateMarketingAsset(id: string, asset: Partial<InsertMarketingAsset>): Promise<MarketingAsset | undefined>;
  deleteMarketingAsset(id: string): Promise<boolean>;

  // Contract Documents
  getContractDocumentsByTransaction(transactionId: string): Promise<ContractDocument[]>;
  getContractDocument(id: string): Promise<ContractDocument | undefined>;
  createContractDocument(doc: InsertContractDocument): Promise<ContractDocument>;
  deleteContractDocument(id: string): Promise<boolean>;

  // CMAs
  getCma(id: string): Promise<Cma | undefined>;
  getCmaByTransaction(transactionId: string): Promise<Cma | undefined>;
  getCmaByShareToken(token: string): Promise<Cma | undefined>;
  getCmasByUser(userId: string): Promise<Cma[]>;
  getAllCmas(): Promise<Cma[]>;
  createCma(cma: InsertCma): Promise<Cma>;
  updateCma(id: string, cma: Partial<Cma>): Promise<Cma | undefined>;
  deleteCma(id: string): Promise<boolean>;

  // CMA Report Configs
  getCmaReportConfig(cmaId: string): Promise<CmaReportConfig | undefined>;
  upsertCmaReportConfig(config: InsertCmaReportConfig): Promise<CmaReportConfig>;
  deleteCmaReportConfig(cmaId: string): Promise<boolean>;

  // CMA Report Templates
  getCmaReportTemplates(userId: string): Promise<CmaReportTemplate[]>;
  getCmaReportTemplate(id: string): Promise<CmaReportTemplate | undefined>;
  createCmaReportTemplate(template: InsertCmaReportTemplate): Promise<CmaReportTemplate>;
  updateCmaReportTemplate(id: string, template: Partial<InsertCmaReportTemplate>): Promise<CmaReportTemplate | undefined>;
  deleteCmaReportTemplate(id: string): Promise<boolean>;

  // Notification Settings
  getNotificationSettings(userId: string, transactionId?: string | null): Promise<NotificationSetting | undefined>;
  getGlobalNotificationSettings(userId: string): Promise<NotificationSetting | undefined>;
  upsertNotificationSettings(settings: InsertNotificationSetting): Promise<NotificationSetting>;
  getTransactionsWithClosingReminders(): Promise<Transaction[]>;

  // Agent Profiles
  getAgentProfile(userId: string): Promise<AgentProfile | undefined>;
  updateAgentProfile(userId: string, profile: UpdateAgentProfile): Promise<AgentProfile | undefined>;

  // Agent Resources
  getAgentResources(userId: string): Promise<AgentResource[]>;
  getAgentResource(id: string): Promise<AgentResource | undefined>;
  createAgentResource(resource: InsertAgentResource): Promise<AgentResource>;
  updateAgentResource(id: string, resource: Partial<InsertAgentResource>): Promise<AgentResource | undefined>;
  deleteAgentResource(id: string): Promise<boolean>;
  reorderAgentResources(userId: string, orderedIds: string[]): Promise<boolean>;

  // User Notification Preferences
  getUserNotificationPreferences(userId: string): Promise<UserNotificationPreferences | null>;
  upsertUserNotificationPreferences(
    userId: string, 
    data: Partial<Omit<UserNotificationPreferences, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>
  ): Promise<UserNotificationPreferences>;

  // Agent Marketing Profiles
  getAgentMarketingProfile(userId: string): Promise<AgentMarketingProfile | undefined>;
  upsertAgentMarketingProfile(userId: string, profile: Partial<InsertAgentMarketingProfile>): Promise<AgentMarketingProfile>;
}

export class DatabaseStorage implements IStorage {
  // Transactions
  async getTransactions(): Promise<Transaction[]> {
    return await db.select().from(transactions).orderBy(desc(transactions.createdAt));
  }

  async getTransaction(id: string): Promise<Transaction | undefined> {
    const [transaction] = await db.select().from(transactions).where(eq(transactions.id, id));
    return transaction;
  }

  async createTransaction(transaction: InsertTransaction): Promise<Transaction> {
    const [newTransaction] = await db
      .insert(transactions)
      .values({
        ...transaction,
        coordinatorIds: transaction.coordinatorIds || [],
        propertyImages: transaction.propertyImages || [],
      })
      .returning();
    return newTransaction;
  }

  async updateTransaction(id: string, update: Partial<InsertTransaction>): Promise<Transaction | undefined> {
    const [updated] = await db
      .update(transactions)
      .set(update)
      .where(eq(transactions.id, id))
      .returning();
    return updated;
  }

  async deleteTransaction(id: string): Promise<boolean> {
    const result = await db.delete(transactions).where(eq(transactions.id, id));
    return true;
  }

  // Coordinators
  async getCoordinators(): Promise<Coordinator[]> {
    return await db.select().from(coordinators);
  }

  async getCoordinator(id: string): Promise<Coordinator | undefined> {
    const [coordinator] = await db.select().from(coordinators).where(eq(coordinators.id, id));
    return coordinator;
  }

  async createCoordinator(coordinator: InsertCoordinator): Promise<Coordinator> {
    const [newCoordinator] = await db
      .insert(coordinators)
      .values(coordinator)
      .returning();
    return newCoordinator;
  }

  async updateCoordinator(id: string, update: Partial<InsertCoordinator>): Promise<Coordinator | undefined> {
    const [updated] = await db
      .update(coordinators)
      .set(update)
      .where(eq(coordinators.id, id))
      .returning();
    return updated;
  }

  async deleteCoordinator(id: string): Promise<boolean> {
    await db.delete(coordinators).where(eq(coordinators.id, id));
    return true;
  }

  // Integration Settings
  async getIntegrationSettings(): Promise<IntegrationSetting[]> {
    return await db.select().from(integrationSettings);
  }

  async getIntegrationSetting(type: string): Promise<IntegrationSetting | undefined> {
    const [setting] = await db
      .select()
      .from(integrationSettings)
      .where(eq(integrationSettings.integrationType, type));
    return setting;
  }

  async saveIntegrationSetting(setting: InsertIntegrationSetting): Promise<IntegrationSetting> {
    const existing = await this.getIntegrationSetting(setting.integrationType);
    if (existing) {
      const [updated] = await db
        .update(integrationSettings)
        .set(setting)
        .where(eq(integrationSettings.integrationType, setting.integrationType))
        .returning();
      return updated;
    }
    const [newSetting] = await db
      .insert(integrationSettings)
      .values(setting)
      .returning();
    return newSetting;
  }

  async updateIntegrationSetting(type: string, update: Partial<InsertIntegrationSetting>): Promise<IntegrationSetting | undefined> {
    const [updated] = await db
      .update(integrationSettings)
      .set(update)
      .where(eq(integrationSettings.integrationType, type))
      .returning();
    return updated;
  }

  async upsertIntegrationSetting(setting: InsertIntegrationSetting): Promise<IntegrationSetting> {
    const existing = await this.getIntegrationSetting(setting.integrationType);
    if (existing) {
      const [updated] = await db
        .update(integrationSettings)
        .set(setting)
        .where(eq(integrationSettings.integrationType, setting.integrationType))
        .returning();
      return updated;
    }
    const [newSetting] = await db
      .insert(integrationSettings)
      .values(setting)
      .returning();
    return newSetting;
  }

  // Activities
  async getActivitiesByTransaction(transactionId: string): Promise<Activity[]> {
    return await db
      .select()
      .from(activities)
      .where(eq(activities.transactionId, transactionId))
      .orderBy(desc(activities.createdAt));
  }

  async createActivity(activity: InsertActivity): Promise<Activity> {
    const [newActivity] = await db
      .insert(activities)
      .values(activity)
      .returning();
    return newActivity;
  }

  // Marketing Assets
  async getMarketingAssetsByTransaction(transactionId: string): Promise<MarketingAsset[]> {
    return await db
      .select()
      .from(marketingAssets)
      .where(eq(marketingAssets.transactionId, transactionId))
      .orderBy(desc(marketingAssets.createdAt));
  }

  async getMarketingAsset(id: string): Promise<MarketingAsset | undefined> {
    const [asset] = await db.select().from(marketingAssets).where(eq(marketingAssets.id, id));
    return asset;
  }

  async createMarketingAsset(asset: InsertMarketingAsset): Promise<MarketingAsset> {
    const [newAsset] = await db
      .insert(marketingAssets)
      .values(asset)
      .returning();
    return newAsset;
  }

  async updateMarketingAsset(id: string, update: Partial<InsertMarketingAsset>): Promise<MarketingAsset | undefined> {
    const [updated] = await db
      .update(marketingAssets)
      .set(update)
      .where(eq(marketingAssets.id, id))
      .returning();
    return updated;
  }

  async deleteMarketingAsset(id: string): Promise<boolean> {
    await db.delete(marketingAssets).where(eq(marketingAssets.id, id));
    return true;
  }

  // Contract Documents
  async getContractDocumentsByTransaction(transactionId: string): Promise<ContractDocument[]> {
    return await db
      .select()
      .from(contractDocuments)
      .where(eq(contractDocuments.transactionId, transactionId))
      .orderBy(desc(contractDocuments.createdAt));
  }

  async getContractDocument(id: string): Promise<ContractDocument | undefined> {
    const [doc] = await db.select().from(contractDocuments).where(eq(contractDocuments.id, id));
    return doc;
  }

  async createContractDocument(doc: InsertContractDocument): Promise<ContractDocument> {
    const [newDoc] = await db
      .insert(contractDocuments)
      .values(doc)
      .returning();
    return newDoc;
  }

  async deleteContractDocument(id: string): Promise<boolean> {
    await db.delete(contractDocuments).where(eq(contractDocuments.id, id));
    return true;
  }

  // CMAs
  async getCma(id: string): Promise<Cma | undefined> {
    const [cma] = await db.select().from(cmas).where(eq(cmas.id, id));
    return cma;
  }

  async getCmaByTransaction(transactionId: string): Promise<Cma | undefined> {
    const [cma] = await db
      .select()
      .from(cmas)
      .where(eq(cmas.transactionId, transactionId))
      .orderBy(desc(cmas.updatedAt))
      .limit(1);
    return cma;
  }

  async getCmaByShareToken(token: string): Promise<Cma | undefined> {
    const [cma] = await db.select().from(cmas).where(eq(cmas.publicLink, token));
    return cma;
  }

  async getCmasByUser(userId: string): Promise<Cma[]> {
    return await db.select().from(cmas).where(eq(cmas.userId, userId));
  }

  async getAllCmas(): Promise<Cma[]> {
    return await db.select().from(cmas).orderBy(desc(cmas.updatedAt));
  }

  async createCma(cma: InsertCma): Promise<Cma> {
    const [newCma] = await db.insert(cmas).values(cma).returning();
    return newCma;
  }

  async updateCma(id: string, updates: Partial<Cma>): Promise<Cma | undefined> {
    const [updated] = await db
      .update(cmas)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(cmas.id, id))
      .returning();
    return updated;
  }

  async deleteCma(id: string): Promise<boolean> {
    // Also delete related report config
    await db.delete(cmaReportConfigs).where(eq(cmaReportConfigs.cmaId, id));
    await db.delete(cmas).where(eq(cmas.id, id));
    return true;
  }

  // CMA Report Configs
  async getCmaReportConfig(cmaId: string): Promise<CmaReportConfig | undefined> {
    const [config] = await db.select().from(cmaReportConfigs).where(eq(cmaReportConfigs.cmaId, cmaId));
    return config;
  }

  async upsertCmaReportConfig(config: InsertCmaReportConfig): Promise<CmaReportConfig> {
    const existing = await this.getCmaReportConfig(config.cmaId);
    
    if (existing) {
      const [updated] = await db
        .update(cmaReportConfigs)
        .set({ ...config, updatedAt: new Date() })
        .where(eq(cmaReportConfigs.cmaId, config.cmaId))
        .returning();
      return updated;
    }
    
    const [created] = await db.insert(cmaReportConfigs).values(config).returning();
    return created;
  }

  async deleteCmaReportConfig(cmaId: string): Promise<boolean> {
    await db.delete(cmaReportConfigs).where(eq(cmaReportConfigs.cmaId, cmaId));
    return true;
  }

  // CMA Report Templates
  async getCmaReportTemplates(userId: string): Promise<CmaReportTemplate[]> {
    return await db.select().from(cmaReportTemplates).where(eq(cmaReportTemplates.userId, userId));
  }

  async getCmaReportTemplate(id: string): Promise<CmaReportTemplate | undefined> {
    const [template] = await db.select().from(cmaReportTemplates).where(eq(cmaReportTemplates.id, id));
    return template;
  }

  async createCmaReportTemplate(template: InsertCmaReportTemplate): Promise<CmaReportTemplate> {
    const [created] = await db.insert(cmaReportTemplates).values(template).returning();
    return created;
  }

  async updateCmaReportTemplate(id: string, template: Partial<InsertCmaReportTemplate>): Promise<CmaReportTemplate | undefined> {
    const [updated] = await db
      .update(cmaReportTemplates)
      .set({ ...template, updatedAt: new Date() })
      .where(eq(cmaReportTemplates.id, id))
      .returning();
    return updated;
  }

  async deleteCmaReportTemplate(id: string): Promise<boolean> {
    await db.delete(cmaReportTemplates).where(eq(cmaReportTemplates.id, id));
    return true;
  }

  // Notification Settings
  async getNotificationSettings(userId: string, transactionId?: string | null): Promise<NotificationSetting | undefined> {
    // First try to get transaction-specific settings if transactionId is provided
    if (transactionId) {
      const [setting] = await db
        .select()
        .from(notificationSettings)
        .where(
          and(
            eq(notificationSettings.userId, userId),
            eq(notificationSettings.transactionId, transactionId)
          )
        );
      if (setting) return setting;
    }
    // Fall back to global settings
    return this.getGlobalNotificationSettings(userId);
  }

  async getGlobalNotificationSettings(userId: string): Promise<NotificationSetting | undefined> {
    const [setting] = await db
      .select()
      .from(notificationSettings)
      .where(
        and(
          eq(notificationSettings.userId, userId),
          isNull(notificationSettings.transactionId)
        )
      );
    return setting;
  }

  async upsertNotificationSettings(settings: InsertNotificationSetting): Promise<NotificationSetting> {
    // Check if settings exist for this user/transaction combo
    const existing = settings.transactionId 
      ? await db.select().from(notificationSettings).where(
          and(
            eq(notificationSettings.userId, settings.userId),
            eq(notificationSettings.transactionId, settings.transactionId)
          )
        )
      : await db.select().from(notificationSettings).where(
          and(
            eq(notificationSettings.userId, settings.userId),
            isNull(notificationSettings.transactionId)
          )
        );

    if (existing.length > 0) {
      const [updated] = await db
        .update(notificationSettings)
        .set({ ...settings, updatedAt: new Date() })
        .where(eq(notificationSettings.id, existing[0].id))
        .returning();
      return updated;
    }

    const [created] = await db
      .insert(notificationSettings)
      .values(settings)
      .returning();
    return created;
  }

  async getTransactionsWithClosingReminders(): Promise<Transaction[]> {
    // Get all transactions that have a closing date and a Slack channel
    const results = await db.select().from(transactions);
    return results.filter(t => 
      t.closingDate && 
      t.slackChannelId && 
      t.status !== 'closed' && 
      t.status !== 'cancelled'
    );
  }

  // Agent Profiles
  async getAgentProfile(userId: string): Promise<AgentProfile | undefined> {
    const [profile] = await db
      .select()
      .from(agentProfiles)
      .where(eq(agentProfiles.userId, userId))
      .limit(1);
    return profile;
  }

  async updateAgentProfile(userId: string, profile: UpdateAgentProfile): Promise<AgentProfile | undefined> {
    const existing = await this.getAgentProfile(userId);
    
    if (!existing) {
      // Create new profile if doesn't exist (upsert)
      const [created] = await db
        .insert(agentProfiles)
        .values({ userId, ...profile })
        .returning();
      return created;
    }
    
    const [updated] = await db
      .update(agentProfiles)
      .set({ ...profile, updatedAt: new Date() })
      .where(eq(agentProfiles.userId, userId))
      .returning();
    return updated;
  }

  // Agent Resources
  async getAgentResources(userId: string): Promise<AgentResource[]> {
    return await db
      .select()
      .from(agentResources)
      .where(eq(agentResources.userId, userId))
      .orderBy(agentResources.displayOrder);
  }

  async getAgentResource(id: string): Promise<AgentResource | undefined> {
    const [resource] = await db
      .select()
      .from(agentResources)
      .where(eq(agentResources.id, id))
      .limit(1);
    return resource;
  }

  async createAgentResource(resource: InsertAgentResource): Promise<AgentResource> {
    // Get the next display order
    const existing = await this.getAgentResources(resource.userId);
    const maxOrder = existing.length > 0 
      ? Math.max(...existing.map(r => r.displayOrder ?? 0)) + 1 
      : 0;
    
    const [created] = await db
      .insert(agentResources)
      .values({ ...resource, displayOrder: maxOrder })
      .returning();
    return created;
  }

  async updateAgentResource(id: string, resource: Partial<InsertAgentResource>): Promise<AgentResource | undefined> {
    const [updated] = await db
      .update(agentResources)
      .set({ ...resource, updatedAt: new Date() })
      .where(eq(agentResources.id, id))
      .returning();
    return updated;
  }

  async deleteAgentResource(id: string): Promise<boolean> {
    const result = await db
      .delete(agentResources)
      .where(eq(agentResources.id, id));
    return true;
  }

  async reorderAgentResources(userId: string, orderedIds: string[]): Promise<boolean> {
    for (let i = 0; i < orderedIds.length; i++) {
      await db
        .update(agentResources)
        .set({ displayOrder: i, updatedAt: new Date() })
        .where(and(
          eq(agentResources.id, orderedIds[i]),
          eq(agentResources.userId, userId)
        ));
    }
    return true;
  }

  // User Notification Preferences
  async getUserNotificationPreferences(userId: string): Promise<UserNotificationPreferences | null> {
    const [prefs] = await db
      .select()
      .from(userNotificationPreferences)
      .where(eq(userNotificationPreferences.userId, userId))
      .limit(1);
    return prefs || null;
  }

  async upsertUserNotificationPreferences(
    userId: string, 
    data: Partial<Omit<UserNotificationPreferences, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>
  ): Promise<UserNotificationPreferences> {
    const existing = await this.getUserNotificationPreferences(userId);
    
    if (existing) {
      const [updated] = await db
        .update(userNotificationPreferences)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(userNotificationPreferences.userId, userId))
        .returning();
      return updated;
    } else {
      const [created] = await db
        .insert(userNotificationPreferences)
        .values({ userId, ...data })
        .returning();
      return created;
    }
  }

  // Agent Marketing Profiles
  async getAgentMarketingProfile(userId: string): Promise<AgentMarketingProfile | undefined> {
    const [profile] = await db
      .select()
      .from(agentMarketingProfiles)
      .where(eq(agentMarketingProfiles.userId, userId))
      .limit(1);
    return profile;
  }

  async upsertAgentMarketingProfile(
    userId: string,
    profile: Partial<InsertAgentMarketingProfile>
  ): Promise<AgentMarketingProfile> {
    const existing = await this.getAgentMarketingProfile(userId);

    if (existing) {
      const [updated] = await db
        .update(agentMarketingProfiles)
        .set({ ...profile, updatedAt: new Date() })
        .where(eq(agentMarketingProfiles.userId, userId))
        .returning();
      return updated;
    } else {
      const [created] = await db
        .insert(agentMarketingProfiles)
        .values({ userId, ...profile })
        .returning();
      return created;
    }
  }
}

export const storage = new DatabaseStorage();
