import { SectionCard } from './SectionCard';
import type { WidgetDefinition, AgentProfile } from '../types';

interface SectionGridProps {
  widgets: WidgetDefinition[];
  onSelectWidget: (index: number) => void;
  compsCount?: number;
  daysOnMarket?: number;
  suggestedListPrice?: number | null;
  avgPricePerAcre?: number | null;
  agent?: AgentProfile;
}

// Format price compactly for badges
const formatCompactPrice = (price: number): string => {
  if (price >= 1000000) {
    const millions = price / 1000000;
    return `$${millions >= 10 ? millions.toFixed(0) : millions.toFixed(1)}M`;
  }
  if (price >= 1000) {
    const thousands = price / 1000;
    return `$${Math.round(thousands)}K`;
  }
  return `$${price.toLocaleString()}`;
};

export function SectionGrid({ 
  widgets, 
  onSelectWidget, 
  compsCount = 0, 
  daysOnMarket = 0,
  suggestedListPrice,
  avgPricePerAcre,
  agent,
}: SectionGridProps) {
  const getWidgetBadge = (widget: WidgetDefinition): string | number | undefined => {
    if (widget.id === 'comps') {
      return compsCount > 0 ? compsCount : undefined;
    }
    if (widget.id === 'time_to_sell') {
      return daysOnMarket > 0 ? `${daysOnMarket} days` : undefined;
    }
    if (widget.id === 'suggested_list_price') {
      return suggestedListPrice && suggestedListPrice > 0 
        ? formatCompactPrice(suggestedListPrice) 
        : undefined;
    }
    if (widget.id === 'average_price_acre') {
      return avgPricePerAcre && avgPricePerAcre > 0 && avgPricePerAcre < 1000000000
        ? `${formatCompactPrice(avgPricePerAcre)}/acre`
        : undefined;
    }
    return widget.badge;
  };

  return (
    <div 
      className="grid gap-3 p-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
      data-testid="section-grid"
    >
      {widgets.map((widget, index) => (
        <SectionCard
          key={widget.id}
          widget={widget}
          onClick={() => onSelectWidget(index)}
          badge={getWidgetBadge(widget)}
          agentPhoto={widget.id === 'agent_resume' ? agent?.photo : undefined}
          agentName={widget.id === 'agent_resume' ? agent?.name : undefined}
        />
      ))}
    </div>
  );
}
