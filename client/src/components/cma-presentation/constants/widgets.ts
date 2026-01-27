import type { WidgetDefinition } from '../types';

export const SPYGLASS_LOGO_WHITE = '/logos/spyglass-logo-white.png';
export const SPYGLASS_LOGO_BLACK = '/logos/spyglass-logo-black.png';
export const SPYGLASS_LOGO_SQUARE = '/logos/spyglass-logo-square.png';
export const LRE_SGR_WHITE = '/logos/lre-sgr-white.png';
export const LRE_SGR_BLACK = '/logos/lre-sgr-black.png';

export const WIDGETS: WidgetDefinition[] = [
  // Dynamic widgets (1-10)
  { 
    id: 'agent_resume', 
    number: 1, 
    title: 'AGENT RESUME', 
    icon: 'user', 
    type: 'dynamic', 
    component: 'AgentResumeWidget' 
  },
  { 
    id: 'listing_with_spyglass', 
    number: 2, 
    title: 'LISTING WITH SPYGLASS REALTY', 
    icon: 'spyglass', 
    type: 'youtube',
    videoUrl: 'https://www.youtube.com/embed/iB_u-ksW3ts'
  },
  { 
    id: 'client_testimonials', 
    number: 3, 
    title: 'CLIENT TESTIMONIALS', 
    subtitle: 'What Clients Say', 
    icon: 'quote', 
    type: 'dynamic',
    component: 'ClientTestimonialsWidget'
  },
  { 
    id: 'marketing', 
    number: 4, 
    title: 'MARKETING', 
    icon: 'spyglass', 
    type: 'dynamic',
    component: 'MarketingWidget'
  },
  { 
    id: 'comps', 
    number: 5, 
    title: 'COMPS', 
    icon: 'homes', 
    type: 'dynamic', 
    component: 'CompsWidget' 
  },
  { 
    id: 'time_to_sell', 
    number: 6, 
    title: 'TIME TO SELL', 
    icon: 'clock', 
    type: 'dynamic', 
    component: 'TimeToSellWidget' 
  },
  { 
    id: 'suggested_list_price', 
    number: 7, 
    title: 'SUGGESTED LIST PRICE', 
    icon: 'dollar', 
    type: 'dynamic', 
    component: 'SuggestedPriceWidget' 
  },
  { 
    id: 'listing_action_plan', 
    number: 8, 
    title: 'LISTING ACTION PLAN', 
    icon: 'spyglass', 
    type: 'text' 
  },
  { 
    id: 'spyglass_resources', 
    number: 9, 
    title: 'SPYGLASS RESOURCES AND LINKS', 
    icon: 'link', 
    type: 'dynamic',
    component: 'SpyglassResourcesWidget'
  },
  { 
    id: 'average_price_acre', 
    number: 10, 
    title: 'AVERAGE PRICE/ACRE', 
    icon: 'chart', 
    type: 'dynamic', 
    component: 'AveragePriceAcreWidget' 
  },
  
  // Static image widgets (11-33) - mapped to uploaded images
  // Images 1-24 in the ZIP map to widgets 11-34 (we have 24 images)
  { 
    id: 'home_selling_system', 
    number: 11, 
    title: 'HOME SELLING SYSTEM', 
    icon: 'spyglass', 
    type: 'static', 
    imagePath: '/cma-widgets/1.png' 
  },
  { 
    id: 'our_proven_approach', 
    number: 12, 
    title: 'OUR PROVEN APPROACH', 
    icon: 'spyglass', 
    type: 'static', 
    imagePath: '/cma-widgets/2.png' 
  },
  { 
    id: 'seo_digital_marketing', 
    number: 13, 
    title: 'SEO & DIGITAL MARKETING', 
    icon: 'spyglass', 
    type: 'static', 
    imagePath: '/cma-widgets/3.png' 
  },
  { 
    id: 'google_meta_ads', 
    number: 14, 
    title: 'GOOGLE + META ADS', 
    icon: 'spyglass', 
    type: 'static', 
    imagePath: '/cma-widgets/4.png' 
  },
  { 
    id: 'professional_videography', 
    number: 15, 
    title: 'PROFESSIONAL VIDEOGRAPHY', 
    icon: 'spyglass', 
    type: 'static', 
    imagePath: '/cma-widgets/5.png' 
  },
  { 
    id: 'why_4k_video', 
    number: 16, 
    title: 'WHY 4K VIDEO', 
    icon: 'spyglass', 
    type: 'static', 
    imagePath: '/cma-widgets/6.png' 
  },
  { 
    id: 'example_videos', 
    number: 17, 
    title: 'EXAMPLE VIDEOS', 
    icon: 'spyglass', 
    type: 'static', 
    imagePath: '/cma-widgets/7.png' 
  },
  { 
    id: 'aerial_photography', 
    number: 18, 
    title: 'AERIAL PHOTOGRAPHY', 
    icon: 'spyglass', 
    type: 'static', 
    imagePath: '/cma-widgets/8.png' 
  },
  { 
    id: 'in_house_design', 
    number: 19, 
    title: 'IN-HOUSE DESIGN TEAM', 
    icon: 'spyglass', 
    type: 'static', 
    imagePath: '/cma-widgets/9.png' 
  },
  { 
    id: 'print_flyers', 
    number: 20, 
    title: 'PRINT & FLYERS', 
    icon: 'spyglass', 
    type: 'static', 
    imagePath: '/cma-widgets/10.png' 
  },
  { 
    id: 'custom_property_page', 
    number: 21, 
    title: 'CUSTOM PROPERTY PAGE', 
    icon: 'spyglass', 
    type: 'static', 
    imagePath: '/cma-widgets/11.png' 
  },
  { 
    id: 'global_marketing_reach', 
    number: 22, 
    title: 'GLOBAL MARKETING REACH', 
    icon: 'spyglass', 
    type: 'static', 
    imagePath: '/cma-widgets/12.png' 
  },
  { 
    id: 'leadingre_network', 
    number: 23, 
    title: 'LEADINGRE NETWORK STRENGTH', 
    icon: 'spyglass', 
    type: 'static', 
    imagePath: '/cma-widgets/13.png' 
  },
  { 
    id: 'featured_property', 
    number: 24, 
    title: 'FEATURED PROPERTY PROGRAM', 
    icon: 'spyglass', 
    type: 'static', 
    imagePath: '/cma-widgets/14.png' 
  },
  { 
    id: 'zillow_marketing', 
    number: 25, 
    title: 'ZILLOW MARKETING TOOLS', 
    icon: 'spyglass', 
    type: 'static', 
    imagePath: '/cma-widgets/15.png' 
  },
  { 
    id: 'zillow_showcase', 
    number: 26, 
    title: 'ZILLOW SHOWCASE LISTINGS', 
    icon: 'spyglass', 
    type: 'static', 
    imagePath: '/cma-widgets/16.png' 
  },
  { 
    id: 'open_house_process', 
    number: 27, 
    title: 'OPEN HOUSE PROCESS', 
    icon: 'spyglass', 
    type: 'static', 
    imagePath: '/cma-widgets/17.png' 
  },
  { 
    id: 'pricing_strategy', 
    number: 28, 
    title: 'PRICING STRATEGY', 
    icon: 'spyglass', 
    type: 'static', 
    imagePath: '/cma-widgets/18.png' 
  },
  { 
    id: 'listing_price', 
    number: 29, 
    title: 'LISTING PRICE', 
    icon: 'spyglass', 
    type: 'static', 
    imagePath: '/cma-widgets/19.png' 
  },
  { 
    id: 'marketing_timeline', 
    number: 30, 
    title: 'MARKETING TIMELINE', 
    icon: 'spyglass', 
    type: 'static', 
    imagePath: '/cma-widgets/20.png' 
  },
  { 
    id: 'select_move_program', 
    number: 31, 
    title: 'SELECT MOVE PROGRAM', 
    icon: 'spyglass', 
    type: 'static', 
    imagePath: '/cma-widgets/21.png' 
  },
  { 
    id: 'what_clients_say', 
    number: 32, 
    title: 'WHAT OUR CLIENTS SAY', 
    icon: 'spyglass', 
    type: 'static', 
    imagePath: '/cma-widgets/22.png' 
  },
  { 
    id: 'thank_you', 
    number: 33, 
    title: 'THANK YOU', 
    icon: 'spyglass', 
    type: 'static', 
    imagePath: '/cma-widgets/23.png' 
  },
];

