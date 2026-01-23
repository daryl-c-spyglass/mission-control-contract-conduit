import { useState, useRef, useMemo } from "react";
import { useLocation } from "wouter";
import { Eye, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PreviewSection } from "./PreviewSection";
import { ExpandedPreviewModal } from "./ExpandedPreviewModal";
import { ZoomControls } from "./ZoomControls";
import { CMA_REPORT_SECTIONS, CmaSectionConfig } from "@shared/cma-sections";
import { CoverPagePreview } from "./preview-sections/CoverPagePreview";
import { SummaryComparablesPreview } from "./preview-sections/SummaryComparablesPreview";
import { AdjustmentsPreview } from "./preview-sections/AdjustmentsPreview";
import { PricePerSqftChartPreview } from "./preview-sections/PricePerSqftChartPreview";
import { PropertyPhotosPreview } from "./preview-sections/PropertyPhotosPreview";
import { PropertyDetailsPreview } from "./preview-sections/PropertyDetailsPreview";
import { CMAMapPreview } from "@/components/presentation/CMAMapPreview";
import { PDF_IMPLEMENTATION_STATUS } from "@/lib/cma-section-sources";
import type { PropertyForAdjustment } from "@/lib/adjustmentCalculations";

interface SectionSource {
  url: string;
  label: string;
}

const getSectionSource = (sectionId: string, transactionId?: string): SectionSource | null => {
  if (!transactionId) return null;
  
  const sources: Record<string, SectionSource> = {
    'cover_page': { url: `/transactions/${transactionId}?tab=mls-data`, label: 'MLS Data' },
    'listing_brochure': { url: `/transactions/${transactionId}?tab=mls-data`, label: 'MLS Data' },
    'agent_resume': { url: '/settings?tab=profile', label: 'Agent Profile' },
    'our_company': { url: '/settings?tab=profile', label: 'Company Profile' },
    'contact_me': { url: '/settings?tab=profile', label: 'Agent Profile' },
    'map_all_listings': { url: `/transactions/${transactionId}?tab=cma`, label: 'CMA Data' },
    'summary_comparables': { url: `/transactions/${transactionId}?tab=cma`, label: 'Comparables' },
    'property_details': { url: `/transactions/${transactionId}?tab=cma`, label: 'Comparables' },
    'property_photos': { url: `/transactions/${transactionId}?tab=mls-data`, label: 'MLS Photos' },
    'adjustments': { url: `/transactions/${transactionId}?tab=cma`, label: 'Adjustments' },
    'price_per_sqft': { url: `/transactions/${transactionId}?tab=cma`, label: 'Market Data' },
    'comparable_stats': { url: `/transactions/${transactionId}?tab=cma`, label: 'Market Data' },
  };
  
  return sources[sectionId] || null;
};

interface LivePreviewPanelProps {
  includedSections: string[];
  contentSettings: {
    title: string;
    subtitle: string;
    clientName?: string;
    showDate: boolean;
    showAgentPhoto: boolean;
    coverLetter?: string;
    salutationType?: string;
    customGreeting?: string;
  };
  layoutSettings: {
    coverPhotoUrl?: string | null;
    brochureUrl?: string;
    mapStyle: 'streets' | 'satellite';
    showMapPolygon: boolean;
  };
  subjectProperty: any;
  comparables: any[];
  agentProfile?: {
    name: string;
    title?: string;
    photo?: string;
    email?: string;
    phone?: string;
  };
  onSectionClick?: (sectionId: string) => void;
  transactionId?: string;
}

