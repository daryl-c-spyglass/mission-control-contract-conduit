import type { CoverPageConfig, CmaAdjustmentRates } from './schema';

export const DEFAULT_COVER_PAGE_CONFIG: CoverPageConfig = {
  title: "Comparative Market Analysis",
  subtitle: "Prepared exclusively for you",
  showDate: true,
  showAgentPhoto: true,
  background: "none",
};

export const DEFAULT_ADJUSTMENT_RATES: CmaAdjustmentRates = {
  sqftPerUnit: 50,
  bedroomValue: 10000,
  bathroomValue: 7500,
  poolValue: 25000,
  garagePerSpace: 5000,
  yearBuiltPerYear: 1000,
  lotSizePerSqft: 2,
};

export const LAYOUT_OPTIONS = [
  { value: "two_photos", label: "Two Photos per Property" },
  { value: "single_photo", label: "Single Photo per Property" },
  { value: "no_photos", label: "No Photos" },
] as const;

export const PHOTO_LAYOUT_OPTIONS = [
  { value: "first_dozen", label: "First 12 Photos" },
  { value: "all", label: "All Photos" },
  { value: "ai_suggested", label: "AI Suggested (Best Quality)" },
  { value: "custom", label: "Custom Selection" },
] as const;

export const MAP_STYLE_OPTIONS = [
  { value: "streets", label: "Streets" },
  { value: "satellite", label: "Satellite" },
  { value: "dark", label: "Dark" },
] as const;

export type LayoutOption = typeof LAYOUT_OPTIONS[number]['value'];
export type PhotoLayoutOption = typeof PHOTO_LAYOUT_OPTIONS[number]['value'];
export type MapStyleOption = typeof MAP_STYLE_OPTIONS[number]['value'];
