export type TemplateCategory = 'social' | 'print' | 'digital';
export type SocialSubcategory = 'posts' | 'stories' | 'facebook';
export type PrintSubcategory = 'flyers' | 'postcards' | 'brochures';
export type DigitalSubcategory = 'email' | 'presentation';
export type TemplateSubcategory = SocialSubcategory | PrintSubcategory | DigitalSubcategory;
export type TemplateLayout = 'minimal' | 'standard' | 'bold' | 'elegant';

export interface TemplateFormat {
  width: number;
  height: number;
  aspectRatio: string;
}

export interface TemplateElements {
  logoPosition: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  pricePosition: 'top' | 'bottom' | 'overlay';
  statusBadgeStyle: 'banner' | 'badge' | 'ribbon';
  photoLayout: 'single' | 'collage' | 'grid';
}

export interface TemplateDesign {
  id: string;
  name: string;
  category: TemplateCategory;
  subcategory: TemplateSubcategory;
  format: TemplateFormat;
  layout: TemplateLayout;
  elements: TemplateElements;
  dialogFormatId?: string;
}

export const SOCIAL_FORMATS = [
  { id: 'square', name: 'Instagram Post', width: 1080, height: 1080, aspectRatio: '1:1', badge: 'Instagram Post', badgeColor: '#3b82f6' },
  { id: 'landscape', name: 'Facebook Post', width: 1200, height: 630, aspectRatio: '16:9', badge: 'Facebook 16:9', badgeColor: '#8b5cf6' },
  { id: 'story', name: 'Instagram Story', width: 1080, height: 1920, aspectRatio: '9:16', badge: 'Instagram Story', badgeColor: '#ec4899' },
] as const;

export const PRINT_FORMATS = [
  { id: 'flyer', name: 'Property Flyer', width: 2550, height: 3300, aspectRatio: '8.5:11' },
  { id: 'postcard', name: 'Postcard', width: 1875, height: 1275, aspectRatio: '6:4' },
  { id: 'brochure', name: 'Brochure', width: 2550, height: 3300, aspectRatio: '8.5:11' },
] as const;

export const STATUS_OPTIONS = [
  { value: "just_listed", label: "Just Listed" },
  { value: "for_sale", label: "For Sale" },
  { value: "for_lease", label: "For Lease" },
  { value: "under_contract", label: "Under Contract" },
  { value: "just_sold", label: "Just Sold" },
  { value: "price_improvement", label: "Price Improvement" },
] as const;

export type StatusType = typeof STATUS_OPTIONS[number]["value"];

