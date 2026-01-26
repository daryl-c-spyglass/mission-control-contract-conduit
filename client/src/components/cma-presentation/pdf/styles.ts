import { StyleSheet, Font } from '@react-pdf/renderer';

// Disable hyphenation to prevent font lookup issues
Font.registerHyphenationCallback((word: string) => [word]);

export const COLORS = {
  spyglassOrange: '#EF4923',
  darkBackground: '#18181b',
  white: '#ffffff',
  lightGray: '#f4f4f5',
  mediumGray: '#a1a1aa',
  darkGray: '#52525b',
  textPrimary: '#18181b',
  textSecondary: '#71717a',
  success: '#22c55e',
  border: '#e4e4e7',
};

export const styles = StyleSheet.create({
  page: {
    backgroundColor: COLORS.white,
    fontFamily: 'Helvetica',
    fontSize: 10,
    padding: 0,
  },
  darkPage: {
    backgroundColor: COLORS.darkBackground,
    fontFamily: 'Helvetica',
    fontSize: 10,
    padding: 0,
  },
  content: {
    padding: 40,
    flex: 1,
  },
  contentDark: {
    padding: 40,
    flex: 1,
    color: COLORS.white,
  },
  
  header: {
    backgroundColor: COLORS.darkBackground,
    padding: '20 40',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: 700,
  },
  headerSlide: {
    color: COLORS.mediumGray,
    fontSize: 10,
  },
  
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 40,
    right: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 8,
    color: COLORS.mediumGray,
  },
  
  coverPage: {
    backgroundColor: COLORS.darkBackground,
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  coverLogo: {
    width: 200,
    height: 80,
    marginBottom: 40,
  },
  coverTitle: {
    fontSize: 28,
    fontWeight: 700,
    color: COLORS.white,
    textAlign: 'center',
    marginBottom: 20,
  },
  coverSubtitle: {
    fontSize: 14,
    color: COLORS.mediumGray,
    textAlign: 'center',
    marginBottom: 40,
  },
  coverAddress: {
    fontSize: 18,
    fontWeight: 600,
    color: COLORS.spyglassOrange,
    textAlign: 'center',
    padding: '15 30',
    borderWidth: 2,
    borderColor: COLORS.spyglassOrange,
    marginBottom: 30,
  },
  coverDate: {
    fontSize: 12,
    color: COLORS.mediumGray,
  },
  
  agentCard: {
    flexDirection: 'row',
    padding: 30,
    backgroundColor: COLORS.lightGray,
    borderRadius: 8,
    marginBottom: 20,
  },
  agentPhoto: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginRight: 30,
    objectFit: 'cover',
  },
  agentInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  agentName: {
    fontSize: 24,
    fontWeight: 700,
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  agentCompany: {
    fontSize: 14,
    color: COLORS.spyglassOrange,
    fontWeight: 600,
    marginBottom: 12,
  },
  agentContact: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  agentBio: {
    fontSize: 10,
    color: COLORS.textSecondary,
    lineHeight: 1.5,
    marginTop: 15,
  },
  
  sectionTitle: {
    fontSize: 20,
    fontWeight: 700,
    color: COLORS.textPrimary,
    marginBottom: 15,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 20,
  },
  
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 20,
  },
  statCard: {
    width: '30%',
    backgroundColor: COLORS.lightGray,
    padding: 20,
    borderRadius: 8,
    marginRight: '3%',
    marginBottom: 15,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 700,
    color: COLORS.spyglassOrange,
    marginBottom: 5,
  },
  statLabel: {
    fontSize: 10,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  
  propertyCard: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    marginBottom: 15,
    overflow: 'hidden',
  },
  propertyImage: {
    width: '100%',
    height: 150,
    objectFit: 'cover',
  },
  propertyDetails: {
    padding: 15,
  },
  propertyAddress: {
    fontSize: 12,
    fontWeight: 600,
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  propertyPrice: {
    fontSize: 16,
    fontWeight: 700,
    color: COLORS.spyglassOrange,
    marginBottom: 8,
  },
  propertyStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  propertyStat: {
    fontSize: 10,
    color: COLORS.textSecondary,
  },
  
  table: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: COLORS.darkBackground,
    padding: '10 15',
  },
  tableHeaderCell: {
    flex: 1,
    fontSize: 10,
    fontWeight: 600,
    color: COLORS.white,
  },
  tableRow: {
    flexDirection: 'row',
    padding: '10 15',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  tableRowAlt: {
    backgroundColor: COLORS.lightGray,
  },
  tableCell: {
    flex: 1,
    fontSize: 10,
    color: COLORS.textPrimary,
  },
  
  priceRange: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 30,
  },
  priceValue: {
    fontSize: 36,
    fontWeight: 700,
    color: COLORS.spyglassOrange,
    textAlign: 'center',
  },
  priceLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 10,
  },
  
  staticImage: {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
  },
  
  centeredContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  
  badge: {
    backgroundColor: COLORS.spyglassOrange,
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 4,
  },
  badgeText: {
    color: COLORS.white,
    fontSize: 10,
    fontWeight: 600,
  },
  
  statusBadge: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusActive: {
    backgroundColor: '#22c55e',
  },
  statusPending: {
    backgroundColor: '#f59e0b',
  },
  statusClosed: {
    backgroundColor: '#6b7280',
  },
  
  chartBar: {
    height: 20,
    backgroundColor: COLORS.spyglassOrange,
    borderRadius: 4,
    marginBottom: 8,
  },
  chartLabel: {
    fontSize: 9,
    color: COLORS.textSecondary,
  },
  
  listItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  listBullet: {
    width: 6,
    height: 6,
    backgroundColor: COLORS.spyglassOrange,
    borderRadius: 3,
    marginRight: 10,
    marginTop: 4,
  },
  listText: {
    flex: 1,
    fontSize: 11,
    color: COLORS.textPrimary,
    lineHeight: 1.5,
  },
  
  twoColumn: {
    flexDirection: 'row',
    gap: 20,
  },
  column: {
    flex: 1,
  },
  
  thankYouText: {
    fontSize: 48,
    fontWeight: 700,
    color: COLORS.white,
    textAlign: 'center',
    marginBottom: 20,
  },
  thankYouSubtext: {
    fontSize: 16,
    color: COLORS.mediumGray,
    textAlign: 'center',
  },
});
