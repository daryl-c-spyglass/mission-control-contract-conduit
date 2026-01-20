import { Page, View, Text, Image } from '@react-pdf/renderer';
import { styles, SPYGLASS_ORANGE, SPYGLASS_NAVY, MEDIUM_GRAY } from './styles';
import type { CMAReportData } from '@shared/cma-sections';

interface CoverLetterSectionProps {
  data: CMAReportData;
  customContent?: string;
}

const DEFAULT_COVER_LETTER = (address: string, agentName: string) => `Thank you for the opportunity to prepare this Comparative Market Analysis for your property at ${address}.

This comprehensive report provides you with valuable insights into the current real estate market conditions in your area. I've carefully analyzed recent sales, active listings, and market trends to help you understand your property's position in today's market.

Inside this report, you'll find:

- A detailed analysis of comparable properties that have recently sold
- Current active listings that will be your competition
- Market statistics and trends for your neighborhood
- My professional opinion on optimal pricing strategy

I'm committed to providing you with exceptional service and would be honored to represent you in the sale of your home. Please don't hesitate to reach out with any questions about this analysis or the selling process.

Looking forward to working with you.

Warm regards,
${agentName}`;

export function CoverLetterSection({ data, customContent }: CoverLetterSectionProps) {
  const { agent, subjectProperty, metadata } = data;
  const agentName = `${agent.firstName} ${agent.lastName}`.trim();
  
  const letterContent = customContent || agent.coverLetter || DEFAULT_COVER_LETTER(subjectProperty.address, agentName);

  return (
    <Page size="LETTER" style={[styles.page, { padding: 60 }]}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 40 }}>
        <Text style={{ fontSize: 14, fontWeight: 600, color: SPYGLASS_ORANGE }}>
          {agent.company || 'SPYGLASS REALTY'}
        </Text>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={{ fontSize: 12, color: SPYGLASS_NAVY }}>{agentName}</Text>
          <Text style={{ fontSize: 11, color: MEDIUM_GRAY }}>{agent.title}</Text>
          <Text style={{ fontSize: 11, color: MEDIUM_GRAY }}>{agent.phone}</Text>
          <Text style={{ fontSize: 11, color: MEDIUM_GRAY }}>{agent.email}</Text>
        </View>
      </View>

      <Text style={{ fontSize: 12, color: MEDIUM_GRAY, marginBottom: 24 }}>
        {metadata.preparedDate}
      </Text>

      {metadata.preparedFor && (
        <Text style={{ fontSize: 14, marginBottom: 20, color: SPYGLASS_NAVY }}>
          Dear {metadata.preparedFor},
        </Text>
      )}

      <Text style={[styles.text, { lineHeight: 1.8 }]}>
        {letterContent}
      </Text>

      <View style={{ marginTop: 40 }}>
        {agent.photo && (
          <Image 
            src={agent.photo} 
            style={{ 
              width: 70, 
              height: 70, 
              borderRadius: 35, 
              objectFit: 'cover',
              marginBottom: 12,
            }} 
          />
        )}
        <Text style={{ fontSize: 14, fontWeight: 600, color: SPYGLASS_NAVY }}>
          {agentName}
        </Text>
        <Text style={{ fontSize: 12, color: SPYGLASS_ORANGE }}>
          {agent.title}
        </Text>
        <Text style={{ fontSize: 11, color: MEDIUM_GRAY }}>
          {agent.company}
        </Text>
      </View>
    </Page>
  );
}
