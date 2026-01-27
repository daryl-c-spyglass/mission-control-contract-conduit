import { Document, Page, View, Text } from '@react-pdf/renderer';
import { styles, COLORS } from './styles';
import type { AgentProfile, CmaProperty } from '../types';
import { WIDGETS, MARKETING_TEXT } from '../constants/widgets';
import {
  extractPrice,
  extractSqft,
  extractDOM,
  extractLotAcres,
  extractBeds,
  extractBaths,
  calculatePricePerSqft,
  calculatePricePerAcre,
  calculateCMAStats,
  formatPrice,
  formatNumber,
  getStatusColor,
  normalizeStatus,
} from '@/lib/cma-data-utils';

interface CmaPdfDocumentProps {
  propertyAddress: string;
  agent: AgentProfile;
  comparables: CmaProperty[];
  subjectProperty?: CmaProperty;
  averageDaysOnMarket?: number;
  suggestedListPrice?: number | null;
  avgPricePerAcre?: number | null;
  preparedFor?: string;
}

const PageHeader = ({ title, slideNumber, totalSlides }: { title: string; slideNumber: number; totalSlides: number }) => (
  <View style={styles.header}>
    <Text style={styles.headerTitle}>{title}</Text>
    <Text style={styles.headerSlide}>Slide {slideNumber} of {totalSlides}</Text>
  </View>
);

const PageFooter = ({ propertyAddress }: { propertyAddress: string }) => (
  <View style={styles.footer}>
    <Text style={styles.footerText}>{propertyAddress}</Text>
    <Text style={styles.footerText}>Spyglass Realty</Text>
  </View>
);

const CoverPage = ({ propertyAddress, agent, preparedFor }: { propertyAddress: string; agent: AgentProfile; preparedFor?: string }) => (
  <Page size="LETTER" orientation="landscape" style={styles.darkPage}>
    <View style={styles.coverPage}>
      <Text style={{ color: COLORS.white, fontSize: 28, fontWeight: 700, marginBottom: 20 }}>SPYGLASS REALTY</Text>
      <Text style={styles.coverTitle}>Comparative Market Analysis</Text>
      {preparedFor && (
        <Text style={styles.coverSubtitle}>Prepared for {preparedFor}</Text>
      )}
      <Text style={styles.coverAddress}>{propertyAddress}</Text>
      <Text style={styles.coverDate}>{new Date().toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      })}</Text>
      <View style={{ marginTop: 30, alignItems: 'center' }}>
        <Text style={{ color: COLORS.mediumGray, fontSize: 10 }}>Prepared by</Text>
        <Text style={{ color: COLORS.white, fontSize: 14, fontWeight: 600, marginTop: 5 }}>{agent.name}</Text>
        <Text style={{ color: COLORS.spyglassOrange, fontSize: 12 }}>{agent.company || 'Spyglass Realty'}</Text>
      </View>
    </View>
  </Page>
);

const AgentResumePage = ({ agent, slideNumber, totalSlides }: { agent: AgentProfile; slideNumber: number; totalSlides: number }) => (
  <Page size="LETTER" orientation="landscape" style={styles.page}>
    <PageHeader title="AGENT RESUME" slideNumber={slideNumber} totalSlides={totalSlides} />
    <View style={styles.content}>
      <View style={styles.agentCard}>
        <View style={styles.agentInfo}>
          <Text style={styles.agentName}>{agent.name}</Text>
          <Text style={styles.agentCompany}>{agent.company || 'Spyglass Realty'}</Text>
          {agent.phone && <Text style={styles.agentContact}>Phone: {agent.phone}</Text>}
          {agent.email && <Text style={styles.agentContact}>Email: {agent.email}</Text>}
        </View>
      </View>
      {agent.bio && (
        <View>
          <Text style={styles.sectionTitle}>About Me</Text>
          <Text style={styles.agentBio}>{agent.bio}</Text>
        </View>
      )}
    </View>
    <PageFooter propertyAddress="" />
  </Page>
);

