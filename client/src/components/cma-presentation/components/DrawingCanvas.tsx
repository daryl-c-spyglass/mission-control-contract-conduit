import { useRef, useState, useEffect, useImperativeHandle, forwardRef } from 'react';

export interface DrawingCanvasHandle {
  clear: () => void;
}

interface DrawingCanvasProps {
  isActive: boolean;
  onClose: () => void;
}

export const DrawingCanvas = forwardRef<DrawingCanvasHandle, DrawingCanvasProps>(
  function DrawingCanvas({ isActive, onClose }, ref) {
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
        ctx.strokeStyle = '#EF4923';
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
        context.strokeStyle = '#EF4923';
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

  // Expose clear function to parent
  useImperativeHandle(ref, () => ({
    clear: clearCanvas,
  }), [context]);

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
    </div>
  );
});
