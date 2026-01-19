import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { 
  Mail, 
  Link as LinkIcon, 
  Printer, 
  LayoutGrid, 
  Share2,
  Loader2 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { CMAShareDialog } from './CMAShareDialog';
import type { PropertyStatistics } from '@shared/schema';

interface CMAActionButtonsProps {
  cmaId?: string | null;
  transactionId?: string;
  propertyAddress: string;
  publicLink?: string | null;
  statistics?: PropertyStatistics | null;
  cmaData?: any[];
  mlsNumber?: string | null;
  onShareSuccess?: () => void;
}

export function CMAActionButtons({
  cmaId,
  transactionId,
  propertyAddress,
  publicLink,
  statistics,
  cmaData,
  mlsNumber,
  onShareSuccess,
}: CMAActionButtonsProps) {
  const { toast } = useToast();
  const [shareDialogOpen, setShareDialogOpen] = useState(false);

  const [localShareUrl, setLocalShareUrl] = useState<string | null>(null);
  
  const shareMutation = useMutation({
    mutationFn: async () => {
      let activeCmaId = cmaId;
      
      // Create CMA on demand if not exists
      if (!activeCmaId && transactionId && cmaData) {
        const createRes = await apiRequest('POST', '/api/cmas', {
          name: `CMA for ${propertyAddress}`,
          transactionId,
          subjectPropertyId: mlsNumber,
          propertiesData: cmaData,
        });
        const newCma = await createRes.json() as { id: string };
        activeCmaId = newCma.id;
      }
      
      if (!activeCmaId) {
        throw new Error('No CMA ID available');
      }
      
      const response = await apiRequest('POST', `/api/cmas/${activeCmaId}/share`);
      return await response.json() as { publicLink: string; expiresAt: string };
    },
    onSuccess: (data) => {
      const shareUrl = `${window.location.origin}/shared/cma/${data.publicLink}`;
      setLocalShareUrl(shareUrl);
      onShareSuccess?.(); // This invalidates react-query cache
      toast({
        title: 'Share link generated',
        description: 'Your CMA is now shareable via the link.',
      });
    },
  });

  const generateClientEmail = () => {
    const priceMin = statistics?.price?.range?.min 
      ? `$${statistics.price.range.min.toLocaleString()}` 
      : 'N/A';
    const priceMax = statistics?.price?.range?.max 
      ? `$${statistics.price.range.max.toLocaleString()}` 
      : 'N/A';
    const avgPricePerSqFt = statistics?.pricePerSqFt?.average 
      ? `$${Math.round(statistics.pricePerSqFt.average)}` 
      : 'N/A';
    const avgDOM = statistics?.daysOnMarket?.average 
      ? `${Math.round(statistics.daysOnMarket.average)}` 
      : 'N/A';
    
    return `Subject: Market Analysis for ${propertyAddress}

---

Hi there,

I put together a market analysis for your home based on recent comparable sales. Here's what the data is showing:

**Comparable Sales Summary**
- Price Range: ${priceMin} – ${priceMax}
- Average Price/Sq Ft: ${avgPricePerSqFt}
- Average Days on Market: ${avgDOM} days

I'd love to walk you through the full analysis and talk through your timing and goals. Want to grab 15 minutes this week?

Best regards`;
  };

  const handleCopyClientEmail = async () => {
    const emailContent = generateClientEmail();
    try {
      await navigator.clipboard.writeText(emailContent);
      toast({
        title: 'Email copied',
        description: 'Paste into your email client to send to your client.',
      });
    } catch {
      toast({
        title: 'Copy failed',
        description: 'Unable to copy to clipboard.',
        variant: 'destructive',
      });
    }
  };

  const handleProduceUrl = async () => {
    try {
      let shareUrl: string;
      if (publicLink) {
        shareUrl = `${window.location.origin}/shared/cma/${publicLink}`;
      } else if (localShareUrl) {
        shareUrl = localShareUrl;
      } else {
        const result = await shareMutation.mutateAsync();
        shareUrl = `${window.location.origin}/shared/cma/${result.publicLink}`;
      }
      await navigator.clipboard.writeText(shareUrl);
      toast({
        title: 'URL copied to clipboard',
        description: shareUrl,
      });
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to generate or copy share URL',
        variant: 'destructive',
      });
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="flex items-center gap-2 flex-wrap print:hidden">
      <Button 
        variant="outline" 
        size="sm" 
        onClick={handleCopyClientEmail}
        data-testid="button-copy-email"
      >
        <Mail className="w-4 h-4 mr-2" />
        Copy Email
      </Button>
      
      <Button 
        variant="outline" 
        size="sm"
        onClick={handleProduceUrl}
        disabled={shareMutation.isPending}
        data-testid="button-produce-url"
      >
        {shareMutation.isPending ? (
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        ) : (
          <LinkIcon className="w-4 h-4 mr-2" />
        )}
        Produce URL
      </Button>
      
      <Button 
        variant="outline" 
        size="sm" 
        onClick={handlePrint}
        data-testid="button-print"
      >
        <Printer className="w-4 h-4 mr-2" />
        Print
      </Button>
      
      <Button 
        variant="outline" 
        size="sm" 
        disabled 
        title="Coming soon"
        data-testid="button-presentation"
      >
        <LayoutGrid className="w-4 h-4 mr-2" />
        Presentation
      </Button>
      
      <Button 
        variant="outline" 
        size="sm" 
        onClick={() => setShareDialogOpen(true)}
        data-testid="button-share"
      >
        <Share2 className="w-4 h-4 mr-2" />
        Share
      </Button>

      <CMAShareDialog
        open={shareDialogOpen}
        onOpenChange={setShareDialogOpen}
        cmaId={cmaId}
        transactionId={transactionId}
        propertyAddress={propertyAddress}
        publicLink={publicLink}
        cmaData={cmaData}
        mlsNumber={mlsNumber}
        onShareSuccess={onShareSuccess}
      />
    </div>
  );
}
