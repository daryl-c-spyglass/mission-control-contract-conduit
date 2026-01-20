import { Page, View, Text, Image } from '@react-pdf/renderer';
import { styles, SPYGLASS_ORANGE, SPYGLASS_NAVY } from './styles';
import type { CMAReportData } from '@shared/cma-sections';
import type { CoverPageConfig } from '@shared/schema';

interface CoverPageSectionProps {
  data: CMAReportData;
  config: CoverPageConfig;
}

export function CoverPageSection({ data, config }: CoverPageSectionProps) {
  const { agent, subjectProperty, metadata } = data;
  const agentInitial = agent.firstName?.charAt(0) || agent.lastName?.charAt(0) || 'A';

  const getBackgroundStyle = () => {
    if (config.background === 'gradient') {
      return { backgroundColor: SPYGLASS_NAVY };
    }
    if (config.background === 'property' && subjectProperty.photos?.[0]) {
      return { backgroundColor: '#1a1a2e' };
    }
    return { backgroundColor: '#ffffff' };
  };

  const isLightBackground = config.background === 'none';
  const textColor = isLightBackground ? SPYGLASS_NAVY : '#ffffff';
  const subtitleColor = isLightBackground ? '#666666' : '#9ca3af';

  return (
    <Page size="LETTER" style={[styles.page, getBackgroundStyle(), { padding: 0, justifyContent: 'center', alignItems: 'center' }]}>
      <View style={{ alignItems: 'center', width: '100%', padding: 60 }}>
        <View style={{ marginBottom: 40 }}>
          <Text style={{ fontSize: 14, fontWeight: 600, color: SPYGLASS_ORANGE, letterSpacing: 2 }}>
            {agent.company || 'SPYGLASS REALTY'}
          </Text>
        </View>

        <Text style={{ fontSize: 36, fontWeight: 700, color: textColor, marginBottom: 24, textAlign: 'center' }}>
          {config.title || 'Comparative Market Analysis'}
        </Text>

        <Text style={{ fontSize: 16, color: subtitleColor, marginBottom: 8 }}>
          {config.subtitle || 'Prepared exclusively for you'}
        </Text>

        {metadata.preparedFor && (
          <Text style={{ fontSize: 18, fontWeight: 500, color: textColor, marginBottom: 24 }}>
            {metadata.preparedFor}
          </Text>
        )}

        <Text style={{ fontSize: 24, fontWeight: 600, color: textColor, marginBottom: 32, textAlign: 'center' }}>
          {subjectProperty.address}
        </Text>

        {subjectProperty.city && (
          <Text style={{ fontSize: 14, color: subtitleColor, marginBottom: 40 }}>
            {subjectProperty.city}, {subjectProperty.state} {subjectProperty.zip}
          </Text>
        )}

        {config.showDate && (
          <Text style={{ fontSize: 14, color: subtitleColor, marginBottom: 30 }}>
            {metadata.preparedDate}
          </Text>
        )}

        {config.showAgentPhoto && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 20 }}>
            {agent.photo ? (
              <Image 
                src={agent.photo} 
                style={{ 
                  width: 50, 
                  height: 50, 
                  borderRadius: 25, 
                  objectFit: 'cover',
                  borderWidth: 2,
                  borderColor: SPYGLASS_ORANGE,
                }} 
              />
            ) : (
              <View style={{ 
                width: 50, 
                height: 50, 
                borderRadius: 25, 
                backgroundColor: SPYGLASS_ORANGE,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Text style={{ fontSize: 18, fontWeight: 600, color: '#ffffff' }}>
                  {agentInitial}
                </Text>
              </View>
            )}
            <View>
              <Text style={{ fontSize: 16, fontWeight: 500, color: textColor }}>
                {agent.firstName} {agent.lastName}
              </Text>
              {agent.title && (
                <Text style={{ fontSize: 12, color: subtitleColor }}>
                  {agent.title}
                </Text>
              )}
            </View>
          </View>
        )}
      </View>
    </Page>
  );
}