const ComparablesSummaryPage = ({ 
  comparables, 
  propertyAddress,
  slideNumber, 
  totalSlides 
}: { 
  comparables: CmaProperty[]; 
  propertyAddress: string;
  slideNumber: number; 
  totalSlides: number;
}) => {
  const stats = calculateCMAStats(comparables);
  
  return (
    <Page size="LETTER" orientation="landscape" style={styles.page}>
      <PageHeader title="COMPARABLE PROPERTIES" slideNumber={slideNumber} totalSlides={totalSlides} />
      <View style={styles.content}>
        <Text style={styles.sectionTitle}>Summary of Comparables</Text>
        <Text style={styles.sectionSubtitle}>{comparables.length} properties analyzed in the surrounding area</Text>
        
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{formatPrice(stats.avgPrice)}</Text>
            <Text style={styles.statLabel}>Average Price</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.avgPricePerSqft ? `$${stats.avgPricePerSqft}/sqft` : 'N/A'}</Text>
            <Text style={styles.statLabel}>Avg Price/Sq Ft</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.avgDOM != null ? `${stats.avgDOM} days` : 'N/A'}</Text>
            <Text style={styles.statLabel}>Avg Days on Market</Text>
          </View>
        </View>
        
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Address</Text>
            <Text style={styles.tableHeaderCell}>Price</Text>
            <Text style={styles.tableHeaderCell}>Beds/Baths</Text>
            <Text style={styles.tableHeaderCell}>Sq Ft</Text>
            <Text style={styles.tableHeaderCell}>$/Sq Ft</Text>
            <Text style={styles.tableHeaderCell}>Status</Text>
            <Text style={styles.tableHeaderCell}>DOM</Text>
          </View>
          {comparables.slice(0, 6).map((comp, i) => {
            const price = extractPrice(comp);
            const sqft = extractSqft(comp);
            const pricePerSqft = calculatePricePerSqft(comp);
            const dom = extractDOM(comp);
            const beds = extractBeds(comp);
            const baths = extractBaths(comp);
            const status = normalizeStatus(comp.status);
            const address = extractFullAddress(comp);
            
            return (
              <View key={comp.id || i} style={[styles.tableRow, i % 2 === 1 ? styles.tableRowAlt : {}]}>
                <Text style={[styles.tableCell, { flex: 2 }]}>{address}</Text>
                <Text style={styles.tableCell}>{formatPrice(price)}</Text>
                <Text style={styles.tableCell}>{beds}/{baths}</Text>
                <Text style={styles.tableCell}>{formatNumber(sqft)}</Text>
                <Text style={styles.tableCell}>{pricePerSqft ? `$${pricePerSqft}` : 'N/A'}</Text>
                <Text style={[styles.tableCell, { color: getStatusColor(status) }]}>{status}</Text>
                <Text style={styles.tableCell}>{dom != null ? dom : 'N/A'}</Text>
              </View>
            );
          })}
        </View>
      </View>
      <PageFooter propertyAddress={propertyAddress} />
    </Page>
  );
};

const PropertyDetailPage = ({ 
  property, 
  propertyAddress,
  slideNumber, 
  totalSlides 
}: { 
  property: CmaProperty; 
  propertyAddress: string;
  slideNumber: number; 
  totalSlides: number;
}) => {
  const price = extractPrice(property);
  const sqft = extractSqft(property);
  const pricePerSqft = calculatePricePerSqft(property);
  const dom = extractDOM(property);
  const beds = extractBeds(property);
  const baths = extractBaths(property);
  const status = normalizeStatus(property.status);
  
  return (
    <Page size="LETTER" orientation="landscape" style={styles.page}>
      <PageHeader title="PROPERTY DETAILS" slideNumber={slideNumber} totalSlides={totalSlides} />
      <View style={styles.content}>
        <View style={{ flexDirection: 'row', gap: 30 }}>
          <View style={{ flex: 1 }}>
            <Text style={styles.propertyAddress}>{extractFullAddress(property)}</Text>
            <Text style={{ fontSize: 10, color: COLORS.textSecondary, marginBottom: 10 }}>
              {[property.city, property.state, property.zipCode].filter(Boolean).join(', ') || 'Location information unavailable'}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.propertyPrice}>{formatPrice(price)}</Text>
            <View style={[styles.badge, { backgroundColor: getStatusColor(status), marginBottom: 15, alignSelf: 'flex-start' }]}>
              <Text style={styles.badgeText}>{status}</Text>
            </View>
            
            <View style={{ marginTop: 10 }}>
              <View style={{ flexDirection: 'row', marginBottom: 8 }}>
                <Text style={{ fontSize: 11, color: COLORS.textSecondary, width: 100 }}>Bedrooms:</Text>
                <Text style={{ fontSize: 11, color: COLORS.textPrimary, fontWeight: 600 }}>{beds}</Text>
              </View>
              <View style={{ flexDirection: 'row', marginBottom: 8 }}>
                <Text style={{ fontSize: 11, color: COLORS.textSecondary, width: 100 }}>Bathrooms:</Text>
                <Text style={{ fontSize: 11, color: COLORS.textPrimary, fontWeight: 600 }}>{baths}</Text>
              </View>
              <View style={{ flexDirection: 'row', marginBottom: 8 }}>
                <Text style={{ fontSize: 11, color: COLORS.textSecondary, width: 100 }}>Square Feet:</Text>
                <Text style={{ fontSize: 11, color: COLORS.textPrimary, fontWeight: 600 }}>{formatNumber(sqft)}</Text>
              </View>
              <View style={{ flexDirection: 'row', marginBottom: 8 }}>
                <Text style={{ fontSize: 11, color: COLORS.textSecondary, width: 100 }}>Price/Sq Ft:</Text>
                <Text style={{ fontSize: 11, color: COLORS.textPrimary, fontWeight: 600 }}>{pricePerSqft ? `$${pricePerSqft}` : 'N/A'}</Text>
              </View>
              <View style={{ flexDirection: 'row', marginBottom: 8 }}>
                <Text style={{ fontSize: 11, color: COLORS.textSecondary, width: 100 }}>Days on Market:</Text>
                <Text style={{ fontSize: 11, color: COLORS.textPrimary, fontWeight: 600 }}>{dom != null ? dom : 'N/A'}</Text>
              </View>
              {property.yearBuilt && (
                <View style={{ flexDirection: 'row', marginBottom: 8 }}>
                  <Text style={{ fontSize: 11, color: COLORS.textSecondary, width: 100 }}>Year Built:</Text>
                  <Text style={{ fontSize: 11, color: COLORS.textPrimary, fontWeight: 600 }}>{property.yearBuilt}</Text>
                </View>
              )}
            </View>
          </View>
        </View>
      </View>
      <PageFooter propertyAddress={propertyAddress} />
    </Page>
  );
};

