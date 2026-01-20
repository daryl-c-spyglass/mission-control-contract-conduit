import { Page, View, Text } from '@react-pdf/renderer';
import { styles, SPYGLASS_ORANGE, SPYGLASS_NAVY, MEDIUM_GRAY } from './styles';
import type { CMAReportData } from '@shared/cma-sections';

interface SummaryComparablesSectionProps {
  data: CMAReportData;
}

function formatPrice(price: number): string {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(price);
}

function formatNumber(num: number): string {
  return new Intl.NumberFormat('en-US').format(num);
}

function getStatusColor(status: string): string {
  const lower = status.toLowerCase();
  if (lower.includes('sold') || lower.includes('closed')) return '#16a34a';
  if (lower.includes('pending')) return '#ca8a04';
  if (lower.includes('active')) return SPYGLASS_ORANGE;
  return MEDIUM_GRAY;
}

export function SummaryComparablesSection({ data }: SummaryComparablesSectionProps) {
  const { subjectProperty, comparables, analysis, agent } = data;

  return (
    <Page size="LETTER" style={styles.page}>
      <View style={styles.header}>
        <Text style={{ fontSize: 18, fontWeight: 700, color: SPYGLASS_NAVY }}>
          Summary of Comparable Properties
        </Text>
        <Text style={{ fontSize: 12, fontWeight: 600, color: SPYGLASS_ORANGE }}>
          {agent.company || 'SPYGLASS REALTY'}
        </Text>
      </View>

      <View style={styles.table}>
        <View style={styles.tableHeader}>
          <Text style={[styles.tableCellHeader, { width: '25%' }]}>Address</Text>
          <Text style={[styles.tableCellHeader, { width: '10%', textAlign: 'center' }]}>Status</Text>
          <Text style={[styles.tableCellHeader, { width: '15%', textAlign: 'right' }]}>Price</Text>
          <Text style={[styles.tableCellHeader, { width: '8%', textAlign: 'center' }]}>Beds</Text>
          <Text style={[styles.tableCellHeader, { width: '8%', textAlign: 'center' }]}>Baths</Text>
          <Text style={[styles.tableCellHeader, { width: '10%', textAlign: 'right' }]}>Sq Ft</Text>
          <Text style={[styles.tableCellHeader, { width: '10%', textAlign: 'right' }]}>$/SqFt</Text>
          <Text style={[styles.tableCellHeader, { width: '7%', textAlign: 'center' }]}>DOM</Text>
          <Text style={[styles.tableCellHeader, { width: '7%', textAlign: 'right' }]}>Dist</Text>
        </View>

        <View style={styles.tableRowHighlight}>
          <Text style={[styles.tableCell, { width: '25%', fontWeight: 600 }]}>
            {subjectProperty.address} (Subject)
          </Text>
          <View style={{ width: '10%', alignItems: 'center' }}>
            <View style={[styles.statusBadge, { backgroundColor: SPYGLASS_ORANGE }]}>
              <Text style={{ fontSize: 7, color: '#ffffff' }}>{subjectProperty.status}</Text>
            </View>
          </View>
          <Text style={[styles.tableCell, { width: '15%', textAlign: 'right', fontWeight: 600, color: SPYGLASS_ORANGE }]}>
            ${formatPrice(subjectProperty.listPrice)}
          </Text>
          <Text style={[styles.tableCell, { width: '8%', textAlign: 'center' }]}>{subjectProperty.bedrooms || '-'}</Text>
          <Text style={[styles.tableCell, { width: '8%', textAlign: 'center' }]}>{subjectProperty.bathrooms || '-'}</Text>
          <Text style={[styles.tableCell, { width: '10%', textAlign: 'right' }]}>
            {subjectProperty.sqft ? formatNumber(subjectProperty.sqft) : '-'}
          </Text>
          <Text style={[styles.tableCell, { width: '10%', textAlign: 'right' }]}>
            ${subjectProperty.sqft && subjectProperty.listPrice 
              ? Math.round(subjectProperty.listPrice / subjectProperty.sqft) 
              : '-'}
          </Text>
          <Text style={[styles.tableCell, { width: '7%', textAlign: 'center' }]}>-</Text>
          <Text style={[styles.tableCell, { width: '7%', textAlign: 'right' }]}>-</Text>
        </View>

        {comparables.map((comp, index) => (
          <View key={index} style={styles.tableRow}>
            <Text style={[styles.tableCell, { width: '25%' }]}>{comp.address}</Text>
            <View style={{ width: '10%', alignItems: 'center' }}>
              <View style={[styles.statusBadge, { backgroundColor: getStatusColor(comp.status) }]}>
                <Text style={{ fontSize: 7, color: '#ffffff' }}>{comp.status}</Text>
              </View>
            </View>
            <Text style={[styles.tableCell, { width: '15%', textAlign: 'right' }]}>
              ${formatPrice(comp.soldPrice || comp.listPrice)}
            </Text>
            <Text style={[styles.tableCell, { width: '8%', textAlign: 'center' }]}>{comp.bedrooms || '-'}</Text>
            <Text style={[styles.tableCell, { width: '8%', textAlign: 'center' }]}>{comp.bathrooms || '-'}</Text>
            <Text style={[styles.tableCell, { width: '10%', textAlign: 'right' }]}>
              {comp.sqft ? formatNumber(comp.sqft) : '-'}
            </Text>
            <Text style={[styles.tableCell, { width: '10%', textAlign: 'right' }]}>
              ${comp.pricePerSqft || '-'}
            </Text>
            <Text style={[styles.tableCell, { width: '7%', textAlign: 'center' }]}>{comp.daysOnMarket || '-'}</Text>
            <Text style={[styles.tableCell, { width: '7%', textAlign: 'right' }]}>
              {comp.distance ? `${comp.distance.toFixed(1)}mi` : '-'}
            </Text>
          </View>
        ))}
      </View>

      <View style={styles.statsGrid}>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>${formatPrice(analysis.averagePrice)}</Text>
          <Text style={styles.statLabel}>Avg. Price</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={[styles.statValue, { color: SPYGLASS_NAVY }]}>${analysis.averagePricePerSqft}</Text>
          <Text style={styles.statLabel}>Avg. $/Sq Ft</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={[styles.statValue, { color: SPYGLASS_NAVY }]}>{analysis.averageDaysOnMarket}</Text>
          <Text style={styles.statLabel}>Avg. Days on Market</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={[styles.statValue, { color: SPYGLASS_NAVY }]}>{comparables.length}</Text>
          <Text style={styles.statLabel}>Comparables</Text>
        </View>
      </View>
    </Page>
  );
}
