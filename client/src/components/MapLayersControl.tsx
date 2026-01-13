import { useEffect } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";

interface MapLayersControlProps {
  position?: L.ControlPosition;
}

export function MapLayersControl({ position = "topleft" }: MapLayersControlProps) {
  const map = useMap();

  useEffect(() => {
    const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    });

    const satelliteLayer = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      {
        attribution: 'Tiles &copy; Esri'
      }
    );

    const topoLayer = L.tileLayer(
      'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
      {
        attribution: 'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      }
    );

    const baseMaps = {
      "Street": osmLayer,
      "Satellite": satelliteLayer,
      "Topographic": topoLayer
    };

    const layersControl = L.control.layers(baseMaps, {}, { position });
    layersControl.addTo(map);

    return () => {
      map.removeControl(layersControl);
    };
  }, [map, position]);

  return null;
}
