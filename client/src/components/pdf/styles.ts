import { StyleSheet, Font } from '@react-pdf/renderer';

Font.register({
  family: 'Inter',
  fonts: [
    { src: 'https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiJ-Ek-_EeA.woff2', fontWeight: 400 },
    { src: 'https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuI6fAZ9hiJ-Ek-_EeA.woff2', fontWeight: 500 },
    { src: 'https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuGKYAZ9hiJ-Ek-_EeA.woff2', fontWeight: 600 },
    { src: 'https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuFuYAZ9hiJ-Ek-_EeA.woff2', fontWeight: 700 },
  ],
});

export const SPYGLASS_ORANGE = '#F37216';
export const SPYGLASS_NAVY = '#1a1a2e';
export const LIGHT_GRAY = '#9ca3af';
export const MEDIUM_GRAY = '#666666';
export const DARK_GRAY = '#333333';

export const styles = StyleSheet.create({
  page: {
    flexDirection: 'column',
    backgroundColor: '#ffffff',
    fontFamily: 'Inter',
    fontSize: 12,
    padding: 40,
  },
  coverPage: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SPYGLASS_NAVY,
    color: '#ffffff',
    padding: 0,
    height: '100%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 12,
    borderBottomWidth: 2,
    borderBottomColor: SPYGLASS_ORANGE,
  },
  logo: {
    height: 30,
    width: 120,
  },
  logoLarge: {
    height: 50,
    width: 200,
  },
  title: {
    fontSize: 24,
    fontWeight: 700,
    color: SPYGLASS_NAVY,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: LIGHT_GRAY,
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 600,
    color: SPYGLASS_NAVY,
    marginBottom: 16,
    marginTop: 24,
  },
  row: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  column: {
    flexDirection: 'column',
  },
  price: {
    fontSize: 28,
    fontWeight: 700,
    color: SPYGLASS_ORANGE,
    marginBottom: 8,
  },
  priceSmall: {
    fontSize: 16,
    fontWeight: 600,
    color: SPYGLASS_ORANGE,
  },
  label: {
    fontSize: 10,
    color: LIGHT_GRAY,
    marginBottom: 2,
  },
  value: {
    fontSize: 14,
    fontWeight: 600,
    color: SPYGLASS_NAVY,
  },
  text: {
    fontSize: 11,
    lineHeight: 1.6,
    color: DARK_GRAY,
  },
  textSmall: {
    fontSize: 10,
    color: MEDIUM_GRAY,
  },
  card: {
    padding: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    marginBottom: 16,
  },
  table: {
    width: '100%',
    marginBottom: 16,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f8f9fa',
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderBottomWidth: 2,
    borderBottomColor: '#dee2e6',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#dee2e6',
  },
  tableRowHighlight: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#dee2e6',
    backgroundColor: '#fff7ed',
  },
  tableCell: {
    fontSize: 9,
    color: DARK_GRAY,
  },
  tableCellHeader: {
    fontSize: 9,
    fontWeight: 600,
    color: SPYGLASS_NAVY,
  },
  statusBadge: {
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 4,
    fontSize: 8,
    color: '#ffffff',
    backgroundColor: SPYGLASS_ORANGE,
    textAlign: 'center',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 16,
    marginTop: 20,
    padding: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
  },
  statBox: {
    width: '22%',
    textAlign: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 700,
    color: SPYGLASS_ORANGE,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 10,
    color: MEDIUM_GRAY,
  },
  propertyPhoto: {
    width: '100%',
    height: 250,
    objectFit: 'cover',
    borderRadius: 8,
    marginBottom: 16,
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  photoThumbnail: {
    width: '32%',
    height: 100,
    objectFit: 'cover',
    borderRadius: 4,
  },
  agentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#eeeeee',
  },
  agentPhoto: {
    width: 50,
    height: 50,
    borderRadius: 25,
    objectFit: 'cover',
    borderWidth: 2,
    borderColor: SPYGLASS_ORANGE,
  },
  agentPhotoPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: SPYGLASS_ORANGE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  agentInitial: {
    fontSize: 18,
    fontWeight: 600,
    color: '#ffffff',
  },
  specsRow: {
    flexDirection: 'row',
    gap: 24,
    marginBottom: 16,
  },
  specItem: {
    alignItems: 'center',
  },
  specValue: {
    fontSize: 20,
    fontWeight: 600,
    color: SPYGLASS_NAVY,
    marginBottom: 2,
  },
  specLabel: {
    fontSize: 10,
    color: MEDIUM_GRAY,
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#eeeeee',
  },
});
