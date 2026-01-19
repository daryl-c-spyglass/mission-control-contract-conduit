import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Loader2, Save } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface CMANotesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cmaId: string;
  initialNotes: string;
  onSuccess?: () => void;
}

export function CMANotesDialog({
  open,
  onOpenChange,
  cmaId,
  initialNotes,
  onSuccess,
}: CMANotesDialogProps) {
  const { toast } = useToast();
  const [notes, setNotes] = useState(initialNotes);

  const saveMutation = useMutation({
    mutationFn: async () => {
      await apiRequest('PATCH', `/api/cmas/${cmaId}`, { notes });
    },
    onSuccess: () => {
      toast({ title: 'Notes saved' });
      onSuccess?.();
      onOpenChange(false);
    },
    onError: () => {
      toast({ title: 'Failed to save notes', variant: 'destructive' });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>CMA Notes</DialogTitle>
          <DialogDescription>
            Add private notes about this market analysis. These are not visible to clients.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add your notes here... (e.g., discussion points, client preferences, pricing strategy)"
            rows={8}
            className="resize-none"
            data-testid="textarea-cma-notes"
          />
        </div>

        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            data-testid="button-cancel-notes"
          >
            Cancel
          </Button>
          <Button 
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            data-testid="button-save-notes"
          >
            {saveMutation.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Save Notes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
