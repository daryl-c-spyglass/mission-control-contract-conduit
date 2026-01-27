import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Sparkles, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface AIHeadlineButtonProps {
  transactionId: string;
  mlsData: any;
  onGenerated: (headline: string) => void;
}

export function AIHeadlineButton({ transactionId, mlsData, onGenerated }: AIHeadlineButtonProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const propertyData = {
        city: mlsData?.city || '',
        state: mlsData?.state || 'TX',
        beds: mlsData?.beds || mlsData?.bedroomsTotal || '',
        baths: mlsData?.baths || mlsData?.bathroomsTotalInteger || '',
        sqft: mlsData?.sqft || mlsData?.livingArea || '',
        propertyType: mlsData?.propertyType || 'Residential',
        neighborhood: mlsData?.subdivision || mlsData?.neighborhood || '',
        yearBuilt: mlsData?.yearBuilt || '',
        price: mlsData?.listPrice || mlsData?.price || '',
        description: mlsData?.publicRemarks || mlsData?.remarks || '',
      };

      const response = await apiRequest('POST', '/api/flyer/generate-headline', { propertyData });
      const data = await response.json();

      if (data.headline) {
        onGenerated(data.headline);
        toast({
          title: 'Headline Generated',
          description: 'AI has created a compelling headline for your flyer.',
        });
      }
    } catch (error) {
      console.error('Failed to generate headline:', error);
      toast({
        title: 'Generation Failed',
        description: 'Unable to generate headline. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={handleGenerate}
      disabled={isGenerating}
      className="h-7 text-xs gap-1 text-primary hover:text-primary"
      data-testid="button-ai-generate-headline"
    >
      {isGenerating ? (
        <>
          <Loader2 className="w-3 h-3 animate-spin" />
          Generating...
        </>
      ) : (
        <>
          <Sparkles className="w-3 h-3" />
          AI Generate
        </>
      )}
    </Button>
  );
}
