import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { 
  Save, 
  ExternalLink, 
  Mail, 
  SlidersHorizontal,
  FileText,
  Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { CMAEmailShareDialog } from './CMAEmailShareDialog';
import { CMANotesDialog } from './CMANotesDialog';
import { CMAFiltersPanel } from './CMAFiltersPanel';

interface CMAPreviewBannerProps {
  cmaId?: string | null;
  transactionId?: string;
  propertyAddress: string;
  publicLink?: string | null;
  notes?: string | null;
  cmaData?: any[];
  mlsNumber?: string | null;
  currentFilters?: any;
  subjectProperty?: {
    listPrice?: number;
    sqft?: number;
    yearBuilt?: number;
    beds?: number;
    baths?: number;
  };
  onSave?: () => void;
  onFiltersApplied?: () => void;
  onNotesUpdate?: () => void;
  isSaving?: boolean;
}

export function CMAPreviewBanner({
  cmaId,
  transactionId,
  propertyAddress,
  publicLink,
  notes,
  cmaData,
  mlsNumber,
  currentFilters,
  subjectProperty,
  onSave,
  onFiltersApplied,
  onNotesUpdate,
  isSaving,
}: CMAPreviewBannerProps) {
  const { toast } = useToast();
  const [emailShareDialogOpen, setEmailShareDialogOpen] = useState(false);
  const [notesDialogOpen, setNotesDialogOpen] = useState(false);
  const [filtersPanelOpen, setFiltersPanelOpen] = useState(false);
  const [localShareUrl, setLocalShareUrl] = useState<string | null>(null);

  const generateShareMutation = useMutation({
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
      onNotesUpdate?.(); // Invalidate cache
    },
  });

  const handleCopyLiveUrl = async () => {
    try {
      let shareUrl: string;
      
      if (publicLink) {
        shareUrl = `${window.location.origin}/shared/cma/${publicLink}`;
      } else if (localShareUrl) {
        shareUrl = localShareUrl;
      } else {
        // Generate share link on demand
        const result = await generateShareMutation.mutateAsync();
        shareUrl = `${window.location.origin}/shared/cma/${result.publicLink}`;
      }
      
      await navigator.clipboard.writeText(shareUrl);
      toast({
        title: 'URL copied',
        description: shareUrl,
      });
    } catch {
      toast({
        title: 'Failed to generate/copy link',
        description: 'Unable to create or copy share link.',
        variant: 'destructive',
      });
    }
  };

  return (
    <>
      <div 
        className="bg-yellow-100 dark:bg-yellow-900/20 border border-yellow-400 dark:border-yellow-600 rounded-md p-4 flex items-center justify-between gap-4 flex-wrap print:hidden"
        data-testid="cma-preview-banner"
      >
        <p className="text-sm text-yellow-800 dark:text-yellow-200">
          You are seeing a preview of the CMA report.
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          {onSave && (
            <Button 
              size="sm" 
              onClick={onSave} 
              disabled={isSaving}
              data-testid="button-save-cma"
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              {isSaving ? 'Saving...' : 'Save'}
            </Button>
          )}
          
          <Button 
            size="sm" 
            variant="outline" 
            onClick={handleCopyLiveUrl}
            disabled={generateShareMutation.isPending}
            data-testid="button-copy-live-url"
          >
            {generateShareMutation.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <ExternalLink className="w-4 h-4 mr-2" />
            )}
            {generateShareMutation.isPending ? 'Generating...' : 'Copy Live URL'}
          </Button>
          
          <Button 
            size="sm" 
            variant="outline" 
            onClick={() => setEmailShareDialogOpen(true)}
            data-testid="button-share-cma-email"
          >
            <Mail className="w-4 h-4 mr-2" />
            Share CMA
          </Button>
          
          {mlsNumber && transactionId && (
            <Button 
              size="sm" 
              variant="outline" 
              onClick={() => setFiltersPanelOpen(true)}
              data-testid="button-adjust-filters"
            >
              <SlidersHorizontal className="w-4 h-4 mr-2" />
              Adjust Filters
            </Button>
          )}
          
          <Button 
            size="sm" 
            variant="outline" 
            onClick={() => setNotesDialogOpen(true)}
            data-testid="button-notes"
          >
            <FileText className="w-4 h-4 mr-2" />
            Notes
          </Button>
        </div>
      </div>

      <CMAEmailShareDialog
        open={emailShareDialogOpen}
        onOpenChange={setEmailShareDialogOpen}
        cmaId={cmaId}
        transactionId={transactionId}
        propertyAddress={propertyAddress}
        publicLink={publicLink}
        cmaData={cmaData}
        mlsNumber={mlsNumber}
        onSuccess={onNotesUpdate} // Reuse onNotesUpdate to invalidate cache
      />

      <CMANotesDialog
        open={notesDialogOpen}
        onOpenChange={setNotesDialogOpen}
        cmaId={cmaId}
        transactionId={transactionId}
        propertyAddress={propertyAddress}
        initialNotes={notes || ''}
        cmaData={cmaData}
        mlsNumber={mlsNumber}
        onSuccess={onNotesUpdate}
      />

      {mlsNumber && transactionId && (
        <CMAFiltersPanel
          open={filtersPanelOpen}
          onOpenChange={setFiltersPanelOpen}
          transactionId={transactionId}
          mlsNumber={mlsNumber}
          currentFilters={currentFilters}
          subjectProperty={subjectProperty}
          onFiltersApplied={() => {
            onFiltersApplied?.();
            onNotesUpdate?.();
          }}
        />
      )}
    </>
  );
}
