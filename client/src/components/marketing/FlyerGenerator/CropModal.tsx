import { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ZoomIn, RotateCcw } from 'lucide-react';

interface CropModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  aspectRatio: number;
  onApply: (position: { x: number; y: number }, zoom: number) => void;
  initialPosition?: { x: number; y: number };
  initialZoom?: number;
  title?: string;
}

export function CropModal({
  isOpen,
  onClose,
  imageUrl,
  aspectRatio,
  onApply,
  initialPosition = { x: 50, y: 50 },
  initialZoom = 1,
  title = 'Crop Image',
}: CropModalProps) {
  const [position, setPosition] = useState(initialPosition);
  const [zoom, setZoom] = useState(initialZoom);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const wasOpenRef = useRef(false);

  // Constrain position to valid bounds for current zoom
  // This prevents showing empty/grey areas when zoomed and panned
  const constrainPosition = (pos: { x: number; y: number }, currentZoom: number) => {
    // When zoomed, limit pan range so edges don't show
    // At zoom z, the valid range is [50 - 50/z, 50 + 50/z] for each axis
    const minPos = 50 - (50 / currentZoom);
    const maxPos = 50 + (50 / currentZoom);
    return {
      x: Math.max(minPos, Math.min(maxPos, pos.x)),
      y: Math.max(minPos, Math.min(maxPos, pos.y)),
    };
  };

  useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      // Constrain initial position to valid bounds for initial zoom
      const constrainedPos = constrainPosition(initialPosition, initialZoom);
      setPosition(constrainedPos);
      setZoom(initialZoom);
      wasOpenRef.current = true;
    } else if (!isOpen) {
      wasOpenRef.current = false;
    }
  }, [isOpen, initialPosition.x, initialPosition.y, initialZoom]);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;

    const deltaX = e.clientX - dragStart.x;
    const deltaY = e.clientY - dragStart.y;

    const sensitivity = 0.15 / zoom;

    setPosition(prev => {
      const newPos = {
        x: prev.x - deltaX * sensitivity,
        y: prev.y - deltaY * sensitivity,
      };
      return constrainPosition(newPos, zoom);
    });

    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      setIsDragging(true);
      setDragStart({ x: e.touches[0].clientX, y: e.touches[0].clientY });
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || e.touches.length !== 1) return;

    const deltaX = e.touches[0].clientX - dragStart.x;
    const deltaY = e.touches[0].clientY - dragStart.y;

    const sensitivity = 0.15 / zoom;

    setPosition(prev => {
      const newPos = {
        x: prev.x - deltaX * sensitivity,
        y: prev.y - deltaY * sensitivity,
      };
      return constrainPosition(newPos, zoom);
    });

    setDragStart({ x: e.touches[0].clientX, y: e.touches[0].clientY });
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  const handleReset = () => {
    setPosition({ x: 50, y: 50 });
    setZoom(1);
  };

  const handleApply = () => {
    onApply(position, zoom);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div
          ref={containerRef}
          className="relative overflow-hidden rounded-lg bg-gray-100 cursor-move select-none"
          style={{
            aspectRatio: aspectRatio,
            maxHeight: '400px',
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className="absolute inset-0 pointer-events-none z-10">
            <div className="w-full h-full grid grid-cols-3 grid-rows-3">
              {Array.from({ length: 9 }).map((_, i) => (
                <div key={i} className="border border-white/30" />
              ))}
            </div>
          </div>

          <img
            src={imageUrl}
            alt="Crop preview"
            className="absolute w-full h-full object-cover select-none"
            style={{
              objectPosition: `${position.x}% ${position.y}%`,
              transform: `scale(${zoom})`,
              transformOrigin: `${position.x}% ${position.y}%`,
            }}
            draggable={false}
          />
        </div>

        <div className="flex items-center gap-3 mt-4">
          <ZoomIn className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <input
            type="range"
            min={1}
            max={3}
            step={0.05}
            value={zoom}
            onChange={(e) => {
              const newValue = parseFloat(e.target.value);
              setZoom(newValue);
              // Constrain position when zoom changes to prevent empty areas
              setPosition(prev => constrainPosition(prev, newValue));
            }}
            className="flex-1 h-2 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
            data-testid="slider-crop-zoom"
          />
          <span className="text-sm text-muted-foreground w-12 text-right">{zoom.toFixed(1)}x</span>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button 
            variant="outline" 
            onClick={handleReset}
            className="gap-2"
            data-testid="button-crop-reset"
          >
            <RotateCcw className="h-4 w-4" />
            Reset
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} data-testid="button-crop-cancel">
              Cancel
            </Button>
            <Button onClick={handleApply} data-testid="button-crop-apply">
              Apply
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