const TimeToSellPage = ({ 
  averageDaysOnMarket, 
  comparables,
  propertyAddress,
  slideNumber, 
  totalSlides 
}: { 
  averageDaysOnMarket: number;
  comparables: CmaProperty[];
  propertyAddress: string;
  slideNumber: number; 
  totalSlides: number;
}) => {
  const stats = calculateCMAStats(comparables);
  const avgDom = averageDaysOnMarket || stats.avgDOM || 0;
  
  const domValues = comparables.map(c => extractDOM(c)).filter((d): d is number => d !== null && d > 0);
  const maxDom = domValues.length > 0 ? Math.max(...domValues) : 1;
  
  return (
    <Page size="LETTER" orientation="landscape" style={styles.page}>
      <PageHeader title="TIME TO SELL" slideNumber={slideNumber} totalSlides={totalSlides} />
      <View style={styles.content}>
        <Text style={styles.sectionTitle}>Average Days on Market</Text>
        <View style={{ alignItems: 'center', marginVertical: 30 }}>
          <Text style={{ fontSize: 64, fontWeight: 700, color: COLORS.spyglassOrange }}>
            {avgDom > 0 ? Math.round(avgDom) : 'N/A'}
          </Text>
          <Text style={{ fontSize: 16, color: COLORS.textSecondary }}>days average</Text>
        </View>
        
        <Text style={{ fontSize: 12, fontWeight: 600, marginBottom: 15 }}>Days on Market by Property</Text>
        {comparables.slice(0, 5).map((comp, i) => {
          const dom = extractDOM(comp);
          const barWidth = dom != null && maxDom > 0 ? Math.min(100, (dom / maxDom) * 100) : 0;
          const address = extractFullAddress(comp);
          
          return (
            <View key={i} style={{ marginBottom: 12 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                <Text style={{ fontSize: 9, color: COLORS.textSecondary }}>{address}</Text>
                <Text style={{ fontSize: 9, fontWeight: 600 }}>{dom != null ? `${dom} days` : 'N/A'}</Text>
              </View>
              <View style={{ height: 12, backgroundColor: COLORS.lightGray, borderRadius: 6 }}>
                <View style={{ 
                  height: 12, 
                  width: `${barWidth}%`, 
                  backgroundColor: COLORS.spyglassOrange, 
                  borderRadius: 6 
                }} />
              </View>
            </View>
          );
        })}
      </View>
      <PageFooter propertyAddress={propertyAddress} />
    </Page>
  );
};

const SuggestedPricePage = ({ 
  suggestedListPrice,
  comparables,
  propertyAddress,
  slideNumber, 
  totalSlides 
}: { 
  suggestedListPrice: number | null | undefined;
  comparables: CmaProperty[];
  propertyAddress: string;
  slideNumber: number; 
  totalSlides: number;
}) => {
  const stats = calculateCMAStats(comparables);
  const price = suggestedListPrice || stats.avgPrice || 0;
  const hasValidPrice = price > 0;
  const lowPrice = hasValidPrice ? Math.round(price * 0.95) : null;
  const highPrice = hasValidPrice ? Math.round(price * 1.05) : null;
  
  return (
    <Page size="LETTER" orientation="landscape" style={styles.page}>
      <PageHeader title="SUGGESTED LIST PRICE" slideNumber={slideNumber} totalSlides={totalSlides} />
      <View style={styles.content}>
        <Text style={styles.sectionTitle}>Recommended Listing Price</Text>
        <Text style={styles.sectionSubtitle}>Based on {comparables.length} comparable properties</Text>
        
        <View style={{ alignItems: 'center', marginVertical: 40 }}>
          <Text style={{ fontSize: 14, color: COLORS.textSecondary, marginBottom: 10 }}>Suggested Price Range</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 20 }}>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontSize: 12, color: COLORS.textSecondary }}>Low</Text>
              <Text style={{ fontSize: 20, fontWeight: 600, color: COLORS.textPrimary }}>{formatPrice(lowPrice)}</Text>
            </View>
            <Text style={{ fontSize: 24, color: COLORS.mediumGray }}>—</Text>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontSize: 48, fontWeight: 700, color: COLORS.spyglassOrange }}>{hasValidPrice ? formatPrice(price) : 'N/A'}</Text>
              <Text style={{ fontSize: 12, color: COLORS.textSecondary }}>Recommended</Text>
            </View>
            <Text style={{ fontSize: 24, color: COLORS.mediumGray }}>—</Text>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontSize: 12, color: COLORS.textSecondary }}>High</Text>
              <Text style={{ fontSize: 20, fontWeight: 600, color: COLORS.textPrimary }}>{formatPrice(highPrice)}</Text>
            </View>
          </View>
        </View>
        
        <View style={{ backgroundColor: COLORS.lightGray, padding: 20, borderRadius: 8, marginTop: 20 }}>
          <Text style={{ fontSize: 12, fontWeight: 600, marginBottom: 10 }}>Price Analysis</Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontSize: 10, color: COLORS.textSecondary }}>Avg $/Sq Ft</Text>
              <Text style={{ fontSize: 14, fontWeight: 600 }}>{stats.avgPricePerSqft ? `$${stats.avgPricePerSqft}` : 'N/A'}</Text>
            </View>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontSize: 10, color: COLORS.textSecondary }}>Price Range</Text>
              <Text style={{ fontSize: 14, fontWeight: 600 }}>{stats.priceRange}</Text>
            </View>
          </View>
        </View>
      </View>
      <PageFooter propertyAddress={propertyAddress} />
    </Page>
  );
};