export const templateDesigns: TemplateDesign[] = [
  {
    id: 'social-post-minimal',
    name: 'Minimal Post',
    category: 'social',
    subcategory: 'posts',
    format: { width: 1080, height: 1080, aspectRatio: '1:1' },
    layout: 'minimal',
    elements: {
      logoPosition: 'top-right',
      pricePosition: 'bottom',
      statusBadgeStyle: 'badge',
      photoLayout: 'single',
    },
    dialogFormatId: 'square',
  },
  {
    id: 'social-post-bold',
    name: 'Bold Post',
    category: 'social',
    subcategory: 'posts',
    format: { width: 1080, height: 1080, aspectRatio: '1:1' },
    layout: 'bold',
    elements: {
      logoPosition: 'top-right',
      pricePosition: 'overlay',
      statusBadgeStyle: 'banner',
      photoLayout: 'single',
    },
    dialogFormatId: 'square',
  },
  {
    id: 'social-post-elegant',
    name: 'Elegant Post',
    category: 'social',
    subcategory: 'posts',
    format: { width: 1080, height: 1080, aspectRatio: '1:1' },
    layout: 'elegant',
    elements: {
      logoPosition: 'bottom-right',
      pricePosition: 'bottom',
      statusBadgeStyle: 'ribbon',
      photoLayout: 'single',
    },
    dialogFormatId: 'square',
  },
  {
    id: 'social-story-minimal',
    name: 'Minimal Story',
    category: 'social',
    subcategory: 'stories',
    format: { width: 1080, height: 1920, aspectRatio: '9:16' },
    layout: 'minimal',
    elements: {
      logoPosition: 'top-left',
      pricePosition: 'bottom',
      statusBadgeStyle: 'badge',
      photoLayout: 'single',
    },
    dialogFormatId: 'story',
  },
  {
    id: 'social-story-bold',
    name: 'Bold Story',
    category: 'social',
    subcategory: 'stories',
    format: { width: 1080, height: 1920, aspectRatio: '9:16' },
    layout: 'bold',
    elements: {
      logoPosition: 'top-right',
      pricePosition: 'overlay',
      statusBadgeStyle: 'banner',
      photoLayout: 'single',
    },
    dialogFormatId: 'story',
  },
  {
    id: 'social-facebook-standard',
    name: 'Standard Facebook',
    category: 'social',
    subcategory: 'facebook',
    format: { width: 1200, height: 630, aspectRatio: '16:9' },
    layout: 'standard',
    elements: {
      logoPosition: 'top-right',
      pricePosition: 'bottom',
      statusBadgeStyle: 'badge',
      photoLayout: 'single',
    },
    dialogFormatId: 'landscape',
  },
  {
    id: 'social-facebook-bold',
    name: 'Bold Facebook',
    category: 'social',
    subcategory: 'facebook',
    format: { width: 1200, height: 630, aspectRatio: '16:9' },
    layout: 'bold',
    elements: {
      logoPosition: 'top-right',
      pricePosition: 'overlay',
      statusBadgeStyle: 'banner',
      photoLayout: 'single',
    },
    dialogFormatId: 'landscape',
  },
  {
    id: 'print-flyer-standard',
    name: 'Standard Flyer',
    category: 'print',
    subcategory: 'flyers',
    format: { width: 2550, height: 3300, aspectRatio: '8.5:11' },
    layout: 'standard',
    elements: {
      logoPosition: 'top-left',
      pricePosition: 'top',
      statusBadgeStyle: 'banner',
      photoLayout: 'collage',
    },
  },
  {
    id: 'print-flyer-elegant',
    name: 'Elegant Flyer',
    category: 'print',
    subcategory: 'flyers',
    format: { width: 2550, height: 3300, aspectRatio: '8.5:11' },
    layout: 'elegant',
    elements: {
      logoPosition: 'top-right',
      pricePosition: 'top',
      statusBadgeStyle: 'ribbon',
      photoLayout: 'single',
    },
  },
  {
    id: 'print-postcard-minimal',
    name: 'Minimal Postcard',
    category: 'print',
    subcategory: 'postcards',
    format: { width: 1875, height: 1275, aspectRatio: '6:4' },
    layout: 'minimal',
    elements: {
      logoPosition: 'bottom-right',
      pricePosition: 'top',
      statusBadgeStyle: 'badge',
      photoLayout: 'single',
    },
  },
  {
    id: 'print-brochure-standard',
    name: 'Standard Brochure',
    category: 'print',
    subcategory: 'brochures',
    format: { width: 2550, height: 3300, aspectRatio: '8.5:11' },
    layout: 'standard',
    elements: {
      logoPosition: 'top-left',
      pricePosition: 'top',
      statusBadgeStyle: 'banner',
      photoLayout: 'grid',
    },
  },
];

export function getTemplatesByCategory(category: TemplateCategory): TemplateDesign[] {
  return templateDesigns.filter(t => t.category === category);
}

export function getTemplatesBySubcategory(subcategory: TemplateSubcategory): TemplateDesign[] {
  return templateDesigns.filter(t => t.subcategory === subcategory);
}

export function getTemplateById(id: string): TemplateDesign | undefined {
  return templateDesigns.find(t => t.id === id);
}

export function getSubcategoriesForCategory(category: TemplateCategory): TemplateSubcategory[] {
  switch (category) {
    case 'social':
      return ['posts', 'stories', 'facebook'];
    case 'print':
      return ['flyers', 'postcards', 'brochures'];
    case 'digital':
      return ['email', 'presentation'];
  }
}

export function getSubcategoryLabel(subcategory: TemplateSubcategory): string {
  const labels: Record<TemplateSubcategory, string> = {
    posts: 'Instagram Posts',
    stories: 'Instagram Stories',
    facebook: 'Facebook Posts',
    flyers: 'Property Flyers',
    postcards: 'Postcards',
    brochures: 'Brochures',
    email: 'Email Templates',
    presentation: 'Presentations',
  };
  return labels[subcategory] || subcategory;
}

export function getCategoryLabel(category: TemplateCategory): string {
  const labels: Record<TemplateCategory, string> = {
    social: 'Social Media',
    print: 'Print Materials',
    digital: 'Digital',
  };
  return labels[category];
}

export function getFormatOptions(category: TemplateCategory) {
  if (category === 'social') {
    return SOCIAL_FORMATS.map(f => ({
      id: f.id,
      name: f.name,
      ratio: f.aspectRatio,
      aspectClass: f.aspectRatio === '1:1' ? 'w-8 h-8' : f.aspectRatio === '16:9' ? 'w-10 h-6' : 'w-6 h-10',
    }));
  }
  return PRINT_FORMATS.map(f => ({
    id: f.id,
    name: f.name,
    ratio: f.aspectRatio,
    aspectClass: 'w-6 h-8',
  }));
}

export function getStatusLabel(statusValue: string): string {
  return STATUS_OPTIONS.find(s => s.value === statusValue)?.label || 'Just Listed';
}
