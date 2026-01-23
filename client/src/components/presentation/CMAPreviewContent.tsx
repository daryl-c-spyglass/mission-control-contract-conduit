import type { CMAReportData } from "@shared/cma-sections";
import type { CoverPageConfig } from "@shared/schema";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface CMAPreviewContentProps {
  data: CMAReportData;
  includedSections: string[];
  sectionOrder: string[];
  coverPageConfig: CoverPageConfig;
  coverLetterOverride?: string;
}

const SPYGLASS_ORANGE = '#EF4923';
const SPYGLASS_NAVY = '#1a1a2e';

function formatPrice(price: number): string {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(price);
}

function formatNumber(num: number): string {
  return new Intl.NumberFormat('en-US').format(num);
}

function getStatusBg(status: string): string {
  const lower = status.toLowerCase();
  if (lower.includes('sold') || lower.includes('closed')) return 'bg-green-600';
  if (lower.includes('pending')) return 'bg-yellow-600';
  if (lower.includes('active')) return 'bg-[#EF4923]';
  return 'bg-gray-500';
}

function CoverPagePreview({ data, config }: { data: CMAReportData; config: CoverPageConfig }) {
  const { agent, subjectProperty, metadata } = data;
  const agentInitial = agent.firstName?.charAt(0) || 'A';

  return (
    <div 
      className="aspect-[8.5/11] rounded-lg flex flex-col items-center justify-center p-12 text-center"
      style={{ backgroundColor: SPYGLASS_NAVY }}
    >
      <p className="text-[#EF4923] font-semibold tracking-widest mb-8 text-sm">
        {agent.company || 'SPYGLASS REALTY'}
      </p>
      <h1 className="text-3xl font-bold text-white mb-4">
        {config.title || 'Comparative Market Analysis'}
      </h1>
      <p className="text-gray-400 mb-2">
        {config.subtitle || 'Prepared exclusively for you'}
      </p>
      {metadata.preparedFor && (
        <p className="text-lg font-medium text-white mb-4">{metadata.preparedFor}</p>
      )}
      <p className="text-xl font-semibold text-white mb-2">{subjectProperty.address}</p>
      <p className="text-gray-400 mb-6">
        {subjectProperty.city}, {subjectProperty.state} {subjectProperty.zip}
      </p>
      {config.showDate && (
        <p className="text-gray-400">{metadata.preparedDate}</p>
      )}
      {config.showAgentPhoto && (
        <div className="flex items-center gap-3 mt-8">
          {agent.photo ? (
            <img src={agent.photo} alt={agent.firstName} className="w-12 h-12 rounded-full object-cover border-2 border-[#EF4923]" />
          ) : (
            <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold text-lg" style={{ backgroundColor: SPYGLASS_ORANGE }}>
              {agentInitial}
            </div>
          )}
          <div className="text-left">
            <p className="text-white font-medium">{agent.firstName} {agent.lastName}</p>
            <p className="text-gray-400 text-sm">{agent.title}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function ListingBrochurePreview({ data }: { data: CMAReportData }) {
  const { subjectProperty, agent } = data;
  const mainPhoto = subjectProperty.photos?.[0];

  return (
    <Card className="p-6 aspect-[8.5/11]">
      <div className="flex justify-between items-start mb-4 pb-4 border-b-2" style={{ borderColor: SPYGLASS_ORANGE }}>
        <span className="font-semibold" style={{ color: SPYGLASS_ORANGE }}>{agent.company}</span>
        <div className="text-right text-sm text-muted-foreground">
          <p>MLS# {subjectProperty.mlsNumber}</p>
          <p>{subjectProperty.status}</p>
        </div>
      </div>
      {mainPhoto && (
        <img src={mainPhoto} alt={subjectProperty.address} className="w-full h-48 object-cover rounded-lg mb-4" />
      )}
      <h2 className="text-xl font-bold mb-1" style={{ color: SPYGLASS_NAVY }}>{subjectProperty.address}</h2>
      <p className="text-muted-foreground mb-2">{subjectProperty.city}, {subjectProperty.state} {subjectProperty.zip}</p>
      <p className="text-2xl font-bold mb-4" style={{ color: SPYGLASS_ORANGE }}>${formatPrice(subjectProperty.listPrice)}</p>
      <div className="flex gap-6 mb-4">
        <div className="text-center">
          <p className="text-lg font-semibold" style={{ color: SPYGLASS_NAVY }}>{subjectProperty.bedrooms || '-'}</p>
          <p className="text-xs text-muted-foreground">Beds</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-semibold" style={{ color: SPYGLASS_NAVY }}>{subjectProperty.bathrooms || '-'}</p>
          <p className="text-xs text-muted-foreground">Baths</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-semibold" style={{ color: SPYGLASS_NAVY }}>{subjectProperty.sqft ? formatNumber(subjectProperty.sqft) : '-'}</p>
          <p className="text-xs text-muted-foreground">Sq Ft</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-semibold" style={{ color: SPYGLASS_NAVY }}>{subjectProperty.yearBuilt || '-'}</p>
          <p className="text-xs text-muted-foreground">Year Built</p>
        </div>
      </div>
      {subjectProperty.description && (
        <p className="text-sm text-muted-foreground line-clamp-4">{subjectProperty.description}</p>
      )}
    </Card>
  );
}

function CoverLetterPreview({ data, customContent }: { data: CMAReportData; customContent?: string }) {
  const { agent, subjectProperty, metadata } = data;
  const agentName = `${agent.firstName} ${agent.lastName}`.trim();
  
  const defaultLetter = `Thank you for the opportunity to prepare this Comparative Market Analysis for your property at ${subjectProperty.address}.

This comprehensive report provides you with valuable insights into the current real estate market conditions in your area. I've carefully analyzed recent sales, active listings, and market trends to help you understand your property's position in today's market.

Looking forward to working with you.

Warm regards,
${agentName}`;

  const content = customContent || agent.coverLetter || defaultLetter;

  return (
    <Card className="p-8 aspect-[8.5/11]">
      <div className="flex justify-between mb-8">
        <span className="font-semibold" style={{ color: SPYGLASS_ORANGE }}>{agent.company}</span>
        <div className="text-right text-sm">
          <p style={{ color: SPYGLASS_NAVY }}>{agentName}</p>
          <p className="text-muted-foreground">{agent.title}</p>
          <p className="text-muted-foreground">{agent.phone}</p>
          <p className="text-muted-foreground">{agent.email}</p>
        </div>
      </div>
      <p className="text-sm text-muted-foreground mb-6">{metadata.preparedDate}</p>
      {metadata.preparedFor && (
        <p className="mb-4" style={{ color: SPYGLASS_NAVY }}>Dear {metadata.preparedFor},</p>
      )}
      <p className="text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground">{content}</p>
    </Card>
  );
}

function SummaryComparablesPreview({ data }: { data: CMAReportData }) {
  const { comparables, analysis, agent } = data;

  return (
    <Card className="p-6 aspect-[8.5/11] overflow-hidden">
      <div className="flex justify-between items-center mb-4 pb-3 border-b-2" style={{ borderColor: SPYGLASS_ORANGE }}>
        <h3 className="text-lg font-bold" style={{ color: SPYGLASS_NAVY }}>Summary of Comparables</h3>
        <span className="text-sm font-semibold" style={{ color: SPYGLASS_ORANGE }}>{agent.company}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b-2 bg-muted/50">
              <th className="text-left py-2 px-1 font-semibold" style={{ color: SPYGLASS_NAVY }}>Address</th>
              <th className="text-center py-2 px-1 font-semibold" style={{ color: SPYGLASS_NAVY }}>Status</th>
              <th className="text-right py-2 px-1 font-semibold" style={{ color: SPYGLASS_NAVY }}>Price</th>
              <th className="text-center py-2 px-1 font-semibold" style={{ color: SPYGLASS_NAVY }}>Bd</th>
              <th className="text-center py-2 px-1 font-semibold" style={{ color: SPYGLASS_NAVY }}>Ba</th>
              <th className="text-right py-2 px-1 font-semibold" style={{ color: SPYGLASS_NAVY }}>SqFt</th>
              <th className="text-right py-2 px-1 font-semibold" style={{ color: SPYGLASS_NAVY }}>$/SF</th>
            </tr>
          </thead>
          <tbody>
            {comparables.slice(0, 8).map((comp, idx) => (
              <tr key={idx} className="border-b">
                <td className="py-2 px-1 truncate max-w-[120px]">{comp.address}</td>
                <td className="py-2 px-1 text-center">
                  <Badge className={`text-[10px] ${getStatusBg(comp.status)}`}>{comp.status}</Badge>
                </td>
                <td className="py-2 px-1 text-right">${formatPrice(comp.soldPrice || comp.listPrice)}</td>
                <td className="py-2 px-1 text-center">{comp.bedrooms}</td>
                <td className="py-2 px-1 text-center">{comp.bathrooms}</td>
                <td className="py-2 px-1 text-right">{formatNumber(comp.sqft)}</td>
                <td className="py-2 px-1 text-right" style={{ color: SPYGLASS_ORANGE }}>${comp.pricePerSqft}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="grid grid-cols-4 gap-4 mt-6 p-4 bg-muted/50 rounded-lg">
        <div className="text-center">
          <p className="text-lg font-bold" style={{ color: SPYGLASS_ORANGE }}>${formatPrice(analysis.averagePrice)}</p>
          <p className="text-xs text-muted-foreground">Avg. Price</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-bold" style={{ color: SPYGLASS_NAVY }}>${analysis.averagePricePerSqft}</p>
          <p className="text-xs text-muted-foreground">Avg. $/SF</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-bold" style={{ color: SPYGLASS_NAVY }}>{analysis.averageDaysOnMarket}</p>
          <p className="text-xs text-muted-foreground">Avg. DOM</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-bold" style={{ color: SPYGLASS_NAVY }}>{comparables.length}</p>
          <p className="text-xs text-muted-foreground">Properties</p>
        </div>
      </div>
    </Card>
  );
}

function ContactMePreview({ data }: { data: CMAReportData }) {
  const { agent } = data;
  const agentInitial = agent.firstName?.charAt(0) || 'A';

  return (
    <Card className="p-8 aspect-[8.5/11] flex flex-col items-center justify-center text-center">
      <h2 className="text-2xl font-bold mb-8" style={{ color: SPYGLASS_NAVY }}>Let's Connect</h2>
      {agent.photo ? (
        <img src={agent.photo} alt={agent.firstName} className="w-24 h-24 rounded-full object-cover border-4 mb-6" style={{ borderColor: SPYGLASS_ORANGE }} />
      ) : (
        <div className="w-24 h-24 rounded-full flex items-center justify-center text-white font-bold text-3xl mb-6" style={{ backgroundColor: SPYGLASS_ORANGE }}>
          {agentInitial}
        </div>
      )}
      <p className="text-xl font-semibold" style={{ color: SPYGLASS_NAVY }}>{agent.firstName} {agent.lastName}</p>
      <p style={{ color: SPYGLASS_ORANGE }} className="mb-6">{agent.title}</p>
      {agent.phone && <p className="text-muted-foreground">Phone: <span style={{ color: SPYGLASS_NAVY }} className="font-medium">{agent.phone}</span></p>}
      {agent.email && <p className="text-muted-foreground">Email: <span style={{ color: SPYGLASS_NAVY }} className="font-medium">{agent.email}</span></p>}
      <div className="mt-8 pt-6 border-t w-full">
        <p className="font-semibold" style={{ color: SPYGLASS_ORANGE }}>{agent.company}</p>
        <p className="text-sm text-muted-foreground">Your trusted partner in real estate</p>
      </div>
    </Card>
  );
}

function ChapterHeaderPreview({ title, subtitle, company }: { title: string; subtitle?: string; company?: string }) {
  return (
    <Card className="aspect-[8.5/11] flex flex-col items-center justify-center text-center bg-muted/30">
      <div className="w-16 h-1 mb-6 rounded" style={{ backgroundColor: SPYGLASS_ORANGE }} />
      <h2 className="text-3xl font-bold mb-3" style={{ color: SPYGLASS_NAVY }}>{title}</h2>
      {subtitle && <p className="text-muted-foreground">{subtitle}</p>}
      <div className="w-16 h-1 mt-6 rounded" style={{ backgroundColor: SPYGLASS_ORANGE }} />
      {company && (
        <p className="mt-auto mb-8 text-sm font-semibold tracking-wider" style={{ color: SPYGLASS_ORANGE }}>{company}</p>
      )}
    </Card>
  );
}

export function CMAPreviewContent({
  data,
  includedSections,
  sectionOrder,
  coverPageConfig,
  coverLetterOverride,
}: CMAPreviewContentProps) {
  const orderedSections = sectionOrder.filter(id => includedSections.includes(id));

  const renderSection = (sectionId: string, index: number) => {
    switch (sectionId) {
      case 'cover_page':
        return <CoverPagePreview key={sectionId} data={data} config={coverPageConfig} />;
      case 'listing_brochure':
        return <ListingBrochurePreview key={sectionId} data={data} />;
      case 'cover_letter':
        return <CoverLetterPreview key={sectionId} data={data} customContent={coverLetterOverride} />;
      case 'contact_me':
        return <ContactMePreview key={sectionId} data={data} />;
      case 'summary_comparables':
        return <SummaryComparablesPreview key={sectionId} data={data} />;
      case 'listings_header':
        return <ChapterHeaderPreview key={sectionId} title="Comparable Listings" subtitle="Detailed view of each comparable property" company={data.agent.company} />;
      case 'analysis_header':
        return <ChapterHeaderPreview key={sectionId} title="Market Analysis" subtitle="Statistical analysis and market insights" company={data.agent.company} />;
      default:
        return (
          <Card key={sectionId} className="aspect-[8.5/11] flex items-center justify-center bg-muted/30">
            <p className="text-muted-foreground text-center p-4">
              {sectionId.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())} Preview
            </p>
          </Card>
        );
    }
  };

  return (
    <div className="space-y-6">
      {orderedSections.map((sectionId, index) => (
        <div key={sectionId} className="relative">
          <div className="absolute -left-6 top-2 text-xs text-muted-foreground font-mono">
            {index + 1}
          </div>
          {renderSection(sectionId, index)}
        </div>
      ))}
    </div>
  );
}