const AveragePricePerAcrePage = ({ 
  avgPricePerAcre,
  comparables,
  propertyAddress,
  slideNumber, 
  totalSlides 
}: { 
  avgPricePerAcre: number | null | undefined;
  comparables: CmaProperty[];
  propertyAddress: string;
  slideNumber: number; 
  totalSlides: number;
}) => {
  const propsWithAcreData = comparables
    .map(c => ({
      ...c,
      acres: extractLotAcres(c),
      pricePerAcreCalc: calculatePricePerAcre(c),
    }))
    .filter(c => c.acres !== null && c.acres > 0);
  
  const stats = calculateCMAStats(comparables);
  const avgPrice = avgPricePerAcre || stats.avgPricePerAcre || 0;
  const hasValidData = avgPrice > 0;
  
  return (
    <Page size="LETTER" orientation="landscape" style={styles.page}>
      <PageHeader title="AVERAGE PRICE PER ACRE" slideNumber={slideNumber} totalSlides={totalSlides} />
      <View style={styles.content}>
        <Text style={styles.sectionTitle}>Land Value Analysis</Text>
        
        <View style={{ alignItems: 'center', marginVertical: 40 }}>
          <Text style={{ fontSize: 48, fontWeight: 700, color: COLORS.spyglassOrange }}>
            {hasValidData ? formatPrice(avgPrice) : 'N/A'}
          </Text>
          <Text style={{ fontSize: 16, color: COLORS.textSecondary }}>per acre (average)</Text>
        </View>
        
        {propsWithAcreData.length > 0 && (
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Property</Text>
              <Text style={styles.tableHeaderCell}>Lot Size (acres)</Text>
              <Text style={styles.tableHeaderCell}>Price/Acre</Text>
            </View>
            {propsWithAcreData.slice(0, 5).map((comp, i) => (
              <View key={comp.id || i} style={[styles.tableRow, i % 2 === 1 ? styles.tableRowAlt : {}]}>
                <Text style={[styles.tableCell, { flex: 2 }]}>{extractFullAddress(comp)}</Text>
                <Text style={styles.tableCell}>{comp.acres?.toFixed(2) || 'N/A'}</Text>
                <Text style={styles.tableCell}>{comp.pricePerAcreCalc ? formatPrice(comp.pricePerAcreCalc) : 'N/A'}</Text>
              </View>
            ))}
          </View>
        )}
        
        {propsWithAcreData.length === 0 && (
          <View style={{ alignItems: 'center', padding: 20 }}>
            <Text style={{ fontSize: 12, color: COLORS.textSecondary }}>
              Lot size data not available for comparable properties
            </Text>
          </View>
        )}
      </View>
      <PageFooter propertyAddress={propertyAddress} />
    </Page>
  );
};

const ListingActionPlanPage = ({ 
  propertyAddress,
  slideNumber, 
  totalSlides 
}: { 
  propertyAddress: string;
  slideNumber: number; 
  totalSlides: number;
}) => {
  const steps = [
    'Pre-listing appointment',
    'Staging Consultation',
    'Pricing analysis',
    'Listing preparation',
    'Marketing period',
    'Offer & negotiation',
    'Contingency period',
    'Closing',
  ];
  
  return (
    <Page size="LETTER" orientation="landscape" style={styles.page}>
      <PageHeader title="LISTING ACTION PLAN" slideNumber={slideNumber} totalSlides={totalSlides} />
      <View style={styles.content}>
        <Text style={styles.sectionTitle}>What's Next?</Text>
        <Text style={styles.sectionSubtitle}>Keeping you on top of the process</Text>
        
        <Text style={{ fontSize: 11, color: COLORS.textSecondary, lineHeight: 1.6, marginBottom: 25 }}>
          Once we have negotiated and agreed to the terms on the contract, our next goal is to manage 
          each and every step of the process to ensure your property closes successfully.
        </Text>
        
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {steps.map((step, i) => (
            <View key={i} style={{ width: '50%', flexDirection: 'row', alignItems: 'center', marginBottom: 15, paddingRight: 20 }}>
              <View style={{ 
                width: 28, 
                height: 28, 
                borderRadius: 14, 
                backgroundColor: COLORS.spyglassOrange, 
                alignItems: 'center', 
                justifyContent: 'center',
                marginRight: 12 
              }}>
                <Text style={{ color: COLORS.white, fontSize: 12, fontWeight: 600 }}>{i + 1}</Text>
              </View>
              <Text style={{ fontSize: 11, color: COLORS.textPrimary }}>{step}</Text>
            </View>
          ))}
        </View>
      </View>
      <PageFooter propertyAddress={propertyAddress} />
    </Page>
  );
};

