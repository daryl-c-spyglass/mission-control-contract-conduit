import { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { SectionGrid } from './components/SectionGrid';
import { SlideViewer } from './components/SlideViewer';
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

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      setCurrentSlide(null);
      setSidebarOpen(false);
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'Escape') {
        if (currentSlide !== null) {
          setCurrentSlide(null);
        } else if (sidebarOpen) {
          setSidebarOpen(false);
        } else {
          onClose();
        }
      } else if (currentSlide !== null) {
        if (e.key === 'ArrowLeft' && currentSlide > 0) {
          setCurrentSlide(currentSlide - 1);
        } else if (e.key === 'ArrowRight' && currentSlide < WIDGETS.length - 1) {
          setCurrentSlide(currentSlide + 1);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentSlide, sidebarOpen, onClose]);

  if (!isOpen) return null;

  if (currentSlide !== null) {
    return (
      <SlideViewer
        currentIndex={currentSlide}
        onClose={() => setCurrentSlide(null)}
        onPrev={() => setCurrentSlide(Math.max(0, currentSlide - 1))}
        onNext={() => setCurrentSlide(Math.min(WIDGETS.length - 1, currentSlide + 1))}
        onHome={() => setCurrentSlide(null)}
        agent={agent}
        comparables={comparables}
        subjectProperty={subjectProperty}
        averageDaysOnMarket={averageDaysOnMarket}
      />
    );
  }

  return (
    <div 
      className="fixed inset-0 z-50 bg-background flex flex-col touch-manipulation"
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
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

      <div className="flex-1 overflow-auto bg-muted/30">
        <SectionGrid
          widgets={WIDGETS}
          onSelectWidget={setCurrentSlide}
          compsCount={comparables.length}
          daysOnMarket={averageDaysOnMarket}
          agent={agent}
        />
      </div>
    </div>
  );
}
