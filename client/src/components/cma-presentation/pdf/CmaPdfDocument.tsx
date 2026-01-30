import { Document, Page, View, Text, Image } from '@react-pdf/renderer';
import { styles, COLORS } from './styles';
import type { AgentProfile, CmaProperty } from '../types';
import { WIDGETS, MARKETING_TEXT, LISTING_ACTION_PLAN_TEXT, SAMPLE_REVIEWS, type Review } from '../constants/widgets';
import lreSgrWhiteLogo from '@assets/LRE_SGR_White_1769702535327.png';
import lreSgrBlackLogo from '@assets/LRE_SGR_Black.png';
import {
  extractPrice,
  extractSqft,
  extractDOM,
  extractLotAcres,
  extractBeds,
  extractBaths,
  extractFullAddress,
  getCityState,
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
  logoBase64?: string | null;
}

const PageHeader = ({ title, slideNumber, totalSlides }: { title: string; slideNumber: number; totalSlides: number }) => (
  <View style={styles.header}>
    <Text style={styles.headerTitle}>{title}</Text>
    <Text style={styles.headerSlide}>Slide {slideNumber} of {totalSlides}</Text>
  </View>
);

const PageFooter = ({ slideNumber = 2, totalSlides = 44, logoBase64 }: { slideNumber?: number; totalSlides?: number; logoBase64?: string | null }) => {
  const showLogo = slideNumber > 1;
  
  return (
    <View style={styles.footer}>
      {showLogo && logoBase64 ? (
        <Image src={logoBase64} style={{ height: 28, width: 'auto' }} />
      ) : (
        <Text style={{ fontSize: 10, fontWeight: 600, color: '#18181b' }}>Spyglass Realty</Text>
      )}
      <Text style={styles.footerText}>Slide {slideNumber} of {totalSlides}</Text>
    </View>
  );
};

const CoverPage = ({ propertyAddress, agent, preparedFor, logoBase64, slideNumber, totalSlides }: { propertyAddress: string; agent: AgentProfile; preparedFor?: string; logoBase64?: string | null; slideNumber: number; totalSlides: number }) => {
  const agentName = getAgentName(agent);
  
  return (
    <Page size="LETTER" orientation="landscape" style={styles.page}>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 }}>
        {logoBase64 ? (
          <Image src={logoBase64} style={{ height: 56, marginBottom: 24 }} />
        ) : (
          <Text style={{ fontSize: 24, fontWeight: 700, color: '#18181b', marginBottom: 24 }}>Spyglass Realty</Text>
        )}
        <Text style={{ fontSize: 24, fontWeight: 700, color: '#18181b', textAlign: 'center', marginBottom: 24 }}>
          COMPARATIVE MARKET ANALYSIS
        </Text>
        <Text style={{ fontSize: 18, color: '#3f3f46', textAlign: 'center', marginBottom: 32 }}>
          {propertyAddress}
        </Text>
        {preparedFor && (
          <Text style={{ fontSize: 12, color: '#71717a', textAlign: 'center', marginBottom: 16 }}>
            Prepared for {preparedFor}
          </Text>
        )}
        <View style={{ marginTop: 16, alignItems: 'center' }}>
          <Text style={{ fontSize: 14, color: '#71717a', textAlign: 'center' }}>Prepared by</Text>
          <Text style={{ fontSize: 16, fontWeight: 600, color: '#18181b', textAlign: 'center', marginTop: 4 }}>{agentName}</Text>
          <Text style={{ fontSize: 14, color: '#52525b', textAlign: 'center', marginTop: 2 }}>{agent.company || 'Spyglass Realty'}</Text>
        </View>
      </View>
      <PageFooter slideNumber={slideNumber} totalSlides={totalSlides} logoBase64={logoBase64} />
    </Page>
  );
};

