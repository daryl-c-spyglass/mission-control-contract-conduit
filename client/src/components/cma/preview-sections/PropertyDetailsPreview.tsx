import { useState } from "react";
import { getStatusColor } from "@/lib/statusColors";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface Property {
  address?: string;
  streetAddress?: string;
  unparsedAddress?: string;
  fullAddress?: string;
  streetNumber?: string;
  streetName?: string;
  city?: string;
  listPrice?: number;
  closePrice?: number;
  soldPrice?: number;
  price?: number;
  beds?: number;
  bedroomsTotal?: number;
  bedrooms?: number;
  baths?: number;
  bathroomsTotal?: number;
  bathrooms?: number;
  sqft?: number | string;
  livingArea?: number;
  status?: string;
  standardStatus?: string;
  mlsNumber?: string;
}

interface PropertyDetailsPreviewProps {
  properties: Property[];
  compact?: boolean;
}

export function PropertyDetailsPreview({ properties, compact }: PropertyDetailsPreviewProps) {
  const [showAll, setShowAll] = useState(false);
  
  const displayCount = compact ? 4 : 6;
  const displayProperties = showAll ? properties : properties.slice(0, displayCount);
  const remainingCount = properties.length - displayCount;

  const getAddress = (property: Property): string => {
    return property.unparsedAddress ||
           property.streetAddress ||
           property.address ||
           property.fullAddress ||
           (property.streetNumber && property.streetName 
             ? `${property.streetNumber} ${property.streetName}` 
             : null) ||
           'Unknown';
  };

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
        const fullAddress = getAddress(property);
        const displayAddress = fullAddress !== 'Unknown' 
          ? fullAddress.split(',')[0] 
          : 'Unknown';
        const status = property.standardStatus || property.status || 'Active';
        const statusColor = getStatusColor(status);
        const price = property.closePrice || property.soldPrice || property.listPrice || property.price || 0;
        const beds = property.bedroomsTotal || property.beds || property.bedrooms || 0;
        const baths = property.bathroomsTotal || property.baths || property.bathrooms || 0;
        const sqftValue = property.livingArea || property.sqft || 0;
        const sqft = typeof sqftValue === 'string' ? parseFloat(sqftValue) || 0 : sqftValue;

        return (
          <div key={property.mlsNumber || i} className="flex items-center justify-between py-2 border-b last:border-b-0">
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate" title={fullAddress}>{displayAddress}</p>
              {property.city && (
                <p className="text-xs text-muted-foreground">{property.city}</p>
              )}
              <p className="text-xs text-muted-foreground">
                ${price.toLocaleString()} · {beds} bd · {baths} ba · {sqft.toLocaleString()} sqft
              </p>
            </div>
            <Badge
              style={{ backgroundColor: statusColor.hex, color: '#ffffff' }}
              className="ml-2 text-xs shrink-0"
            >
              {statusColor.label}
            </Badge>
          </div>
        );
      })}
      
      {remainingCount > 0 && !showAll && (
        <Button
          variant="outline"
          size="default"
          onClick={() => setShowAll(true)}
          className="w-full mt-3 touch-manipulation"
          data-testid="button-show-more-properties"
        >
          +{remainingCount} more properties
        </Button>
      )}
      
      {showAll && properties.length > displayCount && (
        <Button
          variant="ghost"
          size="default"
          onClick={() => setShowAll(false)}
          className="w-full mt-3 touch-manipulation"
          data-testid="button-show-less-properties"
        >
          Show less
        </Button>
      )}
    </div>
  );
}
