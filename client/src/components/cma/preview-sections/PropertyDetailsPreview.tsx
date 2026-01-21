import { getStatusColor } from "@/lib/statusColors";
import { Badge } from "@/components/ui/badge";

interface Property {
  address?: string;
  streetAddress?: string;
  unparsedAddress?: string;
  city?: string;
  listPrice?: number;
  closePrice?: number;
  soldPrice?: number;
  beds?: number;
  bedroomsTotal?: number;
  baths?: number;
  bathroomsTotal?: number;
  sqft?: number;
  livingArea?: number;
  status?: string;
  standardStatus?: string;
}

interface PropertyDetailsPreviewProps {
  properties: Property[];
  compact?: boolean;
}

export function PropertyDetailsPreview({ properties, compact }: PropertyDetailsPreviewProps) {
  const displayCount = compact ? 4 : 6;
  const displayProperties = properties.slice(0, displayCount);
  const remainingCount = properties.length - displayCount;

  if (!properties.length) {
    return (
      <p className="text-sm text-muted-foreground text-center py-4">
        No properties available
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {displayProperties.map((property, i) => {
        const address = property.unparsedAddress || property.streetAddress || property.address || 'Unknown';
        const status = property.standardStatus || property.status || 'Active';
        const statusColor = getStatusColor(status);
        const price = property.closePrice || property.soldPrice || property.listPrice || 0;
        const beds = property.bedroomsTotal || property.beds || 0;
        const baths = property.bathroomsTotal || property.baths || 0;
        const sqft = property.livingArea || property.sqft || 0;

        return (
          <div key={i} className="flex items-center justify-between py-2 border-b last:border-b-0">
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{address}</p>
              <p className="text-xs text-muted-foreground">{property.city || ''}</p>
              <p className="text-xs text-muted-foreground">
                ${price.toLocaleString()} · {beds} bd · {baths} ba · {sqft.toLocaleString()} sqft
              </p>
            </div>
            <Badge
              style={{ backgroundColor: statusColor.hex, color: '#ffffff' }}
              className="ml-2 text-xs"
            >
              {statusColor.label}
            </Badge>
          </div>
        );
      })}
      {remainingCount > 0 && (
        <p className="text-xs text-muted-foreground text-center pt-2">
          +{remainingCount} more properties
        </p>
      )}
    </div>
  );
}
