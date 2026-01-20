import { Document } from '@react-pdf/renderer';
import type { CMAReportData, CmaSectionId } from '@shared/cma-sections';
import type { CoverPageConfig } from '@shared/schema';
import { CoverPageSection } from './CoverPageSection';
import { ListingBrochureSection } from './ListingBrochureSection';
import { CoverLetterSection } from './CoverLetterSection';
import { AgentResumeSection } from './AgentResumeSection';
import { OurCompanySection } from './OurCompanySection';
import { WhatIsCMASection } from './WhatIsCMASection';
import { ContactMeSection } from './ContactMeSection';
import { ChapterHeaderSection } from './ChapterHeaderSection';
import { SummaryComparablesSection } from './SummaryComparablesSection';
import { PropertyDetailsSection } from './PropertyDetailsSection';
import { ComparableStatsSection } from './ComparableStatsSection';

interface CMAPdfDocumentProps {
  data: CMAReportData;
  includedSections: string[];
  sectionOrder: string[];
  coverPageConfig: CoverPageConfig;
  coverLetterOverride?: string;
  agentResumeOverride?: string;
}

export function CMAPdfDocument({
  data,
  includedSections,
  sectionOrder,
  coverPageConfig,
  coverLetterOverride,
  agentResumeOverride,
}: CMAPdfDocumentProps) {
  const orderedSections = sectionOrder.filter(id => includedSections.includes(id));

  const renderSection = (sectionId: CmaSectionId) => {
    switch (sectionId) {
      case 'cover_page':
        return <CoverPageSection key={sectionId} data={data} config={coverPageConfig} />;
      
      case 'listing_brochure':
        return <ListingBrochureSection key={sectionId} data={data} />;
      
      case 'cover_letter':
        return <CoverLetterSection key={sectionId} data={data} customContent={coverLetterOverride} />;
      
      case 'agent_resume':
        return <AgentResumeSection key={sectionId} data={data} customBio={agentResumeOverride} />;
      
      case 'our_company':
        return <OurCompanySection key={sectionId} data={data} />;
      
      case 'what_is_cma':
        return <WhatIsCMASection key={sectionId} data={data} />;
      
      case 'contact_me':
        return <ContactMeSection key={sectionId} data={data} />;
      
      case 'map_all_listings':
        return (
          <ChapterHeaderSection 
            key={sectionId}
            title="Property Locations" 
            subtitle="Map view of subject property and comparable listings"
            company={data.agent.company}
          />
        );
      
      case 'summary_comparables':
        return <SummaryComparablesSection key={sectionId} data={data} />;
      
      case 'listings_header':
        return (
          <ChapterHeaderSection 
            key={sectionId}
            title="Comparable Listings" 
            subtitle="Detailed view of each comparable property"
            company={data.agent.company}
          />
        );
      
      case 'property_details':
        return data.comparables.map((comp, index) => (
          <PropertyDetailsSection 
            key={`${sectionId}-${index}`}
            property={comp} 
            index={index + 1}
            company={data.agent.company}
          />
        ));
      
      case 'property_photos':
        return null;
      
      case 'adjustments':
        return null;
      
      case 'analysis_header':
        return (
          <ChapterHeaderSection 
            key={sectionId}
            title="Market Analysis" 
            subtitle="Statistical analysis and market insights"
            company={data.agent.company}
          />
        );
      
      case 'online_valuation':
        return null;
      
      case 'price_per_sqft':
        return null;
      
      case 'comparable_stats':
        return <ComparableStatsSection key={sectionId} data={data} />;
      
      default:
        return null;
    }
  };

  return (
    <Document>
      {orderedSections.map(sectionId => renderSection(sectionId as CmaSectionId))}
    </Document>
  );
}

export { CoverPageSection } from './CoverPageSection';
export { ListingBrochureSection } from './ListingBrochureSection';
export { CoverLetterSection } from './CoverLetterSection';
export { AgentResumeSection } from './AgentResumeSection';
export { OurCompanySection } from './OurCompanySection';
export { WhatIsCMASection } from './WhatIsCMASection';
export { ContactMeSection } from './ContactMeSection';
export { ChapterHeaderSection } from './ChapterHeaderSection';
export { SummaryComparablesSection } from './SummaryComparablesSection';
export { PropertyDetailsSection } from './PropertyDetailsSection';
export { ComparableStatsSection } from './ComparableStatsSection';
