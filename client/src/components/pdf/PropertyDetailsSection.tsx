import { Page, View, Text, Image } from '@react-pdf/renderer';
import { styles, SPYGLASS_ORANGE, SPYGLASS_NAVY, MEDIUM_GRAY } from './styles';
import type { CMAComparable } from '@shared/cma-sections';

interface PropertyDetailsSectionProps {
  property: CMAComparable & { base64Photos?: string[] };
  index: number;
  company?: string;
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

export function PropertyDetailsSection({ property, index, company }: PropertyDetailsSectionProps) {
  const base64Photos = (property as any).base64Photos || [];
  const urlPhotos = property.photos || [];
  const mainPhoto = base64Photos[0] || urlPhotos[0];
  const base64Additional = base64Photos.slice(1, 5);
  const urlAdditional = urlPhotos.slice(1, 5);
  const additionalPhotos = base64Additional.length > 0 
    ? [...base64Additional, ...urlAdditional.slice(base64Additional.length)].slice(0, 4)
    : urlAdditional;
  const displayPrice = property.soldPrice || property.listPrice;

  return (
    <Page size="LETTER" style={styles.page}>
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ 
            width: 28, 
            height: 28, 
            borderRadius: 14, 
            backgroundColor: SPYGLASS_ORANGE,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Text style={{ fontSize: 12, fontWeight: 600, color: '#ffffff' }}>{index}</Text>
          </View>
          <Text style={{ fontSize: 16, fontWeight: 600, color: SPYGLASS_NAVY }}>
            Comparable #{index}
          </Text>
        </View>
        <Text style={{ fontSize: 12, fontWeight: 600, color: SPYGLASS_ORANGE }}>
          {company || 'SPYGLASS REALTY'}
        </Text>
      </View>

      {mainPhoto && (
        <Image src={mainPhoto} style={styles.propertyPhoto} />
      )}

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 18, fontWeight: 600, color: SPYGLASS_NAVY, marginBottom: 4 }}>
            {property.address}
          </Text>
          <Text style={{ fontSize: 11, color: MEDIUM_GRAY }}>
            MLS# {property.mlsNumber}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <View style={{ 
            paddingVertical: 4, 
            paddingHorizontal: 12, 
            borderRadius: 4, 
            backgroundColor: getStatusColor(property.status),
          }}>
            <Text style={{ fontSize: 10, color: '#ffffff', fontWeight: 600 }}>
              {property.status}
            </Text>
          </View>
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: 24 }}>
        <View style={{ flex: 2 }}>
          <Text style={styles.price}>${formatPrice(displayPrice)}</Text>
          {property.soldPrice && property.listPrice !== property.soldPrice && (
            <Text style={{ fontSize: 11, color: MEDIUM_GRAY, marginBottom: 16 }}>
              List Price: ${formatPrice(property.listPrice)}
            </Text>
          )}

          <View style={styles.specsRow}>
            <View style={styles.specItem}>
              <Text style={styles.specValue}>{property.bedrooms || '-'}</Text>
              <Text style={styles.specLabel}>Beds</Text>
            </View>
            <View style={styles.specItem}>
              <Text style={styles.specValue}>{property.bathrooms || '-'}</Text>
              <Text style={styles.specLabel}>Baths</Text>
            </View>
            <View style={styles.specItem}>
              <Text style={styles.specValue}>{property.sqft ? formatNumber(property.sqft) : '-'}</Text>
              <Text style={styles.specLabel}>Sq Ft</Text>
            </View>
            <View style={styles.specItem}>
              <Text style={styles.specValue}>{property.yearBuilt || '-'}</Text>
              <Text style={styles.specLabel}>Year Built</Text>
            </View>
          </View>

          <View style={[styles.card, { marginTop: 16, padding: 12 }]}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
              <View style={{ width: '45%' }}>
                <Text style={{ fontSize: 10, color: MEDIUM_GRAY }}>Price/Sq Ft</Text>
                <Text style={{ fontSize: 12, fontWeight: 600, color: SPYGLASS_ORANGE }}>
                  ${property.pricePerSqft || '-'}
                </Text>
              </View>
              <View style={{ width: '45%' }}>
                <Text style={{ fontSize: 10, color: MEDIUM_GRAY }}>Days on Market</Text>
                <Text style={{ fontSize: 12, fontWeight: 600, color: SPYGLASS_NAVY }}>
                  {property.daysOnMarket || '-'} days
                </Text>
              </View>
              <View style={{ width: '45%' }}>
                <Text style={{ fontSize: 10, color: MEDIUM_GRAY }}>Lot Size</Text>
                <Text style={{ fontSize: 12, fontWeight: 600, color: SPYGLASS_NAVY }}>
                  {property.lotSize ? formatNumber(property.lotSize) + ' sq ft' : '-'}
                </Text>
              </View>
              <View style={{ width: '45%' }}>
                <Text style={{ fontSize: 10, color: MEDIUM_GRAY }}>Distance</Text>
                <Text style={{ fontSize: 12, fontWeight: 600, color: SPYGLASS_NAVY }}>
                  {property.distance ? property.distance.toFixed(2) + ' mi' : '-'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {additionalPhotos.length > 0 && (
          <View style={{ flex: 1, gap: 6 }}>
            {additionalPhotos.map((photo, idx) => (
              <Image 
                key={idx} 
                src={photo} 
                style={{ width: '100%', height: 70, objectFit: 'cover', borderRadius: 4 }} 
              />
            ))}
          </View>
        )}
      </View>
    </Page>
  );
}
