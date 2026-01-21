import { useState } from "react";
import { Eye, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PreviewSection } from "./PreviewSection";
import { ExpandedPreviewModal } from "./ExpandedPreviewModal";
import { CMA_REPORT_SECTIONS, CmaSectionConfig } from "@shared/cma-sections";
import { CoverPagePreview } from "./preview-sections/CoverPagePreview";
import { SummaryComparablesPreview } from "./preview-sections/SummaryComparablesPreview";
import { AdjustmentsPreview } from "./preview-sections/AdjustmentsPreview";
import { PricePerSqftChartPreview } from "./preview-sections/PricePerSqftChartPreview";
import { PropertyPhotosPreview } from "./preview-sections/PropertyPhotosPreview";
import { PropertyDetailsPreview } from "./preview-sections/PropertyDetailsPreview";
import type { PropertyForAdjustment } from "@/lib/adjustmentCalculations";

interface LivePreviewPanelProps {
  includedSections: string[];
  contentSettings: {
    title: string;
    subtitle: string;
    clientName?: string;
    showDate: boolean;
    showAgentPhoto: boolean;
    coverLetter?: string;
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
}

export function LivePreviewPanel({
  includedSections,
  contentSettings,
  layoutSettings,
  subjectProperty,
  comparables,
  agentProfile,
  onSectionClick,
}: LivePreviewPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);

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
        return (
          <p className="text-sm text-muted-foreground line-clamp-3">
            {contentSettings.coverLetter || "Your personalized cover letter will appear here..."}
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
          <div className="space-y-2">
            <div className="bg-muted rounded-lg h-32 flex items-center justify-center text-muted-foreground text-sm">
              Map Preview ({comparables.length} comparables + Subject)
            </div>
            <div className="flex gap-3 text-xs flex-wrap">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-blue-500"></span> Subject
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-green-500"></span> Active
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-orange-500"></span> Under Contract
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-red-500"></span> Sold
              </span>
            </div>
          </div>
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
      {enabledSections.map((section) => (
        <PreviewSection
          key={section.id}
          title={section.name}
          icon={section.icon}
          sectionId={section.id}
          onClick={onSectionClick}
          compact={compact}
        >
          {renderSectionContent(section, compact)}
        </PreviewSection>
      ))}
    </>
  );

  return (
    <>
      <div className="bg-background rounded-lg border p-4 sticky top-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <Eye className="w-4 h-4" />
              Live Preview
            </h3>
            <p className="text-xs text-muted-foreground">Preview how your CMA will appear</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
              {enabledSections.length} sections
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(true)}
              className="h-8 w-8 p-0"
              data-testid="button-expand-preview"
            >
              <Maximize2 className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <ScrollArea className="h-[500px]">
          <div className="space-y-3 pr-2">
            {previewContent(true)}
          </div>
        </ScrollArea>
      </div>

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
