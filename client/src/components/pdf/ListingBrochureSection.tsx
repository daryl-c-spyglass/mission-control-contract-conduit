import { Page, View, Text, Image } from '@react-pdf/renderer';
import { styles, SPYGLASS_ORANGE, SPYGLASS_NAVY, MEDIUM_GRAY } from './styles';
import type { CMAReportData } from '@shared/cma-sections';

interface ListingBrochureSectionProps {
  data: CMAReportData;
}

function formatPrice(price: number): string {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(price);
}

function formatNumber(num: number): string {
  return new Intl.NumberFormat('en-US').format(num);
}

export function ListingBrochureSection({ data }: ListingBrochureSectionProps) {
  const { subjectProperty, agent } = data;
  const mainPhoto = subjectProperty.photos?.[0];
  const additionalPhotos = subjectProperty.photos?.slice(1, 4) || [];

  return (
    <Page size="LETTER" style={styles.page}>
      <View style={styles.header}>
        <Text style={{ fontSize: 14, fontWeight: 600, color: SPYGLASS_ORANGE }}>
          {agent.company || 'SPYGLASS REALTY'}
        </Text>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={{ fontSize: 12, color: MEDIUM_GRAY }}>
            MLS# {subjectProperty.mlsNumber}
          </Text>
          <Text style={{ fontSize: 10, color: MEDIUM_GRAY }}>
            {subjectProperty.status}
          </Text>
        </View>
      </View>

      {mainPhoto && (
        <Image src={mainPhoto} style={styles.propertyPhoto} />
      )}

      <View style={{ flexDirection: 'row', gap: 24 }}>
        <View style={{ flex: 2 }}>
          <Text style={styles.title}>{subjectProperty.address}</Text>
          <Text style={styles.subtitle}>
            {subjectProperty.city}, {subjectProperty.state} {subjectProperty.zip}
          </Text>

          <Text style={styles.price}>${formatPrice(subjectProperty.listPrice)}</Text>

          <View style={styles.specsRow}>
            <View style={styles.specItem}>
              <Text style={styles.specValue}>{subjectProperty.bedrooms || '-'}</Text>
              <Text style={styles.specLabel}>Beds</Text>
            </View>
            <View style={styles.specItem}>
              <Text style={styles.specValue}>{subjectProperty.bathrooms || '-'}</Text>
              <Text style={styles.specLabel}>Baths</Text>
            </View>
            <View style={styles.specItem}>
              <Text style={styles.specValue}>{subjectProperty.sqft ? formatNumber(subjectProperty.sqft) : '-'}</Text>
              <Text style={styles.specLabel}>Sq Ft</Text>
            </View>
            <View style={styles.specItem}>
              <Text style={styles.specValue}>{subjectProperty.yearBuilt || '-'}</Text>
              <Text style={styles.specLabel}>Year Built</Text>
            </View>
          </View>

          {subjectProperty.description && (
            <Text style={[styles.text, { marginTop: 12 }]}>
              {subjectProperty.description.length > 600 
                ? subjectProperty.description.substring(0, 600) + '...'
                : subjectProperty.description}
            </Text>
          )}
        </View>

        {additionalPhotos.length > 0 && (
          <View style={{ flex: 1, gap: 8 }}>
            {additionalPhotos.map((photo, index) => (
              <Image 
                key={index} 
                src={photo} 
                style={{ width: '100%', height: 80, objectFit: 'cover', borderRadius: 4 }} 
              />
            ))}
          </View>
        )}
      </View>

      <View style={styles.footer}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {agent.photo && (
            <Image src={agent.photo} style={{ width: 36, height: 36, borderRadius: 18, objectFit: 'cover' }} />
          )}
          <View>
            <Text style={{ fontSize: 12, fontWeight: 600, color: SPYGLASS_NAVY }}>
              {agent.firstName} {agent.lastName}
            </Text>
            <Text style={{ fontSize: 10, color: MEDIUM_GRAY }}>{agent.title}</Text>
          </View>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={{ fontSize: 10, color: MEDIUM_GRAY }}>{agent.phone}</Text>
          <Text style={{ fontSize: 10, color: MEDIUM_GRAY }}>{agent.email}</Text>
        </View>
      </View>
    </Page>
  );
}