const AgentResumePage = ({ agent, slideNumber, totalSlides, logoBase64 }: { agent: AgentProfile; slideNumber: number; totalSlides: number; logoBase64?: string | null }) => {
  const agentName = getAgentName(agent);
  const agentInitials = getAgentInitials(agent);
  const agentPhoto = getAgentPhoto(agent) || '';
  
  return (
    <Page size="LETTER" orientation="landscape" style={styles.page}>
      <PageHeader title="AGENT RESUME" slideNumber={slideNumber} totalSlides={totalSlides} />
      <View style={styles.content}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 16, marginBottom: 16 }}>
          {agentPhoto ? (
            <Image src={agentPhoto} style={{ width: 64, height: 64, borderRadius: 32, objectFit: 'cover' }} />
          ) : (
            <View style={{ width: 64, height: 64, backgroundColor: '#e4e4e7', borderRadius: 32, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 24, color: '#a1a1aa' }}>{agentInitials}</Text>
            </View>
          )}
          <View>
            <Text style={{ fontSize: 18, fontWeight: 700, color: '#222222' }}>{agentName}</Text>
            <Text style={{ fontSize: 14, color: '#52525b', marginTop: 2 }}>{agent.company || 'Spyglass Realty'}</Text>
            {agent.phone && <Text style={{ fontSize: 14, color: '#71717a', marginTop: 2 }}>{agent.phone}</Text>}
            {agent.email && <Text style={{ fontSize: 14, color: '#71717a', marginTop: 2 }}>{agent.email}</Text>}
          </View>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 14, fontWeight: 500, marginBottom: 8 }}>About</Text>
          <Text style={{ fontSize: 14, color: '#52525b', lineHeight: 1.5 }}>
            {agent.bio || 'Agent bio will appear here. Update your profile to add your professional biography.'}
          </Text>
        </View>
      </View>
      <PageFooter slideNumber={slideNumber} totalSlides={totalSlides} logoBase64={logoBase64} />
    </Page>
  );
};

