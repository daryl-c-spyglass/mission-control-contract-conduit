import { 
  FileText, 
  Home, 
  BarChart3, 
  Image, 
  Mail, 
  User, 
  Building, 
  HelpCircle, 
  Phone, 
  Map, 
  List, 
  Calculator, 
  TrendingUp, 
  Globe, 
  BarChart, 
  PieChart, 
  Images,
  LucideIcon 
} from "lucide-react";

export interface CmaSectionConfig {
  id: string;
  name: string;
  category: 'introduction' | 'listings' | 'analysis';
  defaultEnabled: boolean;
  icon: LucideIcon;
  editable?: boolean;
}

export const CMA_REPORT_SECTIONS: CmaSectionConfig[] = [
  // Introduction
  { id: 'cover_page', name: 'Cover Page', category: 'introduction', defaultEnabled: true, icon: FileText },
  { id: 'listing_brochure', name: 'Listing Brochure', category: 'introduction', defaultEnabled: false, icon: Image },
  { id: 'cover_letter', name: 'Cover Letter', category: 'introduction', defaultEnabled: true, icon: Mail, editable: true },
  { id: 'agent_resume', name: 'Agent Resume', category: 'introduction', defaultEnabled: false, icon: User, editable: true },
  { id: 'our_company', name: 'Our Company', category: 'introduction', defaultEnabled: false, icon: Building },
  { id: 'what_is_cma', name: 'What is a CMA?', category: 'introduction', defaultEnabled: false, icon: HelpCircle },
  { id: 'contact_me', name: 'Contact Me', category: 'introduction', defaultEnabled: true, icon: Phone },
  // Listings
  { id: 'map_all_listings', name: 'Map of All Listings', category: 'listings', defaultEnabled: true, icon: Map },
  { id: 'listings_header', name: 'Listings Chapter Header', category: 'listings', defaultEnabled: false, icon: List },
  { id: 'summary_comparables', name: 'Summary of Comparable Properties', category: 'listings', defaultEnabled: true, icon: BarChart3 },
  { id: 'property_details', name: 'Property Details', category: 'listings', defaultEnabled: true, icon: Home },
  { id: 'property_photos', name: 'Property Photos', category: 'listings', defaultEnabled: true, icon: Images },
  { id: 'adjustments', name: 'Adjustments', category: 'listings', defaultEnabled: false, icon: Calculator },
  // Analysis
  { id: 'analysis_header', name: 'Analysis Chapter Header', category: 'analysis', defaultEnabled: false, icon: TrendingUp },
  { id: 'online_valuation', name: 'Online Valuation Analysis', category: 'analysis', defaultEnabled: false, icon: Globe },
  { id: 'price_per_sqft', name: 'Average Price Per Sq. Ft.', category: 'analysis', defaultEnabled: true, icon: BarChart },
  { id: 'comparable_stats', name: 'Comparable Property Statistics', category: 'analysis', defaultEnabled: true, icon: PieChart },
];

export type CmaSectionId = typeof CMA_REPORT_SECTIONS[number]['id'];
export type CmaSectionCategory = 'introduction' | 'listings' | 'analysis';

export const DEFAULT_ENABLED_SECTIONS = CMA_REPORT_SECTIONS
  .filter(s => s.defaultEnabled)
  .map(s => s.id);

export const ALL_SECTION_IDS = CMA_REPORT_SECTIONS.map(s => s.id);

export const SECTION_CATEGORIES = {
  introduction: { label: "Introduction", icon: FileText, sections: CMA_REPORT_SECTIONS.filter(s => s.category === 'introduction') },
  listings: { label: "Listings", icon: Home, sections: CMA_REPORT_SECTIONS.filter(s => s.category === 'listings') },
  analysis: { label: "Analysis", icon: BarChart3, sections: CMA_REPORT_SECTIONS.filter(s => s.category === 'analysis') },
} as const;

export const EDITABLE_SECTIONS = CMA_REPORT_SECTIONS.filter(s => 'editable' in s && s.editable);

export function getDefaultEnabledSections(): string[] {
  return CMA_REPORT_SECTIONS.filter(s => s.defaultEnabled).map(s => s.id);
}

export function getDefaultSectionOrder(): string[] {
  return CMA_REPORT_SECTIONS.map(s => s.id);
}

export interface CMASectionStateConfig {
  id: CmaSectionId;
  name: string;
  category: CmaSectionCategory;
  enabled: boolean;
  order: number;
  customizable: boolean;
  customContent?: string;
}

export interface CMASubjectProperty {
  address: string;
  city: string;
  state: string;
  zip: string;
  mlsNumber: string;
  listPrice: number;
  bedrooms: number;
  bathrooms: number;
  sqft: number;
  lotSize: number;
  yearBuilt: number;
  propertyType: string;
  description: string;
  photos: string[];
  listDate: string;
  status: string;
}

export interface CMAComparable {
  address: string;
  mlsNumber: string;
  listPrice: number;
  soldPrice?: number;
  bedrooms: number;
  bathrooms: number;
  sqft: number;
  lotSize: number;
  yearBuilt: number;
  daysOnMarket: number;
  distance: number;
  status: string;
  photos: string[];
  pricePerSqft: number;
}

export interface CMAAgentInfo {
  firstName: string;
  lastName: string;
  title: string;
  email: string;
  phone: string;
  photo: string;
  company: string;
  bio?: string;
  coverLetter?: string;
}

export interface CMAAnalysisData {
  averagePrice: number;
  averagePricePerSqft: number;
  medianPrice: number;
  priceRange: { min: number; max: number };
  averageDaysOnMarket: number;
  suggestedListPrice?: number;
}

export interface CMAReportMetadata {
  preparedFor: string;
  preparedDate: string;
  reportTitle: string;
}

export interface CMAReportData {
  subjectProperty: CMASubjectProperty;
  comparables: CMAComparable[];
  agent: CMAAgentInfo;
  analysis: CMAAnalysisData;
  metadata: CMAReportMetadata;
}
