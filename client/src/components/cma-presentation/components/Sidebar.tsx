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
}

export function Sidebar({
  isOpen,
  onClose,
  widgets,
  onSelectWidget,
  currentWidget,
  compsCount = 0,
}: SidebarProps) {
  if (!isOpen) return null;

  return (
    <>
      <div 
        className="fixed inset-0 bg-black/50 z-40"
        onClick={onClose}
        data-testid="sidebar-overlay"
      />
      
      <div 
        className="fixed left-0 top-0 bottom-0 w-72 bg-background z-50 flex flex-col shadow-xl"
        style={{
          paddingTop: 'env(safe-area-inset-top)',
          paddingBottom: 'env(safe-area-inset-bottom)',
          paddingLeft: 'env(safe-area-inset-left)',
        }}
        data-testid="sidebar"
      >
        <div className="flex items-center justify-between p-4 border-b">
          <span className="font-semibold">Sections</span>
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
          <div className="p-2">
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 mb-2"
              onClick={() => {
                onClose();
              }}
              data-testid="sidebar-home"
            >
              <Home className="w-5 h-5" />
              <span>Home</span>
            </Button>

            {widgets.map((widget, index) => (
              <Button
                key={widget.id}
                variant={currentWidget === index ? 'secondary' : 'ghost'}
                className="w-full justify-start gap-3 mb-1"
                onClick={() => {
                  onSelectWidget(index);
                  onClose();
                }}
                data-testid={`sidebar-item-${widget.id}`}
              >
                <span className="w-6 text-center text-muted-foreground text-sm">
                  {widget.number}
                </span>
                <span className="flex-1 text-left text-sm truncate">
                  {widget.title}
                </span>
                {widget.id === 'comps' && compsCount > 0 && (
                  <Badge variant="secondary" className="ml-auto">
                    {compsCount}
                  </Badge>
                )}
              </Button>
            ))}
          </div>
        </ScrollArea>
      </div>
    </>
  );
}
