import {
  type User,
  type InsertUser,
  type Transaction,
  type InsertTransaction,
  type Coordinator,
  type InsertCoordinator,
  type IntegrationSetting,
  type InsertIntegrationSetting,
  type Activity,
  type InsertActivity,
} from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

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

  // Activities
  getActivitiesByTransaction(transactionId: string): Promise<Activity[]>;
  createActivity(activity: InsertActivity): Promise<Activity>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private transactions: Map<string, Transaction>;
  private coordinators: Map<string, Coordinator>;
  private integrationSettings: Map<string, IntegrationSetting>;
  private activities: Map<string, Activity>;

  constructor() {
    this.users = new Map();
    this.transactions = new Map();
    this.coordinators = new Map();
    this.integrationSettings = new Map();
    this.activities = new Map();

    // Add some sample coordinators
    this.seedData();
  }

  private seedData() {
    const sampleCoordinators: InsertCoordinator[] = [
      { name: "Sarah Johnson", email: "sarah@realty.com", phone: "(555) 123-4567", isActive: true },
      { name: "Mike Chen", email: "mike@realty.com", phone: "(555) 234-5678", isActive: true },
      { name: "Emily Davis", email: "emily@realty.com", phone: "(555) 345-6789", isActive: true },
    ];

    sampleCoordinators.forEach((coord) => {
      const id = randomUUID();
      this.coordinators.set(id, { ...coord, id, slackUserId: null, avatarUrl: null });
    });

    // Add sample transactions
    const coordIds = Array.from(this.coordinators.keys());
    const sampleTransactions: InsertTransaction[] = [
      {
        propertyAddress: "123 Oak Street, Austin, TX 78701",
        mlsNumber: "MLS123456",
        status: "in_contract",
        contractDate: "2024-12-15",
        closingDate: "2025-01-15",
        listPrice: 450000,
        salePrice: 445000,
        bedrooms: 3,
        bathrooms: 2,
        sqft: 1850,
        yearBuilt: 2018,
        propertyType: "Single Family",
        coordinatorIds: [coordIds[0], coordIds[1]],
        fubClientName: "John Smith",
        fubClientEmail: "john.smith@email.com",
        fubClientPhone: "(555) 987-6543",
      },
      {
        propertyAddress: "456 Maple Avenue, Austin, TX 78702",
        mlsNumber: "MLS789012",
        status: "pending_inspection",
        contractDate: "2024-12-10",
        closingDate: "2025-01-20",
        listPrice: 525000,
        salePrice: 520000,
        bedrooms: 4,
        bathrooms: 3,
        sqft: 2200,
        yearBuilt: 2020,
        propertyType: "Single Family",
        coordinatorIds: [coordIds[2]],
        fubClientName: "Mary Williams",
        fubClientEmail: "mary.w@email.com",
      },
      {
        propertyAddress: "789 Cedar Lane, Austin, TX 78703",
        mlsNumber: "MLS345678",
        status: "clear_to_close",
        contractDate: "2024-11-20",
        closingDate: "2024-12-28",
        listPrice: 380000,
        salePrice: 378000,
        bedrooms: 2,
        bathrooms: 2,
        sqft: 1400,
        yearBuilt: 2015,
        propertyType: "Condo",
        coordinatorIds: [coordIds[0]],
      },
    ];

    sampleTransactions.forEach((trans) => {
      const id = randomUUID();
      this.transactions.set(id, {
        ...trans,
        id,
        slackChannelId: null,
        slackChannelName: null,
        gmailFilterId: null,
        fubClientId: null,
        fubClientName: trans.fubClientName || null,
        fubClientEmail: trans.fubClientEmail || null,
        fubClientPhone: trans.fubClientPhone || null,
        mlsData: null,
        cmaData: null,
        propertyImages: null,
        notes: null,
        createdAt: new Date(),
      });
    });
  }

  // Users
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  // Transactions
  async getTransactions(): Promise<Transaction[]> {
    return Array.from(this.transactions.values()).sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateB - dateA;
    });
  }

  async getTransaction(id: string): Promise<Transaction | undefined> {
    return this.transactions.get(id);
  }

  async createTransaction(transaction: InsertTransaction): Promise<Transaction> {
    const id = randomUUID();
    const newTransaction: Transaction = {
      id,
      propertyAddress: transaction.propertyAddress,
      mlsNumber: transaction.mlsNumber || null,
      status: transaction.status || "in_contract",
      contractDate: transaction.contractDate || null,
      closingDate: transaction.closingDate || null,
      listPrice: transaction.listPrice || null,
      salePrice: transaction.salePrice || null,
      bedrooms: transaction.bedrooms || null,
      bathrooms: transaction.bathrooms || null,
      sqft: transaction.sqft || null,
      yearBuilt: transaction.yearBuilt || null,
      propertyType: transaction.propertyType || null,
      slackChannelId: transaction.slackChannelId || null,
      slackChannelName: transaction.slackChannelName || null,
      gmailFilterId: transaction.gmailFilterId || null,
      fubClientId: transaction.fubClientId || null,
      fubClientName: transaction.fubClientName || null,
      fubClientEmail: transaction.fubClientEmail || null,
      fubClientPhone: transaction.fubClientPhone || null,
      coordinatorIds: transaction.coordinatorIds || [],
      mlsData: transaction.mlsData || null,
      cmaData: transaction.cmaData || null,
      propertyImages: transaction.propertyImages || [],
      notes: transaction.notes || null,
      createdAt: new Date(),
    };
    this.transactions.set(id, newTransaction);
    return newTransaction;
  }

  async updateTransaction(id: string, update: Partial<InsertTransaction>): Promise<Transaction | undefined> {
    const existing = this.transactions.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...update };
    this.transactions.set(id, updated);
    return updated;
  }

  async deleteTransaction(id: string): Promise<boolean> {
    return this.transactions.delete(id);
  }

  // Coordinators
  async getCoordinators(): Promise<Coordinator[]> {
    return Array.from(this.coordinators.values());
  }

  async getCoordinator(id: string): Promise<Coordinator | undefined> {
    return this.coordinators.get(id);
  }

  async createCoordinator(coordinator: InsertCoordinator): Promise<Coordinator> {
    const id = randomUUID();
    const newCoordinator: Coordinator = {
      id,
      name: coordinator.name,
      email: coordinator.email,
      phone: coordinator.phone || null,
      slackUserId: coordinator.slackUserId || null,
      avatarUrl: coordinator.avatarUrl || null,
      isActive: coordinator.isActive ?? true,
    };
    this.coordinators.set(id, newCoordinator);
    return newCoordinator;
  }

  async updateCoordinator(id: string, update: Partial<InsertCoordinator>): Promise<Coordinator | undefined> {
    const existing = this.coordinators.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...update };
    this.coordinators.set(id, updated);
    return updated;
  }

  async deleteCoordinator(id: string): Promise<boolean> {
    return this.coordinators.delete(id);
  }

  // Integration Settings
  async getIntegrationSettings(): Promise<IntegrationSetting[]> {
    return Array.from(this.integrationSettings.values());
  }

  async getIntegrationSetting(type: string): Promise<IntegrationSetting | undefined> {
    return Array.from(this.integrationSettings.values()).find(
      (s) => s.integrationType === type
    );
  }

  async saveIntegrationSetting(setting: InsertIntegrationSetting): Promise<IntegrationSetting> {
    const existing = await this.getIntegrationSetting(setting.integrationType);
    if (existing) {
      const updated = { ...existing, ...setting };
      this.integrationSettings.set(existing.id, updated);
      return updated;
    }
    const id = randomUUID();
    const newSetting: IntegrationSetting = {
      id,
      integrationType: setting.integrationType,
      isConnected: setting.isConnected ?? false,
      apiKey: setting.apiKey || null,
      accessToken: setting.accessToken || null,
      refreshToken: setting.refreshToken || null,
      metadata: setting.metadata || null,
      lastSyncAt: null,
    };
    this.integrationSettings.set(id, newSetting);
    return newSetting;
  }

  async updateIntegrationSetting(type: string, update: Partial<InsertIntegrationSetting>): Promise<IntegrationSetting | undefined> {
    const existing = await this.getIntegrationSetting(type);
    if (!existing) return undefined;
    const updated = { ...existing, ...update };
    this.integrationSettings.set(existing.id, updated);
    return updated;
  }

  // Activities
  async getActivitiesByTransaction(transactionId: string): Promise<Activity[]> {
    return Array.from(this.activities.values())
      .filter((a) => a.transactionId === transactionId)
      .sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      });
  }

  async createActivity(activity: InsertActivity): Promise<Activity> {
    const id = randomUUID();
    const newActivity: Activity = {
      id,
      transactionId: activity.transactionId,
      type: activity.type,
      description: activity.description,
      metadata: activity.metadata || null,
      createdAt: new Date(),
    };
    this.activities.set(id, newActivity);
    return newActivity;
  }
}

export const storage = new MemStorage();
