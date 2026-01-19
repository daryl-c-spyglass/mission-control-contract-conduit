export const CMA_REPORT_SECTIONS = [
  { id: 'cover_page', name: 'Cover Page', category: 'introduction', defaultEnabled: true },
  { id: 'listing_brochure', name: 'Listing Brochure', category: 'introduction', defaultEnabled: false },
  { id: 'cover_letter', name: 'Cover Letter', category: 'introduction', defaultEnabled: true, editable: true },
  { id: 'agent_resume', name: 'Agent Resume', category: 'introduction', defaultEnabled: false, editable: true },
  { id: 'our_company', name: 'Our Company', category: 'introduction', defaultEnabled: false },
  { id: 'what_is_cma', name: 'What is a CMA?', category: 'introduction', defaultEnabled: false },
  { id: 'contact_me', name: 'Contact Me', category: 'introduction', defaultEnabled: true },
  
  { id: 'map_all_listings', name: 'Map of All Listings', category: 'listings', defaultEnabled: true },
  { id: 'summary_comparables', name: 'Summary of Comparable Properties', category: 'listings', defaultEnabled: true },
  { id: 'listings_header', name: 'Listings Chapter Header', category: 'listings', defaultEnabled: false },
  { id: 'property_details', name: 'Property Details', category: 'listings', defaultEnabled: true },
  { id: 'property_photos', name: 'Property Photos', category: 'listings', defaultEnabled: true },
  { id: 'adjustments', name: 'Adjustments', category: 'listings', defaultEnabled: false },
  
  { id: 'analysis_header', name: 'Analysis Chapter Header', category: 'analysis', defaultEnabled: false },
  { id: 'online_valuation', name: 'Online Valuation Analysis', category: 'analysis', defaultEnabled: false },
  { id: 'price_per_sqft', name: 'Average Price Per Sq. Ft.', category: 'analysis', defaultEnabled: true },
  { id: 'comparable_stats', name: 'Comparable Property Statistics', category: 'analysis', defaultEnabled: true },
] as const;

export type CmaSectionId = typeof CMA_REPORT_SECTIONS[number]['id'];
export type CmaSectionCategory = 'introduction' | 'listings' | 'analysis';

export const DEFAULT_ENABLED_SECTIONS = CMA_REPORT_SECTIONS
  .filter(s => s.defaultEnabled)
  .map(s => s.id);

export const ALL_SECTION_IDS = CMA_REPORT_SECTIONS.map(s => s.id);

export const SECTION_CATEGORIES = {
  introduction: CMA_REPORT_SECTIONS.filter(s => s.category === 'introduction'),
  listings: CMA_REPORT_SECTIONS.filter(s => s.category === 'listings'),
  analysis: CMA_REPORT_SECTIONS.filter(s => s.category === 'analysis'),
};

export const EDITABLE_SECTIONS = CMA_REPORT_SECTIONS.filter(s => 'editable' in s && s.editable);
