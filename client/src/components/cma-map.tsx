import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useTheme } from '@/hooks/use-theme';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { X, Locate, Maximize2 } from 'lucide-react';
import type { Property } from '@shared/schema';
import {
  buildCmaMapModel,
  STATUS_COLORS,
  SUBJECT_COLOR,
  STATUS_LABELS,
  formatFullPrice,
  type CmaMapModel,
  type CmaPointProperties,
  type NormalizedStatus,
} from '@/lib/cma-map-data';

const CMA_MAP_STYLE_LIGHT = 'mapbox://styles/mapbox/light-v11';
const CMA_MAP_STYLE_DARK = 'mapbox://styles/mapbox/dark-v11';
const DEFAULT_SUBJECT_ZOOM = 14;
const DEFAULT_FIT_PADDING = { top: 60, right: 60, bottom: 60, left: 60 };

interface CMAMapProps {
  properties: Property[];
  subjectProperty: Property | null;
  onPropertyClick?: (property: Property) => void;
  showPolygon?: boolean;
}

const SOURCE_IDS = {
  polygon: 'cma-polygon',
  comps: 'cma-comps',
  subject: 'cma-subject',
};

const LAYER_IDS = {
  polygonFill: 'cma-polygon-fill',
  polygonLine: 'cma-polygon-line',
  clusterCircle: 'cma-cluster-circle',
  clusterCount: 'cma-cluster-count',
  compPoints: 'cma-comp-points',
  compLabels: 'cma-comp-labels',
  subjectPoint: 'cma-subject-point',
  subjectLabel: 'cma-subject-label',
};

const EMPTY_FEATURE_COLLECTION: GeoJSON.FeatureCollection = {
  type: 'FeatureCollection',
  features: [],
};

function initCmaLayers(map: mapboxgl.Map, model: CmaMapModel, isDark: boolean, showPolygon: boolean = true) {
  removeAllCmaLayers(map);

  map.addSource(SOURCE_IDS.polygon, {
    type: 'geojson',
    data: model.polygonCollection || EMPTY_FEATURE_COLLECTION,
  });

  map.addSource(SOURCE_IDS.comps, {
    type: 'geojson',
    data: model.compsOnlyCollection || EMPTY_FEATURE_COLLECTION,
    cluster: true,
    clusterMaxZoom: 14,
    clusterRadius: 50,
    promoteId: 'id',
  });

  const subjectCollection: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: model.subjectFeature ? [model.subjectFeature] : [],
  };

  map.addSource(SOURCE_IDS.subject, {
    type: 'geojson',
    data: subjectCollection,
  });

  map.addLayer({
    id: LAYER_IDS.polygonFill,
    type: 'fill',
    source: SOURCE_IDS.polygon,
    layout: {
      visibility: showPolygon ? 'visible' : 'none',
    },
    paint: {
      'fill-color': isDark ? '#60a5fa' : '#3b82f6',
      'fill-opacity': 0.1,
    },
  });

  map.addLayer({
    id: LAYER_IDS.polygonLine,
    type: 'line',
    source: SOURCE_IDS.polygon,
    layout: {
      visibility: showPolygon ? 'visible' : 'none',
    },
    paint: {
      'line-color': isDark ? '#60a5fa' : '#2563eb',
      'line-width': 2,
      'line-opacity': 0.7,
    },
  });

  map.addLayer({
    id: LAYER_IDS.clusterCircle,
    type: 'circle',
    source: SOURCE_IDS.comps,
    filter: ['has', 'point_count'],
    paint: {
      'circle-color': '#6366f1',
      'circle-radius': ['step', ['get', 'point_count'], 20, 10, 30, 50, 40],
      'circle-stroke-width': 2,
      'circle-stroke-color': '#ffffff',
    },
  });

  map.addLayer({
    id: LAYER_IDS.clusterCount,
    type: 'symbol',
    source: SOURCE_IDS.comps,
    filter: ['has', 'point_count'],
    layout: {
      'text-field': '{point_count_abbreviated}',
      'text-font': ['DIN Pro Medium', 'Arial Unicode MS Bold'],
      'text-size': 14,
    },
    paint: {
      'text-color': '#ffffff',
    },
  });

  map.addLayer({
    id: LAYER_IDS.compPoints,
    type: 'circle',
    source: SOURCE_IDS.comps,
    filter: ['!', ['has', 'point_count']],
    paint: {
      'circle-radius': [
        'case',
        ['boolean', ['feature-state', 'hover'], false],
        10,
        8,
      ],
      'circle-color': [
        'match',
        ['get', 'status'],
        'ACTIVE', STATUS_COLORS.ACTIVE,
        'PENDING', STATUS_COLORS.PENDING,
        'SOLD', STATUS_COLORS.SOLD,
        STATUS_COLORS.UNKNOWN,
      ],
      'circle-stroke-width': [
        'case',
        ['boolean', ['feature-state', 'hover'], false],
        3,
        ['boolean', ['feature-state', 'selected'], false],
        3,
        2,
      ],
      'circle-stroke-color': '#ffffff',
      'circle-opacity': [
        'case',
        ['boolean', ['feature-state', 'hover'], false],
        1,
        0.9,
      ],
    },
  });

  map.addLayer({
    id: LAYER_IDS.compLabels,
    type: 'symbol',
    source: SOURCE_IDS.comps,
    filter: ['!', ['has', 'point_count']],
    layout: {
      'text-field': ['get', 'priceFormatted'],
      'text-font': ['DIN Pro Medium', 'Arial Unicode MS Bold'],
      'text-size': 11,
      'text-offset': [0, -1.8],
      'text-anchor': 'bottom',
      'text-allow-overlap': false,
      'text-ignore-placement': false,
    },
    paint: {
      'text-color': isDark ? '#f5f5f5' : '#1f2937',
      'text-halo-color': isDark ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,0.9)',
      'text-halo-width': 1.5,
    },
  });

  map.addLayer({
    id: LAYER_IDS.subjectPoint,
    type: 'circle',
    source: SOURCE_IDS.subject,
    paint: {
      'circle-radius': 12,
      'circle-color': SUBJECT_COLOR,
      'circle-stroke-width': 3,
      'circle-stroke-color': '#ffffff',
    },
  });

  map.addLayer({
    id: LAYER_IDS.subjectLabel,
    type: 'symbol',
    source: SOURCE_IDS.subject,
    layout: {
      'text-field': ['concat', 'SUBJECT\n', ['get', 'priceFormatted']],
      'text-font': ['DIN Pro Bold', 'Arial Unicode MS Bold'],
      'text-size': 12,
      'text-offset': [0, -2.2],
      'text-anchor': 'bottom',
      'text-allow-overlap': true,
      'text-ignore-placement': true,
    },
    paint: {
      'text-color': isDark ? '#f5f5f5' : '#1e3a8a',
      'text-halo-color': isDark ? 'rgba(0,0,0,0.9)' : 'rgba(255,255,255,0.95)',
      'text-halo-width': 2,
    },
  });
}