const MarketingPage = ({ 
  propertyAddress,
  slideNumber, 
  totalSlides 
}: { 
  propertyAddress: string;
  slideNumber: number; 
  totalSlides: number;
}) => (
  <Page size="LETTER" orientation="landscape" style={styles.page}>
    <PageHeader title="MARKETING" slideNumber={slideNumber} totalSlides={totalSlides} />
    <View style={styles.content}>
      <Text style={styles.sectionTitle}>Where Are Homebuyers Looking?</Text>
      <Text style={{ fontSize: 11, color: COLORS.textSecondary, lineHeight: 1.6, marginBottom: 25 }}>
        {MARKETING_TEXT}
      </Text>
      
      <View style={{ flexDirection: 'row', gap: 20, marginTop: 20 }}>
        <View style={{ flex: 1, backgroundColor: COLORS.lightGray, padding: 20, borderRadius: 8 }}>
          <Text style={{ fontSize: 14, fontWeight: 700, marginBottom: 10, color: COLORS.spyglassOrange }}>Digital Marketing</Text>
          <Text style={{ fontSize: 10, color: COLORS.textSecondary, lineHeight: 1.5 }}>
            Professional photography, virtual tours, social media campaigns, targeted ads
          </Text>
        </View>
        <View style={{ flex: 1, backgroundColor: COLORS.lightGray, padding: 20, borderRadius: 8 }}>
          <Text style={{ fontSize: 14, fontWeight: 700, marginBottom: 10, color: COLORS.spyglassOrange }}>Traditional Marketing</Text>
          <Text style={{ fontSize: 10, color: COLORS.textSecondary, lineHeight: 1.5 }}>
            Print flyers, signage, open houses, broker outreach, direct mail
          </Text>
        </View>
        <View style={{ flex: 1, backgroundColor: COLORS.lightGray, padding: 20, borderRadius: 8 }}>
          <Text style={{ fontSize: 14, fontWeight: 700, marginBottom: 10, color: COLORS.spyglassOrange }}>MLS & Syndication</Text>
          <Text style={{ fontSize: 10, color: COLORS.textSecondary, lineHeight: 1.5 }}>
            MLS listing, Zillow, Realtor.com, Redfin, international portals
          </Text>
        </View>
      </View>
    </View>
    <PageFooter propertyAddress={propertyAddress} />
  </Page>
);

const ClientTestimonialsPage = ({ 
  propertyAddress,
  slideNumber, 
  totalSlides 
}: { 
  propertyAddress: string;
  slideNumber: number; 
  totalSlides: number;
}) => (
  <Page size="LETTER" orientation="landscape" style={styles.page}>
    <PageHeader title="CLIENT TESTIMONIALS" slideNumber={slideNumber} totalSlides={totalSlides} />
    <View style={styles.content}>
      <Text style={styles.sectionTitle}>What Our Clients Say</Text>
      <Text style={styles.sectionSubtitle}>Real feedback from satisfied homeowners</Text>
      
      <View style={{ flexDirection: 'row', gap: 20, marginTop: 20 }}>
        <View style={{ flex: 1, backgroundColor: COLORS.lightGray, padding: 20, borderRadius: 8 }}>
          <Text style={{ fontSize: 24, color: COLORS.spyglassOrange, fontWeight: 700, marginBottom: 10 }}>"</Text>
          <Text style={{ fontSize: 11, color: COLORS.textSecondary, lineHeight: 1.6, fontStyle: 'italic' }}>
            Exceptional service from start to finish. They made the entire process seamless and stress-free.
          </Text>
          <Text style={{ fontSize: 10, fontWeight: 600, marginTop: 15, color: COLORS.textPrimary }}>— Happy Homeowner</Text>
        </View>
        <View style={{ flex: 1, backgroundColor: COLORS.lightGray, padding: 20, borderRadius: 8 }}>
          <Text style={{ fontSize: 24, color: COLORS.spyglassOrange, fontWeight: 700, marginBottom: 10 }}>"</Text>
          <Text style={{ fontSize: 11, color: COLORS.textSecondary, lineHeight: 1.6, fontStyle: 'italic' }}>
            Professional, knowledgeable, and always available. I couldn't have asked for a better team.
          </Text>
          <Text style={{ fontSize: 10, fontWeight: 600, marginTop: 15, color: COLORS.textPrimary }}>— Satisfied Seller</Text>
        </View>
      </View>
      
      <View style={{ marginTop: 30, alignItems: 'center' }}>
        <Text style={{ fontSize: 12, color: COLORS.textSecondary }}>View more testimonials at</Text>
        <Text style={{ fontSize: 12, color: COLORS.spyglassOrange, fontWeight: 600 }}>spyglassrealty.com/reviews</Text>
      </View>
    </View>
    <PageFooter propertyAddress={propertyAddress} />
  </Page>
);