const ComparablesSummaryPage = ({ 
  comparables,
  subjectProperty,
  propertyAddress,
  slideNumber, 
  totalSlides,
  logoBase64
}: { 
  comparables: CmaProperty[];
  subjectProperty?: CmaProperty;
  propertyAddress: string;
  slideNumber: number; 
  totalSlides: number;
  logoBase64?: string | null;
}) => {
  const stats = calculateCMAStats(comparables);
  
  // Calculate subject property values for "vs market" comparison
  const subjectPrice = subjectProperty ? extractPrice(subjectProperty) : null;
  const subjectSqft = subjectProperty ? extractSqft(subjectProperty) : null;
  const subjectPricePerSqft = (subjectPrice && subjectSqft && subjectSqft > 0) 
    ? subjectPrice / subjectSqft 
    : null;
  
  // Calculate % difference vs market average
  const priceVsMarket = (stats.avgPrice && stats.avgPrice > 0 && subjectPrice && subjectPrice > 0)
    ? ((subjectPrice - stats.avgPrice) / stats.avgPrice) * 100
    : null;
  
  const avgPricePerSqft = stats.avgPricePerSqft ?? null;
  const pricePerSqftVsMarket = (avgPricePerSqft && avgPricePerSqft > 0 && subjectPricePerSqft && subjectPricePerSqft > 0)
    ? ((subjectPricePerSqft - avgPricePerSqft) / avgPricePerSqft) * 100
    : null;
  
  return (
    <Page size="LETTER" orientation="landscape" style={styles.page}>
      <PageHeader title="COMPS" slideNumber={slideNumber} totalSlides={totalSlides} />
      <View style={styles.content}>
        {/* Stats boxes matching Preview with market comparison */}
        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
          <View style={{ flex: 1, backgroundColor: '#fafafa', padding: 12, borderRadius: 4, alignItems: 'center' }}>
            <Text style={{ fontSize: 18, fontWeight: 700, color: '#EF4923' }}>{comparables.length}</Text>
            <Text style={{ fontSize: 12, color: '#71717a' }}>Properties</Text>
          </View>
          <View style={{ flex: 1, backgroundColor: '#fafafa', padding: 12, borderRadius: 4, alignItems: 'center' }}>
            <Text style={{ fontSize: 18, fontWeight: 700, color: '#222222' }}>{stats.avgPrice ? formatPrice(stats.avgPrice) : 'N/A'}</Text>
            <Text style={{ fontSize: 12, color: '#71717a' }}>Avg Price</Text>
            {priceVsMarket !== null && (
              <Text style={{ fontSize: 10, color: priceVsMarket > 0 ? '#ef4444' : '#22c55e', marginTop: 2 }}>
                {priceVsMarket > 0 ? '+' : '-'}{Math.abs(priceVsMarket).toFixed(1)}% vs market
              </Text>
            )}
            {subjectPrice && (
              <Text style={{ fontSize: 10, color: '#71717a', marginTop: 1 }}>Your: {formatPrice(subjectPrice)}</Text>
            )}
          </View>
          <View style={{ flex: 1, backgroundColor: '#fafafa', padding: 12, borderRadius: 4, alignItems: 'center' }}>
            <Text style={{ fontSize: 18, fontWeight: 700, color: '#222222' }}>{avgPricePerSqft ? `$${Math.round(avgPricePerSqft)}` : 'N/A'}</Text>
            <Text style={{ fontSize: 12, color: '#71717a' }}>Avg $/SqFt</Text>
            {pricePerSqftVsMarket !== null && (
              <Text style={{ fontSize: 10, color: pricePerSqftVsMarket > 0 ? '#ef4444' : '#22c55e', marginTop: 2 }}>
                {pricePerSqftVsMarket > 0 ? '+' : '-'}{Math.abs(pricePerSqftVsMarket).toFixed(1)}% vs market
              </Text>
            )}
            {subjectPricePerSqft && (
              <Text style={{ fontSize: 10, color: '#71717a', marginTop: 1 }}>Your: ${Math.round(subjectPricePerSqft)}</Text>
            )}
          </View>
          <View style={{ flex: 1, backgroundColor: '#fafafa', padding: 12, borderRadius: 4, alignItems: 'center' }}>
            <Text style={{ fontSize: 18, fontWeight: 700, color: '#222222' }}>{stats.avgDOM !== null ? `${Math.round(stats.avgDOM)} days` : 'N/A'}</Text>
            <Text style={{ fontSize: 12, color: '#71717a' }}>Avg DOM</Text>
          </View>
        </View>
        
        {/* Simple table matching Preview */}
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#e4e4e7', paddingBottom: 4, marginBottom: 4 }}>
            <Text style={{ flex: 2, fontSize: 12, fontWeight: 600 }}>Address</Text>
            <Text style={{ flex: 1, fontSize: 12, fontWeight: 600, textAlign: 'right' }}>Price</Text>
            <Text style={{ flex: 1, fontSize: 12, fontWeight: 600, textAlign: 'right' }}>Sq Ft</Text>
            <Text style={{ flex: 1, fontSize: 12, fontWeight: 600, textAlign: 'right' }}>Status</Text>
          </View>
          {comparables.map((comp, i) => {
            const status = normalizeStatus(comp.status);
            const statusColor = getStatusColor(status);
            
            return (
              <View key={comp.id || i} style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#f4f4f5', paddingVertical: 4 }}>
                <Text style={{ flex: 2, fontSize: 12, color: '#18181b' }}>{extractFullAddress(comp) || 'Unknown'}</Text>
                <Text style={{ flex: 1, fontSize: 12, textAlign: 'right' }}>{formatPrice(extractPrice(comp))}</Text>
                <Text style={{ flex: 1, fontSize: 12, textAlign: 'right' }}>{formatNumber(extractSqft(comp))}</Text>
                <View style={{ flex: 1, alignItems: 'flex-end' }}>
                  <View style={{ paddingHorizontal: 4, paddingVertical: 2, borderRadius: 2, backgroundColor: statusColor + '20' }}>
                    <Text style={{ fontSize: 10, color: statusColor }}>{status}</Text>
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      </View>
      <PageFooter slideNumber={slideNumber} totalSlides={totalSlides} logoBase64={logoBase64} />
    </Page>
  );
};

const PropertyDetailPage = ({ 
  property, 
  propertyAddress,
  slideNumber, 
  totalSlides,
  logoBase64
}: { 
  property: CmaProperty & { base64PrimaryPhoto?: string; coverPhoto?: string }; 
  propertyAddress: string;
  slideNumber: number; 
  totalSlides: number;
  logoBase64?: string | null;
}) => {
  const price = extractPrice(property);
  const sqft = extractSqft(property);
  const dom = extractDOM(property);
  const beds = extractBeds(property);
  const baths = extractBaths(property);
  const status = normalizeStatus(property.status);
  const address = extractFullAddress(property);
  // Priority: coverPhoto (AI-selected) > base64PrimaryPhoto > first photo from array
  const coverPhoto = (property as any).coverPhoto;
  const base64Photo = (property as any).base64PrimaryPhoto;
  const urlPhoto = getPrimaryPhoto(property);
  const primaryPhoto = coverPhoto || base64Photo || urlPhoto;
  
  return (
    <Page size="LETTER" orientation="landscape" style={styles.page}>
      <PageHeader title={`PROPERTY DETAILS - ${address || 'Property'}`} slideNumber={slideNumber} totalSlides={totalSlides} />
      <View style={styles.content}>
        {/* Property Photo - Full uncropped display with contain mode */}
        <View style={{ height: 280, borderRadius: 4, marginBottom: 16, overflow: 'hidden', backgroundColor: '#f8f8f8' }}>
          {primaryPhoto ? (
            <Image src={primaryPhoto} style={{ width: '100%', height: 280, objectFit: 'contain' }} />
          ) : (
            <View style={{ width: '100%', height: 280, backgroundColor: '#f4f4f5', alignItems: 'center', justifyContent: 'center' }}>
              {/* Building icon placeholder - no emoji */}
              <View style={{ width: 48, height: 48, borderWidth: 3, borderColor: '#a1a1aa', borderRadius: 6 }}>
                <View style={{ position: 'absolute', top: 4, left: 4, right: 4, height: 10, borderBottomWidth: 3, borderColor: '#a1a1aa' }} />
                <View style={{ position: 'absolute', bottom: 6, left: 12, width: 8, height: 14, borderWidth: 2, borderColor: '#a1a1aa' }} />
                <View style={{ position: 'absolute', bottom: 6, right: 12, width: 8, height: 14, borderWidth: 2, borderColor: '#a1a1aa' }} />
              </View>
              <Text style={{ fontSize: 12, color: '#a1a1aa', marginTop: 8 }}>No Photo Available</Text>
            </View>
          )}
        </View>
        
        <Text style={{ fontSize: 18, fontWeight: 700, marginBottom: 12, color: '#222222' }}>{address || 'Property Address'}</Text>
        
        {/* Grid of property details - larger text for better readability */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          <View style={{ width: '48%', flexDirection: 'row' }}>
            <Text style={{ fontSize: 14, color: '#71717a' }}>Price: </Text>
            <Text style={{ fontSize: 14, fontWeight: 600 }}>{formatPrice(price)}</Text>
          </View>
          <View style={{ width: '48%', flexDirection: 'row' }}>
            <Text style={{ fontSize: 14, color: '#71717a' }}>Sq Ft: </Text>
            <Text style={{ fontSize: 14, fontWeight: 600 }}>{formatNumber(sqft)}</Text>
          </View>
          <View style={{ width: '48%', flexDirection: 'row' }}>
            <Text style={{ fontSize: 14, color: '#71717a' }}>Beds: </Text>
            <Text style={{ fontSize: 14, fontWeight: 600 }}>{beds ?? 'N/A'}</Text>
          </View>
          <View style={{ width: '48%', flexDirection: 'row' }}>
            <Text style={{ fontSize: 14, color: '#71717a' }}>Baths: </Text>
            <Text style={{ fontSize: 14, fontWeight: 600 }}>{baths ?? 'N/A'}</Text>
          </View>
          <View style={{ width: '48%', flexDirection: 'row' }}>
            <Text style={{ fontSize: 14, color: '#71717a' }}>DOM: </Text>
            <Text style={{ fontSize: 14, fontWeight: 600 }}>{dom ?? 'N/A'}</Text>
          </View>
          <View style={{ width: '48%', flexDirection: 'row' }}>
            <Text style={{ fontSize: 14, color: '#71717a' }}>Status: </Text>
            <Text style={{ fontSize: 14, fontWeight: 600 }}>{status}</Text>
          </View>
        </View>
      </View>
      <PageFooter slideNumber={slideNumber} totalSlides={totalSlides} logoBase64={logoBase64} />
    </Page>
  );
};

const TimeToSellPage = ({ 
  averageDaysOnMarket, 
  comparables,
  propertyAddress,
  slideNumber, 
  totalSlides,
  logoBase64
}: { 
  averageDaysOnMarket: number;
  comparables: CmaProperty[];
  propertyAddress: string;
  slideNumber: number; 
  totalSlides: number;
  logoBase64?: string | null;
}) => {
  const stats = calculateCMAStats(comparables);
  const avgDays = averageDaysOnMarket ?? stats.avgDOM ?? 0;
  
  return (
    <Page size="LETTER" orientation="landscape" style={styles.page}>
      <PageHeader title="TIME TO SELL" slideNumber={slideNumber} totalSlides={totalSlides} />
      <View style={styles.content}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          {/* Clock icon placeholder - centered like Preview */}
          <View style={{ width: 48, height: 48, marginBottom: 16, borderWidth: 3, borderColor: '#EF4923', borderRadius: 24, alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ width: 2, height: 16, backgroundColor: '#EF4923', position: 'absolute', top: 8 }} />
            <View style={{ width: 12, height: 2, backgroundColor: '#EF4923', position: 'absolute', right: 8 }} />
          </View>
          <Text style={{ fontSize: 36, fontWeight: 700, color: '#222222' }}>{Math.round(avgDays)}</Text>
          <Text style={{ fontSize: 18, color: '#52525b' }}>Average Days on Market</Text>
          <Text style={{ fontSize: 14, color: '#a1a1aa', marginTop: 16 }}>
            Based on {stats.avgDOM !== null ? 'comparable properties' : 'market data'}
          </Text>
        </View>
      </View>
      <PageFooter slideNumber={slideNumber} totalSlides={totalSlides} logoBase64={logoBase64} />
    </Page>
  );
};

const SuggestedPricePage = ({ 
  suggestedListPrice,
  comparables,
  propertyAddress,
  slideNumber, 
  totalSlides,
  logoBase64
}: { 
  suggestedListPrice: number | null | undefined;
  comparables: CmaProperty[];
  propertyAddress: string;
  slideNumber: number; 
  totalSlides: number;
  logoBase64?: string | null;
}) => {
  const stats = calculateCMAStats(comparables);
  const price = suggestedListPrice ?? stats.avgPrice;
  
  return (
    <Page size="LETTER" orientation="landscape" style={styles.page}>
      <PageHeader title="SUGGESTED LIST PRICE" slideNumber={slideNumber} totalSlides={totalSlides} />
      <View style={styles.content}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          {/* Dollar sign icon placeholder - centered like Preview */}
          <View style={{ width: 48, height: 48, marginBottom: 16, borderWidth: 3, borderColor: '#EF4923', borderRadius: 24, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 24, fontWeight: 700, color: '#EF4923' }}>$</Text>
          </View>
          <Text style={{ fontSize: 36, fontWeight: 700, color: '#222222' }}>{price ? formatPrice(price) : 'N/A'}</Text>
          <Text style={{ fontSize: 18, color: '#52525b' }}>Suggested List Price</Text>
          {stats.priceRange && stats.priceRange !== 'N/A' && (
            <Text style={{ fontSize: 14, color: '#a1a1aa', marginTop: 16 }}>
              Range: {stats.priceRange}
            </Text>
          )}
        </View>
      </View>
      <PageFooter slideNumber={slideNumber} totalSlides={totalSlides} logoBase64={logoBase64} />
    </Page>
  );
};

const AveragePricePerAcrePage = ({ 
  avgPricePerAcre,
  comparables,
  propertyAddress,
  slideNumber, 
  totalSlides,
  logoBase64
}: { 
  avgPricePerAcre: number | null | undefined;
  comparables: CmaProperty[];
  propertyAddress: string;
  slideNumber: number; 
  totalSlides: number;
  logoBase64?: string | null;
}) => {
  const stats = calculateCMAStats(comparables);
  const pricePerAcre = avgPricePerAcre ?? stats.avgPricePerAcre;
  
  return (
    <Page size="LETTER" orientation="landscape" style={styles.page}>
      <PageHeader title="AVERAGE PRICE/ACRE" slideNumber={slideNumber} totalSlides={totalSlides} />
      <View style={styles.content}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          {/* Ruler icon placeholder - centered like Preview */}
          <View style={{ width: 48, height: 48, marginBottom: 16, borderWidth: 3, borderColor: '#EF4923', borderRadius: 4, alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ width: 32, height: 2, backgroundColor: '#EF4923' }} />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', width: 32, marginTop: 2 }}>
              <View style={{ width: 2, height: 8, backgroundColor: '#EF4923' }} />
              <View style={{ width: 2, height: 4, backgroundColor: '#EF4923' }} />
              <View style={{ width: 2, height: 8, backgroundColor: '#EF4923' }} />
              <View style={{ width: 2, height: 4, backgroundColor: '#EF4923' }} />
              <View style={{ width: 2, height: 8, backgroundColor: '#EF4923' }} />
            </View>
          </View>
          <Text style={{ fontSize: 36, fontWeight: 700, color: '#222222' }}>{pricePerAcre ? formatPrice(pricePerAcre) : 'N/A'}</Text>
          <Text style={{ fontSize: 18, color: '#52525b' }}>Average Price per Acre</Text>
        </View>
      </View>
      <PageFooter slideNumber={slideNumber} totalSlides={totalSlides} logoBase64={logoBase64} />
    </Page>
  );
};

const ListingActionPlanPage = ({ 
  propertyAddress,
  slideNumber, 
  totalSlides,
  logoBase64
}: { 
  propertyAddress: string;
  slideNumber: number; 
  totalSlides: number;
  logoBase64?: string | null;
}) => {
  const lines = LISTING_ACTION_PLAN_TEXT.split('\n');
  
  return (
    <Page size="LETTER" orientation="landscape" style={styles.page}>
      <PageHeader title="LISTING ACTION PLAN" slideNumber={slideNumber} totalSlides={totalSlides} />
      <View style={styles.content}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          {/* Calendar icon placeholder */}
          <View style={{ width: 24, height: 24, borderWidth: 2, borderColor: '#EF4923', borderRadius: 4, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 10, color: '#EF4923' }}>31</Text>
          </View>
          <Text style={{ fontSize: 18, fontWeight: 700, color: '#222222' }}>LISTING ACTION PLAN</Text>
        </View>
        <View>
          {lines.map((line, i) => (
            <Text key={i} style={{ fontSize: 14, color: '#52525b', lineHeight: 1.5, marginBottom: 4 }}>
              {line}
            </Text>
          ))}
        </View>
      </View>
      <PageFooter slideNumber={slideNumber} totalSlides={totalSlides} logoBase64={logoBase64} />
    </Page>
  );
};

const MarketingPage = ({ 
  propertyAddress,
  slideNumber, 
  totalSlides,
  logoBase64
}: { 
  propertyAddress: string;
  slideNumber: number; 
  totalSlides: number;
  logoBase64?: string | null;
}) => (
  <Page size="LETTER" orientation="landscape" style={styles.page}>
    <PageHeader title="MARKETING" slideNumber={slideNumber} totalSlides={totalSlides} />
    <View style={styles.content}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        {/* TrendingUp icon placeholder */}
        <View style={{ width: 24, height: 24, borderWidth: 2, borderColor: '#EF4923', borderRadius: 4, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ width: 12, height: 8, borderBottomWidth: 2, borderRightWidth: 2, borderColor: '#EF4923' }} />
        </View>
        <Text style={{ fontSize: 18, fontWeight: 700, color: '#222222' }}>MARKETING</Text>
      </View>
      <Text style={{ fontSize: 14, color: '#52525b', lineHeight: 1.5 }}>
        {MARKETING_TEXT}
      </Text>
    </View>
    <PageFooter slideNumber={slideNumber} totalSlides={totalSlides} logoBase64={logoBase64} />
  </Page>
);

const StarRating = ({ rating }: { rating: number }) => (
  <View style={{ flexDirection: 'row', gap: 1 }}>
    {[...Array(5)].map((_, i) => (
      <View 
        key={i} 
        style={{ 
          width: 10, 
          height: 10, 
          backgroundColor: i < rating ? '#FACC15' : '#D1D5DB',
          borderRadius: 1,
        }} 
      />
    ))}
  </View>
);

const ReviewCardPdf = ({ review }: { review: Review }) => (
  <View style={{ 
    borderBottomWidth: 1, 
    borderBottomColor: COLORS.lightGray, 
    paddingVertical: 12,
    paddingHorizontal: 8,
  }}>
    <View style={{ flexDirection: 'row', gap: 8 }}>
      <View style={{ 
        width: 32, 
        height: 32, 
        borderRadius: 16, 
        backgroundColor: review.avatarColor,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <Text style={{ color: COLORS.white, fontSize: 14, fontWeight: 600 }}>{review.authorInitial}</Text>
      </View>
      
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 8, color: COLORS.mediumGray }}>{review.reviewCount}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
          <StarRating rating={review.rating} />
          <Text style={{ fontSize: 8, color: COLORS.mediumGray }}>{review.timeAgo}</Text>
        </View>
      </View>
    </View>
    
    {review.positiveHighlights && review.positiveHighlights.length > 0 && (
      <View style={{ marginTop: 6 }}>
        <Text style={{ fontSize: 8, color: COLORS.textSecondary }}>
          <Text style={{ fontWeight: 600, color: COLORS.textPrimary }}>Positive: </Text>
          {review.positiveHighlights.join(', ')}
        </Text>
      </View>
    )}
    
    <Text style={{ 
      fontSize: 9, 
      color: COLORS.textPrimary, 
      lineHeight: 1.4, 
      marginTop: 6,
    }}>
      {review.text}
    </Text>
  </View>
);

const ClientTestimonialsPage = ({ 
  propertyAddress,
  slideNumber, 
  totalSlides,
  logoBase64
}: { 
  propertyAddress: string;
  slideNumber: number; 
  totalSlides: number;
  logoBase64?: string | null;
}) => (
  <Page size="LETTER" orientation="landscape" style={styles.page}>
    <PageHeader title="CLIENT TESTIMONIALS" slideNumber={slideNumber} totalSlides={totalSlides} />
    <View style={styles.content}>
      <View style={{ flex: 1 }}>
        {SAMPLE_REVIEWS.map((review) => (
          <ReviewCardPdf key={review.id} review={review} />
        ))}
      </View>
      
      <View style={{ 
        borderTopWidth: 1, 
        borderTopColor: COLORS.lightGray, 
        paddingTop: 12,
        alignItems: 'center',
      }}>
        <Text style={{ fontSize: 10, color: COLORS.spyglassOrange, fontWeight: 600 }}>
          Click to read all of our reviews on Google!
        </Text>
      </View>
    </View>
    <PageFooter slideNumber={slideNumber} totalSlides={totalSlides} logoBase64={logoBase64} />
  </Page>
);

const ListingWithSpyglassPage = ({ 
  agent,
  propertyAddress,
  slideNumber, 
  totalSlides,
  logoBase64
}: { 
  agent: AgentProfile;
  propertyAddress: string;
  slideNumber: number; 
  totalSlides: number;
  logoBase64?: string | null;
}) => {
  const youtubeVideoUrl = 'https://www.youtube.com/watch?v=iB_u-ksW3ts';
  
  return (
    <Page size="LETTER" orientation="landscape" style={styles.page}>
      <PageHeader title="LISTING WITH SPYGLASS REALTY" slideNumber={slideNumber} totalSlides={totalSlides} />
      <View style={styles.content}>
        <View style={{ alignItems: 'center', justifyContent: 'center', flex: 1 }}>
          {/* LRE Combined Logo on black background */}
          <View style={{ 
            backgroundColor: '#000000', 
            borderRadius: 8, 
            padding: 20, 
            marginBottom: 24,
            width: '60%',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Image 
              src={lreSgrWhiteLogo} 
              style={{ 
                width: '100%', 
                height: 'auto',
                objectFit: 'contain'
              }} 
            />
          </View>
          
          {/* Video Presentation Label */}
          <Text style={{ 
            fontSize: 10, 
            color: COLORS.mediumGray, 
            textTransform: 'uppercase', 
            letterSpacing: 2, 
            marginBottom: 10 
          }}>
            Video Presentation
          </Text>
          
          {/* YouTube Link */}
          <Text style={{ 
            fontSize: 12, 
            color: COLORS.spyglassOrange, 
            textDecoration: 'underline',
            marginBottom: 8
          }}>
            {youtubeVideoUrl}
          </Text>
          
          <Text style={{ 
            fontSize: 12, 
            color: COLORS.spyglassOrange, 
            fontWeight: 600 
          }}>
            Watch our video presentation
          </Text>
        </View>
      </View>
      <PageFooter slideNumber={slideNumber} totalSlides={totalSlides} logoBase64={logoBase64} />
    </Page>
  );
};

const SpyglassResourcesPage = ({ 
  propertyAddress,
  slideNumber, 
  totalSlides,
  logoBase64
}: { 
  propertyAddress: string;
  slideNumber: number; 
  totalSlides: number;
  logoBase64?: string | null;
}) => (
  <Page size="LETTER" orientation="landscape" style={styles.page}>
    <PageHeader title="SPYGLASS RESOURCES AND LINKS" slideNumber={slideNumber} totalSlides={totalSlides} />
    <View style={styles.content}>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        {/* Link icon placeholder - centered like Preview */}
        <View style={{ width: 48, height: 48, marginBottom: 16, borderWidth: 3, borderColor: '#EF4923', borderRadius: 8, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ width: 16, height: 16, borderWidth: 2, borderColor: '#EF4923', borderRadius: 4 }} />
        </View>
        <Text style={{ fontSize: 16, fontWeight: 500, color: '#3f3f46' }}>SPYGLASS RESOURCES AND LINKS</Text>
        <Text style={{ fontSize: 14, color: '#71717a', marginTop: 8 }}>Agent-managed resources for CMA presentations</Text>
      </View>
    </View>
    <PageFooter slideNumber={slideNumber} totalSlides={totalSlides} logoBase64={logoBase64} />
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
  baseUrl,
  logoBase64
}: { 
  widget: { id?: string; title: string; imagePath?: string };
  propertyAddress: string;
  slideNumber: number; 
  totalSlides: number;
  baseUrl: string;
  logoBase64?: string | null;
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
          <PageFooter slideNumber={slideNumber} totalSlides={totalSlides} logoBase64={logoBase64} />
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
          <Image 
            src={lreSgrWhiteLogo} 
            style={{ width: 280, height: 56, marginBottom: 16 }} 
          />
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
  logoBase64,
}: CmaPdfDocumentProps) {
  const totalSlides = WIDGETS.length;
  const stats = calculateCMAStats(comparables);
  const avgDom = averageDaysOnMarket || stats.avgDOM || 0;
  
  let slideNum = 0;
  
  return (
    <Document>
      <CoverPage propertyAddress={propertyAddress} agent={agent} preparedFor={preparedFor} logoBase64={logoBase64} slideNumber={1} totalSlides={totalSlides} />
      
      {WIDGETS.map((widget, index) => {
        slideNum = index + 1;
        
        switch (widget.id) {
          case 'agent_resume':
            return <AgentResumePage key={widget.id} agent={agent} slideNumber={slideNum} totalSlides={totalSlides} logoBase64={logoBase64} />;
          
          case 'listing_with_spyglass':
            return <ListingWithSpyglassPage key={widget.id} agent={agent} propertyAddress={propertyAddress} slideNumber={slideNum} totalSlides={totalSlides} logoBase64={logoBase64} />;
          
          case 'client_testimonials':
            return <ClientTestimonialsPage key={widget.id} propertyAddress={propertyAddress} slideNumber={slideNum} totalSlides={totalSlides} logoBase64={logoBase64} />;
          
          case 'comps':
            return <ComparablesSummaryPage key={widget.id} comparables={comparables} subjectProperty={subjectProperty} propertyAddress={propertyAddress} slideNumber={slideNum} totalSlides={totalSlides} logoBase64={logoBase64} />;
          
          case 'time_to_sell':
            return <TimeToSellPage key={widget.id} averageDaysOnMarket={avgDom} comparables={comparables} propertyAddress={propertyAddress} slideNumber={slideNum} totalSlides={totalSlides} logoBase64={logoBase64} />;
          
          case 'suggested_list_price':
            return <SuggestedPricePage key={widget.id} suggestedListPrice={suggestedListPrice} comparables={comparables} propertyAddress={propertyAddress} slideNumber={slideNum} totalSlides={totalSlides} logoBase64={logoBase64} />;
          
          case 'average_price_acre':
            return <AveragePricePerAcrePage key={widget.id} avgPricePerAcre={avgPricePerAcre} comparables={comparables} propertyAddress={propertyAddress} slideNumber={slideNum} totalSlides={totalSlides} logoBase64={logoBase64} />;
          
          case 'listing_action_plan':
            return <ListingActionPlanPage key={widget.id} propertyAddress={propertyAddress} slideNumber={slideNum} totalSlides={totalSlides} logoBase64={logoBase64} />;
          
          case 'spyglass_resources':
            return <SpyglassResourcesPage key={widget.id} propertyAddress={propertyAddress} slideNumber={slideNum} totalSlides={totalSlides} logoBase64={logoBase64} />;
          
          case 'marketing':
            return <MarketingPage key={widget.id} propertyAddress={propertyAddress} slideNumber={slideNum} totalSlides={totalSlides} logoBase64={logoBase64} />;
          
          case 'thank_you':
            return <ThankYouPage key={widget.id} agent={agent} slideNumber={slideNum} totalSlides={totalSlides} />;
          
          default:
            return <StaticImagePage key={widget.id} widget={widget} propertyAddress={propertyAddress} slideNumber={slideNum} totalSlides={totalSlides} baseUrl={baseUrl} logoBase64={logoBase64} />;
        }
      })}
      
      {comparables.map((comp, i) => (
        <PropertyDetailPage 
          key={`detail-${comp.id}`} 
          property={comp} 
          propertyAddress={propertyAddress}
          slideNumber={totalSlides + i + 1} 
          totalSlides={totalSlides + comparables.length}
          logoBase64={logoBase64}
        />
      ))}
    </Document>
  );
}
