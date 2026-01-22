import { useState } from "react";
import { getAdjustmentColor, formatAdjustmentValue } from "@/lib/statusColors";
import { calculateAdjustments, PropertyForAdjustment } from "@/lib/adjustmentCalculations";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AdjustmentsPreviewProps {
  subjectProperty: PropertyForAdjustment;
  comparables: PropertyForAdjustment[];
  compact?: boolean;
}

export function AdjustmentsPreview({ subjectProperty, comparables, compact }: AdjustmentsPreviewProps) {
  const [showAll, setShowAll] = useState(false);
  
  const displayCount = compact ? 4 : 6;
  const displayComps = showAll ? comparables : comparables.slice(0, displayCount);
  const remainingCount = comparables.length - displayCount;
  const hasMore = remainingCount > 0;

  const adjustments = displayComps.map(comp => calculateAdjustments(subjectProperty, comp));

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b">
            <th className="text-left py-2 font-medium">Property</th>
            <th className="text-right py-2 font-medium">Sale Price</th>
            <th className="text-right py-2 font-medium">Total Adj</th>
            <th className="text-right py-2 font-medium">Adj. Price</th>
          </tr>
        </thead>
        <tbody>
          {adjustments.map((adj, i) => (
            <tr key={i} className="border-b last:border-b-0">
              <td className="py-2 max-w-[120px] truncate">{adj.compAddress}</td>
              <td className="text-right">${(adj.salePrice / 1000).toFixed(0)}k</td>
              <td className="text-right font-medium" style={{ color: getAdjustmentColor(adj.totalAdjustment) }}>
                {formatAdjustmentValue(adj.totalAdjustment)}
              </td>
              <td className="text-right font-bold">${(adj.adjustedPrice / 1000).toFixed(0)}k</td>
            </tr>
          ))}
        </tbody>
      </table>
      
      {hasMore && !showAll && (
        <div className="flex justify-center mt-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAll(true)}
            className="text-xs"
            data-testid="button-show-more-adjustments"
          >
            <span>+{remainingCount} more comparables</span>
            <ChevronDown className="h-3 w-3 ml-1" />
          </Button>
        </div>
      )}
      
      {showAll && comparables.length > displayCount && (
        <div className="flex justify-center mt-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAll(false)}
            className="text-xs text-muted-foreground"
            data-testid="button-show-less-adjustments"
          >
            <ChevronUp className="h-3 w-3 mr-1" />
            <span>Show less</span>
          </Button>
        </div>
      )}
    </div>
  );
}