const ListingWithSpyglassPage = ({ 
  agent,
  propertyAddress,
  slideNumber, 
  totalSlides 
}: { 
  agent: AgentProfile;
  propertyAddress: string;
  slideNumber: number; 
  totalSlides: number;
}) => (
  <Page size="LETTER" orientation="landscape" style={styles.page}>
    <PageHeader title="LISTING WITH SPYGLASS REALTY" slideNumber={slideNumber} totalSlides={totalSlides} />
    <View style={styles.content}>
      <Text style={styles.sectionTitle}>Why List With Spyglass Realty?</Text>
      
      <View style={{ flexDirection: 'row', gap: 30, marginTop: 20 }}>
        <View style={{ flex: 1 }}>
          <View style={{ marginBottom: 20 }}>
            <View style={styles.listItem}>
              <View style={styles.listBullet} />
              <Text style={styles.listText}>Award-winning marketing strategy designed to sell your home quickly</Text>
            </View>
            <View style={styles.listItem}>
              <View style={styles.listBullet} />
              <Text style={styles.listText}>Professional photography, videography, and aerial drone footage</Text>
            </View>
            <View style={styles.listItem}>
              <View style={styles.listBullet} />
              <Text style={styles.listText}>Maximum exposure across MLS, Zillow, Realtor.com, and more</Text>
            </View>
            <View style={styles.listItem}>
              <View style={styles.listBullet} />
              <Text style={styles.listText}>Dedicated transaction coordination from contract to close</Text>
            </View>
            <View style={styles.listItem}>
              <View style={styles.listBullet} />
              <Text style={styles.listText}>Proven negotiation strategies to maximize your sale price</Text>
            </View>
          </View>
        </View>
        <View style={{ flex: 1, backgroundColor: COLORS.darkBackground, padding: 25, borderRadius: 8, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 14, color: COLORS.white, textAlign: 'center', marginBottom: 15 }}>Watch our introduction video</Text>
          <Text style={{ fontSize: 11, color: COLORS.mediumGray, textAlign: 'center' }}>Scan the QR code or visit our website</Text>
          <Text style={{ fontSize: 12, color: COLORS.spyglassOrange, marginTop: 10, fontWeight: 600 }}>spyglassrealty.com</Text>
        </View>
      </View>
    </View>
    <PageFooter propertyAddress={propertyAddress} />
  </Page>
);

const SpyglassResourcesPage = ({ 
  propertyAddress,
  slideNumber, 
  totalSlides 
}: { 
  propertyAddress: string;
  slideNumber: number; 
  totalSlides: number;
}) => (
  <Page size="LETTER" orientation="landscape" style={styles.page}>
    <PageHeader title="SPYGLASS RESOURCES AND LINKS" slideNumber={slideNumber} totalSlides={totalSlides} />
    <View style={styles.content}>
      <Text style={styles.sectionTitle}>Helpful Resources</Text>
      <Text style={styles.sectionSubtitle}>Tools and documents to help you through the selling process</Text>
      
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 15, marginTop: 20 }}>
        {['Home Selling Guide', 'Staging Checklist', 'Closing Timeline', 'Moving Checklist', 'Vendor Recommendations', 'Title Company Info'].map((resource, i) => (
          <View key={i} style={{ width: '30%', backgroundColor: COLORS.lightGray, padding: 15, borderRadius: 8 }}>
            <Text style={{ fontSize: 11, fontWeight: 600, color: COLORS.textPrimary }}>{resource}</Text>
            <Text style={{ fontSize: 9, color: COLORS.spyglassOrange, marginTop: 5 }}>View in presentation →</Text>
          </View>
        ))}
      </View>
      
      <View style={{ marginTop: 30, padding: 20, backgroundColor: COLORS.lightGray, borderRadius: 8 }}>
        <Text style={{ fontSize: 12, fontWeight: 600, marginBottom: 10 }}>Need More Information?</Text>
        <Text style={{ fontSize: 10, color: COLORS.textSecondary }}>
          Contact your agent for access to additional resources and personalized documents for your specific transaction.
        </Text>
      </View>
    </View>
    <PageFooter propertyAddress={propertyAddress} />
  </Page>
);

