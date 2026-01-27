import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Loader2, Eye } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { pdf } from '@react-pdf/renderer';
import { CmaPdfDocument } from '../pdf/CmaPdfDocument';
import { CmaPrintPreview } from './CmaPrintPreview';
import type { AgentProfile, CmaProperty } from '../types';

interface PdfDownloadButtonProps {
  propertyAddress: string;
  agent: AgentProfile;
  comparables?: CmaProperty[];
  subjectProperty?: CmaProperty;
  averageDaysOnMarket?: number;
  suggestedListPrice?: number | null;
  avgPricePerAcre?: number | null;
  preparedFor?: string;
  className?: string;
}

export function PdfDownloadButton({
  propertyAddress,
  agent,
  comparables = [],
  subjectProperty,
  averageDaysOnMarket = 0,
  suggestedListPrice,
  avgPricePerAcre,
  preparedFor,
  className = '',
}: PdfDownloadButtonProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const { toast } = useToast();

  const handleDownload = async () => {
    setIsGenerating(true);
    
    try {
      toast({
        title: 'Generating PDF',
        description: 'This may take a moment...',
      });

      const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';

      const doc = (
        <CmaPdfDocument
          propertyAddress={propertyAddress}
          agent={agent}
          comparables={comparables}
          subjectProperty={subjectProperty}
          averageDaysOnMarket={averageDaysOnMarket}
          suggestedListPrice={suggestedListPrice}
          avgPricePerAcre={avgPricePerAcre}
          preparedFor={preparedFor}
          baseUrl={baseUrl}
        />
      );

      const blob = await pdf(doc).toBlob();
      
      const filename = `CMA-${propertyAddress.replace(/[^a-zA-Z0-9]/g, '-')}-${new Date().toISOString().split('T')[0]}.pdf`;
      
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: 'PDF Downloaded',
        description: 'Your CMA presentation has been exported successfully.',
      });
    } catch (error) {
      console.error('PDF generation error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast({
        title: 'Download Failed',
        description: `Unable to generate PDF: ${errorMessage.slice(0, 100)}`,
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setShowPreview(true)}
        disabled={isGenerating}
        className={className}
        data-testid="button-preview-pdf"
        title="Preview & Download PDF"
      >
        {isGenerating ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <Eye className="w-5 h-5" />
        )}
      </Button>

      <CmaPrintPreview
        isOpen={showPreview}
        onClose={() => setShowPreview(false)}
        onDownload={handleDownload}
        propertyAddress={propertyAddress}
        comparables={comparables}
        agent={agent}
        subjectProperty={subjectProperty}
        averageDaysOnMarket={averageDaysOnMarket}
        suggestedListPrice={suggestedListPrice}
        avgPricePerAcre={avgPricePerAcre}
      />
    </>
  );
}
