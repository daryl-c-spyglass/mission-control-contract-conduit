import { useEffect, useRef, useState, useCallback } from "react";
import { MapContainer, TileLayer, FeatureGroup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet-draw";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Trash2, MapPin, AlertCircle, Search, PenTool } from "lucide-react";
import { cn } from "@/lib/utils";
import { MapLayersControl } from "./MapLayersControl";
import "leaflet/dist/leaflet.css";
import "leaflet-draw/dist/leaflet.draw.css";

interface PolygonMapSearchProps {
  onSearch: (boundary: number[][][]) => void;
  onClear: () => void;
  isLoading?: boolean;
  resultCount?: number;
  fullHeight?: boolean;
}

const AUSTIN_CENTER: [number, number] = [30.2672, -97.7431];
const DEFAULT_ZOOM = 11;

function DrawControl({ 
  onPolygonCreated, 
  onPolygonDeleted 
}: { 
  onPolygonCreated: (coords: number[][]) => void;
  onPolygonDeleted: () => void;
}) {
  const map = useMap();
  const drawControlRef = useRef<L.Control.Draw | null>(null);
  const featureGroupRef = useRef<L.FeatureGroup>(L.featureGroup());

  useEffect(() => {
    featureGroupRef.current.addTo(map);

    const drawControl = new L.Control.Draw({
      position: "topright",
      draw: {
        polyline: false,
        rectangle: false,
        circle: false,
        circlemarker: false,
        marker: false,
        polygon: {
          allowIntersection: false,
          showArea: false,
          shapeOptions: {
            color: "#f97316",
            fillColor: "#f97316",
            fillOpacity: 0.2,
            weight: 2,
          },
        },
      },
      edit: {
        featureGroup: featureGroupRef.current,
        remove: true,
      },
    });

    drawControlRef.current = drawControl;
    map.addControl(drawControl);

    const handleCreated = (e: L.LeafletEvent) => {
      const event = e as L.DrawEvents.Created;
      featureGroupRef.current.clearLayers();
      featureGroupRef.current.addLayer(event.layer);
      
      if (event.layer instanceof L.Polygon) {
        const latlngs = event.layer.getLatLngs()[0] as L.LatLng[];
        const coordinates = latlngs.map(ll => [ll.lng, ll.lat]);
        if (coordinates.length > 0) {
          coordinates.push(coordinates[0]);
        }
        onPolygonCreated(coordinates);
      }
    };

    const handleDeleted = () => {
      onPolygonDeleted();
    };

    map.on(L.Draw.Event.CREATED, handleCreated);
    map.on(L.Draw.Event.DELETED, handleDeleted);

    return () => {
      if (drawControlRef.current) {
        map.removeControl(drawControlRef.current);
      }
      map.off(L.Draw.Event.CREATED, handleCreated);
      map.off(L.Draw.Event.DELETED, handleDeleted);
      featureGroupRef.current.remove();
    };
  }, [map, onPolygonCreated, onPolygonDeleted]);

  return null;
}

function MapController() {
  const map = useMap();
  
  useEffect(() => {
    setTimeout(() => {
      map.invalidateSize();
    }, 100);
  }, [map]);
  
  return null;
}

export function PolygonMapSearch({ onSearch, onClear, isLoading, resultCount, fullHeight }: PolygonMapSearchProps) {
  const [hasPolygon, setHasPolygon] = useState(false);
  const [currentBoundary, setCurrentBoundary] = useState<number[][][] | null>(null);

  const handlePolygonCreated = useCallback((coordinates: number[][]) => {
    const boundary: number[][][] = [coordinates];
    setCurrentBoundary(boundary);
    setHasPolygon(true);
  }, []);

  const handlePolygonDeleted = useCallback(() => {
    setHasPolygon(false);
    setCurrentBoundary(null);
    onClear();
  }, [onClear]);

  const handleSearchClick = useCallback(() => {
    if (currentBoundary) {
      onSearch(currentBoundary);
    }
  }, [currentBoundary, onSearch]);

  return (
    <div className={cn("flex flex-col gap-3", fullHeight && "h-full")}>
      <div className="flex items-center justify-between flex-wrap gap-2 flex-shrink-0">
        <div className="flex items-center gap-2">
          <MapPin className="w-5 h-5 text-primary" />
          <span className="font-medium">Draw a search area on the map</span>
        </div>
        {hasPolygon && (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={handleSearchClick}
              disabled={isLoading}
              data-testid="button-search-polygon"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              ) : (
                <Search className="w-4 h-4 mr-1" />
              )}
              Search Area
            </Button>
          </div>
        )}
      </div>

      {resultCount !== undefined && resultCount > 0 && (
        <Badge variant="secondary" className="text-sm flex-shrink-0">
          {resultCount} properties found in area
        </Badge>
      )}

      <Card className={cn("overflow-hidden", fullHeight ? "flex-1 min-h-0" : "")}>
        <div className={cn("w-full relative", fullHeight ? "h-full" : "h-[400px]")}>
          <MapContainer
            center={AUSTIN_CENTER}
            zoom={DEFAULT_ZOOM}
            style={{ height: "100%", width: "100%" }}
            scrollWheelZoom={true}
          >
            <MapController />
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <DrawControl 
              onPolygonCreated={handlePolygonCreated}
              onPolygonDeleted={handlePolygonDeleted}
            />
            <MapLayersControl position="topleft" />
          </MapContainer>
          
          {!hasPolygon && (
            <div className="absolute bottom-4 left-4 right-4 z-[1001]">
              <div className="bg-card/95 backdrop-blur-sm border rounded-lg p-3 shadow-lg">
                <div className="flex items-start gap-2">
                  <PenTool className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-muted-foreground">
                    Click the <strong>polygon tool</strong> (pentagon icon) in the top-right corner, then click on the map to draw points around your search area. Double-click to complete the shape.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}


