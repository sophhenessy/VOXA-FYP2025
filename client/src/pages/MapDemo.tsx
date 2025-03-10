import { useState } from 'react';
import { MapComponent } from '@/components/Map';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function MapDemo() {
  const [markers, setMarkers] = useState<Array<{ lat: number; lng: number }>>([]);

  const handleMapClick = (e: google.maps.MapMouseEvent) => {
    if (e.latLng) {
      const newMarker = {
        lat: e.latLng.lat(),
        lng: e.latLng.lng()
      };
      setMarkers(prev => [...prev, newMarker]);
    }
  };

  return (
    <div className="container mx-auto p-4 h-screen">
      <Card className="h-[calc(100vh-2rem)]">
        <CardHeader>
          <CardTitle>Interactive Map</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="relative w-full h-[calc(100vh-8rem)]">
            <MapComponent 
              onMapClick={handleMapClick}
              markers={markers}
              className="w-full h-full"
              initialCenter={{ lat: 37.7749, lng: -122.4194 }}
            />
          </div>
          {markers.length > 0 && (
            <div className="p-4">
              <h3 className="font-semibold mb-2">Markers:</h3>
              <ul className="space-y-2">
                {markers.map((marker, index) => (
                  <li key={index} className="text-sm">
                    Marker {index + 1}: Lat: {marker.lat.toFixed(4)}, Lng: {marker.lng.toFixed(4)}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}