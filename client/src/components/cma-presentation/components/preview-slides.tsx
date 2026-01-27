import { 
  extractPrice, 
  extractSqft, 
  extractDOM, 
  extractFullAddress,
  extractBeds,
  extractBaths,
  calculateCMAStats,
  formatPrice,
  formatNumber,
  normalizeStatus,
  getStatusColor,
  getPrimaryPhoto,
} from '@/lib/cma-data-utils';
import { Home, MapPin, Calendar, Ruler, DollarSign, Clock, User, Building, FileText, Play, MessageSquare, TrendingUp, Link } from 'lucide-react';
import type { AgentProfile, CmaProperty } from '../types';
import { WIDGETS, LISTING_ACTION_PLAN_TEXT, MARKETING_TEXT } from '../constants/widgets';

export interface PreviewSlide {
  type: string;
  title: string;
  content: React.ReactNode;
  slideNumber: number;
  totalSlides: number;
  hasIssue: boolean;
  issueMessage?: string;
}

interface GeneratePreviewSlidesParams {
  propertyAddress: string;
  comparables: CmaProperty[];
  agent: AgentProfile;
  subjectProperty?: CmaProperty;
  averageDaysOnMarket?: number;
  suggestedListPrice?: number | null;
  avgPricePerAcre?: number | null;
}

export function generatePreviewSlides({
  propertyAddress,
  comparables,
  agent,
  subjectProperty,
  averageDaysOnMarket,
  suggestedListPrice,
  avgPricePerAcre,
}: GeneratePreviewSlidesParams): PreviewSlide[] {
  const slides: PreviewSlide[] = [];
  const stats = calculateCMAStats(comparables);
  const address = propertyAddress || 'Property Address';

  slides.push({
    type: 'cover',
    title: 'COMPARATIVE MARKET ANALYSIS',
    content: (
      <CoverSlideContent 
        address={address}
        agent={agent}
      />
    ),
    slideNumber: 1,
    totalSlides: 0,
    hasIssue: !agent?.name,
    issueMessage: !agent?.name ? 'Agent name not configured' : undefined,
  });

  WIDGETS.forEach((widget) => {
    let slideContent: React.ReactNode;
    let hasIssue = false;
    let issueMessage: string | undefined;

    switch (widget.id) {
      case 'agent_resume':
        hasIssue = !agent?.name || !agent?.bio;
        issueMessage = hasIssue ? 'Agent profile incomplete' : undefined;
        slideContent = <AgentResumeContent agent={agent} />;
        break;

      case 'listing_with_spyglass':
        slideContent = <VideoSlideContent title={widget.title} />;
        break;

      case 'client_testimonials':
        slideContent = <TestimonialsContent />;
        break;

      case 'marketing':
        slideContent = <MarketingContent />;
        break;

      case 'comps':
        hasIssue = comparables.length === 0 || stats.avgPrice === null;
        issueMessage = comparables.length === 0 
          ? 'No comparable properties loaded' 
          : stats.avgPrice === null 
            ? 'Price data not available' 
            : undefined;
        slideContent = <CompsContent comparables={comparables} stats={stats} />;
        break;

      case 'time_to_sell':
        // Note: 0 days is valid (fast-selling market), only null/undefined indicates missing data
        hasIssue = stats.avgDOM === null || stats.avgDOM === undefined;
        issueMessage = hasIssue ? 'Days on market data not available' : undefined;
        slideContent = <TimeToSellContent stats={stats} averageDaysOnMarket={averageDaysOnMarket} />;
        break;

      case 'suggested_list_price':
        hasIssue = stats.avgPrice === null && !suggestedListPrice;
        issueMessage = hasIssue ? 'Cannot calculate suggested price without comparable prices' : undefined;
        slideContent = <SuggestedPriceContent stats={stats} suggestedListPrice={suggestedListPrice} />;
        break;

      case 'listing_action_plan':
        slideContent = <ListingActionPlanContent />;
        break;

      case 'spyglass_resources':
        slideContent = <SpyglassResourcesContent />;
        break;

      case 'average_price_acre':
        hasIssue = avgPricePerAcre === null || avgPricePerAcre === undefined;
        issueMessage = hasIssue ? 'Acreage data not available' : undefined;
        slideContent = <AveragePriceAcreContent avgPricePerAcre={avgPricePerAcre} stats={stats} />;
        break;

      default:
        if (widget.type === 'static' && widget.imagePath) {
          slideContent = <StaticSlideContent title={widget.title} imagePath={widget.imagePath} />;
        } else {
          slideContent = <GenericSlideContent title={widget.title} />;
        }
    }

    slides.push({
      type: widget.type,
      title: widget.title,
      content: slideContent,
      slideNumber: slides.length + 1,
      totalSlides: 0,
      hasIssue,
      issueMessage,
    });
  });

  comparables.forEach((comp, index) => {
    const price = extractPrice(comp);
    const hasPhoto = (comp.photos && comp.photos.length > 0) || (comp as any).primaryPhoto;
    
    slides.push({
      type: 'propertyDetails',
      title: `PROPERTY DETAILS - ${extractFullAddress(comp) || `Comparable ${index + 1}`}`,
      content: <PropertyDetailsContent property={comp} />,
      slideNumber: slides.length + 1,
      totalSlides: 0,
      hasIssue: price === null || !hasPhoto,
      issueMessage: price === null 
        ? 'Price not available' 
        : !hasPhoto 
          ? 'Photo not available' 
          : undefined,
    });
  });

  const totalSlides = slides.length;
  slides.forEach((slide, index) => {
    slide.slideNumber = index + 1;
    slide.totalSlides = totalSlides;
  });

  return slides;
}

