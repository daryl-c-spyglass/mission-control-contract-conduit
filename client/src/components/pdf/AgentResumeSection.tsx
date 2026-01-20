import { Page, View, Text, Image } from '@react-pdf/renderer';
import { styles, SPYGLASS_ORANGE, SPYGLASS_NAVY, MEDIUM_GRAY } from './styles';
import type { CMAReportData } from '@shared/cma-sections';

interface AgentResumeSectionProps {
  data: CMAReportData;
  customBio?: string;
}

export function AgentResumeSection({ data, customBio }: AgentResumeSectionProps) {
  const { agent } = data;
  const agentInitial = agent.firstName?.charAt(0) || agent.lastName?.charAt(0) || 'A';
  const bio = customBio || agent.bio || `${agent.firstName} ${agent.lastName} is a dedicated real estate professional committed to providing exceptional service to clients. With a deep understanding of the local market and a passion for helping people find their perfect home, ${agent.firstName} brings expertise and enthusiasm to every transaction.`;

  return (
    <Page size="LETTER" style={styles.page}>
      <View style={styles.header}>
        <Text style={{ fontSize: 18, fontWeight: 700, color: SPYGLASS_NAVY }}>
          About Your Agent
        </Text>
        <Text style={{ fontSize: 12, fontWeight: 600, color: SPYGLASS_ORANGE }}>
          {agent.company || 'SPYGLASS REALTY'}
        </Text>
      </View>

      <View style={{ flexDirection: 'row', gap: 24, marginBottom: 24 }}>
        {agent.photo ? (
          <Image 
            src={agent.photo} 
            style={{ 
              width: 150, 
              height: 150, 
              borderRadius: 8, 
              objectFit: 'cover',
            }} 
          />
        ) : (
          <View style={{ 
            width: 150, 
            height: 150, 
            borderRadius: 8, 
            backgroundColor: SPYGLASS_ORANGE,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Text style={{ fontSize: 60, fontWeight: 600, color: '#ffffff' }}>
              {agentInitial}
            </Text>
          </View>
        )}

        <View style={{ flex: 1, justifyContent: 'center' }}>
          <Text style={{ fontSize: 24, fontWeight: 700, color: SPYGLASS_NAVY, marginBottom: 4 }}>
            {agent.firstName} {agent.lastName}
          </Text>
          <Text style={{ fontSize: 14, color: SPYGLASS_ORANGE, marginBottom: 16 }}>
            {agent.title}
          </Text>
          
          <View style={{ gap: 8 }}>
            {agent.phone && (
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Text style={{ fontSize: 11, color: MEDIUM_GRAY, width: 50 }}>Phone:</Text>
                <Text style={{ fontSize: 11, color: SPYGLASS_NAVY }}>{agent.phone}</Text>
              </View>
            )}
            {agent.email && (
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Text style={{ fontSize: 11, color: MEDIUM_GRAY, width: 50 }}>Email:</Text>
                <Text style={{ fontSize: 11, color: SPYGLASS_NAVY }}>{agent.email}</Text>
              </View>
            )}
          </View>
        </View>
      </View>

      <View style={[styles.card, { marginBottom: 24 }]}>
        <Text style={{ fontSize: 14, fontWeight: 600, color: SPYGLASS_NAVY, marginBottom: 12 }}>
          About Me
        </Text>
        <Text style={[styles.text, { lineHeight: 1.8 }]}>
          {bio}
        </Text>
      </View>

      <View style={{ flexDirection: 'row', gap: 16 }}>
        <View style={[styles.card, { flex: 1, alignItems: 'center' }]}>
          <Text style={{ fontSize: 28, fontWeight: 700, color: SPYGLASS_ORANGE, marginBottom: 4 }}>
            5
          </Text>
          <Text style={styles.textSmall}>Years Experience</Text>
        </View>
        <View style={[styles.card, { flex: 1, alignItems: 'center' }]}>
          <Text style={{ fontSize: 28, fontWeight: 700, color: SPYGLASS_ORANGE, marginBottom: 4 }}>
            50+
          </Text>
          <Text style={styles.textSmall}>Homes Sold</Text>
        </View>
        <View style={[styles.card, { flex: 1, alignItems: 'center' }]}>
          <Text style={{ fontSize: 28, fontWeight: 700, color: SPYGLASS_ORANGE, marginBottom: 4 }}>
            5
          </Text>
          <Text style={styles.textSmall}>Star Rating</Text>
        </View>
      </View>
    </Page>
  );
}
