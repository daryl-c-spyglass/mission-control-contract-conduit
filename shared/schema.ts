import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Transaction status enum
export const transactionStatuses = ["active", "in_contract", "pending_inspection", "clear_to_close", "closed", "cancelled"] as const;
export type TransactionStatus = typeof transactionStatuses[number];

// Transaction type enum (buy/sell)
export const transactionTypes = ["buy", "sell"] as const;
export type TransactionType = typeof transactionTypes[number];

// Transactions table
export const transactions = pgTable("transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id"), // The agent who created this transaction
  transactionType: text("transaction_type").notNull().default("buy"), // buy or sell
  propertyAddress: text("property_address").notNull(),
  mlsNumber: text("mls_number"),
  status: text("status").notNull().default("in_contract"),
  contractDate: text("contract_date"),
  closingDate: text("closing_date"),
  listPrice: integer("list_price"),
  salePrice: integer("sale_price"),
  bedrooms: integer("bedrooms"),
  bathrooms: integer("bathrooms"),
  sqft: integer("sqft"),
  yearBuilt: integer("year_built"),
  propertyType: text("property_type"),
  slackChannelId: text("slack_channel_id"),
  slackChannelName: text("slack_channel_name"),
  gmailFilterId: text("gmail_filter_id"),
  gmailLabelId: text("gmail_label_id"),
  gmailPendingForEmail: text("gmail_pending_for_email"), // Email of agent who needs to consent for filter creation
  fubClientId: text("fub_client_id"),
  fubClientName: text("fub_client_name"),
  fubClientEmail: text("fub_client_email"),
  fubClientPhone: text("fub_client_phone"),
  coordinatorIds: text("coordinator_ids").array(),
  mlsData: jsonb("mls_data"),
  cmaData: jsonb("cma_data"),
  propertyImages: text("property_images").array(),
  propertyDescription: text("property_description"), // For brochure/marketing materials
  notes: text("notes"),
  mlsLastSyncedAt: timestamp("mls_last_synced_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Transaction coordinators
export const coordinators = pgTable("coordinators", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  slackUserId: text("slack_user_id"),
  avatarUrl: text("avatar_url"),
  isActive: boolean("is_active").default(true),
});

// Integration settings
export const integrationSettings = pgTable("integration_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  integrationType: text("integration_type").notNull(), // slack, gmail, repliers, fub
  isConnected: boolean("is_connected").default(false),
  apiKey: text("api_key"),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  metadata: jsonb("metadata"),
  lastSyncAt: timestamp("last_sync_at"),
});

