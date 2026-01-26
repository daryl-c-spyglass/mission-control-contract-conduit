import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Menu, X } from 'lucide-react';
import type { AgentProfile, CmaProperty } from '../types';
import { WIDGETS } from '../constants/widgets';

import { StaticImageWidget } from '../widgets/StaticImageWidget';

const imageCache = new Set<string>();

function preloadImage(src: string) {
  if (imageCache.has(src)) return;
  const img = new Image();
  img.src = src;
  imageCache.add(src);
}

function preloadAdjacentSlides(currentIndex: number) {
  const indicesToPreload = [
    currentIndex - 1,
    currentIndex + 1,
    currentIndex + 2,
  ].filter(i => i >= 0 && i < WIDGETS.length);

  indicesToPreload.forEach(index => {
    const widget = WIDGETS[index];
    if (widget.type === 'static' && widget.imagePath) {
      preloadImage(widget.imagePath);
    }
  });
}
import { AgentResumeWidget } from '../widgets/AgentResumeWidget';
import { ListingWithSpyglassWidget } from '../widgets/ListingWithSpyglassWidget';
import { ClientTestimonialsWidget } from '../widgets/ClientTestimonialsWidget';
import { MarketingWidget } from '../widgets/MarketingWidget';
import { ListingActionPlanWidget } from '../widgets/ListingActionPlanWidget';
import { CompsWidget } from '../widgets/CompsWidget';
import { TimeToSellWidget } from '../widgets/TimeToSellWidget';
import { SuggestedPriceWidget } from '../widgets/SuggestedPriceWidget';
import { SpyglassResourcesWidget } from '../widgets/SpyglassResourcesWidget';
import { AveragePriceAcreWidget } from '../widgets/AveragePriceAcreWidget';

interface SlideViewerProps {
  currentIndex: number;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  onHome: () => void;
  onMenuClick: () => void;
  agent: AgentProfile;
  comparables: CmaProperty[];
  subjectProperty?: CmaProperty;
  averageDaysOnMarket: number;
  cmaToken?: string; // Optional token for public CMA share access
}

export function SlideViewer({
  currentIndex,
  onClose,
  onPrev,
  onNext,
  onHome,
  onMenuClick,
  agent,
  comparables,
  subjectProperty,
  averageDaysOnMarket,
  cmaToken,
}: SlideViewerProps) {
  const widget = WIDGETS[currentIndex];
  const totalSlides = WIDGETS.length;

  useEffect(() => {
    preloadAdjacentSlides(currentIndex);
  }, [currentIndex]);

  const renderWidget = () => {
    if (widget.type === 'static' && widget.imagePath) {
      return <StaticImageWidget title={widget.title} imagePath={widget.imagePath} />;
    }

    switch (widget.id) {
      case 'agent_resume':
        return <AgentResumeWidget agent={agent} />;
      case 'listing_with_spyglass':
        return <ListingWithSpyglassWidget videoUrl={widget.videoUrl} />;
      case 'client_testimonials':
        return <ClientTestimonialsWidget />;
      case 'marketing':
        return <MarketingWidget />;
      case 'comps':
        return <CompsWidget comparables={comparables} subjectProperty={subjectProperty} />;
      case 'time_to_sell':
        return <TimeToSellWidget comparables={comparables} averageDaysOnMarket={averageDaysOnMarket} />;
      case 'suggested_list_price':
        return <SuggestedPriceWidget comparables={comparables} subjectProperty={subjectProperty} mlsNumber={subjectProperty?.mlsNumber} />;
      case 'listing_action_plan':
        return <ListingActionPlanWidget />;
      case 'spyglass_resources':
        return <SpyglassResourcesWidget cmaToken={cmaToken} />;
      case 'average_price_acre':
        return <AveragePriceAcreWidget comparables={comparables} subjectProperty={subjectProperty} />;
      default:
        return (
          <div className="flex flex-col h-full bg-background">
            <div className="flex-1 flex items-center justify-center p-6">
              <div className="text-center text-muted-foreground">
                <p className="text-lg font-medium">{widget.title}</p>
                <p className="text-sm">Content coming soon</p>
              </div>
            </div>
          </div>
        );
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 bg-background flex flex-col"
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        paddingLeft: 'env(safe-area-inset-left)',
        paddingRight: 'env(safe-area-inset-right)',
      }}
      data-testid="slide-viewer"
    >
      <div 
        className="flex-shrink-0 bg-[#222222]"
      >
        <div className="relative flex items-center justify-between p-3">
          <div className="flex items-center gap-2 z-10">
            <Button
              variant="ghost"
              size="icon"
              onClick={onMenuClick}
              className="text-white hover:bg-white/10"
              data-testid="button-menu-slide"
            >
              <Menu className="w-5 h-5" />
            </Button>
            <img 
              src="/logos/SpyglassRealty_Logo_White.png" 
              alt="Spyglass Realty" 
              className="h-8 w-auto max-w-[120px] object-contain"
            />
          </div>

          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <h1 
              className="text-white text-lg md:text-xl font-bold uppercase tracking-wide"
              data-testid="text-slide-title"
            >
              {widget.title}
            </h1>
          </div>

          <div className="flex items-center gap-3 z-10">
            <div className="text-right hidden md:block">
              <p className="text-white text-sm font-medium" data-testid="text-agent-name">
                {agent.name || 'Agent'}
              </p>
              <p className="text-white/70 text-xs" data-testid="text-agent-company">
                {agent.company || 'Spyglass Realty'}
              </p>
            </div>
            <img 
              src={agent.photo || '/default-avatar.png'} 
              alt={agent.name || 'Agent'}
              className="w-10 h-10 rounded-full object-cover border-2 border-white/30"
              data-testid="img-agent-photo"
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="ml-1 text-white hover:bg-white/10"
              aria-label="Close presentation (Esc)"
              title="Close (Esc)"
              data-testid="button-close-slide"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        <div className="text-center pb-2">
          <p 
            className="text-white/70 text-xs"
            data-testid="text-slide-counter"
          >
            {currentIndex + 1} / {totalSlides}
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-auto pb-16">
        {renderWidget()}
      </div>
    </div>
  );
}
