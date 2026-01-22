import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, ExternalLink, X } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import type { Transaction, AgentProfile } from "@shared/schema";

interface GraphicGeneratorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: Transaction;
}

export function GraphicGeneratorDialog({
  open,
  onOpenChange,
  transaction,
}: GraphicGeneratorDialogProps) {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [iframeError, setIframeError] = useState(false);
  
  // Fetch agent profile for agent info
  const { data: agentProfileData } = useQuery<{
    profile: AgentProfile | null;
    user: any;
  }>({
    queryKey: ["/api/agent/profile"],
    staleTime: 30000,
  });
  
  const mlsData = transaction.mlsData as any;
  
  // Build the primary photo URL
  const primaryPhotoUrl = useMemo(() => {
    const uploadedPhotos = transaction.propertyImages || [];
    const mlsPhotos = mlsData?.images || mlsData?.photos || [];
    const allPhotos = [...uploadedPhotos, ...mlsPhotos];
    const primaryIndex = transaction.primaryPhotoIndex || 0;
    return allPhotos[primaryIndex] || allPhotos[0] || '';
  }, [transaction.propertyImages, transaction.primaryPhotoIndex, mlsData]);
  
  // Build the status label for graphic generator
  const statusLabel = useMemo(() => {
    if (transaction.isOffMarket) return "OFF MARKET";
    const status = (mlsData?.status || transaction.status || "Active").toLowerCase();
    // Map status to graphic generator labels
    if (status === 'active' || status === 'act') return 'JUST LISTED';
    if (status === 'pending' || status === 'under contract') return 'UNDER CONTRACT';
    if (status === 'sold' || status === 'closed') return 'SOLD';
    if (status === 'coming soon') return 'COMING SOON';
    return 'JUST LISTED'; // default
  }, [transaction.isOffMarket, transaction.status, mlsData?.status]);
  
  // Build the iframe URL with query params
  const iframeUrl = useMemo(() => {
    const baseUrl = 'https://graphic-1-generator-black--caleb254.replit.app';
    const url = new URL(baseUrl);
    
    // Add embed mode
    url.searchParams.set('embed', 'true');
    
    // Property data
    url.searchParams.set('address', transaction.propertyAddress || '');
    url.searchParams.set('status', statusLabel);
    
    // Photo URL
    if (primaryPhotoUrl) {
      url.searchParams.set('propertyPhoto', primaryPhotoUrl);
    }
    
    // Agent data from profile
    if (agentProfileData?.user) {
      const fullName = [
        agentProfileData.user.firstName,
        agentProfileData.user.lastName
      ].filter(Boolean).join(' ');
      if (fullName) {
        url.searchParams.set('agentName', fullName);
      }
    }
    
    if (agentProfileData?.profile) {
      const profile = agentProfileData.profile;
      // Agent headshot
      if (profile.headshotUrl) {
        url.searchParams.set('agentPhoto', profile.headshotUrl);
      }
    }
    
    // Phone from user email or profile (if available)
    if (agentProfileData?.user?.phoneNumber) {
      url.searchParams.set('agentPhone', agentProfileData.user.phoneNumber);
    }
    
    // MLS number if available
    if (transaction.mlsNumber) {
      url.searchParams.set('mlsNumber', transaction.mlsNumber);
    }
    
    // Price if available
    const price = mlsData?.listPrice || transaction.listPrice;
    if (price) {
      url.searchParams.set('price', price.toString());
    }
    
    // Property details
    if (transaction.bedrooms) {
      url.searchParams.set('beds', transaction.bedrooms.toString());
    }
    if (transaction.bathrooms) {
      url.searchParams.set('baths', transaction.bathrooms.toString());
    }
    if (transaction.sqft) {
      url.searchParams.set('sqft', transaction.sqft.toString());
    }
    
    // Transaction ID for reference
    url.searchParams.set('transactionId', transaction.id);
    
    return url.toString();
  }, [transaction, statusLabel, primaryPhotoUrl, agentProfileData]);
  
  // Reset loading state when dialog opens
  useEffect(() => {
    if (open) {
      setIsLoading(true);
      setIframeError(false);
    }
  }, [open]);
  
  const handleIframeLoad = () => {
    setIsLoading(false);
  };
  
  const handleIframeError = () => {
    setIsLoading(false);
    setIframeError(true);
  };
  
  const handleOpenInNewTab = () => {
    window.open(iframeUrl, '_blank');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] w-[1400px] h-[90vh] p-0 gap-0 flex flex-col">
        <DialogHeader className="px-6 py-4 border-b shrink-0">
          <div className="flex items-center justify-between gap-4">
            <div>
              <DialogTitle className="text-lg font-semibold">
                Create Marketing Graphics
              </DialogTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {transaction.propertyAddress}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleOpenInNewTab}
                className="text-muted-foreground"
                data-testid="button-open-generator-new-tab"
              >
                <ExternalLink className="w-4 h-4 mr-1" />
                Open in new tab
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onOpenChange(false)}
                data-testid="button-close-generator"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </DialogHeader>
        
        <div className="flex-1 relative overflow-hidden">
          {/* Loading state */}
          {isLoading && !iframeError && (
            <div className="absolute inset-0 flex items-center justify-center bg-background z-10">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Loading Graphic Generator...</p>
              </div>
            </div>
          )}
          
          {/* Error state */}
          {iframeError && (
            <div className="absolute inset-0 flex items-center justify-center bg-background z-10">
              <div className="flex flex-col items-center gap-3 text-center max-w-md px-4">
                <div className="p-3 bg-destructive/10 rounded-full">
                  <X className="h-6 w-6 text-destructive" />
                </div>
                <h3 className="font-medium">Failed to load Graphic Generator</h3>
                <p className="text-sm text-muted-foreground">
                  The graphic generator service is temporarily unavailable. Please try again or open it in a new tab.
                </p>
                <div className="flex gap-2 mt-2">
                  <Button variant="outline" onClick={() => onOpenChange(false)}>
                    Close
                  </Button>
                  <Button onClick={handleOpenInNewTab}>
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Open in New Tab
                  </Button>
                </div>
              </div>
            </div>
          )}
          
          {/* Iframe */}
          <iframe
            src={iframeUrl}
            className="w-full h-full border-0"
            title="Graphic Generator"
            onLoad={handleIframeLoad}
            onError={handleIframeError}
            allow="clipboard-write; clipboard-read"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-downloads"
            data-testid="iframe-graphic-generator"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
