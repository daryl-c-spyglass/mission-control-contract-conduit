import { getAdjustmentColor, formatAdjustmentValue } from "@/lib/statusColors";
import { calculateAdjustments, PropertyForAdjustment } from "@/lib/adjustmentCalculations";

interface AdjustmentsPreviewProps {
  subjectProperty: PropertyForAdjustment;
  comparables: PropertyForAdjustment[];
  compact?: boolean;
}

export function AdjustmentsPreview({ subjectProperty, comparables, compact }: AdjustmentsPreviewProps) {
  const displayCount = compact ? 4 : 6;
  const displayComps = comparables.slice(0, displayCount);

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
      {comparables.length > displayCount && (
        <p className="text-xs text-muted-foreground mt-2 text-center">
          +{comparables.length - displayCount} more comparables in full report
        </p>
      )}
    </div>
  );
}