export function checkDataIssues({ comparables, agent, subjectProperty }: {
  comparables: CmaProperty[];
  agent: AgentProfile;
  subjectProperty?: CmaProperty;
}): string[] {
  const issues: string[] = [];

  if (!agent?.name) issues.push('Agent name not configured');
  // Use same fallback chain as AgentResumeContent for photo check
  const agentPhoto = agent?.photo || (agent as any)?.headshotUrl || (agent as any)?.photoUrl;
  if (!agentPhoto) issues.push('Agent photo not uploaded');
  if (!agent?.bio) issues.push('Agent bio not filled in');

  if (subjectProperty) {
    const subjectAddress = extractFullAddress(subjectProperty);
    if (!subjectAddress || subjectAddress === 'Address unavailable') {
      issues.push('Subject property address not available');
    }
    const subjectPrice = extractPrice(subjectProperty);
    if (subjectPrice === null) {
      issues.push('Subject property price not available');
    }
    const subjectSqft = extractSqft(subjectProperty);
    if (subjectSqft === null || subjectSqft === 0) {
      issues.push('Subject property square footage not available');
    }
    const hasSubjectPhotos = (subjectProperty.photos && subjectProperty.photos.length > 0) || (subjectProperty as any).primaryPhoto;
    if (!hasSubjectPhotos) {
      issues.push('Subject property photos not available');
    }
  }

  if (!comparables || comparables.length === 0) {
    issues.push('No comparable properties loaded');
  } else {
    const withPrice = comparables.filter(c => extractPrice(c) !== null);
    if (withPrice.length === 0) {
      issues.push('Price data missing for all comparables');
    } else if (withPrice.length < comparables.length) {
      issues.push(`Price data missing for ${comparables.length - withPrice.length} comparables`);
    }

    const withPhotos = comparables.filter(c => (c.photos && c.photos.length > 0) || (c as any).primaryPhoto);
    if (withPhotos.length < comparables.length) {
      issues.push(`Photos missing for ${comparables.length - withPhotos.length} comparables`);
    }

    const withCoords = comparables.filter(c => 
      (c.latitude && c.longitude) || 
      ((c as any).map?.latitude && (c as any).map?.longitude)
    );
    if (withCoords.length === 0) {
      issues.push('Location coordinates missing - map will not display');
    }

    // Check if any comparables have DOM data - 0 is a valid value (fast-selling market)
    const withDOM = comparables.filter(c => {
      const dom = extractDOM(c);
      return dom !== null && dom !== undefined;
    });
    if (withDOM.length === 0) {
      issues.push('Days on market data not available');
    }

    const withSqft = comparables.filter(c => {
      const sqft = extractSqft(c);
      return sqft !== null && sqft > 0;
    });
    if (withSqft.length < comparables.length) {
      issues.push(`Square footage missing for ${comparables.length - withSqft.length} comparables`);
    }
  }

  return issues;
}

function CoverSlideContent({ address, agent }: { address: string; agent: AgentProfile }) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center">
      <div className="mb-4">
        <img 
          src="/logos/spyglass-logo-black.png"
          alt="Spyglass Realty"
          className="h-12 w-auto mx-auto mb-4"
          onError={(e) => {
            e.currentTarget.style.display = 'none';
          }}
        />
        <h1 className="text-2xl font-bold text-[#222222]">COMPARATIVE MARKET ANALYSIS</h1>
      </div>
      <p className="text-lg text-zinc-700 mb-4">{address}</p>
      <div className="mt-4 pt-4 border-t border-zinc-200">
        <p className="text-sm text-zinc-600">Prepared by</p>
        <p className="font-medium text-[#222222]">{agent?.name || 'Agent Name'}</p>
        <p className="text-sm text-zinc-500">{agent?.company || 'Spyglass Realty'}</p>
      </div>
    </div>
  );
}

