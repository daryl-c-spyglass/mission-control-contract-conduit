import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { BarChart3, MapPin, Pencil, Info } from 'lucide-react';
import { format } from 'date-fns';

interface CMASourceIndicatorProps {
  source: string | null;
  generatedAt?: string | Date | null;
  lastUpdatedAt?: string | Date | null;
  comparablesCount?: number;
}

const SOURCE_CONFIG = {
  repliers_similar: {
    icon: BarChart3,
    label: 'MLS Comparables',
    shortLabel: 'MLS',
    color: 'text-green-600 dark:text-green-400',
    bgColor: 'bg-green-50 dark:bg-green-950/30',
    borderColor: 'border-green-200 dark:border-green-800',
    description: "Automatically fetched from the MLS using Repliers' similar listings algorithm.",
    details: [
      'Location and neighborhood',
      'Price range',
      'Property characteristics (beds, baths, sqft)',
    ],
  },
  coordinate_fallback: {
    icon: MapPin,
    label: 'Nearby Property Search',
    shortLabel: 'Nearby',
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-50 dark:bg-blue-950/30',
    borderColor: 'border-blue-200 dark:border-blue-800',
    description: 'Generated using a coordinate-based search within 5 miles of this property.',
    details: [
      'Radius: 5 miles',
      'Price range: ±25% of list price',
      'Bedrooms: ±1 of subject property',
    ],
    note: 'This method is used when standard MLS comparables are not available (e.g., for closed listings).',
  },
  manual: {
    icon: Pencil,
    label: 'Manually Selected',
    shortLabel: 'Manual',
    color: 'text-purple-600 dark:text-purple-400',
    bgColor: 'bg-purple-50 dark:bg-purple-950/30',
    borderColor: 'border-purple-200 dark:border-purple-800',
    description: 'These comparables were manually selected or modified.',
    details: [],
  },
};

export function CMASourceIndicator({ 
  source, 
  generatedAt, 
  lastUpdatedAt,
  comparablesCount 
}: CMASourceIndicatorProps) {
  const sourceKey = source && SOURCE_CONFIG[source as keyof typeof SOURCE_CONFIG] 
    ? source as keyof typeof SOURCE_CONFIG
    : 'repliers_similar';
  
  const config = SOURCE_CONFIG[sourceKey];
  const Icon = config.icon;
  
  const displayDate = lastUpdatedAt || generatedAt;
  const formattedDate = displayDate 
    ? format(new Date(displayDate), "MMM d, yyyy 'at' h:mm a")
    : null;

  return (
    <TooltipProvider>
      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          <button 
            className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium 
                        ${config.bgColor} ${config.color} border ${config.borderColor}
                        hover:opacity-80 transition-opacity cursor-help`}
            data-testid="button-cma-source-indicator"
          >
            <Icon className="w-3.5 h-3.5" />
            <span>{config.shortLabel}</span>
            <Info className="w-3 h-3 opacity-60" />
          </button>
        </TooltipTrigger>
        <TooltipContent 
          side="bottom" 
          align="start" 
          className="max-w-sm p-0 overflow-hidden"
        >
          <div className={`p-3 ${config.bgColor} border-b ${config.borderColor}`}>
            <div className="flex items-center gap-2">
              <Icon className={`w-4 h-4 ${config.color}`} />
              <span className={`font-semibold ${config.color}`}>{config.label}</span>
            </div>
          </div>
          
          <div className="p-3 space-y-3">
            <p className="text-sm text-muted-foreground">
              {config.description}
            </p>
            
            {'note' in config && config.note && (
              <p className="text-xs text-muted-foreground italic">
                {config.note}
              </p>
            )}
            
            {config.details.length > 0 && (
              <div>
                <p className="text-xs font-medium mb-1">
                  {sourceKey === 'coordinate_fallback' ? 'Search criteria:' : 'Algorithm considers:'}
                </p>
                <ul className="text-xs text-muted-foreground space-y-0.5">
                  {config.details.map((detail, index) => (
                    <li key={index} className="flex items-center gap-1.5">
                      <span className="w-1 h-1 rounded-full bg-current opacity-60" />
                      {detail}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
            {formattedDate && (
              <p className="text-xs text-muted-foreground pt-2 border-t">
                {lastUpdatedAt ? 'Last updated:' : 'Generated:'} {formattedDate}
              </p>
            )}
            
            {comparablesCount !== undefined && (
              <p className="text-xs font-medium">
                {comparablesCount} comparable{comparablesCount !== 1 ? 's' : ''} found
              </p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
