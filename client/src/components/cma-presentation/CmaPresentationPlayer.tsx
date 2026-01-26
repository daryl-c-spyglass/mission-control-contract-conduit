import { useState, useEffect, useRef } from 'react';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { SectionGrid } from './components/SectionGrid';
import { SlideViewer } from './components/SlideViewer';
import { BottomNavigation } from './components/BottomNavigation';
import { DrawingCanvas, type DrawingCanvasHandle } from './components/DrawingCanvas';
import { WIDGETS } from './constants/widgets';
import type { AgentProfile, CmaProperty } from './types';

interface CmaPresentationPlayerProps {
  isOpen: boolean;
  onClose: () => void;
  propertyAddress: string;
  mlsNumber: string;
  preparedFor?: string;
  agent: AgentProfile;
  subjectProperty?: CmaProperty;
  comparables: CmaProperty[];
  averageDaysOnMarket: number;
  latitude?: number;
  longitude?: number;
}

export function CmaPresentationPlayer({
  isOpen,
  onClose,
  propertyAddress,
  mlsNumber,
  preparedFor,
  agent,
  subjectProperty,
  comparables,
  averageDaysOnMarket,
  latitude,
  longitude,
}: CmaPresentationPlayerProps) {
  const [currentSlide, setCurrentSlide] = useState<number | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [drawingMode, setDrawingMode] = useState(false);
  const drawingCanvasRef = useRef<DrawingCanvasHandle>(null);

  const handleClearDrawing = () => {
    drawingCanvasRef.current?.clear();
  };

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      setCurrentSlide(null);
      setSidebarOpen(false);
      setDrawingMode(false);
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'Escape') {
        if (drawingMode) {
          setDrawingMode(false);
        } else if (currentSlide !== null) {
          setCurrentSlide(null);
        } else if (sidebarOpen) {
          setSidebarOpen(false);
        } else {
          onClose();
        }
      } else if (currentSlide !== null && !drawingMode) {
        if (e.key === 'ArrowLeft' && currentSlide > 0) {
          setCurrentSlide(currentSlide - 1);
        } else if (e.key === 'ArrowRight' && currentSlide < WIDGETS.length - 1) {
          setCurrentSlide(currentSlide + 1);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentSlide, sidebarOpen, drawingMode, onClose]);

  if (!isOpen) return null;

  if (currentSlide !== null) {
    const prevTitle = currentSlide > 0 ? WIDGETS[currentSlide - 1].title : null;
    const nextTitle = currentSlide < WIDGETS.length - 1 ? WIDGETS[currentSlide + 1].title : null;

    return (
      <>
        <Sidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          widgets={WIDGETS}
          onSelectWidget={(index) => {
            setCurrentSlide(index);
            setSidebarOpen(false);
          }}
          currentWidget={currentSlide}
          compsCount={comparables.length}
        />
        <SlideViewer
          currentIndex={currentSlide}
          onClose={() => setCurrentSlide(null)}
          onPrev={() => setCurrentSlide(Math.max(0, currentSlide - 1))}
          onNext={() => setCurrentSlide(Math.min(WIDGETS.length - 1, currentSlide + 1))}
          onHome={() => setCurrentSlide(null)}
          onMenuClick={() => setSidebarOpen(true)}
          agent={agent}
          comparables={comparables}
          subjectProperty={subjectProperty}
          averageDaysOnMarket={averageDaysOnMarket}
        />
        <BottomNavigation
          mode="slide"
          currentSlide={currentSlide}
          totalSlides={WIDGETS.length}
          prevSlideTitle={prevTitle}
          nextSlideTitle={nextTitle}
          onPrevious={() => setCurrentSlide(Math.max(0, currentSlide - 1))}
          onNext={() => setCurrentSlide(Math.min(WIDGETS.length - 1, currentSlide + 1))}
          onHome={() => setCurrentSlide(null)}
          onToggleDrawing={() => setDrawingMode(!drawingMode)}
          onClearDrawing={handleClearDrawing}
          isDrawingMode={drawingMode}
        />
        <DrawingCanvas ref={drawingCanvasRef} isActive={drawingMode} onClose={() => setDrawingMode(false)} />
      </>
    );
  }

  return (
    <div 
      className="fixed inset-0 z-50 bg-background flex flex-col touch-manipulation"
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        paddingLeft: 'env(safe-area-inset-left)',
        paddingRight: 'env(safe-area-inset-right)',
      }}
      data-testid="cma-presentation-player"
    >
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        widgets={WIDGETS}
        onSelectWidget={(index) => {
          setCurrentSlide(index);
          setSidebarOpen(false);
        }}
        currentWidget={currentSlide ?? undefined}
        compsCount={comparables.length}
      />

      <Header
        propertyAddress={propertyAddress}
        mlsNumber={mlsNumber}
        preparedFor={preparedFor}
        agent={agent}
        onMenuClick={() => setSidebarOpen(true)}
        onClose={onClose}
        latitude={latitude}
        longitude={longitude}
        comparables={comparables}
        subjectProperty={subjectProperty}
      />

      <div className="flex-1 overflow-auto bg-muted/30 pb-16">
        <SectionGrid
          widgets={WIDGETS}
          onSelectWidget={setCurrentSlide}
          compsCount={comparables.length}
          daysOnMarket={averageDaysOnMarket}
          agent={agent}
        />
      </div>

      <BottomNavigation
        mode="home"
        onStartPresentation={() => setCurrentSlide(0)}
        onToggleDrawing={() => setDrawingMode(!drawingMode)}
        onClearDrawing={handleClearDrawing}
        isDrawingMode={drawingMode}
      />
      
      <DrawingCanvas ref={drawingCanvasRef} isActive={drawingMode} onClose={() => setDrawingMode(false)} />
    </div>
  );
}
