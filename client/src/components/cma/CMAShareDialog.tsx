import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Copy, Check, Loader2, Trash2, ExternalLink } from 'lucide-react';
import { SiFacebook, SiX, SiLinkedin } from 'react-icons/si';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface CMAShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cmaId: string;
  propertyAddress: string;
  publicLink?: string | null;
  onShareSuccess?: () => void;
}

export function CMAShareDialog({
  open,
  onOpenChange,
  cmaId,
  propertyAddress,
  publicLink,
  onShareSuccess,
}: CMAShareDialogProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);

  const shareMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', `/api/cmas/${cmaId}/share`);
      return await response.json() as { publicLink: string; expiresAt: string };
    },
    onSuccess: (data) => {
      setGeneratedLink(`${window.location.origin}/shared/cma/${data.publicLink}`);
      onShareSuccess?.();
    },
  });

  const removeLinkMutation = useMutation({
    mutationFn: async () => {
      await apiRequest('DELETE', `/api/cmas/${cmaId}/share`);
    },
    onSuccess: () => {
      setGeneratedLink(null);
      onShareSuccess?.();
      toast({ title: 'Share link removed' });
    },
  });

  const shareUrl = publicLink 
    ? `${window.location.origin}/shared/cma/${publicLink}`
    : generatedLink || '';

  const handleCopy = async () => {
    if (!shareUrl) {
      try {
        await shareMutation.mutateAsync();
      } catch {
        toast({ title: 'Failed to generate link', variant: 'destructive' });
        return;
      }
    }
    
    const urlToCopy = shareUrl || generatedLink;
    if (urlToCopy) {
      await navigator.clipboard.writeText(urlToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({ title: 'Link copied!' });
    }
  };

  const handleSocialShare = (platform: string) => {
    const url = shareUrl || generatedLink;
    if (!url) {
      toast({ 
        title: 'Generate link first', 
        description: 'Click copy to generate a share link.',
        variant: 'destructive' 
      });
      return;
    }
    
    const text = encodeURIComponent(`Check out this market analysis: ${propertyAddress}`);
    const encodedUrl = encodeURIComponent(url);
    
    const urls: Record<string, string> = {
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
      twitter: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${text}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
    };
    
    const shareUrl2 = urls[platform];
    if (shareUrl2) {
      window.open(shareUrl2, '_blank', 'width=600,height=400');
    }
  };

  const hasLink = !!publicLink || !!generatedLink;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share CMA</DialogTitle>
          <DialogDescription>
            Generate a public link to share this market analysis with clients.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Input 
              value={shareUrl || 'Click "Copy Link" to generate a share link'} 
              readOnly 
              className="flex-1 text-sm"
              data-testid="input-share-url"
            />
            <Button 
              size="sm" 
              onClick={handleCopy}
              disabled={shareMutation.isPending}
              data-testid="button-copy-share-link"
            >
              {shareMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : copied ? (
                <Check className="w-4 h-4" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </Button>
          </div>

          {hasLink && (
            <>
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="flex-1"
                  onClick={() => window.open(shareUrl, '_blank')}
                  data-testid="button-open-share-link"
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Open Link
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => removeLinkMutation.mutate()}
                  disabled={removeLinkMutation.isPending}
                  data-testid="button-remove-share-link"
                >
                  {removeLinkMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                </Button>
              </div>

              <div className="border-t pt-4">
                <p className="text-sm text-muted-foreground mb-3">Share on social media</p>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="icon"
                    onClick={() => handleSocialShare('facebook')}
                    data-testid="button-share-facebook"
                  >
                    <SiFacebook className="w-4 h-4" />
                  </Button>
                  <Button 
                    variant="outline" 
                    size="icon"
                    onClick={() => handleSocialShare('twitter')}
                    data-testid="button-share-twitter"
                  >
                    <SiX className="w-4 h-4" />
                  </Button>
                  <Button 
                    variant="outline" 
                    size="icon"
                    onClick={() => handleSocialShare('linkedin')}
                    data-testid="button-share-linkedin"
                  >
                    <SiLinkedin className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
