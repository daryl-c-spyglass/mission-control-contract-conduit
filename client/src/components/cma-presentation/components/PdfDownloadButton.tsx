import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import jsPDF from 'jspdf';
import { WIDGETS, SPYGLASS_LOGO_WHITE, LRE_SGR_WHITE } from '../constants/widgets';
import type { AgentProfile, CmaProperty } from '../types';

interface PdfDownloadButtonProps {
  propertyAddress: string;
  agent: AgentProfile;
  comparables?: CmaProperty[];
  subjectProperty?: CmaProperty;
  className?: string;
}

export function PdfDownloadButton({
  propertyAddress,
  agent,
  comparables = [],
  subjectProperty,
  className = '',
}: PdfDownloadButtonProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();

  const loadImage = (src: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
      img.src = src;
    });
  };

  const handleDownload = async () => {
    setIsGenerating(true);
    
    try {
      const pdf = new jsPDF('landscape', 'pt', 'letter');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 40;
      const contentWidth = pageWidth - (margin * 2);
      const contentHeight = pageHeight - (margin * 2);
      
      let currentPage = 0;

      for (const widget of WIDGETS) {
        if (currentPage > 0) {
          pdf.addPage();
        }

        pdf.setFillColor(26, 26, 46);
        pdf.rect(0, 0, pageWidth, 50, 'F');
        
        pdf.setTextColor(255, 255, 255);
        pdf.setFontSize(14);
        pdf.setFont('helvetica', 'bold');
        pdf.text(widget.title, margin, 32);

        pdf.setTextColor(100, 100, 100);
        pdf.setFontSize(10);
        pdf.text(`Slide ${widget.number} of ${WIDGETS.length}`, pageWidth - margin - 80, 32);

        if (widget.type === 'static' && widget.imagePath) {
          try {
            const img = await loadImage(widget.imagePath);
            const imgRatio = img.width / img.height;
            const maxImgHeight = contentHeight - 20;
            const maxImgWidth = contentWidth;
            
            let imgWidth = maxImgWidth;
            let imgHeight = imgWidth / imgRatio;
            
            if (imgHeight > maxImgHeight) {
              imgHeight = maxImgHeight;
              imgWidth = imgHeight * imgRatio;
            }

            const imgX = margin + (contentWidth - imgWidth) / 2;
            const imgY = 60 + (contentHeight - imgHeight) / 2;
            
            pdf.addImage(img, 'PNG', imgX, imgY, imgWidth, imgHeight);
          } catch (err) {
            pdf.setTextColor(100, 100, 100);
            pdf.setFontSize(12);
            pdf.text('Image unavailable', pageWidth / 2, pageHeight / 2, { align: 'center' });
          }
        } else {
          pdf.setTextColor(50, 50, 50);
          pdf.setFontSize(24);
          pdf.setFont('helvetica', 'bold');
          pdf.text(widget.title, pageWidth / 2, pageHeight / 2 - 20, { align: 'center' });
          
          pdf.setTextColor(100, 100, 100);
          pdf.setFontSize(12);
          pdf.setFont('helvetica', 'normal');
          
          if (widget.id === 'agent_resume') {
            pdf.text(agent.name || 'Agent', pageWidth / 2, pageHeight / 2 + 10, { align: 'center' });
            pdf.text(agent.company || 'Spyglass Realty', pageWidth / 2, pageHeight / 2 + 25, { align: 'center' });
          } else if (widget.id === 'comps') {
            pdf.text(`${comparables.length} Comparable Properties`, pageWidth / 2, pageHeight / 2 + 10, { align: 'center' });
          } else if (widget.id === 'suggested_list_price' && subjectProperty) {
            const avgPrice = comparables.length > 0 
              ? comparables.reduce((sum, c) => sum + (c.soldPrice || c.price), 0) / comparables.length 
              : 0;
            if (avgPrice > 0) {
              pdf.text(`Suggested Price Range: $${Math.round(avgPrice * 0.95).toLocaleString()} - $${Math.round(avgPrice * 1.05).toLocaleString()}`, 
                pageWidth / 2, pageHeight / 2 + 10, { align: 'center' });
            }
          } else {
            pdf.text('Interactive content - view in presentation', pageWidth / 2, pageHeight / 2 + 10, { align: 'center' });
          }
        }

        pdf.setTextColor(150, 150, 150);
        pdf.setFontSize(8);
        pdf.text(propertyAddress, margin, pageHeight - 20);
        pdf.text('Spyglass Realty', pageWidth - margin - 70, pageHeight - 20);

        currentPage++;
      }

      const filename = `CMA-${propertyAddress.replace(/[^a-zA-Z0-9]/g, '-')}.pdf`;
      pdf.save(filename);

      toast({
        title: 'PDF Downloaded',
        description: `${WIDGETS.length} slides exported successfully`,
      });
    } catch (error) {
      console.error('PDF generation error:', error);
      toast({
        title: 'Download Failed',
        description: 'Unable to generate PDF. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleDownload}
      disabled={isGenerating}
      className={className}
      data-testid="button-download-pdf"
    >
      {isGenerating ? (
        <Loader2 className="w-5 h-5 animate-spin" />
      ) : (
        <Download className="w-5 h-5" />
      )}
    </Button>
  );
}
