import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Menu, X, Phone, Mail, Send } from 'lucide-react';
import type { AgentProfile, CmaProperty } from '../types';
import { WIDGETS } from '../constants/widgets';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { PdfDownloadButton } from './PdfDownloadButton';

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
  suggestedListPrice?: number | null;
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
  suggestedListPrice,
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
        return <SuggestedPriceWidget comparables={comparables} subjectProperty={subjectProperty} suggestedPrice={suggestedListPrice ?? undefined} mlsNumber={subjectProperty?.mlsNumber} />;
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

          <div className="flex items-center gap-2 z-10">
            <PdfDownloadButton
              propertyAddress={subjectProperty?.address || 'Property'}
              agent={agent}
              comparables={comparables}
              subjectProperty={subjectProperty}
              averageDaysOnMarket={averageDaysOnMarket}
              suggestedListPrice={suggestedListPrice ?? undefined}
              className="text-white"
            />
            
            <Popover>
              <PopoverTrigger asChild>
                <button 
                  className="flex items-center gap-2 rounded-full pl-3 pr-1 py-1 hover-elevate transition-colors cursor-pointer"
                  data-testid="button-agent-profile"
                >
                  <div className="text-right hidden md:block">
                    <p className="text-white text-sm font-medium" data-testid="text-agent-name">
                      {agent.name || 'Agent'}
                    </p>
                    <p className="text-white/70 text-xs" data-testid="text-agent-company">
                      {agent.company || 'Spyglass Realty'}
                    </p>
                  </div>
                  <Avatar className="w-10 h-10 border-2 border-white/30">
                    <AvatarImage src={agent.photo || '/default-avatar.png'} alt={agent.name || 'Agent'} />
                    <AvatarFallback className="bg-primary text-white text-sm">
                      {(agent.name || 'A').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                </button>
              </PopoverTrigger>
              
              <PopoverContent align="end" className="w-72 p-4" data-testid="popover-agent-profile">
                <div className="flex items-center gap-3 mb-4">
                  <Avatar className="w-14 h-14">
                    <AvatarImage src={agent.photo || '/default-avatar.png'} alt={agent.name || 'Agent'} />
                    <AvatarFallback className="bg-primary text-white text-lg">
                      {(agent.name || 'A').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-semibold text-lg">{agent.name || 'Agent'}</div>
                    <div className="text-sm text-muted-foreground">{agent.company || 'Spyglass Realty'}</div>
                  </div>
                </div>
                
                <div className="space-y-2 mb-4">
                  {agent.phone && (
                    <a 
                      href={`tel:${agent.phone}`}
                      className="flex items-center gap-3 text-sm hover:text-primary transition-colors"
                      data-testid="link-agent-phone"
                    >
                      <Phone className="w-4 h-4 text-muted-foreground" />
                      <span>{agent.phone}</span>
                    </a>
                  )}
                  {agent.email && (
                    <a 
                      href={`mailto:${agent.email}`}
                      className="flex items-center gap-3 text-sm hover:text-primary transition-colors"
                      data-testid="link-agent-email"
                    >
                      <Mail className="w-4 h-4 text-muted-foreground" />
                      <span>{agent.email}</span>
                    </a>
                  )}
                </div>
                
                {agent.email && (
                  <Button 
                    variant="outline" 
                    className="w-full gap-2"
                    onClick={() => window.open(`mailto:${agent.email}?subject=CMA Report Request`, '_blank')}
                    data-testid="button-email-report"
                  >
                    <Send className="w-4 h-4" />
                    Email Report
                  </Button>
                )}
              </PopoverContent>
            </Popover>

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
