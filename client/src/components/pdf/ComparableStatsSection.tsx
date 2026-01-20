import { Page, View, Text } from '@react-pdf/renderer';
import { styles, SPYGLASS_ORANGE, SPYGLASS_NAVY, MEDIUM_GRAY } from './styles';
import type { CMAReportData } from '@shared/cma-sections';

interface ComparableStatsSectionProps {
  data: CMAReportData;
}

function formatPrice(price: number): string {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(price);
}

export function ComparableStatsSection({ data }: ComparableStatsSectionProps) {
  const { analysis, comparables, agent } = data;

  const activeCount = comparables.filter(c => 
    c.status.toLowerCase().includes('active')
  ).length;
  
  const soldCount = comparables.filter(c => 
    c.status.toLowerCase().includes('sold') || c.status.toLowerCase().includes('closed')
  ).length;
  
  const pendingCount = comparables.filter(c => 
    c.status.toLowerCase().includes('pending')
  ).length;

  return (
    <Page size="LETTER" style={styles.page}>
      <View style={styles.header}>
        <Text style={{ fontSize: 18, fontWeight: 700, color: SPYGLASS_NAVY }}>
          Comparable Property Statistics
        </Text>
        <Text style={{ fontSize: 12, fontWeight: 600, color: SPYGLASS_ORANGE }}>
          {agent.company || 'SPYGLASS REALTY'}
        </Text>
      </View>

      <View style={{ flexDirection: 'row', gap: 24 }}>
        <View style={[styles.card, { flex: 1 }]}>
          <Text style={{ fontSize: 14, fontWeight: 600, color: SPYGLASS_NAVY, marginBottom: 16 }}>
            Price Analysis
          </Text>
          
          <View style={{ gap: 12 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 11, color: MEDIUM_GRAY }}>Average Price</Text>
              <Text style={{ fontSize: 11, fontWeight: 600, color: SPYGLASS_NAVY }}>
                ${formatPrice(analysis.averagePrice)}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 11, color: MEDIUM_GRAY }}>Median Price</Text>
              <Text style={{ fontSize: 11, fontWeight: 600, color: SPYGLASS_NAVY }}>
                ${formatPrice(analysis.medianPrice)}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 11, color: MEDIUM_GRAY }}>Price Range</Text>
              <Text style={{ fontSize: 11, fontWeight: 600, color: SPYGLASS_NAVY }}>
                ${formatPrice(analysis.priceRange.min)} - ${formatPrice(analysis.priceRange.max)}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 11, color: MEDIUM_GRAY }}>Avg. Price/Sq Ft</Text>
              <Text style={{ fontSize: 11, fontWeight: 600, color: SPYGLASS_ORANGE }}>
                ${analysis.averagePricePerSqft}
              </Text>
            </View>
          </View>
        </View>

        <View style={[styles.card, { flex: 1 }]}>
          <Text style={{ fontSize: 14, fontWeight: 600, color: SPYGLASS_NAVY, marginBottom: 16 }}>
            Market Activity
          </Text>
          
          <View style={{ gap: 12 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 11, color: MEDIUM_GRAY }}>Avg. Days on Market</Text>
              <Text style={{ fontSize: 11, fontWeight: 600, color: SPYGLASS_NAVY }}>
                {analysis.averageDaysOnMarket} days
              </Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 11, color: MEDIUM_GRAY }}>Active Listings</Text>
              <Text style={{ fontSize: 11, fontWeight: 600, color: SPYGLASS_ORANGE }}>
                {activeCount}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 11, color: MEDIUM_GRAY }}>Sold/Closed</Text>
              <Text style={{ fontSize: 11, fontWeight: 600, color: '#16a34a' }}>
                {soldCount}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 11, color: MEDIUM_GRAY }}>Pending</Text>
              <Text style={{ fontSize: 11, fontWeight: 600, color: '#ca8a04' }}>
                {pendingCount}
              </Text>
            </View>
          </View>
        </View>
      </View>

      <View style={[styles.card, { marginTop: 24 }]}>
        <Text style={{ fontSize: 14, fontWeight: 600, color: SPYGLASS_NAVY, marginBottom: 16 }}>
          Property Size Comparison
        </Text>
        
        <View style={{ gap: 12 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ fontSize: 11, color: MEDIUM_GRAY }}>Total Comparables</Text>
            <Text style={{ fontSize: 11, fontWeight: 600, color: SPYGLASS_NAVY }}>
              {comparables.length} properties
            </Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ fontSize: 11, color: MEDIUM_GRAY }}>Avg. Square Footage</Text>
            <Text style={{ fontSize: 11, fontWeight: 600, color: SPYGLASS_NAVY }}>
              {comparables.length > 0 
                ? Math.round(comparables.reduce((sum, c) => sum + (c.sqft || 0), 0) / comparables.length).toLocaleString()
                : '-'} sq ft
            </Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ fontSize: 11, color: MEDIUM_GRAY }}>Avg. Bedrooms</Text>
            <Text style={{ fontSize: 11, fontWeight: 600, color: SPYGLASS_NAVY }}>
              {comparables.length > 0 
                ? (comparables.reduce((sum, c) => sum + (c.bedrooms || 0), 0) / comparables.length).toFixed(1)
                : '-'}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ fontSize: 11, color: MEDIUM_GRAY }}>Avg. Bathrooms</Text>
            <Text style={{ fontSize: 11, fontWeight: 600, color: SPYGLASS_NAVY }}>
              {comparables.length > 0 
                ? (comparables.reduce((sum, c) => sum + (c.bathrooms || 0), 0) / comparables.length).toFixed(1)
                : '-'}
            </Text>
          </View>
        </View>
      </View>

      {analysis.suggestedListPrice && (
        <View style={[styles.card, { marginTop: 24, backgroundColor: '#fff7ed', borderWidth: 2, borderColor: SPYGLASS_ORANGE }]}>
          <Text style={{ fontSize: 14, fontWeight: 600, color: SPYGLASS_NAVY, marginBottom: 8 }}>
            Suggested List Price
          </Text>
          <Text style={{ fontSize: 28, fontWeight: 700, color: SPYGLASS_ORANGE }}>
            ${formatPrice(analysis.suggestedListPrice)}
          </Text>
          <Text style={{ fontSize: 10, color: MEDIUM_GRAY, marginTop: 8 }}>
            Based on comparable property analysis
          </Text>
        </View>
      )}
    </Page>
  );
}