function AgentResumeContent({ agent }: { agent: AgentProfile }) {
  // Get agent photo - the AgentProfile type uses 'photo' field
  const agentPhoto = agent?.photo || (agent as any)?.headshotUrl || (agent as any)?.photoUrl;
  
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-start gap-4 mb-4">
        {agentPhoto ? (
          <img 
            src={agentPhoto}
            alt={agent?.name || 'Agent'}
            className="w-16 h-16 rounded-full object-cover"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
              const fallback = e.currentTarget.nextElementSibling;
              if (fallback) (fallback as HTMLElement).classList.remove('hidden');
            }}
          />
        ) : null}
        <div className={`w-16 h-16 bg-zinc-200 rounded-full flex items-center justify-center ${agentPhoto ? 'hidden' : ''}`}>
          <User className="w-8 h-8 text-zinc-400" />
        </div>
        <div>
          <h2 className="font-bold text-lg text-[#222222]">{agent?.name || 'Agent Name'}</h2>
          <p className="text-sm text-zinc-600">{agent?.company || 'Spyglass Realty'}</p>
          {agent?.phone && <p className="text-sm text-zinc-500">{agent.phone}</p>}
          {agent?.email && <p className="text-sm text-zinc-500">{agent.email}</p>}
        </div>
      </div>
      <div className="flex-1">
        <h3 className="font-medium text-sm mb-2">About</h3>
        <p className="text-sm text-zinc-600 leading-relaxed">
          {agent?.bio || 'Agent bio will appear here. Update your profile to add your professional biography.'}
        </p>
      </div>
    </div>
  );
}

function VideoSlideContent({ title }: { title: string }) {
  // YouTube video ID for Listing with Spyglass Realty
  const youtubeVideoId = 'iB_u-ksW3ts';
  
  return (
    <div className="flex flex-col items-center justify-center h-full text-center">
      <div className="relative w-full max-w-md aspect-video">
        <img 
          src={`https://img.youtube.com/vi/${youtubeVideoId}/maxresdefault.jpg`}
          alt={title}
          className="w-full h-full object-cover rounded-lg"
          onError={(e) => {
            // Fallback to medium quality if maxres not available
            e.currentTarget.src = `https://img.youtube.com/vi/${youtubeVideoId}/hqdefault.jpg`;
          }}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="bg-[#EF4923] rounded-full p-3 shadow-lg">
            <Play className="w-6 h-6 text-white fill-white" />
          </div>
        </div>
      </div>
      <p className="font-medium text-zinc-700 mt-4">{title}</p>
      <p className="text-sm text-zinc-500 mt-1">Video presentation</p>
    </div>
  );
}

function TestimonialsContent() {
  const testimonials = [
    {
      quote: "Exceptional service from start to finish. They made the entire process seamless and stress-free.",
      author: "Happy Homeowner",
      source: "Google Review"
    },
    {
      quote: "Professional, knowledgeable, and always available. I couldn't have asked for a better team.",
      author: "Satisfied Seller",
      source: "Zillow Review"
    },
    {
      quote: "They sold our home in just 5 days for above asking price. Highly recommend!",
      author: "Austin Family",
      source: "Google Review"
    }
  ];

  return (
    <div className="flex flex-col h-full p-2">
      <div className="flex items-center gap-2 mb-3">
        <MessageSquare className="w-5 h-5 text-[#EF4923]" />
        <h2 className="font-bold text-sm text-[#222222]">CLIENT TESTIMONIALS</h2>
      </div>
      <p className="text-xs text-zinc-500 mb-3">What clients say about working with Spyglass Realty</p>
      
      <div className="flex-1 space-y-2 overflow-auto">
        {testimonials.map((testimonial, index) => (
          <div key={index} className="bg-zinc-50 rounded-lg p-3 relative">
            <div className="absolute -top-1 left-2 text-xl text-[#EF4923] font-serif">"</div>
            <p className="text-xs text-zinc-700 italic pl-4 pr-2 leading-relaxed">
              {testimonial.quote}
            </p>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-xs font-medium text-zinc-800">— {testimonial.author}</span>
              <span className="text-[10px] text-zinc-500">{testimonial.source}</span>
            </div>
          </div>
        ))}
      </div>
      
      <div className="text-center mt-2">
        <p className="text-[10px] text-zinc-400">
          View more at <span className="text-[#EF4923]">spyglassrealty.com/reviews</span>
        </p>
      </div>
    </div>
  );
}

