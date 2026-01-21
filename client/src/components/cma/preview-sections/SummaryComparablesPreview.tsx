interface ComparableData {
  listPrice?: number;
  sqft?: number;
  livingArea?: number;
  closePrice?: number;
  soldPrice?: number;
}

interface SummaryComparablesPreviewProps {
  comparables: ComparableData[];
}

export function SummaryComparablesPreview({ comparables }: SummaryComparablesPreviewProps) {
  const avgPrice = comparables.length > 0
    ? comparables.reduce((sum, c) => sum + (c.closePrice || c.soldPrice || c.listPrice || 0), 0) / comparables.length
    : 0;

  const avgPricePerSqft = comparables.length > 0
    ? comparables.reduce((sum, c) => {
        const price = c.closePrice || c.soldPrice || c.listPrice || 0;
        const sqft = c.livingArea || c.sqft || 1;
        return sum + (price / sqft);
      }, 0) / comparables.length
    : 0;

  return (
    <div className="grid grid-cols-3 gap-3">
      <div className="text-center p-3 bg-muted/50 rounded-lg">
        <p className="text-xs text-muted-foreground">Avg Price</p>
        <p className="font-bold text-[#F37216]">
          ${avgPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}
        </p>
      </div>
      <div className="text-center p-3 bg-muted/50 rounded-lg">
        <p className="text-xs text-muted-foreground">Avg $/SqFt</p>
        <p className="font-bold text-[#F37216]">${avgPricePerSqft.toFixed(0)}</p>
      </div>
      <div className="text-center p-3 bg-muted/50 rounded-lg">
        <p className="text-xs text-muted-foreground">Properties</p>
        <p className="font-bold text-[#F37216]">{comparables.length}</p>
      </div>
    </div>
  );
}
