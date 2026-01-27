import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Sparkles, Loader2, Undo2, ChevronDown } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface AISummarizeButtonProps {
  currentDescription: string;
  originalDescription: string;
  previousDescription: string;
  propertyAddress: string;
  maxLength: number;
  onSummarized: (summary: string) => void;
  onRevert: (type: 'previous' | 'original') => void;
  hasUsedAI: boolean;
}

export function AISummarizeButton({
  currentDescription,
  originalDescription,
  previousDescription,
  propertyAddress,
  maxLength,
  onSummarized,
  onRevert,
  hasUsedAI,
}: AISummarizeButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSummarize = async () => {
    if (!originalDescription) {
      toast({
        title: 'No Description',
        description: 'No MLS description available to summarize.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await apiRequest('POST', '/api/summarize-description', {
        description: originalDescription,
        maxLength,
        propertyInfo: {
          address: propertyAddress,
        },
      });

      const data = await response.json();

      if (data.summary) {
        onSummarized(data.summary);
        toast({
          title: data.fallback ? 'Description Truncated' : 'Description Summarized',
          description: data.fallback
            ? 'AI unavailable, description was truncated.'
            : 'Click again for a different variation.',
        });
      }
    } catch (error) {
      console.error('Summarization failed:', error);
      toast({
        title: 'Summarization Failed',
        description: 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleSummarize}
        disabled={isLoading || !originalDescription}
        className="h-7 text-xs gap-1.5 text-primary border-primary/30 hover:bg-primary/10"
        data-testid="button-ai-summarize"
      >
        {isLoading ? (
          <>
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Summarizing...
          </>
        ) : (
          <>
            <Sparkles className="w-3.5 h-3.5" />
            AI Summarize
          </>
        )}
      </Button>

      {hasUsedAI && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1 text-muted-foreground"
              data-testid="button-revert-description"
            >
              <Undo2 className="w-3.5 h-3.5" />
              Revert
              <ChevronDown className="w-3 h-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {previousDescription && previousDescription !== currentDescription && (
              <DropdownMenuItem onClick={() => onRevert('previous')}>
                <Undo2 className="w-4 h-4 mr-2" />
                Revert to Previous
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => onRevert('original')}>
              <Undo2 className="w-4 h-4 mr-2" />
              Revert to Original (Full MLS)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