function removeAllCmaLayers(map: mapboxgl.Map) {
  Object.values(LAYER_IDS).forEach((id) => {
    if (map.getLayer(id)) map.removeLayer(id);
  });
  Object.values(SOURCE_IDS).forEach((id) => {
    if (map.getSource(id)) map.removeSource(id);
  });
}

function updateCmaData(map: mapboxgl.Map, model: CmaMapModel) {
  const polygonSource = map.getSource(SOURCE_IDS.polygon) as mapboxgl.GeoJSONSource;
  if (polygonSource) {
    polygonSource.setData(model.polygonCollection || EMPTY_FEATURE_COLLECTION);
  }

  const compsSource = map.getSource(SOURCE_IDS.comps) as mapboxgl.GeoJSONSource;
  if (compsSource) {
    compsSource.setData(model.compsOnlyCollection || EMPTY_FEATURE_COLLECTION);
  }

  const subjectCollection: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: model.subjectFeature ? [model.subjectFeature] : [],
  };

  const subjectSource = map.getSource(SOURCE_IDS.subject) as mapboxgl.GeoJSONSource;
  if (subjectSource) {
    subjectSource.setData(subjectCollection);
  }
}

export function CMAMap({
  properties,
  subjectProperty,
  onPropertyClick,
  showPolygon = true,
}: CMAMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const popupRef = useRef<mapboxgl.Popup | null>(null);
  const hoveredIdRef = useRef<string | null>(null);
  const selectedIdRef = useRef<string | null>(null);
  const showPolygonRef = useRef(showPolygon);
  const propertiesRef = useRef(properties);
  const subjectPropertyRef = useRef(subjectProperty);
  const onPropertyClickRef = useRef(onPropertyClick);
  const modelRef = useRef<CmaMapModel | null>(null);
  const isDarkRef = useRef<boolean>(false);

  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedProperty, setSelectedProperty] = useState<CmaPointProperties | null>(null);
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    showPolygonRef.current = showPolygon;
  }, [showPolygon]);

  useEffect(() => {
    propertiesRef.current = properties;
  }, [properties]);

  useEffect(() => {
    subjectPropertyRef.current = subjectProperty;
  }, [subjectProperty]);

  useEffect(() => {
    onPropertyClickRef.current = onPropertyClick;
  }, [onPropertyClick]);

  const { isDark } = useTheme();
  const mapStyle = isDark ? CMA_MAP_STYLE_DARK : CMA_MAP_STYLE_LIGHT;

  const model = useMemo(() => {
    return buildCmaMapModel(subjectProperty, properties);
  }, [subjectProperty, properties]);

  useEffect(() => {
    modelRef.current = model;
  }, [model]);

  useEffect(() => {
    isDarkRef.current = isDark;
  }, [isDark]);

  useEffect(() => {
    fetch('/api/mapbox-token')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (data.token) setToken(data.token);
        else setError(data.error || 'Failed to load map token');
      })
      .catch((err) => setError(`Failed to load map: ${err.message}`));
  }, []);

  const centerOnSubject = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!model.subjectLngLat) {
      console.log('[CMA Map] centerOnSubject: No subject coordinates');
      return;
    }

    map.resize();
    map.flyTo({
      center: model.subjectLngLat,
      zoom: DEFAULT_SUBJECT_ZOOM,
      essential: true,
      duration: 600,
    });
  }, [model.subjectLngLat]);

  const fitAllBounds = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!model.bounds) {
      console.log('[CMA Map] fitAllBounds: No bounds available');
      return;
    }

    map.resize();

    if (model.compFeatures.length === 0 && model.subjectLngLat) {
      map.flyTo({
        center: model.subjectLngLat,
        zoom: DEFAULT_SUBJECT_ZOOM,
        duration: 600,
      });
      return;
    }

    map.fitBounds(model.bounds, {
      padding: DEFAULT_FIT_PADDING,
      maxZoom: 15,
      duration: 600,
    });
  }, [model.bounds, model.compFeatures.length, model.subjectLngLat]);

  useEffect(() => {
    if (!token || !mapContainer.current || mapRef.current) return;

    mapboxgl.accessToken = token;

    const centerCoords = model.subjectLngLat || [-97.7431, 30.2672];

    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: mapStyle,
      center: centerCoords as [number, number],
      zoom: 11,
    });

    mapRef.current = map;

    map.addControl(new mapboxgl.NavigationControl(), 'top-right');

    map.on('load', () => {
      initCmaLayers(map, model, isDark, showPolygon);
      setMapReady(true);

      if (model.bounds) {
        setTimeout(() => fitAllBounds(), 100);
      }
    });

    map.on('click', LAYER_IDS.clusterCircle, (e) => {
      const features = map.queryRenderedFeatures(e.point, {
        layers: [LAYER_IDS.clusterCircle],
      });
      if (!features.length) return;

      const clusterId = features[0].properties?.cluster_id;
      const source = map.getSource(SOURCE_IDS.comps) as mapboxgl.GeoJSONSource;

      source.getClusterExpansionZoom(clusterId, (err, zoom) => {
        if (err) return;
        const coords = (features[0].geometry as GeoJSON.Point).coordinates as [number, number];
        map.easeTo({ center: coords, zoom: zoom ?? 14 });
      });
    });

    map.on('click', LAYER_IDS.compPoints, (e) => {
      const features = map.queryRenderedFeatures(e.point, {
        layers: [LAYER_IDS.compPoints],
      });
      if (!features.length) return;

      const props = features[0].properties as CmaPointProperties;

      if (selectedIdRef.current) {
        map.setFeatureState(
          { source: SOURCE_IDS.comps, id: selectedIdRef.current },
          { selected: false }
        );
      }

      const featureId = props.id;
      selectedIdRef.current = featureId;
      map.setFeatureState(
        { source: SOURCE_IDS.comps, id: featureId },
        { selected: true }
      );

      const parsedPhotos = typeof props.photos === 'string' 
        ? JSON.parse(props.photos) 
        : props.photos;

      setSelectedProperty({
        ...props,
        photos: parsedPhotos || [],
      });

      const currentModel = modelRef.current;
      if (currentModel) {
        const matchingProp = currentModel.propertyByFeatureId.get(props.id);
        if (matchingProp) {
          onPropertyClickRef.current?.(matchingProp);
        }
      }
    });

    map.on('click', LAYER_IDS.subjectPoint, () => {
      const currentModel = modelRef.current;
      if (currentModel) {
        const subjectProp = currentModel.propertyByFeatureId.get('subject');
        if (subjectProp) {
          onPropertyClickRef.current?.(subjectProp);
        }
      }
    });

    map.on('mousemove', LAYER_IDS.compPoints, (e) => {
      map.getCanvas().style.cursor = 'pointer';

      const features = map.queryRenderedFeatures(e.point, {
        layers: [LAYER_IDS.compPoints],
      });
      if (!features.length) return;

      const featureId = features[0].properties?.id as string;

      if (hoveredIdRef.current && hoveredIdRef.current !== featureId) {
        map.setFeatureState(
          { source: SOURCE_IDS.comps, id: hoveredIdRef.current },
          { hover: false }
        );
      }

      hoveredIdRef.current = featureId;
      map.setFeatureState(
        { source: SOURCE_IDS.comps, id: featureId },
        { hover: true }
      );
    });

    map.on('mouseleave', LAYER_IDS.compPoints, () => {
      map.getCanvas().style.cursor = '';

      if (hoveredIdRef.current) {
        map.setFeatureState(
          { source: SOURCE_IDS.comps, id: hoveredIdRef.current },
          { hover: false }
        );
        hoveredIdRef.current = null;
      }
    });

    map.on('mouseenter', LAYER_IDS.clusterCircle, () => {
      map.getCanvas().style.cursor = 'pointer';
    });

    map.on('mouseleave', LAYER_IDS.clusterCircle, () => {
      map.getCanvas().style.cursor = '';
    });

    map.on('mouseenter', LAYER_IDS.subjectPoint, () => {
      map.getCanvas().style.cursor = 'pointer';
    });

    map.on('mouseleave', LAYER_IDS.subjectPoint, () => {
      map.getCanvas().style.cursor = '';
    });

    return () => {
      popupRef.current?.remove();
      map.remove();
      mapRef.current = null;
    };
  }, [token]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    updateCmaData(map, model);

    if (model.bounds && model.compFeatures.length > 0) {
      setTimeout(() => fitAllBounds(), 100);
    }
  }, [model, mapReady, fitAllBounds]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const previousSelectedId = selectedIdRef.current;
    const previousHoveredId = hoveredIdRef.current;

    map.setStyle(mapStyle);

    map.once('styledata', () => {
      const currentModel = modelRef.current;
      if (currentModel) {
        initCmaLayers(map, currentModel, isDarkRef.current, showPolygonRef.current);

        if (previousSelectedId) {
          try {
            map.setFeatureState(
              { source: SOURCE_IDS.comps, id: previousSelectedId },
              { selected: true }
            );
          } catch (e) {
          }
        }

        if (previousHoveredId && previousHoveredId !== previousSelectedId) {
          try {
            map.setFeatureState(
              { source: SOURCE_IDS.comps, id: previousHoveredId },
              { hover: true }
            );
          } catch (e) {
          }
        }
      }
    });
  }, [mapStyle, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const polygonFillLayer = map.getLayer(LAYER_IDS.polygonFill);
    const polygonLineLayer = map.getLayer(LAYER_IDS.polygonLine);

    if (polygonFillLayer) {
      map.setLayoutProperty(
        LAYER_IDS.polygonFill,
        'visibility',
        showPolygon ? 'visible' : 'none'
      );
    }
    if (polygonLineLayer) {
      map.setLayoutProperty(
        LAYER_IDS.polygonLine,
        'visibility',
        showPolygon ? 'visible' : 'none'
      );
    }
  }, [showPolygon, mapReady]);

  const closePropertyPopup = useCallback(() => {
    const map = mapRef.current;
    if (map && selectedIdRef.current) {
      map.setFeatureState(
        { source: SOURCE_IDS.comps, id: selectedIdRef.current },
        { selected: false }
      );
      selectedIdRef.current = null;
    }
    setSelectedProperty(null);
  }, []);

  if (error) {
    return (
      <div className="w-full h-[550px] rounded-lg border flex items-center justify-center bg-muted">
        <p className="text-muted-foreground">{error}</p>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="w-full h-[550px] rounded-lg border flex items-center justify-center bg-muted">
        <p className="text-muted-foreground">Loading map...</p>
      </div>
    );
  }

  const compsWithCoords = model.compFeatures.length;
  const totalComps = properties.length;

  return (
    <div
      className="relative w-full h-[550px] rounded-lg overflow-hidden border"
      data-testid="cma-map-container"
    >
      <div ref={mapContainer} className="w-full h-full" />

      <div className="absolute top-4 left-4 flex flex-col gap-2">
        <Button
          size="icon"
          variant="secondary"
          className="h-8 w-8 shadow-md"
          onClick={centerOnSubject}
          disabled={!model.subjectLngLat}
          title="Center on subject"
          data-testid="button-center-subject"
        >
          <Locate className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant="secondary"
          className="h-8 w-8 shadow-md"
          onClick={fitAllBounds}
          disabled={!model.bounds}
          title="Fit all properties"
          data-testid="button-fit-bounds"
        >
          <Maximize2 className="h-4 w-4" />
        </Button>
      </div>

      <div className="absolute top-4 left-1/2 -translate-x-1/2">
        <Badge variant="secondary" className="shadow-md bg-background/90 backdrop-blur">
          {compsWithCoords === totalComps
            ? `${totalComps} comparable${totalComps !== 1 ? 's' : ''} + Subject`
            : `${compsWithCoords}/${totalComps} comparables + Subject`}
        </Badge>
      </div>

      <div className="absolute bottom-4 left-4 bg-background/90 dark:bg-background/95 backdrop-blur rounded-lg p-3 shadow-md border">
        <p className="text-xs font-medium mb-2">Legend</p>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: SUBJECT_COLOR }}
            />
            <span className="text-xs">Subject Property</span>
          </div>
          <div className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: STATUS_COLORS.ACTIVE }}
            />
            <span className="text-xs">{STATUS_LABELS.ACTIVE}</span>
          </div>
          <div className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: STATUS_COLORS.PENDING }}
            />
            <span className="text-xs">{STATUS_LABELS.PENDING}</span>
          </div>
          <div className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: STATUS_COLORS.SOLD }}
            />
            <span className="text-xs">{STATUS_LABELS.SOLD}</span>
          </div>
          <div className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: STATUS_COLORS.UNKNOWN }}
            />
            <span className="text-xs">{STATUS_LABELS.UNKNOWN}</span>
          </div>
          {showPolygon && (
            <div className="flex items-center gap-2 mt-1 pt-1 border-t">
              <div className="w-3 h-3 rounded border-2 border-blue-500 bg-blue-500/20" />
              <span className="text-xs">Search Area</span>
            </div>
          )}
        </div>
      </div>

      {selectedProperty && (
        <div
          className="absolute top-4 right-14 bg-background rounded-lg shadow-lg p-4 max-w-xs border"
          data-testid="selected-property-popup"
        >
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-1 right-1 h-6 w-6"
            onClick={closePropertyPopup}
            data-testid="button-close-property-popup"
          >
            <X className="h-4 w-4" />
          </Button>

          {selectedProperty.photos?.[0] && (
            <img
              src={selectedProperty.photos[0]}
              alt="Property"
              className="w-full h-24 object-cover rounded mb-2"
            />
          )}

          <p className="font-semibold text-sm">
            {formatFullPrice(selectedProperty.price)}
          </p>

          <div className="flex items-center gap-1 mt-1">
            <Badge
              className="text-[10px] px-1.5 py-0"
              style={{
                backgroundColor:
                  STATUS_COLORS[selectedProperty.status as NormalizedStatus] ||
                  STATUS_COLORS.UNKNOWN,
                color: '#fff',
              }}
            >
              {STATUS_LABELS[selectedProperty.status as NormalizedStatus] ||
                STATUS_LABELS.UNKNOWN}
            </Badge>
          </div>

          <p className="text-xs text-muted-foreground mt-1 truncate">
            {selectedProperty.address}
          </p>

          <div className="flex gap-2 mt-1 text-xs text-muted-foreground">
            <span>{selectedProperty.beds ?? '-'} bd</span>
            <span>{selectedProperty.baths ?? '-'} ba</span>
            <span>
              {selectedProperty.sqft?.toLocaleString() ?? '-'} sqft
            </span>
          </div>

          {selectedProperty.dom != null && (
            <p className="text-xs text-muted-foreground mt-1">
              {selectedProperty.dom} days on market
            </p>
          )}
        </div>
      )}
    </div>
  );
}