function MarketingContent() {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="w-6 h-6 text-[#EF4923]" />
        <h2 className="font-bold text-lg text-[#222222]">MARKETING</h2>
      </div>
      <p className="text-sm text-zinc-600 leading-relaxed">{MARKETING_TEXT}</p>
    </div>
  );
}

function CompsContent({ comparables, stats }: { 
  comparables: CmaProperty[]; 
  stats: ReturnType<typeof calculateCMAStats>;
}) {
  return (
    <div className="flex flex-col h-full">
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="bg-zinc-50 p-3 rounded text-center">
          <p className="text-lg font-bold text-[#EF4923]">{comparables.length}</p>
          <p className="text-xs text-zinc-500">Properties</p>
        </div>
        <div className="bg-zinc-50 p-3 rounded text-center">
          <p className="text-lg font-bold text-[#222222]">{stats.avgPrice ? formatPrice(stats.avgPrice) : 'N/A'}</p>
          <p className="text-xs text-zinc-500">Avg Price</p>
        </div>
        <div className="bg-zinc-50 p-3 rounded text-center">
          <p className="text-lg font-bold text-[#222222]">{stats.avgDOM !== null ? `${Math.round(stats.avgDOM)} days` : 'N/A'}</p>
          <p className="text-xs text-zinc-500">Avg DOM</p>
        </div>
      </div>
      <div className="flex-1 overflow-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b">
              <th className="text-left py-1">Address</th>
              <th className="text-right py-1">Price</th>
              <th className="text-right py-1">Sq Ft</th>
              <th className="text-right py-1">Status</th>
            </tr>
          </thead>
          <tbody>
            {/* Show ALL comparables - no truncation for PDF compatibility */}
            {comparables.map((comp, i) => (
              <tr key={i} className="border-b border-zinc-100">
                <td className="py-1 truncate max-w-[120px]">{extractFullAddress(comp) || 'Unknown'}</td>
                <td className="text-right py-1">{formatPrice(extractPrice(comp))}</td>
                <td className="text-right py-1">{formatNumber(extractSqft(comp))}</td>
                <td className="text-right py-1">
                  <span 
                    className="px-1 py-0.5 rounded text-[10px]"
                    style={{ 
                      backgroundColor: getStatusColor(normalizeStatus(comp.status)) + '20',
                      color: getStatusColor(normalizeStatus(comp.status))
                    }}
                  >
                    {normalizeStatus(comp.status)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TimeToSellContent({ stats, averageDaysOnMarket }: { 
  stats: ReturnType<typeof calculateCMAStats>;
  averageDaysOnMarket?: number;
}) {
  const avgDays = averageDaysOnMarket ?? stats.avgDOM ?? 0;
  return (
    <div className="flex flex-col items-center justify-center h-full text-center">
      <Clock className="w-12 h-12 text-[#EF4923] mb-4" />
      <p className="text-3xl font-bold text-[#222222]">{Math.round(avgDays)}</p>
      <p className="text-lg text-zinc-600">Average Days on Market</p>
      <p className="text-sm text-zinc-400 mt-4">
        Based on {stats.avgDOM !== null ? 'comparable properties' : 'market data'}
      </p>
    </div>
  );
}

function SuggestedPriceContent({ stats, suggestedListPrice }: { 
  stats: ReturnType<typeof calculateCMAStats>;
  suggestedListPrice?: number | null;
}) {
  const price = suggestedListPrice ?? stats.avgPrice;
  return (
    <div className="flex flex-col items-center justify-center h-full text-center">
      <DollarSign className="w-12 h-12 text-[#EF4923] mb-4" />
      <p className="text-3xl font-bold text-[#222222]">{price ? formatPrice(price) : 'N/A'}</p>
      <p className="text-lg text-zinc-600">Suggested List Price</p>
      {stats.priceRange && stats.priceRange !== 'N/A' && (
        <p className="text-sm text-zinc-400 mt-4">
          Range: {stats.priceRange}
        </p>
      )}
    </div>
  );
}

function ListingActionPlanContent() {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 mb-4">
        <Calendar className="w-6 h-6 text-[#EF4923]" />
        <h2 className="font-bold text-lg text-[#222222]">LISTING ACTION PLAN</h2>
      </div>
      <p className="text-sm text-zinc-600 leading-relaxed whitespace-pre-line">{LISTING_ACTION_PLAN_TEXT}</p>
    </div>
  );
}

function SpyglassResourcesContent() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center">
      <Link className="w-12 h-12 text-[#EF4923] mb-4" />
      <p className="font-medium text-zinc-700">SPYGLASS RESOURCES AND LINKS</p>
      <p className="text-sm text-zinc-500 mt-2">Agent-managed resources for CMA presentations</p>
    </div>
  );
}

function AveragePriceAcreContent({ avgPricePerAcre, stats }: { 
  avgPricePerAcre?: number | null;
  stats: ReturnType<typeof calculateCMAStats>;
}) {
  const pricePerAcre = avgPricePerAcre ?? stats.avgPricePerAcre;
  return (
    <div className="flex flex-col items-center justify-center h-full text-center">
      <Ruler className="w-12 h-12 text-[#EF4923] mb-4" />
      <p className="text-3xl font-bold text-[#222222]">{pricePerAcre ? formatPrice(pricePerAcre) : 'N/A'}</p>
      <p className="text-lg text-zinc-600">Average Price per Acre</p>
    </div>
  );
}

function StaticSlideContent({ title, imagePath }: { title: string; imagePath: string }) {
  // Use the imagePath directly from widget constants for consistency with PDF
  return (
    <div className="relative w-full h-full flex items-center justify-center bg-white rounded overflow-hidden">
      <img 
        src={imagePath}
        alt={title}
        className="w-full h-full object-contain"
        onError={(e) => {
          // Show fallback on error
          e.currentTarget.style.display = 'none';
          const fallback = e.currentTarget.parentElement?.querySelector('.fallback');
          if (fallback) (fallback as HTMLElement).classList.remove('hidden');
        }}
      />
      <div className="fallback hidden absolute inset-0 flex flex-col items-center justify-center bg-zinc-50">
        <FileText className="w-12 h-12 text-zinc-400 mb-4" />
        <p className="font-medium text-zinc-700">{title}</p>
      </div>
    </div>
  );
}

function GenericSlideContent({ title }: { title: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center bg-zinc-50 rounded">
      <FileText className="w-12 h-12 text-zinc-400 mb-4" />
      <p className="font-medium text-zinc-700">{title}</p>
    </div>
  );
}

function PropertyDetailsContent({ property }: { property: CmaProperty }) {
  // Get property photo from Repliers API data
  const primaryPhoto = getPrimaryPhoto(property);
  
  return (
    <div className="flex flex-col h-full">
      {/* Property Photo from Repliers API */}
      <div className="h-24 rounded mb-3 overflow-hidden">
        {primaryPhoto ? (
          <img 
            src={primaryPhoto}
            alt={extractFullAddress(property) || 'Property'}
            className="w-full h-full object-cover"
            onError={(e) => {
              // Fallback to placeholder on error
              e.currentTarget.style.display = 'none';
              const fallback = e.currentTarget.parentElement?.querySelector('.fallback');
              if (fallback) (fallback as HTMLElement).classList.remove('hidden');
            }}
          />
        ) : null}
        <div className={`fallback ${primaryPhoto ? 'hidden' : ''} w-full h-full bg-zinc-100 flex items-center justify-center`}>
          <Building className="w-8 h-8 text-zinc-400" />
        </div>
      </div>
      <h3 className="font-medium text-sm mb-2">{extractFullAddress(property) || 'Property Address'}</h3>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <span className="text-zinc-500">Price:</span>
          <span className="ml-1 font-medium">{formatPrice(extractPrice(property))}</span>
        </div>
        <div>
          <span className="text-zinc-500">Sq Ft:</span>
          <span className="ml-1 font-medium">{formatNumber(extractSqft(property))}</span>
        </div>
        <div>
          <span className="text-zinc-500">Beds:</span>
          <span className="ml-1 font-medium">{extractBeds(property) ?? 'N/A'}</span>
        </div>
        <div>
          <span className="text-zinc-500">Baths:</span>
          <span className="ml-1 font-medium">{extractBaths(property) ?? 'N/A'}</span>
        </div>
        <div>
          <span className="text-zinc-500">DOM:</span>
          <span className="ml-1 font-medium">{extractDOM(property) ?? 'N/A'}</span>
        </div>
        <div>
          <span className="text-zinc-500">Status:</span>
          <span className="ml-1 font-medium">{normalizeStatus(property.status)}</span>
        </div>
      </div>
    </div>
  );
}
