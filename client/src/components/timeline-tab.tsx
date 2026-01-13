import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Activity } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { getEventConfig, CATEGORY_FILTERS } from '@/lib/timeline-config';
import type { Activity as ActivityType } from '@shared/schema';

interface TimelineTabProps {
  transactionId: string;
}

export function TimelineTab({ transactionId }: TimelineTabProps) {
  const [categoryFilter, setCategoryFilter] = useState('all');

  const { data: events = [], isLoading } = useQuery<ActivityType[]>({
    queryKey: ['/api/transactions', transactionId, 'activities', categoryFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (categoryFilter !== 'all') {
        params.set('category', categoryFilter);
      }
      const res = await fetch(`/api/transactions/${transactionId}/activities?${params}`);
      if (!res.ok) throw new Error('Failed to fetch timeline');
      return res.json();
    },
  });

  const groupedEvents = groupEventsByDate(events);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h2 className="text-xl font-semibold">Activity Timeline</h2>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-44" data-testid="select-timeline-filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CATEGORY_FILTERS.map((filter) => (
              <SelectItem key={filter.value} value={filter.value} data-testid={`option-filter-${filter.value}`}>
                {filter.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {events.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Activity className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="font-medium mb-2">No Activity Yet</h3>
            <p className="text-sm text-muted-foreground">
              Activity will be recorded as actions are taken on this transaction.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {Object.entries(groupedEvents).map(([date, dateEvents]) => (
            <div key={date}>
              <div className="flex items-center gap-3 mb-4">
                <div className="h-px flex-1 bg-border" />
                <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">{date}</span>
                <div className="h-px flex-1 bg-border" />
              </div>

              <div className="space-y-3">
                {(dateEvents as ActivityType[]).map((event) => (
                  <TimelineEventCard key={event.id} event={event} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TimelineEventCard({ event }: { event: ActivityType }) {
  const config = getEventConfig(event.type);
  const IconComponent = config.icon;

  return (
    <div className="flex gap-4 items-start" data-testid={`timeline-event-${event.id}`}>
      <div className={cn(
        "flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center",
        config.bgColor
      )}>
        <IconComponent className={cn("h-5 w-5", config.color)} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-medium text-sm">{event.description}</p>
          {event.category && (
            <Badge variant="secondary" className="text-xs">
              {formatCategory(event.category)}
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          {formatTime(event.createdAt)}
        </p>
      </div>
    </div>
  );
}

function groupEventsByDate(events: ActivityType[]): Record<string, ActivityType[]> {
  const groups: Record<string, ActivityType[]> = {};
  
  events.forEach((event) => {
    if (!event.createdAt) return;
    const date = new Date(event.createdAt).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
    
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(event);
  });
  
  return groups;
}

function formatTime(dateString: Date | string | null | undefined): string {
  if (!dateString) return '';
  return new Date(dateString).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function formatCategory(category: string): string {
  return category.charAt(0).toUpperCase() + category.slice(1);
}
