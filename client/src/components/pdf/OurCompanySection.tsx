import { Page, View, Text } from '@react-pdf/renderer';
import { styles, SPYGLASS_ORANGE, SPYGLASS_NAVY, MEDIUM_GRAY } from './styles';
import type { CMAReportData } from '@shared/cma-sections';

interface OurCompanySectionProps {
  data: CMAReportData;
}

export function OurCompanySection({ data }: OurCompanySectionProps) {
  const { agent } = data;
  const companyName = agent.company || 'SPYGLASS REALTY';

  return (
    <Page size="LETTER" style={[styles.page, { justifyContent: 'center' }]}>
      <View style={{ alignItems: 'center', marginBottom: 40 }}>
        <Text style={{ fontSize: 14, fontWeight: 600, color: SPYGLASS_ORANGE, letterSpacing: 2, marginBottom: 16 }}>
          {companyName}
        </Text>
        <Text style={{ fontSize: 28, fontWeight: 700, color: SPYGLASS_NAVY, textAlign: 'center' }}>
          Your Trusted Real Estate Partner
        </Text>
      </View>

      <View style={{ gap: 24 }}>
        <View style={styles.card}>
          <Text style={{ fontSize: 14, fontWeight: 600, color: SPYGLASS_NAVY, marginBottom: 8 }}>
            Our Mission
          </Text>
          <Text style={styles.text}>
            We are committed to providing exceptional real estate services through expertise, 
            integrity, and personalized attention. Our goal is to make your real estate journey 
            as smooth and successful as possible.
          </Text>
        </View>

        <View style={{ flexDirection: 'row', gap: 16 }}>
          <View style={[styles.card, { flex: 1 }]}>
            <Text style={{ fontSize: 24, fontWeight: 700, color: SPYGLASS_ORANGE, marginBottom: 4 }}>
              100+
            </Text>
            <Text style={styles.textSmall}>Homes Sold</Text>
          </View>
          <View style={[styles.card, { flex: 1 }]}>
            <Text style={{ fontSize: 24, fontWeight: 700, color: SPYGLASS_ORANGE, marginBottom: 4 }}>
              98%
            </Text>
            <Text style={styles.textSmall}>Client Satisfaction</Text>
          </View>
          <View style={[styles.card, { flex: 1 }]}>
            <Text style={{ fontSize: 24, fontWeight: 700, color: SPYGLASS_ORANGE, marginBottom: 4 }}>
              15+
            </Text>
            <Text style={styles.textSmall}>Years Experience</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={{ fontSize: 14, fontWeight: 600, color: SPYGLASS_NAVY, marginBottom: 8 }}>
            Why Choose Us
          </Text>
          <View style={{ gap: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: SPYGLASS_ORANGE }} />
              <Text style={styles.text}>Deep local market knowledge and expertise</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: SPYGLASS_ORANGE }} />
              <Text style={styles.text}>Personalized service tailored to your needs</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: SPYGLASS_ORANGE }} />
              <Text style={styles.text}>Proven track record of successful transactions</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: SPYGLASS_ORANGE }} />
              <Text style={styles.text}>Cutting-edge technology and marketing strategies</Text>
            </View>
          </View>
        </View>
      </View>

      <View style={{ marginTop: 'auto', paddingTop: 32, alignItems: 'center' }}>
        <Text style={{ fontSize: 11, color: MEDIUM_GRAY, textAlign: 'center' }}>
          Ready to make your next move? Contact us today.
        </Text>
      </View>
    </Page>
  );
}