export function LivePreviewPanel({
  includedSections,
  contentSettings,
  layoutSettings,
  subjectProperty,
  comparables,
  agentProfile,
  onSectionClick,
  transactionId,
}: LivePreviewPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const [zoom, setZoom] = useState(100);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [, navigate] = useLocation();

  const sectionStats = useMemo(() => {
    const implemented = includedSections.filter(
      (id) => PDF_IMPLEMENTATION_STATUS[id] === true
    ).length;
    const previewOnly = includedSections.length - implemented;
    return { implemented, previewOnly };
  }, [includedSections]);
  
  const handleSourceClick = (url: string) => {
    navigate(url);
  };

  const enabledSections = CMA_REPORT_SECTIONS.filter(s => includedSections.includes(s.id));
  
  const allPhotos = [
    ...(subjectProperty?.photos || subjectProperty?.images || []),
    ...comparables.flatMap(c => c.photos || c.images || [])
  ].slice(0, 24);

  const subjectForAdjustments: PropertyForAdjustment = subjectProperty ? {
    address: subjectProperty.unparsedAddress || subjectProperty.streetAddress || '',
    livingArea: subjectProperty.livingArea || subjectProperty.sqft,
    bedroomsTotal: subjectProperty.bedroomsTotal || subjectProperty.beds,
    bathroomsTotal: subjectProperty.bathroomsTotal || subjectProperty.baths,
    listPrice: subjectProperty.listPrice,
  } : { address: '', livingArea: 0, bedroomsTotal: 0, bathroomsTotal: 0, listPrice: 0 };

  const comparablesForAdjustments: PropertyForAdjustment[] = comparables.map(c => ({
    address: c.unparsedAddress || c.streetAddress || c.address || '',
    livingArea: c.livingArea || c.sqft,
    bedroomsTotal: c.bedroomsTotal || c.beds,
    bathroomsTotal: c.bathroomsTotal || c.baths,
    listPrice: c.closePrice || c.soldPrice || c.listPrice,
  }));

  const renderSectionContent = (section: CmaSectionConfig, compact: boolean) => {
    switch (section.id) {
      case 'cover_page':
        return (
          <CoverPagePreview
            title={contentSettings.title}
            subtitle={contentSettings.subtitle}
            clientName={contentSettings.clientName}
            showDate={contentSettings.showDate}
            showAgentPhoto={contentSettings.showAgentPhoto}
            agentName={agentProfile?.name}
            agentPhoto={agentProfile?.photo}
            compact={compact}
          />
        );

      case 'listing_brochure':
        return layoutSettings.brochureUrl ? (
          <div className="flex justify-center">
            <img
              src={layoutSettings.brochureUrl}
              alt="Brochure"
              className={compact ? "max-h-32" : "max-h-64"}
            />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground italic text-center">
            No brochure uploaded
          </p>
        );

      case 'cover_letter':
        const getFullGreeting = () => {
          const isNoGreeting = contentSettings.salutationType === 'none';
          const isCustom = contentSettings.salutationType === 'custom';
          if (isNoGreeting) return '';
          if (isCustom) return contentSettings.customGreeting ? `${contentSettings.customGreeting},` : '';
          if (!contentSettings.salutationType && !contentSettings.clientName) return '';
          if (!contentSettings.clientName) return `${contentSettings.salutationType || 'Dear'},`;
          return `${contentSettings.salutationType || 'Dear'} ${contentSettings.clientName},`;
        };
        const greeting = getFullGreeting();
        return contentSettings.coverLetter ? (
          <div className="text-sm text-muted-foreground line-clamp-4 whitespace-pre-wrap">
            {greeting && (
              <p className="font-medium text-foreground mb-2">{greeting}</p>
            )}
            {contentSettings.coverLetter}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground italic">
            No cover letter set. Add one in Settings → Agent Profile → Default Cover Letter
          </p>
        );

      case 'agent_resume':
        return (
          <div className="flex items-start gap-3">
            {agentProfile?.photo && (
              <img
                src={agentProfile.photo}
                alt={agentProfile.name}
                className="w-12 h-12 rounded-full object-cover"
              />
            )}
            <div>
              <p className="font-medium">{agentProfile?.name || "Agent Name"}</p>
              <p className="text-sm text-muted-foreground">
                {agentProfile?.title || "Real Estate Agent"}
              </p>
            </div>
          </div>
        );

      case 'our_company':
        return (
          <div>
            <p className="font-medium text-[#F37216]">Spyglass Realty</p>
            <p className="text-sm text-muted-foreground">
              Company profile and information
            </p>
          </div>
        );

      case 'what_is_cma':
        return (
          <p className="text-sm text-muted-foreground">
            A Comparative Market Analysis (CMA) is a detailed report that helps determine the value of a property.
          </p>
        );

      case 'contact_me':
        return (
          <div className="text-sm space-y-1">
            <p>{agentProfile?.email || "agent@spyglassrealty.com"}</p>
            {agentProfile?.phone && <p>{agentProfile.phone}</p>}
          </div>
        );

      case 'map_all_listings':
        return (
          <CMAMapPreview
            subjectProperty={subjectProperty}
            comparables={comparables}
            compact={compact}
          />
        );

      case 'listings_header':
        return (
          <div className="border-l-4 border-[#F37216] pl-3 py-2">
            <p className="font-bold text-lg">Comparable Properties</p>
          </div>
        );

      case 'summary_comparables':
        return <SummaryComparablesPreview comparables={comparables} />;

      case 'property_details':
        return <PropertyDetailsPreview properties={comparables} compact={compact} />;

      case 'property_photos':
        return <PropertyPhotosPreview photos={allPhotos} compact={compact} />;

      case 'adjustments':
        return subjectProperty ? (
          <AdjustmentsPreview
            subjectProperty={subjectForAdjustments}
            comparables={comparablesForAdjustments}
            compact={compact}
          />
        ) : (
          <p className="text-sm text-muted-foreground italic">
            Subject property required for adjustments
          </p>
        );

      case 'analysis_header':
        return (
          <div className="border-l-4 border-[#F37216] pl-3 py-2">
            <p className="font-bold text-lg">Market Analysis</p>
          </div>
        );

      case 'online_valuation':
        return (
          <div>
            <p className="font-medium">Online Valuations vs. Actual Sale Prices</p>
            <p className="text-sm text-muted-foreground mt-1">
              Comparison of automated valuation models against actual closed sale prices.
            </p>
          </div>
        );

      case 'price_per_sqft':
        return <PricePerSqftChartPreview comparables={comparables} compact={compact} />;

      case 'comparable_stats':
        const avgPrice = comparables.length > 0
          ? comparables.reduce((sum, c) => sum + (c.closePrice || c.soldPrice || c.listPrice || 0), 0) / comparables.length
          : 0;
        const avgPricePerSqft = comparables.length > 0
          ? comparables.reduce((sum, c) => {
              const price = c.closePrice || c.soldPrice || c.listPrice || 0;
              const sqft = c.livingArea || c.sqft || 1;
              return sum + (price / sqft);
            }, 0) / comparables.length
          : 0;

        return (
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-muted/50 rounded-lg">
              <p className="text-xs text-muted-foreground">Average Price</p>
              <p className="font-bold text-lg">
                ${avgPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
            </div>
            <div className="p-3 bg-muted/50 rounded-lg">
              <p className="text-xs text-muted-foreground">Avg Price/SqFt</p>
              <p className="font-bold text-lg">${avgPricePerSqft.toFixed(0)}</p>
            </div>
          </div>
        );

      default:
        return (
          <p className="text-sm text-muted-foreground italic">
            Section preview not available
          </p>
        );
    }
  };

  const previewContent = (compact: boolean) => (
    <>
      {enabledSections.map((section) => {
        const source = getSectionSource(section.id, transactionId);
        return (
          <PreviewSection
            key={section.id}
            title={section.name}
            icon={section.icon}
            sectionId={section.id}
            onClick={onSectionClick}
            compact={compact}
            sourceUrl={source?.url}
            sourceLabel={source?.label}
            onSourceClick={handleSourceClick}
          >
            {renderSectionContent(section, compact)}
          </PreviewSection>
        );
      })}
    </>
  );

  return (
    <>
      {/* Main Preview Panel - FULL HEIGHT */}
      <div 
        className="bg-background rounded-lg border flex flex-col h-full"
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
      >
        {/* Fixed Header */}
        <div className="flex-shrink-0 flex items-center justify-between p-3 border-b bg-muted/30 gap-2">
          <div className="min-w-0">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <Eye className="w-4 h-4 flex-shrink-0" />
              <span className="truncate">Live Preview</span>
            </h3>
            <p className="text-xs text-muted-foreground truncate">
              {enabledSections.length} sections
              {sectionStats.previewOnly > 0 && (
                <span className="text-amber-600 dark:text-amber-400 ml-1">
                  ({sectionStats.previewOnly} preview only)
                </span>
              )}
            </p>
          </div>
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => setIsExpanded(true)}
            className="flex-shrink-0 touch-manipulation"
            title="Expand to full screen"
            data-testid="button-expand-preview"
          >
            <Maximize2 className="w-4 h-4" />
          </Button>
        </div>

        {/* Scrollable Preview Area - FILLS REMAINING HEIGHT */}
        <div 
          ref={scrollRef}
          className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain"
          style={{ 
            minHeight: 0,
            WebkitOverflowScrolling: 'touch',
          }}
        >
          <div 
            className="p-3 space-y-3 transition-transform duration-200 origin-top"
            style={{ transform: `scale(${zoom / 100})` }}
          >
            {previewContent(true)}
          </div>
          
          {/* Scroll indicator at bottom when content overflows */}
          {enabledSections.length > 3 && zoom === 100 && (
            <div className="sticky bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-background to-transparent pointer-events-none flex items-end justify-center pb-1">
              <span className="text-[10px] text-muted-foreground animate-pulse">
                Scroll for more sections
              </span>
            </div>
          )}
        </div>

        {/* Zoom Controls Footer */}
        <ZoomControls 
          zoom={zoom} 
          onZoomChange={setZoom}
          showSlider={true}
          showFitButton={false}
        />
      </div>

      {/* Expanded Modal */}
      <ExpandedPreviewModal 
        isOpen={isExpanded} 
        onClose={() => setIsExpanded(false)} 
        sectionsEnabled={enabledSections.length}
      >
        {previewContent(false)}
      </ExpandedPreviewModal>
    </>
  );
}
