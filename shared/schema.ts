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
  halfBaths: integer("half_baths"),
  sqft: integer("sqft"),
  lotSizeAcres: text("lot_size_acres"),
  yearBuilt: integer("year_built"),
  propertyType: text("property_type"),
  isCompanyLead: boolean("is_company_lead").default(false),
  isOffMarket: boolean("is_off_market").default(false),
  isComingSoon: boolean("is_coming_soon").default(false), // Post to #coming-soon-listings Slack channel
  offMarketListingDate: timestamp("off_market_listing_date"),
  goLiveDate: text("go_live_date"), // When off-market listing will go live on MLS
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
  cmaSource: varchar("cma_source", { length: 50 }),
  cmaGeneratedAt: timestamp("cma_generated_at"),
  propertyImages: text("property_images").array(),
  primaryPhotoIndex: integer("primary_photo_index").default(0), // Index of primary photo for marketing materials
  propertyDescription: text("property_description"), // For brochure/marketing materials
  notes: text("notes"),
  mlsLastSyncedAt: timestamp("mls_last_synced_at"),
  isArchived: boolean("is_archived").default(false),
  archivedAt: timestamp("archived_at"),
  previousReminderSettings: jsonb("previous_reminder_settings"), // Store notification settings before archive for potential restoration
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

