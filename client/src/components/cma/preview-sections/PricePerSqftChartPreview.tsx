import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

interface ComparableData {
  address?: string;
  streetAddress?: string;
  unparsedAddress?: string;
  listPrice?: number;
  closePrice?: number;
  soldPrice?: number;
  sqft?: number;
  livingArea?: number;
}

interface PricePerSqftChartPreviewProps {
  comparables: ComparableData[];
  compact?: boolean;
}

export function PricePerSqftChartPreview({ comparables, compact }: PricePerSqftChartPreviewProps) {
  const data = comparables.slice(0, compact ? 5 : 8).map((comp, i) => {
    const address = comp.unparsedAddress || comp.streetAddress || comp.address || `Comp ${i + 1}`;
    const price = comp.closePrice || comp.soldPrice || comp.listPrice || 0;
    const sqft = comp.livingArea || comp.sqft || 1;
    return {
      name: address.split(' ').slice(0, 2).join(' '),
      pricePerSqft: Math.round(price / sqft),
    };
  });

  const avgPricePerSqft = data.length > 0
    ? data.reduce((sum, d) => sum + d.pricePerSqft, 0) / data.length
    : 0;

  return (
    <div>
      <ResponsiveContainer width="100%" height={compact ? 150 : 200}>
        <BarChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
          <XAxis
            dataKey="name"
            tick={{ fontSize: 10 }}
            angle={-45}
            textAnchor="end"
            height={60}
          />
          <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `$${v}`} />
          <Tooltip formatter={(value) => [`$${value}/sqft`, 'Price/SqFt']} />
          <Bar dataKey="pricePerSqft" radius={[4, 4, 0, 0]}>
            {data.map((_, index) => (
              <Cell key={`cell-${index}`} fill="#EF4923" />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <p className="text-center text-sm text-muted-foreground mt-2">
        Average: ${avgPricePerSqft.toFixed(0)}/sqft
      </p>
    </div>
  );
}
