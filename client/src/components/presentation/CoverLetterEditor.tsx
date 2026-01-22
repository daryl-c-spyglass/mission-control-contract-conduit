import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Loader2, Sparkles, Copy, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface CoverLetterEditorProps {
  coverLetter: string;
  onChange: (coverLetter: string) => void;
  defaultCoverLetter?: string;
  clientName?: string;
  onClientNameChange?: (name: string) => void;
  subjectProperty?: any;
  properties?: any[];
  statistics?: any;
  agentName?: string;
  companyName?: string;
  includeAgentFooter?: boolean;
  onAgentFooterChange?: (include: boolean) => void;
}

export function CoverLetterEditor({
  coverLetter,
  onChange,
  defaultCoverLetter = '',
  clientName = '',
  onClientNameChange,
  subjectProperty,
  properties = [],
  statistics,
  agentName = '',
  companyName = '',
  includeAgentFooter = true,
  onAgentFooterChange,
}: CoverLetterEditorProps) {
  const { toast } = useToast();
  const [tone, setTone] = useState<'professional' | 'friendly' | 'confident'>('professional');
  const [copied, setCopied] = useState(false);

  const handleClientNameChange = (name: string) => {
    onClientNameChange?.(name);
  };

  const displayedCoverLetter = coverLetter || defaultCoverLetter;
  const isUsingDefault = !coverLetter && !!defaultCoverLetter;
  const isCustomized = coverLetter && coverLetter !== defaultCoverLetter;

  const handleResetToDefault = () => {
    onChange('');
  };

  const generateMutation = useMutation({
    mutationFn: async () => {
      const context = {
        subjectProperty: subjectProperty ? {
          address: subjectProperty.streetAddress || subjectProperty.address || '',
          price: subjectProperty.listPrice || 0,
          beds: subjectProperty.bedroomsTotal || 0,
          baths: subjectProperty.bathroomsTotal || 0,
          sqft: subjectProperty.livingArea || 0,
          description: subjectProperty.publicRemarks || '',
        } : null,
        comparables: {
          count: properties.length,
          avgPrice: statistics?.price?.average || 0,
          medianPrice: statistics?.price?.median || 0,
          avgPricePerSqft: statistics?.pricePerSqFt?.average || 0,
          priceRange: {
            min: statistics?.price?.range?.min || 0,
            max: statistics?.price?.range?.max || 0,
          },
        },
        marketStats: {
          avgDOM: statistics?.daysOnMarket?.average || 0,
          activeCount: properties.filter((p: any) => p.standardStatus?.toLowerCase().includes('active')).length,
          closedCount: properties.filter((p: any) => p.standardStatus?.toLowerCase().includes('closed')).length,
        },
        agentInfo: {
          name: agentName,
          brokerage: companyName,
        },
        clientName: clientName || undefined,
      };

      const response = await apiRequest('POST', '/api/ai/generate-cover-letter', { context, tone });
      const data = await response.json();
      return data.coverLetter;
    },
    onSuccess: (generatedLetter) => {
      onChange(generatedLetter);
      toast({ title: 'Cover letter generated', description: 'AI-powered cover letter is ready' });
    },
    onError: (error: any) => {
      toast({ 
        title: 'Generation failed', 
        description: error.message || 'Failed to generate cover letter',
        variant: 'destructive' 
      });
    },
  });

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(coverLetter);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({ title: 'Copied', description: 'Cover letter copied to clipboard' });
    } catch {
      toast({ title: 'Copy failed', variant: 'destructive' });
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Cover Letter</CardTitle>
        <CardDescription>Customize the cover letter for this CMA report</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="clientName" className="text-sm">Client Name (Optional)</Label>
          <Input
            id="clientName"
            value={clientName}
            onChange={(e) => handleClientNameChange(e.target.value)}
            placeholder="e.g., John and Jane Smith"
            data-testid="input-client-name"
          />
          <p className="text-xs text-muted-foreground">Include client name for personalized cover letter greeting</p>
        </div>

        <div className="border rounded-lg p-4 bg-purple-50 dark:bg-purple-950/20 space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-600" />
            <span className="font-medium text-sm text-purple-600">AI Assistant</span>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Label htmlFor="tone" className="text-sm whitespace-nowrap">Tone:</Label>
              <Select value={tone} onValueChange={(v) => setTone(v as typeof tone)}>
                <SelectTrigger id="tone" className="w-[140px]" data-testid="select-tone">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="professional">Professional</SelectItem>
                  <SelectItem value="friendly">Friendly</SelectItem>
                  <SelectItem value="confident">Confident</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <Button 
              onClick={() => generateMutation.mutate()} 
              disabled={generateMutation.isPending}
              className="gap-2 bg-purple-600 hover:bg-purple-700"
              data-testid="button-generate-cover-letter"
            >
              {generateMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              Generate with AI
            </Button>
          </div>
          
          <p className="text-xs text-muted-foreground">
            AI will create a cover letter based on your CMA data, comparables, and market statistics.
          </p>
        </div>
        
        <div className="space-y-2">
          <Textarea
            id="coverLetterText"
            value={displayedCoverLetter}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Enter your cover letter content, or use AI to generate one based on your CMA data..."
            className="min-h-[180px]"
            data-testid="textarea-cover-letter"
          />
          <p className="text-xs text-muted-foreground">
            {isUsingDefault ? (
              <>ℹ️ Pre-filled from your default cover letter. Edit above to customize for this CMA.</>
            ) : isCustomized ? (
              <>
                ✏️ Custom cover letter for this CMA.{' '}
                <button
                  type="button"
                  className="text-primary hover:underline"
                  onClick={handleResetToDefault}
                  data-testid="button-reset-cover-letter"
                >
                  Reset to default
                </button>
              </>
            ) : (
              <>Enter your cover letter content, or set a default in Settings → Agent Profile.</>
            )}
          </p>
        </div>

        <Separator />

        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="agentFooter" className="font-medium text-sm">Agent Footer</Label>
            <p className="text-xs text-muted-foreground">Include agent contact information at the bottom of each page</p>
          </div>
          <Switch
            id="agentFooter"
            checked={includeAgentFooter}
            onCheckedChange={(checked) => onAgentFooterChange?.(checked)}
            data-testid="switch-agent-footer"
          />
        </div>
      </CardContent>
    </Card>
  );
}
