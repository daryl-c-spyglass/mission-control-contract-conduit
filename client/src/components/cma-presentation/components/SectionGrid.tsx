import { SectionCard } from './SectionCard';
import type { WidgetDefinition, AgentProfile } from '../types';

interface SectionGridProps {
  widgets: WidgetDefinition[];
  onSelectWidget: (index: number) => void;
  compsCount?: number;
  daysOnMarket?: number;
  agent?: AgentProfile;
}

export function SectionGrid({ 
  widgets, 
  onSelectWidget, 
  compsCount = 0, 
  daysOnMarket = 0,
  agent,
}: SectionGridProps) {
  const getWidgetBadge = (widget: WidgetDefinition): string | number | undefined => {
    if (widget.id === 'comps') {
      return compsCount > 0 ? compsCount : undefined;
    }
    if (widget.id === 'time_to_sell') {
      return daysOnMarket > 0 ? `${daysOnMarket} days` : undefined;
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
