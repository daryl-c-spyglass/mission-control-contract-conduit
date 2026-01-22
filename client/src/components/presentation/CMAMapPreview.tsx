import { CMAMap } from '@/components/cma-map';
import { MapPin } from 'lucide-react';
import type { Property } from '@shared/schema';

interface CMAMapPreviewProps {
  subjectProperty: any;
  comparables: any[];
  compact?: boolean;
}

export function CMAMapPreview({ subjectProperty, comparables, compact }: CMAMapPreviewProps) {
  const normalizedSubject: Property | null = subjectProperty ? {
    ...subjectProperty,
    latitude: subjectProperty.latitude || 
              subjectProperty.coordinates?.latitude || 
              subjectProperty.map?.latitude,
    longitude: subjectProperty.longitude || 
               subjectProperty.coordinates?.longitude || 
               subjectProperty.map?.longitude,
  } : null;

  const normalizedComparables: Property[] = comparables.map(comp => ({
    ...comp,
    latitude: comp.latitude || comp.map?.latitude || comp.coordinates?.latitude,
    longitude: comp.longitude || comp.map?.longitude || comp.coordinates?.longitude,
  }));

  const hasSubjectCoords = normalizedSubject?.latitude && normalizedSubject?.longitude;
  const validComparables = normalizedComparables.filter(c => c.latitude && c.longitude);

  if (!hasSubjectCoords && validComparables.length === 0) {
    return (
      <div className={`flex items-center justify-center bg-muted rounded-lg ${compact ? 'h-32' : 'h-48'}`}>
        <div className="text-center text-muted-foreground">
          <MapPin className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Map unavailable</p>
          <p className="text-xs">No coordinates found</p>
        </div>
      </div>
    );
  }

  return (
    <div className={compact ? 'h-32' : 'h-48'}>
      <CMAMap
        properties={normalizedComparables}
        subjectProperty={normalizedSubject}
        showPolygon={false}
      />
    </div>
  );
}
