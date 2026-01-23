import { useRef, useState, useEffect } from 'react';
import { Trash2, X } from 'lucide-react';

interface DrawingCanvasProps {
  isActive: boolean;
  onClose: () => void;
}

export function DrawingCanvas({ isActive, onClose }: DrawingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [context, setContext] = useState<CanvasRenderingContext2D | null>(null);

  useEffect(() => {
    if (isActive && canvasRef.current) {
      const canvas = canvasRef.current;
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;

      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.strokeStyle = '#F37216';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        setContext(ctx);
      }
    }
  }, [isActive]);

  useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current && context) {
        const imageData = context.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height);
        canvasRef.current.width = window.innerWidth;
        canvasRef.current.height = window.innerHeight;
        context.putImageData(imageData, 0, 0);
        context.strokeStyle = '#F37216';
        context.lineWidth = 3;
        context.lineCap = 'round';
        context.lineJoin = 'round';
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [context]);

  const getCoordinates = (e: React.MouseEvent | React.TouchEvent) => {
    if ('touches' in e) {
      return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
    return { x: e.clientX, y: e.clientY };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    if (!context) return;
    if ('touches' in e) {
      e.preventDefault();
    }
    setIsDrawing(true);
    const { x, y } = getCoordinates(e);
    context.beginPath();
    context.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || !context) return;
    if ('touches' in e) {
      e.preventDefault();
    }
    const { x, y } = getCoordinates(e);
    context.lineTo(x, y);
    context.stroke();
  };

  const stopDrawing = () => {
    if (context) {
      context.closePath();
    }
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    if (context && canvasRef.current) {
      context.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
  };

  if (!isActive) return null;

  return (
    <div className="fixed inset-0 z-[60] pointer-events-auto" data-testid="drawing-canvas">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 cursor-crosshair"
        style={{ touchAction: 'none' }}
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
        onTouchStart={startDrawing}
        onTouchMove={draw}
        onTouchEnd={stopDrawing}
      />

      <div className="absolute top-4 right-4 flex gap-2">
        <button
          onClick={clearCanvas}
          className="min-w-[44px] min-h-[44px] p-2 bg-white dark:bg-gray-800 
                     rounded-lg shadow-lg text-gray-700 dark:text-gray-300
                     hover:bg-gray-100 dark:hover:bg-gray-700"
          title="Clear drawing"
          data-testid="button-clear-drawing"
        >
          <Trash2 className="w-5 h-5" />
        </button>
        <button
          onClick={onClose}
          className="min-w-[44px] min-h-[44px] p-2 bg-white dark:bg-gray-800 
                     rounded-lg shadow-lg text-gray-700 dark:text-gray-300
                     hover:bg-gray-100 dark:hover:bg-gray-700"
          title="Exit drawing mode"
          data-testid="button-exit-drawing"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
