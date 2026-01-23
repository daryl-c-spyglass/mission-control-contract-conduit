import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, X, Home } from 'lucide-react';
import type { WidgetDefinition, AgentProfile, CmaProperty } from '../types';
import { WIDGETS } from '../constants/widgets';

import { StaticImageWidget } from '../widgets/StaticImageWidget';
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
  agent: AgentProfile;
  comparables: CmaProperty[];
  subjectProperty?: CmaProperty;
  averageDaysOnMarket: number;
}

export function SlideViewer({
  currentIndex,
  onClose,
  onPrev,
  onNext,
  onHome,
  agent,
  comparables,
  subjectProperty,
  averageDaysOnMarket,
}: SlideViewerProps) {
  const widget = WIDGETS[currentIndex];
  const totalSlides = WIDGETS.length;
  const isFirst = currentIndex === 0;
  const isLast = currentIndex === totalSlides - 1;

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
        return <SuggestedPriceWidget comparables={comparables} subjectProperty={subjectProperty} />;
      case 'listing_action_plan':
        return <ListingActionPlanWidget />;
      case 'spyglass_resources':
        return <SpyglassResourcesWidget />;
      case 'average_price_acre':
        return <AveragePriceAcreWidget comparables={comparables} subjectProperty={subjectProperty} />;
      default:
        return (
          <div className="flex flex-col h-full bg-background">
            <div className="bg-gray-900 text-white py-3 px-4 text-center flex-shrink-0">
              <span className="font-bold tracking-wider text-sm uppercase">
                {widget.title}
              </span>
            </div>
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
        paddingBottom: 'env(safe-area-inset-bottom)',
        paddingLeft: 'env(safe-area-inset-left)',
        paddingRight: 'env(safe-area-inset-right)',
      }}
      data-testid="slide-viewer"
    >
      <div className="flex items-center justify-between p-2 border-b bg-background flex-shrink-0">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={onHome}
            data-testid="button-home"
          >
            <Home className="w-5 h-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            data-testid="button-close-slide"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="text-center">
          <p 
            className="text-sm font-medium truncate max-w-[200px] md:max-w-none"
            data-testid="text-slide-title"
          >
            {widget.title}
          </p>
          <p 
            className="text-xs text-muted-foreground"
            data-testid="text-slide-counter"
          >
            {currentIndex + 1} / {totalSlides}
          </p>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={onPrev}
            disabled={isFirst}
            data-testid="button-prev-slide"
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onNext}
            disabled={isLast}
            data-testid="button-next-slide"
          >
            <ChevronRight className="w-5 h-5" />
          </Button>
        </div>
      </div>

      <div className="h-1 bg-muted flex-shrink-0">
        <div
          className="h-full bg-[#F37216] transition-all duration-300"
          style={{ width: `${((currentIndex + 1) / totalSlides) * 100}%` }}
          data-testid="progress-bar"
        />
      </div>

      <div className="flex-1 overflow-hidden">
        {renderWidget()}
      </div>
    </div>
  );
}