export const LISTING_ACTION_PLAN_TEXT = `WHAT'S NEXT?
Keeping you on top of the process.

Once we have negotiated and agreed to the terms on the contract, our next goal is to manage each and every step of the process to ensure your property closes successfully. There are countless details and loose ends to handle leading up to closing and we make sure you're always informed of WHAT'S NEXT. You can be confident that we will be as detail-oriented during the post-contract phase as we were during the marketing phase. We'll continue to keep you up-to-date on the status of the closing process and will work diligently to ensure the closing is as smooth and problem-free as possible.

• Pre-listing appointment
• Staging Consultation
• Pricing analysis
• Listing preparation
• Marketing period
• Offer & negotiation
• Contingency period
• Closing`;

export const LISTING_WITH_SPYGLASS_TEXT = `We aim to combine our expertise with an award-winning marketing strategy to quickly sell your property for the highest possible price.

We thank you in advance for considering Spyglass Realty as your listing partner and brokerage.`;

export const MARKETING_TEXT = `Where are homebuyers looking for information?

One of our top priorities is making sure we market your property in the places your future buyer is looking. We take a look at marketing- and buyer-behavior trends to determine where to invest our resources. The latest data indicates we need to invest in our website, our signage and marketing materials, and our continued professional development.`;

export const GOOGLE_REVIEWS_URL = 'https://www.google.com/maps/place/Spyglass+Realty/@30.3492682,-97.7474442,17z/data=!4m8!3m7!1s0x8644cb678e6dffff:0x14ff7ac63e7fb7cd!8m2!3d30.3492682!4d-97.7448693!9m1!1b1!16s%2Fg%2F11c45c3h9x';

