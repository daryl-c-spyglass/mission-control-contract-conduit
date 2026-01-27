import { Document, Page, View, Text, Image } from '@react-pdf/renderer';
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
  extractFullAddress,
  calculatePricePerSqft,
  calculatePricePerAcre,
  calculateCMAStats,
  formatPrice,
  formatPriceShort,
  formatNumber,
  getStatusColor,
  normalizeStatus,
  getAgentName,
  getAgentPhoto,
  getAgentInitials,
  getPrimaryPhoto,
  getPhotos,
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
  baseUrl?: string;
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

const CoverPage = ({ propertyAddress, agent, preparedFor, baseUrl }: { propertyAddress: string; agent: AgentProfile; preparedFor?: string; baseUrl: string }) => {
  const agentName = getAgentName(agent);
  const agentInitials = getAgentInitials(agent);
  const agentPhoto = getAgentPhoto(agent) || '';
  const addressParts = propertyAddress.split(',');
  const streetAddress = addressParts[0]?.trim() || propertyAddress;
  const cityState = addressParts.slice(1).join(',').trim();
  const logoUrl = baseUrl ? `${baseUrl}/logos/spyglass-logo-white.png` : '';
  
  return (
    <Page size="LETTER" orientation="landscape" style={styles.darkPage}>
      <View style={styles.coverPagePro}>
        <View style={styles.coverContentPro}>
          {baseUrl ? (
            <Image src={logoUrl} style={{ width: 180, height: 40, marginBottom: 20 }} />
          ) : (
            <View style={styles.coverLogoPro}>
              <Text style={styles.coverLogoOrange}>SPYGLASS</Text>
              <Text style={styles.coverLogoWhite}>REALTY</Text>
            </View>
          )}
          <Text style={styles.coverTitle}>Comparative Market Analysis</Text>
          {preparedFor && (
            <Text style={styles.coverSubtitle}>Prepared for {preparedFor}</Text>
          )}
          <View style={styles.coverAddressBox}>
            <Text style={styles.coverAddressPro}>{streetAddress}</Text>
            {cityState && <Text style={styles.coverCityPro}>{cityState}</Text>}
          </View>
          <Text style={styles.coverDate}>{new Date().toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })}</Text>
        </View>
        <View style={styles.coverAgentSection}>
          {agentPhoto ? (
            <Image src={agentPhoto} style={{ width: 70, height: 70, borderRadius: 35, marginRight: 16 }} />
          ) : (
            <View style={styles.coverAgentPhotoPlaceholder}>
              <Text style={styles.coverAgentInitials}>{agentInitials}</Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 9, color: 'rgba(255,255,255,0.8)', textTransform: 'uppercase' }}>Prepared by</Text>
            <Text style={{ fontSize: 20, fontWeight: 700, color: COLORS.white, marginTop: 2 }}>{agentName}</Text>
            <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.9)', marginTop: 2 }}>REALTOR | {agent.company || 'Spyglass Realty'}</Text>
            {agent.phone && (
              <Text style={{ fontSize: 9, color: 'rgba(255,255,255,0.8)', marginTop: 2 }}>{agent.phone} | {agent.email}</Text>
            )}
          </View>
        </View>
      </View>
    </Page>
  );
};

