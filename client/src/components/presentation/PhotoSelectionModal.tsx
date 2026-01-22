import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Check } from "lucide-react";

interface PhotoSelectionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  propertyId: string;
  propertyAddress: string;
  photos: string[];
  selectedPhotos: string[];
  onSave: (propertyId: string, selectedPhotos: string[]) => void;
  maxPhotos?: number;
}

export function PhotoSelectionModal({
  open,
  onOpenChange,
  propertyId,
  propertyAddress,
  photos,
  selectedPhotos: initialSelected,
  onSave,
  maxPhotos = 12,
}: PhotoSelectionModalProps) {
  const [selected, setSelected] = useState<string[]>([]);

  useEffect(() => {
    if (open) {
      setSelected(initialSelected.length > 0 ? initialSelected : photos.slice(0, Math.min(maxPhotos, photos.length)));
    }
  }, [open, initialSelected, photos, maxPhotos]);

  const togglePhoto = (photoUrl: string) => {
    setSelected(prev => {
      if (prev.includes(photoUrl)) {
        return prev.filter(p => p !== photoUrl);
      }
      if (prev.length >= maxPhotos) {
        return prev;
      }
      return [...prev, photoUrl];
    });
  };

  const handleSave = () => {
    onSave(propertyId, selected);
    onOpenChange(false);
  };

  const selectAll = () => {
    setSelected(photos.slice(0, Math.min(maxPhotos, photos.length)));
  };

  const clearAll = () => {
    setSelected([]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-4xl max-h-[80vh] p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="text-base sm:text-lg">Select Photos</DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            {propertyAddress} - Select up to {maxPhotos} photos for the presentation
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:justify-between pb-2 border-b">
          <span className="text-xs sm:text-sm text-muted-foreground">
            {selected.length} of {maxPhotos} selected
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={selectAll} data-testid="button-select-all" className="text-xs sm:text-sm">
              Select {Math.min(maxPhotos, photos.length)}
            </Button>
            <Button variant="outline" size="sm" onClick={clearAll} data-testid="button-clear-all" className="text-xs sm:text-sm">
              Clear
            </Button>
          </div>
        </div>

        <ScrollArea className="h-[400px]">
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 p-1">
            {photos.map((photo, index) => {
              const isSelected = selected.includes(photo);
              return (
                <div
                  key={photo}
                  className={`relative aspect-square rounded-lg overflow-hidden cursor-pointer border-2 transition-all ${
                    isSelected ? 'border-primary ring-2 ring-primary/20' : 'border-transparent hover:border-muted'
                  }`}
                  onClick={() => togglePhoto(photo)}
                  data-testid={`photo-${index}`}
                >
                  <img
                    src={photo}
                    alt={`Photo ${index + 1}`}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  {isSelected && (
                    <div className="absolute top-1 right-1 w-6 h-6 bg-primary rounded-full flex items-center justify-center">
                      <Check className="w-4 h-4 text-primary-foreground" />
                    </div>
                  )}
                  <div className="absolute bottom-1 left-1 bg-black/50 text-white text-xs px-1.5 py-0.5 rounded">
                    {index + 1}
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-photo-selection">
            Cancel
          </Button>
          <Button onClick={handleSave} data-testid="button-save-photo-selection">
            Save Selection ({selected.length})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
