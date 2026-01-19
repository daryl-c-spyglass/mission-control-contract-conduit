import { useState } from 'react';
import { 
  Save, 
  ExternalLink, 
  Mail, 
  Edit, 
  FileText,
  Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { CMAEmailShareDialog } from './CMAEmailShareDialog';
import { CMANotesDialog } from './CMANotesDialog';

interface CMAPreviewBannerProps {
  cmaId: string;
  propertyAddress: string;
  publicLink?: string | null;
  notes?: string | null;
  onSave?: () => void;
  onModifySearch?: () => void;
  onNotesUpdate?: () => void;
  isSaving?: boolean;
}

export function CMAPreviewBanner({
  cmaId,
  propertyAddress,
  publicLink,
  notes,
  onSave,
  onModifySearch,
  onNotesUpdate,
  isSaving,
}: CMAPreviewBannerProps) {
  const { toast } = useToast();
  const [emailShareDialogOpen, setEmailShareDialogOpen] = useState(false);
  const [notesDialogOpen, setNotesDialogOpen] = useState(false);

  const handleCopyLiveUrl = async () => {
    if (!publicLink) {
      toast({
        title: 'No share link',
        description: 'Generate a share link first using "Produce URL".',
        variant: 'destructive',
      });
      return;
    }
    
    const shareUrl = `${window.location.origin}/shared/cma/${publicLink}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast({
        title: 'URL copied',
        description: shareUrl,
      });
    } catch {
      toast({
        title: 'Copy failed',
        description: 'Unable to copy to clipboard.',
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
            data-testid="button-copy-live-url"
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            Copy Live URL
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
          
          {onModifySearch && (
            <Button 
              size="sm" 
              variant="outline" 
              onClick={onModifySearch}
              data-testid="button-modify-search"
            >
              <Edit className="w-4 h-4 mr-2" />
              Modify Search
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
        propertyAddress={propertyAddress}
        publicLink={publicLink}
      />

      <CMANotesDialog
        open={notesDialogOpen}
        onOpenChange={setNotesDialogOpen}
        cmaId={cmaId}
        initialNotes={notes || ''}
        onSuccess={onNotesUpdate}
      />
    </>
  );
}