const AgentResumePage = ({ agent, slideNumber, totalSlides }: { agent: AgentProfile; slideNumber: number; totalSlides: number }) => {
  const agentName = getAgentName(agent);
  const agentInitials = getAgentInitials(agent);
  const agentPhoto = getAgentPhoto(agent) || '';
  
  return (
    <Page size="LETTER" orientation="landscape" style={styles.page}>
      <PageHeader title="MEET YOUR AGENT" slideNumber={slideNumber} totalSlides={totalSlides} />
      <View style={styles.content}>
        <View style={{ flexDirection: 'row', gap: 30 }}>
          <View style={{ width: '35%' }}>
            {agentPhoto ? (
              <Image src={agentPhoto} style={{ width: '100%', height: 200, borderRadius: 4, objectFit: 'cover' }} />
            ) : (
              <View style={{ width: '100%', height: 200, backgroundColor: COLORS.lightGray, borderRadius: 4, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 48, color: COLORS.mediumGray }}>{agentInitials}</Text>
              </View>
            )}
            <View style={{ backgroundColor: COLORS.darkBackground, padding: 12, borderRadius: 4, marginTop: 12 }}>
              <Text style={{ fontSize: 14, fontWeight: 700, color: COLORS.white }}>{agentName}</Text>
              <Text style={{ fontSize: 9, color: COLORS.mediumGray, marginTop: 2 }}>REALTOR | {agent.company || 'Spyglass Realty'}</Text>
              {agent.phone && <Text style={{ fontSize: 9, color: COLORS.spyglassOrange, marginTop: 8 }}>{agent.phone}</Text>}
              {agent.email && <Text style={{ fontSize: 9, color: COLORS.mediumGray }}>{agent.email}</Text>}
            </View>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 20, fontWeight: 700, color: COLORS.textPrimary, marginBottom: 12 }}>Your Austin Real Estate Expert</Text>
            <Text style={{ fontSize: 10, color: COLORS.textSecondary, lineHeight: 1.6 }}>
              {agent.bio || "As a dedicated Austin real estate professional, I specialize in helping families find their perfect home in Central Texas. My deep knowledge of Austin's diverse neighborhoods ensures you'll get expert guidance tailored to your needs."}
            </Text>
            <View style={{ flexDirection: 'row', marginTop: 24, gap: 8 }}>
              <View style={{ flex: 1, backgroundColor: COLORS.lightGray, padding: 12, borderRadius: 4, alignItems: 'center' }}>
                <Text style={{ fontSize: 24, fontWeight: 700, color: COLORS.spyglassOrange }}>150+</Text>
                <Text style={{ fontSize: 8, color: COLORS.textSecondary, textTransform: 'uppercase' }}>Homes Sold</Text>
              </View>
              <View style={{ flex: 1, backgroundColor: COLORS.lightGray, padding: 12, borderRadius: 4, alignItems: 'center' }}>
                <Text style={{ fontSize: 24, fontWeight: 700, color: COLORS.spyglassOrange }}>$85M</Text>
                <Text style={{ fontSize: 8, color: COLORS.textSecondary, textTransform: 'uppercase' }}>Sales Volume</Text>
              </View>
              <View style={{ flex: 1, backgroundColor: COLORS.lightGray, padding: 12, borderRadius: 4, alignItems: 'center' }}>
                <Text style={{ fontSize: 24, fontWeight: 700, color: COLORS.spyglassOrange }}>4.9</Text>
                <Text style={{ fontSize: 8, color: COLORS.textSecondary, textTransform: 'uppercase' }}>Client Rating</Text>
              </View>
            </View>
          </View>
        </View>
      </View>
      <PageFooter propertyAddress="" />
    </Page>
  );
};

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
        <View style={styles.statsRowPro}>
          <View style={styles.statBoxPro}>
            <Text style={styles.statLabelPro}>Properties</Text>
            <Text style={styles.statValuePro}>{stats.count}</Text>
          </View>
          <View style={styles.statBoxHighlight}>
            <Text style={styles.statLabelWhite}>Average Price</Text>
            <Text style={styles.statValueWhite}>{formatPrice(stats.avgPrice)}</Text>
          </View>
          <View style={styles.statBoxHighlight}>
            <Text style={styles.statLabelWhite}>Avg $/Sq Ft</Text>
            <Text style={styles.statValueWhite}>${stats.avgPricePerSqft || 'N/A'}</Text>
          </View>
          <View style={styles.statBoxPro}>
            <Text style={styles.statLabelPro}>Avg Days on Market</Text>
            <Text style={styles.statValuePro}>{stats.avgDOM ?? 'N/A'} days</Text>
          </View>
        </View>
        
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderCell, { width: '28%' }]}>Address</Text>
            <Text style={[styles.tableHeaderCell, { width: '14%', textAlign: 'right' }]}>Price</Text>
            <Text style={[styles.tableHeaderCell, { width: '10%', textAlign: 'center' }]}>Bed/Bath</Text>
            <Text style={[styles.tableHeaderCell, { width: '12%', textAlign: 'right' }]}>Sq Ft</Text>
            <Text style={[styles.tableHeaderCell, { width: '10%', textAlign: 'right' }]}>$/SqFt</Text>
            <Text style={[styles.tableHeaderCell, { width: '14%', textAlign: 'center' }]}>Status</Text>
            <Text style={[styles.tableHeaderCell, { width: '10%', textAlign: 'right' }]}>DOM</Text>
          </View>
          {comparables.map((comp, i) => {
            const price = extractPrice(comp);
            const sqft = extractSqft(comp);
            const pricePerSqft = calculatePricePerSqft(comp);
            const dom = extractDOM(comp);
            const beds = extractBeds(comp);
            const baths = extractBaths(comp);
            const status = normalizeStatus(comp.status);
            const isClosed = status.toLowerCase() === 'closed';
            const address = extractFullAddress(comp);
            const streetOnly = address.split(',')[0] || address;
            
            return (
              <View key={comp.id || i} style={[styles.tableRow, i % 2 === 1 ? styles.tableRowAlt : {}]}>
                <View style={{ width: '28%' }}>
                  <Text style={styles.tableCellBold}>{streetOnly}</Text>
                  <Text style={{ fontSize: 7, color: COLORS.textSecondary }}>Austin, TX</Text>
                </View>
                <Text style={[styles.tableCellOrange, { width: '14%', textAlign: 'right' }]}>{formatPrice(price)}</Text>
                <Text style={[styles.tableCell, { width: '10%', textAlign: 'center' }]}>{beds}/{baths}</Text>
                <Text style={[styles.tableCell, { width: '12%', textAlign: 'right' }]}>{formatNumber(sqft)}</Text>
                <Text style={[styles.tableCell, { width: '10%', textAlign: 'right' }]}>{pricePerSqft ? `$${pricePerSqft}` : '-'}</Text>
                <View style={{ width: '14%', alignItems: 'center' }}>
                  <View style={isClosed ? styles.statusBadgeClosed : styles.statusBadgeActive}>
                    <Text style={isClosed ? styles.statusTextClosed : styles.statusTextActive}>{status}</Text>
                  </View>
                </View>
                <Text style={[styles.tableCell, { width: '10%', textAlign: 'right' }]}>{dom != null ? dom : '-'}</Text>
              </View>
            );
          })}
        </View>
        <Text style={{ fontSize: 8, color: COLORS.mediumGray, textAlign: 'center', marginTop: 12 }}>
          Data sourced from Austin Board of REALTORS MLS. Information deemed reliable but not guaranteed.
        </Text>
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
  const lotAcres = extractLotAcres(property);
  const status = normalizeStatus(property.status);
  const isClosed = status.toLowerCase() === 'closed';
  const address = extractFullAddress(property);
  const streetOnly = address.split(',')[0] || address;
  const primaryPhoto = getPrimaryPhoto(property);
  
  return (
    <Page size="LETTER" orientation="landscape" style={styles.page}>
      <PageHeader title="COMPARABLE PROPERTY" slideNumber={slideNumber} totalSlides={totalSlides} />
      <View style={styles.content}>
        <View style={{ flexDirection: 'row', gap: 24 }}>
          <View style={{ width: '45%' }}>
            {primaryPhoto ? (
              <Image src={primaryPhoto} style={{ width: '100%', height: 200, borderRadius: 4, objectFit: 'cover' }} />
            ) : (
              <View style={{ 
                width: '100%', 
                height: 200, 
                backgroundColor: COLORS.lightGray, 
                borderRadius: 4, 
                alignItems: 'center', 
                justifyContent: 'center' 
              }}>
                <Text style={{ fontSize: 11, color: COLORS.mediumGray }}>Property Photo</Text>
                <Text style={{ fontSize: 9, color: COLORS.mediumGray, marginTop: 4 }}>(View in interactive presentation)</Text>
              </View>
            )}
            <View style={{ marginTop: 12 }}>
              <Text style={{ fontSize: 16, fontWeight: 700, color: COLORS.textPrimary }}>{streetOnly}</Text>
              <Text style={{ fontSize: 10, color: COLORS.textSecondary, marginTop: 2 }}>
                {[property.city, property.state, property.zipCode].filter(Boolean).join(', ') || 'Austin, TX'}
              </Text>
            </View>
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <Text style={{ fontSize: 32, fontWeight: 700, color: COLORS.spyglassOrange }}>{formatPrice(price)}</Text>
              <View style={isClosed ? styles.statusBadgeClosed : styles.statusBadgeActive}>
                <Text style={isClosed ? styles.statusTextClosed : styles.statusTextActive}>{status}</Text>
              </View>
            </View>
            
            <View style={{ flexDirection: 'row', marginBottom: 16, gap: 12 }}>
              <View style={{ flex: 1, backgroundColor: COLORS.lightGray, padding: 12, borderRadius: 4, alignItems: 'center' }}>
                <Text style={{ fontSize: 18, fontWeight: 700, color: COLORS.textPrimary }}>{beds}</Text>
                <Text style={{ fontSize: 8, color: COLORS.textSecondary, textTransform: 'uppercase' }}>Beds</Text>
              </View>
              <View style={{ flex: 1, backgroundColor: COLORS.lightGray, padding: 12, borderRadius: 4, alignItems: 'center' }}>
                <Text style={{ fontSize: 18, fontWeight: 700, color: COLORS.textPrimary }}>{baths}</Text>
                <Text style={{ fontSize: 8, color: COLORS.textSecondary, textTransform: 'uppercase' }}>Baths</Text>
              </View>
              <View style={{ flex: 1, backgroundColor: COLORS.lightGray, padding: 12, borderRadius: 4, alignItems: 'center' }}>
                <Text style={{ fontSize: 18, fontWeight: 700, color: COLORS.textPrimary }}>{formatNumber(sqft)}</Text>
                <Text style={{ fontSize: 8, color: COLORS.textSecondary, textTransform: 'uppercase' }}>Sq Ft</Text>
              </View>
            </View>
            
            <View style={{ backgroundColor: '#f9fafb', padding: 12, borderRadius: 4 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                <Text style={{ fontSize: 10, color: COLORS.textSecondary }}>Price per Sq Ft</Text>
                <Text style={{ fontSize: 10, fontWeight: 600, color: COLORS.textPrimary }}>{pricePerSqft ? `$${pricePerSqft}` : 'N/A'}</Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                <Text style={{ fontSize: 10, color: COLORS.textSecondary }}>Days on Market</Text>
                <Text style={{ fontSize: 10, fontWeight: 600, color: COLORS.textPrimary }}>{dom != null ? dom : 'N/A'}</Text>
              </View>
              {lotAcres != null && (
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                  <Text style={{ fontSize: 10, color: COLORS.textSecondary }}>Lot Size</Text>
                  <Text style={{ fontSize: 10, fontWeight: 600, color: COLORS.textPrimary }}>{lotAcres.toFixed(2)} acres</Text>
                </View>
              )}
              {property.yearBuilt && (
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: 10, color: COLORS.textSecondary }}>Year Built</Text>
                  <Text style={{ fontSize: 10, fontWeight: 600, color: COLORS.textPrimary }}>{property.yearBuilt}</Text>
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
        {comparables.map((comp, i) => {
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
        
        <View style={{ alignItems: 'center', marginVertical: 24 }}>
          <View style={{ backgroundColor: '#f0fdf4', borderWidth: 2, borderColor: '#22c55e', borderRadius: 8, padding: 20, width: '60%', alignItems: 'center' }}>
            <Text style={{ fontSize: 12, color: '#15803d', textTransform: 'uppercase', marginBottom: 8 }}>Suggested List Price</Text>
            <Text style={{ fontSize: 48, fontWeight: 700, color: COLORS.spyglassOrange }}>{hasValidPrice ? formatPrice(price) : 'N/A'}</Text>
          </View>
        </View>
        
        <View style={{ width: '80%', marginHorizontal: 'auto', marginTop: 16 }}>
          <View style={{ height: 8, backgroundColor: '#e5e7eb', borderRadius: 4, position: 'relative' }}>
            <View style={{ 
              position: 'absolute', 
              left: '20%', 
              right: '20%', 
              height: 8, 
              backgroundColor: COLORS.spyglassOrange, 
              borderRadius: 4,
              opacity: 0.7
            }} />
            <View style={{ 
              position: 'absolute', 
              left: '45%', 
              top: -4,
              width: 16, 
              height: 16, 
              borderRadius: 8, 
              backgroundColor: COLORS.spyglassOrange, 
              borderWidth: 2,
              borderColor: COLORS.white
            }} />
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
            <View style={{ alignItems: 'flex-start' }}>
              <Text style={{ fontSize: 9, color: COLORS.textSecondary }}>Low</Text>
              <Text style={{ fontSize: 14, fontWeight: 600, color: COLORS.textPrimary }}>{formatPrice(lowPrice)}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ fontSize: 9, color: COLORS.textSecondary }}>High</Text>
              <Text style={{ fontSize: 14, fontWeight: 600, color: COLORS.textPrimary }}>{formatPrice(highPrice)}</Text>
            </View>
          </View>
        </View>
        
        <View style={{ backgroundColor: COLORS.lightGray, padding: 20, borderRadius: 8, marginTop: 24 }}>
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
  // Sanity checks for price per acre values
  const MIN_LOT_SIZE_ACRES = 0.05;
  const MAX_PRICE_PER_ACRE = 20_000_000; // $20M/acre max
  const MIN_PRICE_PER_ACRE = 10_000; // $10K/acre minimum
  
  const propsWithAcreData = comparables
    .map(c => ({
      ...c,
      acres: extractLotAcres(c),
      pricePerAcreCalc: calculatePricePerAcre(c),
    }))
    .filter(c => {
      // Filter out invalid data
      if (c.acres === null || c.acres <= 0) return false;
      if (c.acres < MIN_LOT_SIZE_ACRES) return false; // Exclude tiny lots
      if (c.pricePerAcreCalc === null) return false;
      // Sanity check the price per acre
      if (c.pricePerAcreCalc > MAX_PRICE_PER_ACRE || c.pricePerAcreCalc < MIN_PRICE_PER_ACRE) return false;
      return true;
    });
  
  // Calculate average from filtered data
  const validPricesPerAcre = propsWithAcreData.map(c => c.pricePerAcreCalc!).filter(p => p > 0);
  const calculatedAvg = validPricesPerAcre.length > 0 
    ? Math.round(validPricesPerAcre.reduce((a, b) => a + b, 0) / validPricesPerAcre.length) 
    : 0;
  
  // Use provided value or calculated value
  let avgPrice = avgPricePerAcre || calculatedAvg || 0;
  // Sanity check the provided value too
  if (avgPrice > MAX_PRICE_PER_ACRE) avgPrice = calculatedAvg || 0;
  const hasValidData = avgPrice > 0 && avgPrice <= MAX_PRICE_PER_ACRE;
  
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
            {propsWithAcreData.map((comp, i) => (
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
      
      <View style={{ flexDirection: 'row', gap: 16, marginTop: 20 }}>
        <View style={{ flex: 1, backgroundColor: COLORS.lightGray, padding: 16, borderRadius: 8 }}>
          <Text style={{ fontSize: 20, color: COLORS.spyglassOrange, fontWeight: 700, marginBottom: 8 }}>"</Text>
          <Text style={{ fontSize: 10, color: COLORS.textSecondary, lineHeight: 1.5, fontStyle: 'italic' }}>
            Exceptional service from start to finish. They made the entire process seamless and stress-free.
          </Text>
          <View style={{ marginTop: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ fontSize: 9, fontWeight: 600, color: COLORS.textPrimary }}>— Happy Homeowner</Text>
            <Text style={{ fontSize: 8, color: COLORS.mediumGray }}>Google Review</Text>
          </View>
        </View>
        <View style={{ flex: 1, backgroundColor: COLORS.lightGray, padding: 16, borderRadius: 8 }}>
          <Text style={{ fontSize: 20, color: COLORS.spyglassOrange, fontWeight: 700, marginBottom: 8 }}>"</Text>
          <Text style={{ fontSize: 10, color: COLORS.textSecondary, lineHeight: 1.5, fontStyle: 'italic' }}>
            Professional, knowledgeable, and always available. I couldn't have asked for a better team.
          </Text>
          <View style={{ marginTop: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ fontSize: 9, fontWeight: 600, color: COLORS.textPrimary }}>— Satisfied Seller</Text>
            <Text style={{ fontSize: 8, color: COLORS.mediumGray }}>Zillow Review</Text>
          </View>
        </View>
        <View style={{ flex: 1, backgroundColor: COLORS.lightGray, padding: 16, borderRadius: 8 }}>
          <Text style={{ fontSize: 20, color: COLORS.spyglassOrange, fontWeight: 700, marginBottom: 8 }}>"</Text>
          <Text style={{ fontSize: 10, color: COLORS.textSecondary, lineHeight: 1.5, fontStyle: 'italic' }}>
            They sold our home in just 5 days for above asking price. Highly recommend!
          </Text>
          <View style={{ marginTop: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ fontSize: 9, fontWeight: 600, color: COLORS.textPrimary }}>— Austin Family</Text>
            <Text style={{ fontSize: 8, color: COLORS.mediumGray }}>Google Review</Text>
          </View>
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
        <View style={{ flex: 1 }}>
          {/* YouTube Video Thumbnail */}
          <View style={{ position: 'relative', borderRadius: 8, overflow: 'hidden', marginBottom: 12 }}>
            <Image 
              src="https://img.youtube.com/vi/iB_u-ksW3ts/hqdefault.jpg"
              style={{ width: '100%', height: 150, borderRadius: 8, objectFit: 'cover' }}
            />
            <View style={{ 
              position: 'absolute', 
              top: '50%', 
              left: '50%', 
              marginTop: -20,
              marginLeft: -20,
              width: 40, 
              height: 40, 
              backgroundColor: COLORS.spyglassOrange, 
              borderRadius: 20,
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Text style={{ fontSize: 18, color: COLORS.white }}>▶</Text>
            </View>
          </View>
          <Text style={{ fontSize: 10, color: COLORS.textSecondary, textAlign: 'center' }}>
            Watch our introduction video at <Text style={{ color: COLORS.spyglassOrange, fontWeight: 600 }}>spyglassrealty.com</Text>
          </Text>
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
  totalSlides,
  baseUrl
}: { 
  widget: { id?: string; title: string; imagePath?: string };
  propertyAddress: string;
  slideNumber: number; 
  totalSlides: number;
  baseUrl: string;
}) => {
  const hasImage = widget.imagePath && widget.imagePath.length > 0 && baseUrl;
  const normalizedPath = widget.imagePath?.startsWith('/') ? widget.imagePath : `/${widget.imagePath}`;
  const imageUrl = hasImage ? (widget.imagePath?.startsWith('http') ? widget.imagePath : `${baseUrl}${normalizedPath}`) : null;
  
  return (
    <Page size="LETTER" orientation="landscape" style={{ padding: 0 }}>
      {imageUrl ? (
        <Image
          src={imageUrl}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
          }}
        />
      ) : (
        <>
          <PageHeader title={widget.title} slideNumber={slideNumber} totalSlides={totalSlides} />
          <View style={styles.content}>
            <Text style={styles.sectionTitle}>{widget.title}</Text>
            <View style={styles.centeredContent}>
              <Text style={{ fontSize: 12, color: COLORS.textSecondary, marginTop: 10 }}>
                View full content in the interactive presentation
              </Text>
            </View>
          </View>
          <PageFooter propertyAddress={propertyAddress} />
        </>
      )}
    </Page>
  );
};

const ThankYouPage = ({ agent, slideNumber, totalSlides }: { agent: AgentProfile; slideNumber: number; totalSlides: number }) => {
  const agentName = getAgentName(agent);
  const agentInitials = getAgentInitials(agent);
  const agentPhoto = getAgentPhoto(agent) || '';
  
  return (
    <Page size="LETTER" orientation="landscape" style={styles.darkPage}>
      <View style={styles.coverPagePro}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <View style={styles.coverLogoPro}>
            <Text style={styles.coverLogoOrange}>SPYGLASS</Text>
            <Text style={styles.coverLogoWhite}>REALTY</Text>
          </View>
          <Text style={{ fontSize: 36, color: COLORS.white, marginTop: 24, marginBottom: 8 }}>Thank You</Text>
          <Text style={{ fontSize: 12, color: COLORS.mediumGray, marginBottom: 32 }}>for considering Spyglass Realty</Text>
          {agentPhoto ? (
            <Image src={agentPhoto} style={{ 
              width: 80, 
              height: 80, 
              borderRadius: 40, 
              borderWidth: 4, 
              borderColor: COLORS.spyglassOrange 
            }} />
          ) : (
            <View style={{ 
              width: 80, 
              height: 80, 
              borderRadius: 40, 
              backgroundColor: '#4b5563', 
              borderWidth: 4, 
              borderColor: COLORS.spyglassOrange, 
              alignItems: 'center', 
              justifyContent: 'center' 
            }}>
              <Text style={{ fontSize: 28, color: COLORS.white, fontWeight: 700 }}>{agentInitials}</Text>
            </View>
          )}
          <Text style={{ fontSize: 20, fontWeight: 700, color: COLORS.white, marginTop: 16 }}>{agentName}</Text>
          <Text style={{ fontSize: 11, color: COLORS.mediumGray, marginTop: 4 }}>REALTOR | {agent.company || 'Spyglass Realty'}</Text>
          {agent.phone && <Text style={{ fontSize: 11, color: COLORS.spyglassOrange, marginTop: 16 }}>{agent.phone}</Text>}
          {agent.email && <Text style={{ fontSize: 11, color: COLORS.mediumGray, marginTop: 4 }}>{agent.email}</Text>}
        </View>
      </View>
    </Page>
  );
};

export function CmaPdfDocument({
  propertyAddress,
  agent,
  comparables,
  subjectProperty,
  averageDaysOnMarket = 0,
  suggestedListPrice,
  avgPricePerAcre,
  preparedFor,
  baseUrl = '',
}: CmaPdfDocumentProps) {
  const totalSlides = WIDGETS.length;
  const stats = calculateCMAStats(comparables);
  const avgDom = averageDaysOnMarket || stats.avgDOM || 0;
  
  let slideNum = 0;
  
  return (
    <Document>
      <CoverPage propertyAddress={propertyAddress} agent={agent} preparedFor={preparedFor} baseUrl={baseUrl} />
      
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
            return <StaticImagePage key={widget.id} widget={widget} propertyAddress={propertyAddress} slideNumber={slideNum} totalSlides={totalSlides} baseUrl={baseUrl} />;
        }
      })}
      
      {comparables.map((comp, i) => (
        <PropertyDetailPage 
          key={`detail-${comp.id}`} 
          property={comp} 
          propertyAddress={propertyAddress}
          slideNumber={totalSlides + i + 1} 
          totalSlides={totalSlides + comparables.length} 
        />
      ))}
    </Document>
  );
}
