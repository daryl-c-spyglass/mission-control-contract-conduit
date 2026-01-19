import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Sparkles, Copy, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface CoverLetterEditorProps {
  coverLetter: string;
  onChange: (coverLetter: string) => void;
  subjectProperty?: any;
  properties?: any[];
  statistics?: any;
  agentName?: string;
  companyName?: string;
}

export function CoverLetterEditor({
  coverLetter,
  onChange,
  subjectProperty,
  properties = [],
  statistics,
  agentName = '',
  companyName = '',
}: CoverLetterEditorProps) {
  const { toast } = useToast();
  const [clientName, setClientName] = useState('');
  const [tone, setTone] = useState<'professional' | 'friendly' | 'confident'>('professional');
  const [copied, setCopied] = useState(false);

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
      <CardHeader>
        <CardTitle className="text-base">Cover Letter</CardTitle>
        <CardDescription>Generate an AI-powered cover letter or write your own</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="clientName">Client Name (Optional)</Label>
            <Input
              id="clientName"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="Enter client's name"
              data-testid="input-client-name"
            />
          </div>
          <div className="space-y-2">
            <Label>Tone</Label>
            <Select value={tone} onValueChange={(v) => setTone(v as typeof tone)}>
              <SelectTrigger data-testid="select-tone">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="professional">Professional</SelectItem>
                <SelectItem value="friendly">Friendly</SelectItem>
                <SelectItem value="confident">Confident</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button 
          onClick={() => generateMutation.mutate()} 
          disabled={generateMutation.isPending}
          className="w-full gap-2"
          data-testid="button-generate-cover-letter"
        >
          {generateMutation.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Sparkles className="w-4 h-4" />
          )}
          Generate with AI
        </Button>
        
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="coverLetterText">Cover Letter Text</Label>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleCopy}
              disabled={!coverLetter}
              className="gap-1"
              data-testid="button-copy-cover-letter"
            >
              {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              {copied ? 'Copied' : 'Copy'}
            </Button>
          </div>
          <Textarea
            id="coverLetterText"
            value={coverLetter}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Write your cover letter here or use AI to generate one..."
            className="min-h-[200px]"
            data-testid="textarea-cover-letter"
          />
        </div>
      </CardContent>
    </Card>
  );
}
