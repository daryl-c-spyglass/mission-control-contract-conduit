import { Page, View, Text } from '@react-pdf/renderer';
import { SPYGLASS_ORANGE, SPYGLASS_NAVY } from './styles';

interface ChapterHeaderSectionProps {
  title: string;
  subtitle?: string;
  company?: string;
}

export function ChapterHeaderSection({ title, subtitle, company }: ChapterHeaderSectionProps) {
  return (
    <Page size="LETTER" style={{ 
      flexDirection: 'column', 
      alignItems: 'center', 
      justifyContent: 'center',
      backgroundColor: '#f8f9fa',
      padding: 60,
    }}>
      <View style={{ alignItems: 'center' }}>
        <View style={{ 
          width: 60, 
          height: 4, 
          backgroundColor: SPYGLASS_ORANGE, 
          marginBottom: 24 
        }} />
        
        <Text style={{ 
          fontSize: 36, 
          fontWeight: 700, 
          color: SPYGLASS_NAVY, 
          textAlign: 'center',
          marginBottom: 12,
        }}>
          {title}
        </Text>
        
        {subtitle && (
          <Text style={{ 
            fontSize: 14, 
            color: '#666666', 
            textAlign: 'center',
            maxWidth: 400,
          }}>
            {subtitle}
          </Text>
        )}
        
        <View style={{ 
          width: 60, 
          height: 4, 
          backgroundColor: SPYGLASS_ORANGE, 
          marginTop: 24 
        }} />
      </View>
      
      {company && (
        <Text style={{ 
          position: 'absolute',
          bottom: 40,
          fontSize: 12,
          fontWeight: 600,
          color: SPYGLASS_ORANGE,
          letterSpacing: 1,
        }}>
          {company}
        </Text>
      )}
    </Page>
  );
}