export interface Review {
  id: string;
  authorInitial: string;
  avatarColor: string;
  reviewCount: string;
  rating: number;
  timeAgo: string;
  text: string;
  positiveHighlights?: string[];
}

export const SAMPLE_REVIEWS: Review[] = [
  {
    id: '1',
    authorInitial: 'P',
    avatarColor: '#EC407A',
    reviewCount: '1 review',
    rating: 5,
    timeAgo: '2 years ago',
    text: 'My family and I recently relocated internationally to Austin. I was introduced to Ryan through a trusted colleague to help quickly locate a home for my family. Ryan and Sunny did a brilliant job of helping us, and I can\'t thank them enough for their patience and persistence. I look forward to continuing to work with Spyglass in future.',
  },
  {
    id: '2',
    authorInitial: 'E',
    avatarColor: '#66BB6A',
    reviewCount: '1 review',
    rating: 5,
    timeAgo: 'a year ago',
    positiveHighlights: ['Professionalism', 'Quality', 'Responsiveness', 'Value'],
    text: 'Michele did a wonderful job. The overall transaction went well. We had a little hiccup with our first buyers finding a loophole and backing out, but Michele was great about immediately setting up another open house and getting us more offers. Michele did especially well in hitting the market hard and fast which I believe maximized our offers.',
  },
  {
    id: '3',
    authorInitial: 'E',
    avatarColor: '#66BB6A',
    reviewCount: '4 reviews',
    rating: 5,
    timeAgo: 'a year ago',
    text: 'I worked with Emily Shea to help sell my home and I cannot say good enough things about her. The entire process was a seamless experience. Emily is very experienced and extremely knowledgeable about real estate. She did a lot of research on the appropriate sales price, and all I can say is she nailed it. We were able to solidify a primary and backup offer within four hours of listing.',
  },
];
