import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Loader2, Send } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface CMAEmailShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cmaId?: string | null;
  transactionId?: string;
  propertyAddress: string;
  publicLink?: string | null;
  cmaData?: any[];
  mlsNumber?: string | null;
  onSuccess?: () => void;
}

export function CMAEmailShareDialog({
  open,
  onOpenChange,
  cmaId,
  transactionId,
  propertyAddress,
  publicLink,
  cmaData,
  mlsNumber,
  onSuccess,
}: CMAEmailShareDialogProps) {
  const { toast } = useToast();
  const [recipientEmail, setRecipientEmail] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [message, setMessage] = useState(
    `Hi,\n\nI've prepared a market analysis for ${propertyAddress}. Please click the link below to view the full report.\n\nLet me know if you have any questions!\n\nBest regards`
  );

  const shareUrl = publicLink 
    ? `${window.location.origin}/shared/cma/${publicLink}`
    : '';

  const generateLinkMutation = useMutation({
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
    onSuccess: () => {
      onSuccess?.(); // Invalidate cache so savedCma refreshes
    },
  });

  const handleCopyEmailDraft = async () => {
    let linkToUse = shareUrl;
    
    if (!linkToUse) {
      try {
        const result = await generateLinkMutation.mutateAsync();
        linkToUse = `${window.location.origin}/shared/cma/${result.publicLink}`;
      } catch {
        toast({ title: 'Failed to generate share link', variant: 'destructive' });
        return;
      }
    }

    const emailDraft = `To: ${recipientEmail}
Subject: Market Analysis for ${propertyAddress}

${recipientName ? `Hi ${recipientName},` : 'Hi,'}

${message}

View the full report: ${linkToUse}`;

    try {
      await navigator.clipboard.writeText(emailDraft);
      toast({ 
        title: 'Email draft copied', 
        description: 'Paste into your email client to send.' 
      });
      onOpenChange(false);
    } catch {
      toast({ title: 'Failed to copy', variant: 'destructive' });
    }
  };

  const handleOpenMailto = async () => {
    let linkToUse = shareUrl;
    
    if (!linkToUse) {
      try {
        const result = await generateLinkMutation.mutateAsync();
        linkToUse = `${window.location.origin}/shared/cma/${result.publicLink}`;
      } catch {
        toast({ title: 'Failed to generate share link', variant: 'destructive' });
        return;
      }
    }

    const subject = encodeURIComponent(`Market Analysis for ${propertyAddress}`);
    const body = encodeURIComponent(`${recipientName ? `Hi ${recipientName},\n\n` : ''}${message}\n\nView the full report: ${linkToUse}`);
    const mailto = `mailto:${recipientEmail}?subject=${subject}&body=${body}`;
    
    window.location.href = mailto;
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Share CMA via Email</DialogTitle>
          <DialogDescription>
            Send this market analysis to your client via email.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="recipient-email">Recipient Email</Label>
              <Input
                id="recipient-email"
                type="email"
                placeholder="client@example.com"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                data-testid="input-recipient-email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="recipient-name">Recipient Name (optional)</Label>
              <Input
                id="recipient-name"
                placeholder="John"
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                data-testid="input-recipient-name"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">Message</Label>
            <Textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={6}
              className="resize-none"
              data-testid="textarea-email-message"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button 
            variant="outline" 
            onClick={handleCopyEmailDraft}
            disabled={generateLinkMutation.isPending}
            data-testid="button-copy-email-draft"
          >
            {generateLinkMutation.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : null}
            Copy Draft
          </Button>
          <Button 
            onClick={handleOpenMailto}
            disabled={generateLinkMutation.isPending || !recipientEmail}
            data-testid="button-open-email-client"
          >
            <Send className="w-4 h-4 mr-2" />
            Open Email Client
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
