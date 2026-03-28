import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet.heat'; // This attaches the heatLayer plugin to the global L object

interface HeatmapLayerProps {
  points: Array<[number, number, number]>; // [latitude, longitude, intensity]
}

export const HeatmapLayer = ({ points }: HeatmapLayerProps) => {
  const map = useMap();

  useEffect(() => {
    if (!map) return;

    // Create the heat layer
    // We use (L as any) to bypass strict TypeScript checks on the plugin injection
    const heatLayer = (L as any).heatLayer(points, {
      radius: 35,       // The size of each "glow"
      blur: 25,         // How smooth the edges are
      maxZoom: 14,      // Zoom level where points reach max intensity
      max: 1.0,         // Maximum intensity value
      gradient: {
        0.2: '#3b82f6', // Cool Blue (Lower rated / Sparse)
        0.5: '#2dd4bf', // Teal
        0.8: '#f59e0b', // Warm Orange
        1.0: '#ef4444'  // Hot Red (High rated / Dense)
      }
    });

    // Add it to the map
    heatLayer.addTo(map);

    // Cleanup: remove the layer when the component unmounts or points change
    return () => {
      map.removeLayer(heatLayer);
    };
  }, [map, points]);

  return null; // This component doesn't render HTML, it just alters the Leaflet canvas
};