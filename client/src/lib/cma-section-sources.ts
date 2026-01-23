export type SourceType = 'mls' | 'agent-profile' | 'cma-settings' | 'manual' | 'static';

export interface SectionSourceConfig {
  type: SourceType;
  label: string;
  navigateTo?: string;
  tabName?: string;
}

export const SECTION_SOURCES: Record<string, SectionSourceConfig> = {
  cover_page: {
    type: 'cma-settings',
    label: 'Content Tab',
    tabName: 'content',
  },
  listing_brochure: {
    type: 'mls',
    label: 'MLS Data',
    tabName: 'mls-data',
  },
  cover_letter: {
    type: 'agent-profile',
    label: 'Agent Profile Settings',
    navigateTo: '/settings?tab=profile',
  },
  agent_resume: {
    type: 'agent-profile',
    label: 'Agent Profile Settings',
    navigateTo: '/settings?tab=profile',
  },
  our_company: {
    type: 'agent-profile',
    label: 'Company Settings',
    navigateTo: '/settings?tab=profile',
  },
  what_is_cma: {
    type: 'static',
    label: 'Static Content',
  },
  contact_me: {
    type: 'agent-profile',
    label: 'Agent Profile Settings',
    navigateTo: '/settings?tab=profile',
  },
  map_all_listings: {
    type: 'mls',
    label: 'CMA Comparables',
    tabName: 'sections',
  },
  listings_header: {
    type: 'static',
    label: 'Chapter Divider',
  },
  summary_comparables: {
    type: 'mls',
    label: 'CMA Comparables',
    tabName: 'sections',
  },
  property_details: {
    type: 'mls',
    label: 'MLS Data',
    tabName: 'mls-data',
  },
  property_photos: {
    type: 'mls',
    label: 'Layout Tab',
    tabName: 'layout',
  },
  adjustments: {
    type: 'cma-settings',
    label: 'Content Tab',
    tabName: 'content',
  },
  analysis_header: {
    type: 'static',
    label: 'Chapter Divider',
  },
  online_valuation: {
    type: 'mls',
    label: 'Market Data',
    tabName: 'sections',
  },
  price_per_sqft: {
    type: 'mls',
    label: 'Market Data',
    tabName: 'sections',
  },
  comparable_stats: {
    type: 'mls',
    label: 'CMA Analysis',
    tabName: 'sections',
  },
};

export const PDF_IMPLEMENTATION_STATUS: Record<string, boolean> = {
  cover_page: true,
  listing_brochure: true,
  cover_letter: true,
  agent_resume: true,
  our_company: true,
  what_is_cma: true,
  contact_me: true,
  map_all_listings: false,
  summary_comparables: true,
  listings_header: true,
  property_details: true,
  property_photos: false,
  adjustments: false,
  analysis_header: true,
  online_valuation: false,
  price_per_sqft: false,
  comparable_stats: true,
};

export function getSectionSource(sectionId: string): SectionSourceConfig | null {
  return SECTION_SOURCES[sectionId] || null;
}

export function isPdfImplemented(sectionId: string): boolean {
  return PDF_IMPLEMENTATION_STATUS[sectionId] ?? false;
}