// Transaction photos table - for Off Market, Coming Soon, and User uploaded photos
export const transactionPhotos = pgTable("transaction_photos", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  transactionId: varchar("transaction_id").notNull(),
  url: text("url").notNull(),
  filename: text("filename"),
  source: text("source").notNull(), // 'mls' | 'off_market' | 'coming_soon' | 'uploaded'
  label: text("label"),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertTransactionPhotoSchema = createInsertSchema(transactionPhotos);
export type TransactionPhoto = typeof transactionPhotos.$inferSelect;
export type InsertTransactionPhoto = z.infer<typeof insertTransactionPhotoSchema>;

// Flyers table - shareable property flyers with QR codes
export const flyers = pgTable("flyers", {
  id: varchar("id", { length: 12 }).primaryKey(), // Short unique ID for URL (e.g., "abc123xyz")
  transactionId: varchar("transaction_id"),
  userId: varchar("user_id").notNull(),
  
  // Property Data (snapshot at time of creation)
  propertyAddress: text("property_address").notNull(),
  propertyCity: text("property_city"),
  propertyState: text("property_state"),
  propertyZip: text("property_zip"),
  listPrice: text("list_price"),
  bedrooms: integer("bedrooms"),
  bathrooms: text("bathrooms"),
  squareFeet: integer("square_feet"),
  headline: text("headline"),
  description: text("description"),
  
  // Images
  mainPhoto: text("main_photo"),
  kitchenPhoto: text("kitchen_photo"),
  roomPhoto: text("room_photo"),
  additionalPhotos: jsonb("additional_photos").$type<string[]>().default([]),
  
  // Agent Data (from Settings at time of creation)
  agentName: text("agent_name"),
  agentTitle: text("agent_title"),
  agentPhone: text("agent_phone"),
  agentEmail: text("agent_email"),
  agentPhoto: text("agent_photo"),
  
  // Branding
  companyLogo: text("company_logo"),
  secondaryLogo: text("secondary_logo"),
  logoScales: jsonb("logo_scales").$type<{ primary: number; secondary: number }>().default({ primary: 1, secondary: 1 }),
  dividerPosition: integer("divider_position").default(148),
  secondaryLogoOffsetY: integer("secondary_logo_offset_y").default(0),
  
  // Metadata
  status: text("status").default("active"),
  viewCount: integer("view_count").default(0),
  mlsNumber: text("mls_number"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// CMA Brochure type
export interface CmaBrochure {
  type: "pdf" | "image";
  url: string;
  thumbnail?: string;
  filename: string;
  generated: boolean;
  uploadedAt: string;
}

// CMA Adjustment Rates
export interface CmaAdjustmentRates {
  sqftPerUnit: number;
  bedroomValue: number;
  bathroomValue: number;
  poolValue: number;
  garagePerSpace: number;
  yearBuiltPerYear: number;
  lotSizePerSqft: number;
}

// CMA Comparable Adjustment Overrides
export interface CmaCompAdjustmentOverrides {
  sqft: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  pool: number | null;
  garage: number | null;
  yearBuilt: number | null;
  lotSize: number | null;
  custom: { name: string; value: number }[];
}

// CMA Adjustments Data
export interface CmaAdjustmentsData {
  rates: CmaAdjustmentRates;
  compAdjustments: Record<string, CmaCompAdjustmentOverrides>;
  enabled: boolean;
}

// Cover Page Config
export interface CoverPageConfig {
  title: string;
  subtitle: string;
  showDate: boolean;
  showAgentPhoto: boolean;
  background: "none" | "gradient" | "property";
}

// Default adjustment rates
export const DEFAULT_ADJUSTMENT_RATES: CmaAdjustmentRates = {
  sqftPerUnit: 50,
  bedroomValue: 10000,
  bathroomValue: 7500,
  poolValue: 25000,
  garagePerSpace: 5000,
  yearBuiltPerYear: 1000,
  lotSizePerSqft: 2,
};

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
  brochure: jsonb("brochure").$type<CmaBrochure>(), // Listing brochure
  adjustments: jsonb("adjustments").$type<CmaAdjustmentsData>(), // Property value adjustments
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// CMA Report Configs table - 1:1 with cmas for presentation settings
export const cmaReportConfigs = pgTable("cma_report_configs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  cmaId: varchar("cma_id").notNull().unique(), // References cmas.id
  includedSections: jsonb("included_sections").$type<string[]>(),
  sectionOrder: jsonb("section_order").$type<string[]>(),
  coverLetterOverride: text("cover_letter_override"),
  layout: text("layout").default("two_photos"), // two_photos, single_photo, no_photos
  template: text("template").default("default"),
  theme: text("theme").default("spyglass"),
  photoLayout: text("photo_layout").default("first_dozen"), // first_dozen, all, ai_suggested, custom
  mapStyle: text("map_style").default("streets"), // streets, satellite, dark
  showMapPolygon: boolean("show_map_polygon").default(true),
  includeAgentFooter: boolean("include_agent_footer").default(true),
  coverPageConfig: jsonb("cover_page_config").$type<CoverPageConfig>(),
  customPhotoSelections: jsonb("custom_photo_selections").$type<Record<string, string[]>>(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// CMA Report Templates - user-owned reusable templates
export const cmaReportTemplates = pgTable("cma_report_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  name: text("name").notNull(),
  isDefault: boolean("is_default").default(false),
  includedSections: jsonb("included_sections").$type<string[]>(),
  sectionOrder: jsonb("section_order").$type<string[]>(),
  coverLetterOverride: text("cover_letter_override"),
  layout: text("layout").default("two_photos"),
  theme: text("theme").default("spyglass"),
  photoLayout: text("photo_layout").default("first_dozen"),
  mapStyle: text("map_style").default("streets"),
  showMapPolygon: boolean("show_map_polygon").default(true),
  includeAgentFooter: boolean("include_agent_footer").default(true),
  coverPageConfig: jsonb("cover_page_config").$type<CoverPageConfig>(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
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
// ALL DEFAULTS ARE FALSE - Users must opt-in to notifications
export const notificationSettings = pgTable("notification_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  transactionId: varchar("transaction_id"), // null = global settings for user
  
  // Toggle each notification type
  documentUploads: boolean("document_uploads").default(false),
  closingReminders: boolean("closing_reminders").default(false), // Parent toggle for reminder schedule
  marketingAssets: boolean("marketing_assets").default(false),
  
  // Reminder intervals - Limited to: 14 days, 7 days, 3 days, day of
  // Only active when closingReminders (parent toggle) is true
  reminder30Days: boolean("reminder_30_days").default(false), // Legacy - kept for compatibility
  reminder14Days: boolean("reminder_14_days").default(false),
  reminder7Days: boolean("reminder_7_days").default(false),
  reminder3Days: boolean("reminder_3_days").default(false),
  reminder1Day: boolean("reminder_1_day").default(false), // Legacy - kept for compatibility
  reminderDayOf: boolean("reminder_day_of").default(false),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Sent notifications - Prevents duplicate notifications (deduplication)
export const sentNotifications = pgTable("sent_notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  transactionId: varchar("transaction_id").notNull(),
  notificationType: varchar("notification_type", { length: 50 }).notNull(), // closing_14_days, closing_7_days, etc.
  channelId: varchar("channel_id", { length: 100 }).notNull(),
  sentAt: timestamp("sent_at").defaultNow().notNull(),
  messageTs: varchar("message_ts", { length: 50 }), // Slack message timestamp for reference
});

// User Notification Preferences (per-agent settings for Slack notifications)
export const userNotificationPreferences = pgTable("user_notification_preferences", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().unique(), // Links to Replit Auth user
  
  // Slack Notification Types (3 toggles)
  notifyDocumentUploads: boolean("notify_document_uploads").default(false),
  notifyClosingReminders: boolean("notify_closing_reminders").default(false),
  notifyMarketingAssets: boolean("notify_marketing_assets").default(false),
  
  // Reminder Schedule Options (only active when notifyClosingReminders is true)
  reminder14Days: boolean("reminder_14_days").default(false),
  reminder7Days: boolean("reminder_7_days").default(false),
  reminder3Days: boolean("reminder_3_days").default(false),
  reminderDayOf: boolean("reminder_day_of").default(false),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Types for user notification preferences
export type UserNotificationPreferences = typeof userNotificationPreferences.$inferSelect;
export type InsertUserNotificationPreferences = typeof userNotificationPreferences.$inferInsert;

// Zod schema for validating user notification preferences updates
export const updateUserNotificationPreferencesSchema = z.object({
  notifyDocumentUploads: z.boolean().optional(),
  notifyClosingReminders: z.boolean().optional(),
  notifyMarketingAssets: z.boolean().optional(),
  reminder14Days: z.boolean().optional(),
  reminder7Days: z.boolean().optional(),
  reminder3Days: z.boolean().optional(),
  reminderDayOf: z.boolean().optional(),
});

// Agent profiles for CMA reports and marketing
export const agentProfiles = pgTable("agent_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: text("user_id").notNull().unique(),
  title: text("title"),
  headshotUrl: text("headshot_url"),
  bio: text("bio"),
  defaultCoverLetter: text("default_cover_letter"),
  // Social links
  facebookUrl: text("facebook_url"),
  instagramUrl: text("instagram_url"),
  linkedinUrl: text("linkedin_url"),
  twitterUrl: text("twitter_url"),
  websiteUrl: text("website_url"),
  marketingCompany: text("marketing_company"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Agent resources for CMA presentations
export const agentResources = pgTable("agent_resources", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  type: text("type").notNull(), // 'link' or 'file'
  url: text("url"), // For external links
  fileUrl: text("file_url"), // For uploaded files (object storage URL) - deprecated, use fileData
  fileName: text("file_name"), // Original file name
  fileData: text("file_data"), // Base64 encoded file content (for database storage)
  fileMimeType: text("file_mime_type"), // MIME type of uploaded file
  isActive: boolean("is_active").default(true),
  displayOrder: integer("display_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Agent marketing profiles for flyers and marketing materials
export const agentMarketingProfiles = pgTable("agent_marketing_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: text("user_id").notNull().unique(),
  agentPhoto: text("agent_photo"), // Base64 or URL
  agentTitle: varchar("agent_title", { length: 100 }).default("REALTOR®"),
  qrCode: text("qr_code"), // Base64 or URL (agent uploads their own)
  companyLogo: text("company_logo"), // Base64 or URL (custom upload)
  companyLogoUseDefault: boolean("company_logo_use_default").default(true),
  secondaryLogo: text("secondary_logo"), // Base64 or URL (custom upload)
  secondaryLogoUseDefault: boolean("secondary_logo_use_default").default(true),
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

export const insertFlyerSchema = createInsertSchema(flyers).omit({
  createdAt: true,
  updatedAt: true,
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

export const insertCmaReportConfigSchema = createInsertSchema(cmaReportConfigs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCmaReportTemplateSchema = createInsertSchema(cmaReportTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertNotificationSettingsSchema = createInsertSchema(notificationSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSentNotificationSchema = createInsertSchema(sentNotifications).omit({
  id: true,
  sentAt: true,
});

export const insertAgentProfileSchema = createInsertSchema(agentProfiles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAgentResourceSchema = createInsertSchema(agentResources).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAgentMarketingProfileSchema = createInsertSchema(agentMarketingProfiles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Helper schema for optional URLs that auto-prepends https:// if missing
const optionalUrlSchema = z
  .string()
  .transform((val) => {
    if (!val || val.trim() === "") return "";
    let url = val.trim();
    if (!url.match(/^https?:\/\//i)) {
      url = `https://${url}`;
    }
    return url;
  })
  .refine(
    (val) => {
      if (!val) return true;
      try {
        new URL(val);
        return true;
      } catch {
        return false;
      }
    },
    { message: "Please enter a valid URL (e.g., facebook.com/yourprofile)" }
  )
  .optional()
  .or(z.literal(''));

// Agent profile update validation schema
export const updateAgentProfileSchema = z.object({
  title: z.string().optional(),
  headshotUrl: z.string().url().optional().or(z.literal('')),
  bio: z.string().optional(),
  defaultCoverLetter: z.string().optional(),
  facebookUrl: optionalUrlSchema,
  instagramUrl: optionalUrlSchema,
  linkedinUrl: optionalUrlSchema,
  twitterUrl: optionalUrlSchema,
  websiteUrl: optionalUrlSchema,
  marketingCompany: z.string().optional(),
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

export type Flyer = typeof flyers.$inferSelect;
export type InsertFlyer = z.infer<typeof insertFlyerSchema>;

export type ContractDocument = typeof contractDocuments.$inferSelect;
export type InsertContractDocument = z.infer<typeof insertContractDocumentSchema>;

export type Cma = typeof cmas.$inferSelect;
export type InsertCma = z.infer<typeof insertCmaSchema>;

export type CmaReportConfig = typeof cmaReportConfigs.$inferSelect;
export type InsertCmaReportConfig = z.infer<typeof insertCmaReportConfigSchema>;

export type CmaReportTemplate = typeof cmaReportTemplates.$inferSelect;
export type InsertCmaReportTemplate = z.infer<typeof insertCmaReportTemplateSchema>;

export type NotificationSetting = typeof notificationSettings.$inferSelect;
export type InsertNotificationSetting = z.infer<typeof insertNotificationSettingsSchema>;

export type SentNotification = typeof sentNotifications.$inferSelect;
export type InsertSentNotification = z.infer<typeof insertSentNotificationSchema>;

export type AgentProfile = typeof agentProfiles.$inferSelect;
export type InsertAgentProfile = z.infer<typeof insertAgentProfileSchema>;
export type UpdateAgentProfile = z.infer<typeof updateAgentProfileSchema>;

export type AgentResource = typeof agentResources.$inferSelect;
export type InsertAgentResource = z.infer<typeof insertAgentResourceSchema>;

export type AgentMarketingProfile = typeof agentMarketingProfiles.$inferSelect;
export type InsertAgentMarketingProfile = z.infer<typeof insertAgentMarketingProfileSchema>;

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
  listPrice?: number;
  closePrice?: number;
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
  closeDate?: string;
  yearBuilt?: number;
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
