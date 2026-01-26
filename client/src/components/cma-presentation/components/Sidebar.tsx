import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { X, Home } from 'lucide-react';
import type { WidgetDefinition } from '../types';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  widgets: WidgetDefinition[];
  onSelectWidget: (index: number) => void;
  currentWidget?: number;
  compsCount?: number;
  daysOnMarket?: number;
  suggestedListPrice?: number | null;
  avgPricePerAcre?: number | null;
}

// Format price compactly for sidebar badges
const formatSidebarBadge = (price: number): string => {
  if (price >= 1000000000) return `$${(price / 1000000000).toFixed(1)}B`;
  if (price >= 1000000) return `$${(price / 1000000).toFixed(1)}M`;
  if (price >= 1000) return `$${Math.round(price / 1000)}K`;
  return `$${price}`;
};

export function Sidebar({
  isOpen,
  onClose,
  widgets,
  onSelectWidget,
  currentWidget,
  compsCount = 0,
  daysOnMarket = 0,
  suggestedListPrice,
  avgPricePerAcre,
}: SidebarProps) {
  const getWidgetBadge = (widget: WidgetDefinition): string | number | null => {
    if (widget.id === 'comps' && compsCount > 0) return compsCount;
    if (widget.id === 'time_to_sell' && daysOnMarket > 0) return `${daysOnMarket} days`;
    if (widget.id === 'suggested_list_price' && suggestedListPrice && suggestedListPrice > 0) {
      return formatSidebarBadge(suggestedListPrice);
    }
    if (widget.id === 'average_price_acre' && avgPricePerAcre && avgPricePerAcre > 0 && avgPricePerAcre < 1000000000) {
      return `${formatSidebarBadge(avgPricePerAcre)}/ac`;
    }
    return null;
  };
  if (!isOpen) return null;

  return (
    <>
      <div 
        className="fixed inset-0 bg-black/50 z-[60]"
        onClick={onClose}
        data-testid="sidebar-overlay"
      />
      
      <div 
        className="fixed left-0 top-0 bottom-0 w-80 max-w-[85vw] bg-background z-[70] flex flex-col shadow-xl"
        style={{
          paddingTop: 'env(safe-area-inset-top)',
          paddingBottom: 'env(safe-area-inset-bottom)',
          paddingLeft: 'env(safe-area-inset-left)',
        }}
        data-testid="sidebar"
      >
        <div className="flex items-center justify-between p-4 border-b">
          <span className="font-semibold text-lg">Sections</span>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            data-testid="button-close-sidebar"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        <ScrollArea className="flex-1">
          <div className="py-2">
            <button
              className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/50 transition-colors"
              onClick={() => {
                onClose();
              }}
              data-testid="sidebar-home"
            >
              <span className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center bg-muted">
                <Home className="w-4 h-4 text-muted-foreground" />
              </span>
              <span className="text-sm font-medium">Home</span>
            </button>

            {widgets.map((widget, index) => {
              const isActive = currentWidget === index;
              return (
                <button
                  key={widget.id}
                  title={widget.title}
                  className={`
                    w-full flex items-start gap-3 px-4 py-3 text-left
                    transition-colors min-h-[52px]
                    hover:bg-muted/50
                    ${isActive 
                      ? 'bg-[#EF4923]/10 border-l-4 border-[#EF4923]' 
                      : 'border-l-4 border-transparent'
                    }
                  `}
                  onClick={() => {
                    onSelectWidget(index);
                    onClose();
                  }}
                  data-testid={`sidebar-item-${widget.id}`}
                >
                  <span 
                    className={`
                      flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center
                      text-xs font-medium
                      ${isActive 
                        ? 'bg-[#EF4923] text-white' 
                        : 'bg-muted text-muted-foreground'
                      }
                    `}
                  >
                    {widget.number}
                  </span>
                  <span 
                    className={`
                      flex-1 text-sm leading-snug line-clamp-2
                      ${isActive ? 'text-[#EF4923] font-medium' : 'text-foreground'}
                    `}
                  >
                    {widget.title}
                  </span>
                  {getWidgetBadge(widget) && (
                    <Badge variant="secondary" className="ml-auto flex-shrink-0">
                      {getWidgetBadge(widget)}
                    </Badge>
                  )}
                </button>
              );
            })}
          </div>
        </ScrollArea>
      </div>
    </>
  );
}
