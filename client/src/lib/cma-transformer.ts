import type { Property, PropertyStatistics, Cma } from "@shared/schema";
import type { CMAReportData, CMASubjectProperty, CMAComparable, CMAAgentInfo, CMAAnalysisData, CMAReportMetadata } from "@shared/cma-sections";

function getPropertyAddress(property: Property): string {
  return property.unparsedAddress || 
    `${property.streetNumber || ''} ${property.streetName || ''} ${property.streetSuffix || ''}`.trim() || 
    property.city || '';
}

export function transformPropertyToSubject(property: Property): CMASubjectProperty {
  const photos: string[] = (property as any).photos || [];
  
  return {
    address: getPropertyAddress(property),
    city: property.city || '',
    state: property.state || 'TX',
    zip: property.postalCode || '',
    mlsNumber: property.mlsNumber || '',
    listPrice: property.listPrice || 0,
    bedrooms: property.bedrooms || 0,
    bathrooms: property.bathrooms || 0,
    sqft: property.livingArea || property.sqft || 0,
    lotSize: property.lotSize || 0,
    yearBuilt: property.yearBuilt || 0,
    propertyType: property.propertyType || '',
    description: property.publicRemarks || '',
    photos,
    listDate: property.listDate || '',
    status: property.standardStatus || 'Active',
  };
}

export function transformPropertyToComparable(property: Property, subjectProperty?: Property): CMAComparable {
  const photos: string[] = (property as any).photos || [];
  const sqft = property.livingArea || property.sqft || 0;
  const price = property.closePrice || property.listPrice || 0;
  const pricePerSqft = sqft > 0 ? Math.round(price / sqft) : 0;
  
  let distance = 0;
  if (subjectProperty?.latitude && subjectProperty?.longitude && property.latitude && property.longitude) {
    distance = calculateDistance(
      subjectProperty.latitude,
      subjectProperty.longitude,
      property.latitude,
      property.longitude
    );
  }
  
  return {
    address: getPropertyAddress(property),
    mlsNumber: property.mlsNumber || '',
    listPrice: property.listPrice || 0,
    soldPrice: property.closePrice,
    bedrooms: property.bedrooms || 0,
    bathrooms: property.bathrooms || 0,
    sqft,
    lotSize: property.lotSize || 0,
    yearBuilt: property.yearBuilt || 0,
    daysOnMarket: property.daysOnMarket || 0,
    distance,
    status: property.standardStatus || 'Active',
    photos,
    pricePerSqft,
  };
}

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3959;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function calculateAnalysisData(comparables: CMAComparable[], statistics?: PropertyStatistics): CMAAnalysisData {
  if (comparables.length === 0) {
    return {
      averagePrice: 0,
      averagePricePerSqft: 0,
      medianPrice: 0,
      priceRange: { min: 0, max: 0 },
      averageDaysOnMarket: 0,
    };
  }

  const prices = comparables.map(c => c.soldPrice || c.listPrice).filter(p => p > 0);
  const pricesPerSqft = comparables.map(c => c.pricePerSqft).filter(p => p > 0);
  const doms = comparables.map(c => c.daysOnMarket).filter(d => d > 0);

  const sortedPrices = [...prices].sort((a, b) => a - b);
  const medianPrice = sortedPrices.length > 0
    ? sortedPrices[Math.floor(sortedPrices.length / 2)]
    : 0;

  const avgPrice = prices.length > 0 ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : 0;
  const avgPricePerSqft = pricesPerSqft.length > 0 ? Math.round(pricesPerSqft.reduce((a, b) => a + b, 0) / pricesPerSqft.length) : 0;
  const avgDom = doms.length > 0 ? Math.round(doms.reduce((a, b) => a + b, 0) / doms.length) : 0;

  return {
    averagePrice: statistics?.price?.average || avgPrice,
    averagePricePerSqft: statistics?.pricePerSqFt?.average || avgPricePerSqft,
    medianPrice: statistics?.price?.median || medianPrice,
    priceRange: {
      min: statistics?.price?.range?.min || Math.min(...prices, 0),
      max: statistics?.price?.range?.max || Math.max(...prices, 0),
    },
    averageDaysOnMarket: statistics?.daysOnMarket?.average || avgDom,
    suggestedListPrice: undefined,
  };
}

export function transformToCMAReportData(
  cma: Cma,
  subjectProperty: Property | undefined,
  comparableProperties: Property[],
  agentInfo?: Partial<CMAAgentInfo>,
  statistics?: PropertyStatistics
): CMAReportData {
  const subject = subjectProperty 
    ? transformPropertyToSubject(subjectProperty)
    : {
        address: cma.name || 'Subject Property',
        city: '',
        state: 'TX',
        zip: '',
        mlsNumber: cma.subjectPropertyId || '',
        listPrice: 0,
        bedrooms: 0,
        bathrooms: 0,
        sqft: 0,
        lotSize: 0,
        yearBuilt: 0,
        propertyType: '',
        description: '',
        photos: [],
        listDate: '',
        status: 'Active',
      };

  const comparables = comparableProperties.map(p => 
    transformPropertyToComparable(p, subjectProperty)
  );

  const analysis = calculateAnalysisData(comparables, statistics);

  const agent: CMAAgentInfo = {
    firstName: agentInfo?.firstName || 'Agent',
    lastName: agentInfo?.lastName || '',
    title: agentInfo?.title || 'Real Estate Professional',
    email: agentInfo?.email || '',
    phone: agentInfo?.phone || '',
    photo: agentInfo?.photo || '',
    company: agentInfo?.company || 'Spyglass Realty',
    bio: agentInfo?.bio,
    coverLetter: agentInfo?.coverLetter,
  };

  const metadata: CMAReportMetadata = {
    preparedFor: (cma as any).clientName || '',
    preparedDate: new Date().toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    }),
    reportTitle: cma.name || 'Comparative Market Analysis',
  };

  return {
    subjectProperty: subject,
    comparables,
    agent,
    analysis,
    metadata,
  };
}