const STATIC_SLIDE_CONTENT: Record<string, { description: string; bullets: string[] }> = {
  home_selling_system: {
    description: 'Our proven step-by-step system to get your home sold quickly and for top dollar.',
    bullets: ['Strategic pricing analysis', 'Professional staging consultation', 'Premium photography and video', 'Targeted digital marketing', 'Expert negotiation'],
  },
  our_proven_approach: {
    description: 'A comprehensive marketing strategy that maximizes exposure and attracts qualified buyers.',
    bullets: ['Market analysis and positioning', 'Custom marketing plan', 'Open house strategy', 'Buyer feedback tracking', 'Weekly status updates'],
  },
  seo_digital_marketing: {
    description: 'Advanced digital marketing to ensure your property reaches the right buyers.',
    bullets: ['Search engine optimization', 'Social media campaigns', 'Email marketing', 'Retargeting ads', 'Analytics and reporting'],
  },
  google_meta_ads: {
    description: 'Targeted advertising on Google and Meta platforms for maximum reach.',
    bullets: ['Google search ads', 'Display network advertising', 'Facebook and Instagram ads', 'Custom audience targeting', 'Performance optimization'],
  },
  professional_videography: {
    description: 'High-quality video production that showcases your property beautifully.',
    bullets: ['4K video tours', 'Drone aerial footage', 'Professional editing', 'Music and narration', 'Social media optimized versions'],
  },
  why_4k_video: {
    description: 'The importance of professional 4K video in today\'s real estate market.',
    bullets: ['93% of buyers use video in their search', 'Properties with video get 403% more inquiries', 'Virtual tours save time for serious buyers', 'Stand out from competition'],
  },
  example_videos: {
    description: 'Sample property videos showcasing our production quality.',
    bullets: ['Full property walkthrough', 'Neighborhood highlights', 'Lifestyle content', 'Agent introduction'],
  },
  aerial_photography: {
    description: 'Stunning aerial photography that captures your property\'s full potential.',
    bullets: ['Licensed drone operators', 'High-resolution imagery', 'Property boundary views', 'Neighborhood context', 'Unique perspectives'],
  },
  in_house_design_team: {
    description: 'Professional design team creating custom marketing materials.',
    bullets: ['Custom property brochures', 'Digital presentations', 'Social media graphics', 'Print marketing', 'Brand consistency'],
  },
  print_flyers: {
    description: 'High-quality print materials for open houses and distribution.',
    bullets: ['Property feature sheets', 'Neighborhood guides', 'Open house signage', 'Direct mail campaigns'],
  },
  custom_property_page: {
    description: 'Dedicated property website showcasing your listing.',
    bullets: ['Custom domain', 'Photo gallery', 'Video integration', 'Lead capture', 'Social sharing'],
  },
  global_marketing_reach: {
    description: 'International exposure through our global network.',
    bullets: ['1M+ monthly website visitors', '100+ countries reached', 'Multi-language support', 'International buyer connections'],
  },
  leadingre_network: {
    description: 'Part of the Leading Real Estate Companies of the World network.',
    bullets: ['550+ member firms', '4,600 offices worldwide', '150,000 agents', 'Referral network access'],
  },
  featured_property_program: {
    description: 'Premium placement for maximum visibility.',
    bullets: ['Featured on homepage', 'Priority search placement', 'Email blast inclusion', 'Social media spotlight'],
  },
  zillow_marketing: {
    description: 'Leveraging Zillow\'s massive platform for your property.',
    bullets: ['Zillow Premier Agent', 'Enhanced listings', 'Lead generation', 'Performance tracking'],
  },
  zillow_showcase: {
    description: 'Zillow Showcase listing benefits.',
    bullets: ['Professional photography', 'Interactive floor plans', '3D home tours', 'Priority placement'],
  },
  open_house_process: {
    description: 'Our strategic open house approach.',
    bullets: ['Pre-event marketing', 'Professional presentation', 'Buyer feedback collection', 'Follow-up system'],
  },
  pricing_strategy: {
    description: 'Data-driven pricing to attract buyers and maximize value.',
    bullets: ['Comparative market analysis', 'Market condition assessment', 'Pricing psychology', 'Adjustment strategy'],
  },
  listing_price: {
    description: 'Understanding the importance of correct listing price.',
    bullets: ['First impression impact', 'Days on market correlation', 'Buyer perception', 'Negotiation positioning'],
  },
  marketing_timeline: {
    description: 'Week-by-week marketing plan for your property.',
    bullets: ['Pre-listing preparation', 'Launch week activities', 'Ongoing marketing', 'Price adjustment strategy'],
  },
  select_move_program: {
    description: 'Spyglass Select Move Program benefits.',
    bullets: ['Bridge financing', 'Buy before you sell', 'Cash offer assistance', 'Relocation support'],
  },
  what_clients_say: {
    description: 'Testimonials from satisfied clients.',
    bullets: ['5-star reviews', 'Client success stories', 'Referral network', 'Community impact'],
  },
  thank_you: {
    description: 'Thank you for considering Spyglass Realty.',
    bullets: ['Ready to get started', 'Questions answered', 'Next steps outlined'],
  },
};

const StaticImagePage = ({ 
  widget, 
  propertyAddress,
  slideNumber, 
  totalSlides 
}: { 
  widget: { id?: string; title: string; imagePath?: string };
  propertyAddress: string;
  slideNumber: number; 
  totalSlides: number;
}) => {
  const content = widget.id ? STATIC_SLIDE_CONTENT[widget.id] : null;
  
  return (
    <Page size="LETTER" orientation="landscape" style={styles.page}>
      <PageHeader title={widget.title} slideNumber={slideNumber} totalSlides={totalSlides} />
      <View style={styles.content}>
        <Text style={styles.sectionTitle}>{widget.title}</Text>
        
        {content ? (
          <>
            <Text style={{ fontSize: 12, color: COLORS.textSecondary, marginBottom: 20, lineHeight: 1.6 }}>
              {content.description}
            </Text>
            
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 10 }}>
              {content.bullets.map((bullet, i) => (
                <View key={i} style={{ width: '45%', flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 }}>
                  <View style={{ 
                    width: 6, 
                    height: 6, 
                    borderRadius: 3, 
                    backgroundColor: COLORS.spyglassOrange, 
                    marginRight: 8,
                    marginTop: 4
                  }} />
                  <Text style={{ fontSize: 11, color: COLORS.textPrimary, flex: 1 }}>{bullet}</Text>
                </View>
              ))}
            </View>
            
            <View style={{ marginTop: 30, padding: 15, backgroundColor: COLORS.lightGray, borderRadius: 8 }}>
              <Text style={{ fontSize: 10, color: COLORS.textSecondary, textAlign: 'center' }}>
                View the full interactive presentation for detailed visuals and media content
              </Text>
            </View>
          </>
        ) : (
          <View style={styles.centeredContent}>
            <Text style={{ fontSize: 12, color: COLORS.textSecondary, marginTop: 10 }}>
              View full content in the interactive presentation
            </Text>
          </View>
        )}
      </View>
      <PageFooter propertyAddress={propertyAddress} />
    </Page>
  );
};

