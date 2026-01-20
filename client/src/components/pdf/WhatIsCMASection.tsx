import { Page, View, Text } from '@react-pdf/renderer';
import { styles, SPYGLASS_ORANGE, SPYGLASS_NAVY, MEDIUM_GRAY } from './styles';
import type { CMAReportData } from '@shared/cma-sections';

interface WhatIsCMASectionProps {
  data: CMAReportData;
}

export function WhatIsCMASection({ data }: WhatIsCMASectionProps) {
  const { agent } = data;

  return (
    <Page size="LETTER" style={styles.page}>
      <View style={styles.header}>
        <Text style={{ fontSize: 18, fontWeight: 700, color: SPYGLASS_NAVY }}>
          What is a CMA?
        </Text>
        <Text style={{ fontSize: 12, fontWeight: 600, color: SPYGLASS_ORANGE }}>
          {agent.company || 'SPYGLASS REALTY'}
        </Text>
      </View>

      <Text style={{ fontSize: 14, fontWeight: 600, color: SPYGLASS_NAVY, marginBottom: 16 }}>
        Comparative Market Analysis
      </Text>

      <Text style={[styles.text, { marginBottom: 16 }]}>
        A Comparative Market Analysis (CMA) is a detailed evaluation of recently sold properties 
        (called "comparables" or "comps") that are similar in location, size, and features to a 
        subject property. Real estate professionals use CMAs to help sellers determine a competitive 
        listing price and to help buyers make informed offers.
      </Text>

      <Text style={{ fontSize: 14, fontWeight: 600, color: SPYGLASS_NAVY, marginBottom: 12, marginTop: 20 }}>
        How a CMA Helps You
      </Text>

      <View style={{ gap: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
          <Text style={{ fontSize: 16, color: SPYGLASS_ORANGE }}>1</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 12, fontWeight: 600, color: SPYGLASS_NAVY, marginBottom: 2 }}>
              Accurate Pricing
            </Text>
            <Text style={styles.textSmall}>
              Understand your property's value based on real market data, not guesswork.
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
          <Text style={{ fontSize: 16, color: SPYGLASS_ORANGE }}>2</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 12, fontWeight: 600, color: SPYGLASS_NAVY, marginBottom: 2 }}>
              Market Insight
            </Text>
            <Text style={styles.textSmall}>
              Learn about current market trends, average days on market, and price per square foot.
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
          <Text style={{ fontSize: 16, color: SPYGLASS_ORANGE }}>3</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 12, fontWeight: 600, color: SPYGLASS_NAVY, marginBottom: 2 }}>
              Negotiation Power
            </Text>
            <Text style={styles.textSmall}>
              Make informed decisions backed by data when negotiating offers.
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
          <Text style={{ fontSize: 16, color: SPYGLASS_ORANGE }}>4</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 12, fontWeight: 600, color: SPYGLASS_NAVY, marginBottom: 2 }}>
              Strategic Planning
            </Text>
            <Text style={styles.textSmall}>
              Plan your buying or selling strategy based on comprehensive market analysis.
            </Text>
          </View>
        </View>
      </View>

      <View style={[styles.card, { marginTop: 32, backgroundColor: '#fff7ed' }]}>
        <Text style={{ fontSize: 12, fontWeight: 600, color: SPYGLASS_NAVY, marginBottom: 8 }}>
          Professional Expertise
        </Text>
        <Text style={[styles.textSmall, { color: MEDIUM_GRAY }]}>
          This CMA was prepared by a licensed real estate professional using the most current 
          market data available. The analysis takes into account property features, location, 
          market conditions, and comparable sales to provide you with an accurate assessment 
          of your property's value in today's market.
        </Text>
      </View>
    </Page>
  );
}
