import { Page, View, Text, Image } from '@react-pdf/renderer';
import { styles, SPYGLASS_ORANGE, SPYGLASS_NAVY, MEDIUM_GRAY } from './styles';
import type { CMAReportData } from '@shared/cma-sections';

interface ContactMeSectionProps {
  data: CMAReportData;
}

export function ContactMeSection({ data }: ContactMeSectionProps) {
  const { agent } = data;
  const agentInitial = agent.firstName?.charAt(0) || agent.lastName?.charAt(0) || 'A';

  return (
    <Page size="LETTER" style={[styles.page, { justifyContent: 'center', alignItems: 'center' }]}>
      <View style={{ alignItems: 'center', width: '100%', maxWidth: 400 }}>
        <Text style={{ fontSize: 24, fontWeight: 700, color: SPYGLASS_NAVY, marginBottom: 32, textAlign: 'center' }}>
          Let's Connect
        </Text>

        {agent.photo ? (
          <Image 
            src={agent.photo} 
            style={{ 
              width: 120, 
              height: 120, 
              borderRadius: 60, 
              objectFit: 'cover',
              borderWidth: 4,
              borderColor: SPYGLASS_ORANGE,
              marginBottom: 24,
            }} 
          />
        ) : (
          <View style={{ 
            width: 120, 
            height: 120, 
            borderRadius: 60, 
            backgroundColor: SPYGLASS_ORANGE,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 24,
          }}>
            <Text style={{ fontSize: 48, fontWeight: 600, color: '#ffffff' }}>
              {agentInitial}
            </Text>
          </View>
        )}

        <Text style={{ fontSize: 20, fontWeight: 600, color: SPYGLASS_NAVY, marginBottom: 4 }}>
          {agent.firstName} {agent.lastName}
        </Text>
        
        <Text style={{ fontSize: 14, color: SPYGLASS_ORANGE, marginBottom: 24 }}>
          {agent.title}
        </Text>

        <View style={{ width: '100%', gap: 16, marginBottom: 32 }}>
          {agent.phone && (
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <Text style={{ fontSize: 12, color: MEDIUM_GRAY }}>Phone:</Text>
              <Text style={{ fontSize: 12, fontWeight: 600, color: SPYGLASS_NAVY }}>{agent.phone}</Text>
            </View>
          )}
          
          {agent.email && (
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <Text style={{ fontSize: 12, color: MEDIUM_GRAY }}>Email:</Text>
              <Text style={{ fontSize: 12, fontWeight: 600, color: SPYGLASS_NAVY }}>{agent.email}</Text>
            </View>
          )}
        </View>

        <View style={{ 
          width: '100%', 
          paddingTop: 24, 
          borderTopWidth: 1, 
          borderTopColor: '#eeeeee',
          alignItems: 'center',
        }}>
          <Text style={{ fontSize: 14, fontWeight: 600, color: SPYGLASS_ORANGE, marginBottom: 4 }}>
            {agent.company || 'SPYGLASS REALTY'}
          </Text>
          <Text style={{ fontSize: 11, color: MEDIUM_GRAY, textAlign: 'center' }}>
            Your trusted partner in real estate
          </Text>
        </View>
      </View>
    </Page>
  );
}