const ThankYouPage = ({ agent, slideNumber, totalSlides }: { agent: AgentProfile; slideNumber: number; totalSlides: number }) => (
  <Page size="LETTER" orientation="landscape" style={styles.darkPage}>
    <View style={styles.coverPage}>
      <Text style={styles.thankYouText}>Thank You</Text>
      <Text style={styles.thankYouSubtext}>for considering Spyglass Realty</Text>
      <View style={{ marginTop: 40, alignItems: 'center' }}>
        <Text style={{ color: COLORS.white, fontSize: 16, fontWeight: 600 }}>{agent.name}</Text>
        <Text style={{ color: COLORS.spyglassOrange, fontSize: 12, marginTop: 5 }}>{agent.company || 'Spyglass Realty'}</Text>
        {agent.phone && <Text style={{ color: COLORS.mediumGray, fontSize: 11, marginTop: 10 }}>{agent.phone}</Text>}
        {agent.email && <Text style={{ color: COLORS.mediumGray, fontSize: 11 }}>{agent.email}</Text>}
      </View>
    </View>
  </Page>
);

export function CmaPdfDocument({
  propertyAddress,
  agent,
  comparables,
  subjectProperty,
  averageDaysOnMarket = 0,
  suggestedListPrice,
  avgPricePerAcre,
  preparedFor,
}: CmaPdfDocumentProps) {
  const totalSlides = WIDGETS.length;
  const stats = calculateCMAStats(comparables);
  const avgDom = averageDaysOnMarket || stats.avgDOM || 0;
  
  let slideNum = 0;
  
  return (
    <Document>
      <CoverPage propertyAddress={propertyAddress} agent={agent} preparedFor={preparedFor} />
      
      {WIDGETS.map((widget, index) => {
        slideNum = index + 1;
        
        switch (widget.id) {
          case 'agent_resume':
            return <AgentResumePage key={widget.id} agent={agent} slideNumber={slideNum} totalSlides={totalSlides} />;
          
          case 'listing_with_spyglass':
            return <ListingWithSpyglassPage key={widget.id} agent={agent} propertyAddress={propertyAddress} slideNumber={slideNum} totalSlides={totalSlides} />;
          
          case 'client_testimonials':
            return <ClientTestimonialsPage key={widget.id} propertyAddress={propertyAddress} slideNumber={slideNum} totalSlides={totalSlides} />;
          
          case 'comps':
            return <ComparablesSummaryPage key={widget.id} comparables={comparables} propertyAddress={propertyAddress} slideNumber={slideNum} totalSlides={totalSlides} />;
          
          case 'time_to_sell':
            return <TimeToSellPage key={widget.id} averageDaysOnMarket={avgDom} comparables={comparables} propertyAddress={propertyAddress} slideNumber={slideNum} totalSlides={totalSlides} />;
          
          case 'suggested_list_price':
            return <SuggestedPricePage key={widget.id} suggestedListPrice={suggestedListPrice} comparables={comparables} propertyAddress={propertyAddress} slideNumber={slideNum} totalSlides={totalSlides} />;
          
          case 'average_price_acre':
            return <AveragePricePerAcrePage key={widget.id} avgPricePerAcre={avgPricePerAcre} comparables={comparables} propertyAddress={propertyAddress} slideNumber={slideNum} totalSlides={totalSlides} />;
          
          case 'listing_action_plan':
            return <ListingActionPlanPage key={widget.id} propertyAddress={propertyAddress} slideNumber={slideNum} totalSlides={totalSlides} />;
          
          case 'spyglass_resources':
            return <SpyglassResourcesPage key={widget.id} propertyAddress={propertyAddress} slideNumber={slideNum} totalSlides={totalSlides} />;
          
          case 'marketing':
            return <MarketingPage key={widget.id} propertyAddress={propertyAddress} slideNumber={slideNum} totalSlides={totalSlides} />;
          
          case 'thank_you':
            return <ThankYouPage key={widget.id} agent={agent} slideNumber={slideNum} totalSlides={totalSlides} />;
          
          default:
            return <StaticImagePage key={widget.id} widget={widget} propertyAddress={propertyAddress} slideNumber={slideNum} totalSlides={totalSlides} />;
        }
      })}
      
      {comparables.slice(0, 3).map((comp, i) => (
        <PropertyDetailPage 
          key={`detail-${comp.id}`} 
          property={comp} 
          propertyAddress={propertyAddress}
          slideNumber={totalSlides + i + 1} 
          totalSlides={totalSlides + 3} 
        />
      ))}
    </Document>
  );
}