// Activity timeline for transactions
export const activities = pgTable("activities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  transactionId: varchar("transaction_id").notNull(),
  type: text("type").notNull(), // transaction_created, status_changed, mls_synced, price_changed, document_uploaded, graphic_created, flyer_created, cma_created, cma_shared, coordinator_assigned
  category: text("category"), // transaction, mls, documents, marketing, cma, team, dates, communication
  description: text("description").notNull(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Marketing assets for transactions
export const marketingAssets = pgTable("marketing_assets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  transactionId: varchar("transaction_id").notNull(),
  type: text("type").notNull(), // facebook, instagram, alt_style, flyer
  imageData: text("image_data").notNull(), // Base64 encoded image data
  fileName: text("file_name").notNull(),
  metadata: jsonb("metadata"), // Additional info like dimensions, status, etc.
  createdAt: timestamp("created_at").defaultNow(),
});

// CMA (Comparative Market Analysis) table
export const cmas = pgTable("cmas", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  transactionId: varchar("transaction_id"), // Link to transaction (varchar to match transactions.id)
  userId: varchar("user_id"),
  name: text("name").notNull(),
  subjectPropertyId: text("subject_property_id"), // MLS number of subject property
  comparablePropertyIds: jsonb("comparable_property_ids").$type<string[]>().notNull().default([]),
  propertiesData: jsonb("properties_data").$type<any[]>(),
  searchCriteria: jsonb("search_criteria"),
  notes: text("notes"),
  publicLink: text("public_link").unique(),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Contract documents for transactions
export const contractDocuments = pgTable("contract_documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  transactionId: varchar("transaction_id").notNull(),
  name: text("name").default('Untitled Document'), // User-defined document name
  documentType: text("document_type").default('other'), // contract, amendment, addendum, disclosure, inspection, appraisal, other
  fileName: text("file_name").notNull(),
  fileData: text("file_data").notNull(), // Base64 encoded file data
  fileType: text("file_type").notNull(), // MIME type (application/pdf, etc.)
  fileSize: integer("file_size").notNull(), // Size in bytes
  notes: text("notes"), // Optional notes about the document
  uploadedBy: text("uploaded_by"), // User who uploaded
  createdAt: timestamp("created_at").defaultNow(),
});

// Notification settings per user/transaction
export const notificationSettings = pgTable("notification_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  transactionId: varchar("transaction_id"), // null = global settings for user
  
  // Toggle each notification type
  documentUploads: boolean("document_uploads").default(true),
  closingReminders: boolean("closing_reminders").default(true),
  marketingAssets: boolean("marketing_assets").default(true),
  
  // Reminder intervals (which ones to receive)
  reminder30Days: boolean("reminder_30_days").default(true),
  reminder14Days: boolean("reminder_14_days").default(true),
  reminder7Days: boolean("reminder_7_days").default(true),
  reminder3Days: boolean("reminder_3_days").default(true),
  reminder1Day: boolean("reminder_1_day").default(true),
  reminderDayOf: boolean("reminder_day_of").default(true),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Insert schemas
export const insertTransactionSchema = createInsertSchema(transactions).omit({
  id: true,
  createdAt: true,
});

export const insertCoordinatorSchema = createInsertSchema(coordinators).omit({
  id: true,
});

export const insertIntegrationSettingsSchema = createInsertSchema(integrationSettings).omit({
  id: true,
});

export const insertActivitySchema = createInsertSchema(activities).omit({
  id: true,
  createdAt: true,
});

export const insertMarketingAssetSchema = createInsertSchema(marketingAssets).omit({
  id: true,
  createdAt: true,
});

export const insertContractDocumentSchema = createInsertSchema(contractDocuments).omit({
  id: true,
  createdAt: true,
});

export const insertCmaSchema = createInsertSchema(cmas).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertNotificationSettingsSchema = createInsertSchema(notificationSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Types
export type Transaction = typeof transactions.$inferSelect;
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;

export type Coordinator = typeof coordinators.$inferSelect;
export type InsertCoordinator = z.infer<typeof insertCoordinatorSchema>;

export type IntegrationSetting = typeof integrationSettings.$inferSelect;
export type InsertIntegrationSetting = z.infer<typeof insertIntegrationSettingsSchema>;

export type Activity = typeof activities.$inferSelect;
export type InsertActivity = z.infer<typeof insertActivitySchema>;

export type MarketingAsset = typeof marketingAssets.$inferSelect;
export type InsertMarketingAsset = z.infer<typeof insertMarketingAssetSchema>;

export type ContractDocument = typeof contractDocuments.$inferSelect;
export type InsertContractDocument = z.infer<typeof insertContractDocumentSchema>;

export type Cma = typeof cmas.$inferSelect;
export type InsertCma = z.infer<typeof insertCmaSchema>;

export type NotificationSetting = typeof notificationSettings.$inferSelect;
export type InsertNotificationSetting = z.infer<typeof insertNotificationSettingsSchema>;

// CMA Statistics Types
export interface CmaStatRange {
  min: number;
  max: number;
}

export interface CmaStatMetric {
  range: CmaStatRange;
  average: number;
  median: number;
}

export interface PropertyStatistics {
  price: CmaStatMetric;
  pricePerSqFt: CmaStatMetric;
  daysOnMarket: CmaStatMetric;
  livingArea: CmaStatMetric;
  lotSize: CmaStatMetric;
  acres: CmaStatMetric;
  bedrooms: CmaStatMetric;
  bathrooms: CmaStatMetric;
  yearBuilt: CmaStatMetric;
}

export interface TimelineDataPoint {
  date: string;
  price: number;
  status: string;
  propertyId: string;
  address: string;
  daysOnMarket: number | null;
  cumulativeDaysOnMarket: number | null;
}

// CMA Comparable type
export interface CMAComparable {
  address: string;
  price: number;
  bedrooms: number;
  bathrooms: number;
  sqft: number | string;
  daysOnMarket: number;
  distance: number;
  imageUrl?: string;
  photos?: string[];
  mlsNumber?: string;
  status?: string;
  listDate?: string;
  map?: {
    latitude: number;
    longitude: number;
  };
}

// MLS Data type - matches the Repliers API response structure
export interface MLSData {
  mlsNumber: string;
  listPrice: number;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  
  // Property basics
  bedrooms: number;
  bathrooms: number;
  halfBaths: number;
  sqft: number;
  lotSize: string;
  yearBuilt: number;
  propertyType: string;
  propertyStyle: string;
  stories: number;
  garage: string;
  
  // Status & dates
  status: string;
  lastStatus?: string;
  daysOnMarket: number;
  simpleDaysOnMarket?: number | null;
  listDate: string;
  
  // Price history & sale info (from Repliers)
  originalPrice?: number | null;
  soldPrice?: number | null;
  soldDate?: string | null;
  
  // External media links (internal use only - NOT for display per MLS/IDX/VOW compliance)
  virtualTourUrl?: string | null;
  hasExternalMediaLinks?: boolean; // Computed flag for internal debugging
  
  // Photo count
  photoCount?: number;
  
  // Permissions (for display control)
  permissions?: {
    displayAddressOnInternet: boolean;
    displayPublic: boolean;
    displayInternetEntireListing: boolean;
  };
  
  // Neighborhood info
  neighborhood?: string;
  
  // Description
  description: string;
  
  // Features arrays
  interiorFeatures: string[];
  exteriorFeatures: string[];
  appliances: string[];
  heatingCooling: string[];
  
  // Additional property features (from Repliers API)
  flooring?: string[];
  roofMaterial?: string;
  foundation?: string;
  pool?: string;
  parking?: string[];
  waterSource?: string;
  sewer?: string;
  utilities?: string[];
  constructionMaterials?: string[];
  
  // Detail fields from Repliers details object
  viewType?: string;
  patio?: string;
  extras?: string;
  subdivision?: string;
  
  // Financial
  hoaFee: number | null;
  hoaFrequency: string;
  taxAmount: number | null;
  taxYear: number | null;
  
  // Listing agent info
  listingAgent: string;
  listingOffice: string;
  listingAgentPhone: string;
  listingAgentEmail: string;
  
  // Photos
  photos: string[];
  
  // Coordinates for mapping
  coordinates?: {
    latitude: number;
    longitude: number;
  };
  
  // Legacy compatibility
  images: string[];
  agent?: {
    name: string;
    phone: string;
    email: string;
    brokerage: string;
  };
  
  // Legacy fields for backward compatibility
  listingId?: string;
  features?: string[];
  lotSizeNum?: number;
  
  // Raw API response for debugging (dev mode only)
  rawData?: any;
}

// Property interface for CMA and search results (from Repliers API)
export interface Property {
  id: string;
  mlsNumber?: string;
  unparsedAddress: string;
  streetNumber?: string;
  streetName?: string;
  streetSuffix?: string;
  city: string;
  state?: string;
  postalCode: string;
  county?: string;
  
  // Property characteristics
  bedrooms?: number;
  bathrooms?: number;
  bathroomsFull?: number;
  bathroomsHalf?: number;
  sqft?: number;
  livingArea?: number;
  lotSize?: number;
  lotSizeAcres?: number;
  yearBuilt?: number;
  propertyType?: string;
  propertySubType?: string;
  stories?: number;
  garage?: string;
  garageSpaces?: number;
  
  // Status and dates
  standardStatus?: string;
  status?: string;
  listDate?: string;
  listingContractDate?: string;
  soldDate?: string;
  closeDate?: string;
  daysOnMarket?: number;
  simpleDaysOnMarket?: number | null;
  cumulativeDaysOnMarket?: number | null;
  
  // Pricing
  listPrice?: number;
  originalListPrice?: number;
  soldPrice?: number;
  closePrice?: number;
  pricePerSqft?: number;
  
  // Location
  latitude?: number;
  longitude?: number;
  subdivision?: string;
  neighborhood?: string;
  
  // School information
  schoolDistrict?: string;
  elementarySchool?: string;
  middleSchool?: string;
  highSchool?: string;
  
  // Media
  photos?: string[];
  photoCount?: number;
  virtualTourUrl?: string;
  
  // Description
  description?: string;
  publicRemarks?: string;
  
  // Features
  interiorFeatures?: string[];
  exteriorFeatures?: string[];
  appliances?: string[];
  heatingCooling?: string[];
  flooring?: string[];
  pool?: string;
  
  // Listing agent info
  listingAgent?: string;
  listingAgentName?: string;
  listingAgentPhone?: string;
  listingAgentEmail?: string;
  listingOffice?: string;
  listingOfficeName?: string;
  
  // Financial
  hoaFee?: number;
  hoaFrequency?: string;
  taxAmount?: number;
  taxYear?: number;
  
  // Search API specific fields
  type?: string;
  class?: string;
  transactionType?: string;
  
  // Additional raw data
  details?: Record<string, any>;
  rawData?: Record<string, any>;
}

// Re-export auth models (users and sessions tables for Replit Auth)
export * from "./models/auth";

// Re-export chat models (conversations and messages for AI chat)
export * from "./models/chat";
