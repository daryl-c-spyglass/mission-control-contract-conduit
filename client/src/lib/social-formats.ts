export interface SocialFormat {
  id: string;
  name: string;
  platform: string;
  width: number;
  height: number;
  ratio: string;
  icon: string;
  description: string;
}

export const SOCIAL_FORMATS: SocialFormat[] = [
  { 
    id: 'instagram-post', 
    name: 'Instagram Post', 
    platform: 'Instagram',
    width: 1080, 
    height: 1080, 
    ratio: '1:1',
    icon: 'Instagram',
    description: 'Square format for feed posts'
  },
  { 
    id: 'instagram-story', 
    name: 'Instagram Story', 
    platform: 'Instagram',
    width: 1080, 
    height: 1920, 
    ratio: '9:16',
    icon: 'Instagram',
    description: 'Vertical format for stories & reels'
  },
  { 
    id: 'facebook-post', 
    name: 'Facebook Post', 
    platform: 'Facebook',
    width: 1200, 
    height: 630, 
    ratio: '1.91:1',
    icon: 'Facebook',
    description: 'Landscape format for feed posts'
  },
  { 
    id: 'x-post', 
    name: 'X (Twitter) Post', 
    platform: 'X',
    width: 1200, 
    height: 675, 
    ratio: '16:9',
    icon: 'Twitter',
    description: 'Landscape format for tweets'
  },
  { 
    id: 'tiktok-cover', 
    name: 'TikTok Cover', 
    platform: 'TikTok',
    width: 1080, 
    height: 1920, 
    ratio: '9:16',
    icon: 'TikTok',
    description: 'Vertical format for video covers'
  },
];

export const STATUS_OPTIONS = [
  { value: 'just_listed', label: 'Just Listed', color: 'bg-[#EF4923]' },
  { value: 'for_sale', label: 'For Sale', color: 'bg-[#EF4923]' },
  { value: 'for_lease', label: 'For Lease', color: 'bg-cyan-500' },
  { value: 'under_contract', label: 'Under Contract', color: 'bg-blue-500' },
  { value: 'just_sold', label: 'Just Sold', color: 'bg-red-500' },
  { value: 'price_improvement', label: 'Price Improvement', color: 'bg-purple-500' },
  { value: 'open_house', label: 'Open House', color: 'bg-blue-500' },
  { value: 'coming_soon', label: 'Coming Soon', color: 'bg-teal-500' },
];

export function getDefaultStatusFromMLS(mlsStatus: string | undefined): string {
  if (!mlsStatus) return 'just_listed';
  
  const status = mlsStatus.toLowerCase();
  if (status.includes('contract') || status.includes('pending')) {
    return 'under_contract';
  } else if (status.includes('sold') || status.includes('closed')) {
    return 'just_sold';
  } else if (status.includes('lease')) {
    return 'for_lease';
  } else if (status.includes('coming')) {
    return 'coming_soon';
  }
  return 'just_listed';
}
