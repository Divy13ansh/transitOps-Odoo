import React, { useEffect, useRef, useMemo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Trip, Vehicle, TripStatus } from '../types';
import { CITIES } from '../data/dispatcherData';
import { Navigation, Radio } from 'lucide-react';

// Map relative city names to real-world latitude and longitude coordinates in India
const CITY_COORDS: Record<string, [number, number]> = {
  'New Delhi': [28.6139, 77.2090],
  'Jaipur': [26.9124, 75.7873],
  'Mumbai': [19.0760, 72.8777],
  'Pune': [18.5204, 73.8567],
  'Ahmedabad': [23.0225, 72.5714],
  'Bengaluru': [12.9716, 77.5946],
  'Chennai': [13.0827, 80.2707],
  'Hyderabad': [17.3850, 78.4867],
  'Kolkata': [22.5726, 88.3639]
};

// Helper to calculate a curved path (array of lat-lng points) between two points
function getCurvedPath(source: [number, number], dest: [number, number]): [number, number][] {
  const points: [number, number][] = [];
  const N = 40; // Subdivisions for curved paths
  const dy = dest[0] - source[0];
  const dx = dest[1] - source[1];
  const distance = Math.sqrt(dx*dx + dy*dy);
  
  // Perpendicular vector
  const perpY = -dx;
  const perpX = dy;
  const perpLen = Math.sqrt(perpY*perpY + perpX*perpX);
  
  // Calculate consistent bend multiplier based on coordinate values
  const sumCoords = Math.abs(source[0] + source[1] + dest[0] + dest[1]);
  const bendDirection = Math.sin(sumCoords) > 0 ? 1 : -1;
  const maxOffset = distance * 0.14 * bendDirection; // 14% of direct distance
  
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const latLinear = source[0] + dy * t;
    const lngLinear = source[1] + dx * t;
    
    // Sine wave offset: peak at the middle, zero at ends
    const offsetFactor = Math.sin(Math.PI * t);
    
    let latOffset = 0;
    let lngOffset = 0;
    if (perpLen > 0) {
      latOffset = (perpY / perpLen) * maxOffset * offsetFactor;
      lngOffset = (perpX / perpLen) * maxOffset * offsetFactor;
    }
    
    points.push([latLinear + latOffset, lngLinear + lngOffset]);
  }
  return points;
}

interface MapContainerProps {
  theme: 'light' | 'dark';
  trips: Trip[];
  vehicles: Vehicle[];
  selectedTripId?: string | null;
  activeFilters: {
    vehicleType: string;
    status: string;
    region: string;
  };
}

export default function MapContainer({
  theme,
  trips,
  vehicles,
  selectedTripId,
  activeFilters
}: MapContainerProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersGroupRef = useRef<L.LayerGroup | null>(null);
  const routesGroupRef = useRef<L.LayerGroup | null>(null);

  // Filter active trips to show as routes
  const activeTrips = useMemo(() => {
    return trips.filter(trip => {
      // If a specific trip is selected, show that one with high priority
      if (selectedTripId) {
        return trip.id === selectedTripId;
      }

      // Filter by dispatch status (include both draft and dispatched trips)
      if (trip.status !== 'dispatched' && trip.status !== 'draft') return false;

      // Filter by vehicle type
      const vehicle = vehicles.find(v => v.id === trip.vehicleId);
      if (activeFilters.vehicleType !== 'All' && vehicle?.type !== activeFilters.vehicleType) return false;

      // Filter by region (either source or dest must match region)
      if (activeFilters.region !== 'All') {
        const sourceCity = CITIES.find(c => c.name === trip.source);
        const destCity = CITIES.find(c => c.name === trip.destination);
        if (sourceCity?.region !== activeFilters.region && destCity?.region !== activeFilters.region) {
          return false;
        }
      }

      return true;
    });
  }, [trips, vehicles, selectedTripId, activeFilters]);

  // Effect to initialize the map container and handle light/dark tile layer swaps
  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Recreate the map instance on theme change to apply correct map tiles
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    const map = L.map(mapContainerRef.current, {
      center: [21.7679, 78.8718], // Center of India
      zoom: 5,
      zoomControl: false,
      attributionControl: false
    });

    // Highly clean grayscale map tiles. CartoDB Positron for light mode, Dark Matter for dark mode.
    // Perfectly highlights orange overlays without unwanted greens or blues.
    const tileUrl = theme === 'dark'
      ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
      : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';

    L.tileLayer(tileUrl, {
      maxZoom: 18,
    }).addTo(map);

    mapInstanceRef.current = map;
    markersGroupRef.current = L.layerGroup().addTo(map);
    routesGroupRef.current = L.layerGroup().addTo(map);

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markersGroupRef.current = null;
        routesGroupRef.current = null;
      }
    };
  }, [theme]);

  // Effect to re-render routes and markers dynamically when state updates
  useEffect(() => {
    const map = mapInstanceRef.current;
    const markersGroup = markersGroupRef.current;
    const routesGroup = routesGroupRef.current;

    if (!map || !markersGroup || !routesGroup) return;

    // Clear previous drawings
    markersGroup.clearLayers();
    routesGroup.clearLayers();

    // 1. Draw connecting logistics roads (sleek solid lines)
    activeTrips.forEach((trip) => {
      const sourceCoord = CITY_COORDS[trip.source];
      const destCoord = CITY_COORDS[trip.destination];

      if (sourceCoord && destCoord) {
        const isSelected = selectedTripId === trip.id;
        
        // Pure orange stroke representing high-priority transit paths
        const strokeColor = '#eb5e00';
        const strokeWeight = isSelected ? 4 : 2;
        const strokeOpacity = isSelected ? 0.8 : 0.35;

        // Draw primary curved polyline
        const curvePoints = getCurvedPath(sourceCoord, destCoord);
        const polyline = L.polyline(curvePoints, {
          color: strokeColor,
          weight: strokeWeight,
          opacity: strokeOpacity,
        }).addTo(routesGroup);

        // Bind high-contrast descriptive popup
        polyline.bindPopup(`
          <div style="font-family: sans-serif; font-size: 11px; color: #1c1917; padding: 4px; line-height: 1.4;">
            <b style="color: #eb5e00; font-size: 12px; display: block; margin-bottom: 2px;">Trip ${trip.id}</b>
            <b>Route:</b> ${trip.source} &rarr; ${trip.destination}<br/>
            <b>Cargo:</b> ${trip.cargoWeight.toLocaleString()} lbs<br/>
            <b>Status:</b> ${trip.status === 'dispatched' ? 'On Trip' : trip.status}
          </div>
        `, { closeButton: false });
      }
    });

    // 2. Draw city node markers
    Object.entries(CITY_COORDS).forEach(([cityName, latLng]) => {
      const isSourceActive = activeTrips.some(t => t.source === cityName);
      const isDestActive = activeTrips.some(t => t.destination === cityName);
      const hasActivity = isSourceActive || isDestActive;

      // Custom DivIcon styled with orange, white, and gray only
      const size = hasActivity ? 14 : 8;
      const markerColor = hasActivity ? '#eb5e00' : '#d4d4d8';
      const borderColor = hasActivity ? '#ffffff' : '#a1a1aa';
      const shadowStyle = hasActivity 
        ? 'box-shadow: 0 0 10px rgba(235, 94, 0, 0.85);' 
        : '';

      const customIcon = L.divIcon({
        className: 'custom-city-icon',
        html: `
          <div style="
            width: ${size}px;
            height: ${size}px;
            border-radius: 50%;
            background: ${markerColor};
            border: 2px solid ${borderColor};
            ${shadowStyle}
            transition: all 0.3s ease;
          "></div>
        `,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2]
      });

      const marker = L.marker(latLng, { icon: customIcon }).addTo(markersGroup);

      // Bind detailed text tooltips
      marker.bindPopup(`
        <div style="font-family: sans-serif; font-size: 11px; color: #1c1917; padding: 2px;">
          <b style="font-size: 12px; color: ${hasActivity ? '#eb5e00' : '#52525b'};">${cityName} Logistics Hub</b><br/>
          ${hasActivity ? `<span style="color: #eb5e00; font-weight: bold;">Active Connected Hub</span>` : '<span style="color: #71717a;">Standby Mode</span>'}
        </div>
      `, { closeButton: false });
    });

    // 3. Create real-time animated/pixel vehicles moving along active curved paths
    const movingVehicles: {
      marker: L.Marker;
      curvePoints: [number, number][];
      offset: number;
    }[] = [];

    activeTrips.forEach((trip) => {
      const sourceCoord = CITY_COORDS[trip.source];
      const destCoord = CITY_COORDS[trip.destination];

      if (sourceCoord && destCoord) {
        const vehicle = vehicles.find(v => v.id === trip.vehicleId);
        
        // Offset progress based on trip ID so they start at different positions
        const numericId = parseInt(trip.id.replace(/\D/g, '') || '0') || 5;
        const offset = (numericId * 0.17) % 1.0;

        const curvePoints = getCurvedPath(sourceCoord, destCoord);

        const customIcon = L.divIcon({
          className: 'custom-moving-vehicle',
          html: `
            <div style="
              transform: rotate(0deg);
              width: 20px;
              height: 11px;
              background-color: #eb5e00;
              border-radius: 2px;
              position: relative;
              box-shadow: 0 1px 3px rgba(0,0,0,0.4);
              cursor: pointer;
              border: 1px solid rgba(255,255,255,0.45);
              transition: transform 0.1s linear;
            ">
              <!-- Windshield / Cab window -->
              <div style="
                position: absolute;
                right: 2px;
                top: 2px;
                bottom: 2px;
                width: 4px;
                background-color: #ffffff;
                border-radius: 1px;
                opacity: 0.95;
              "></div>
              <!-- Small dark wheels -->
              <div style="
                position: absolute;
                bottom: -2px;
                left: 3px;
                width: 3px;
                height: 2px;
                background-color: #18181b;
                border-radius: 1px;
              "></div>
              <div style="
                position: absolute;
                bottom: -2px;
                right: 4px;
                width: 3px;
                height: 2px;
                background-color: #18181b;
                border-radius: 1px;
              "></div>
              <div style="
                position: absolute;
                top: -2px;
                left: 3px;
                width: 3px;
                height: 2px;
                background-color: #18181b;
                border-radius: 1px;
              "></div>
              <div style="
                position: absolute;
                top: -2px;
                right: 4px;
                width: 3px;
                height: 2px;
                background-color: #18181b;
                border-radius: 1px;
              "></div>
            </div>
          `,
          iconSize: [20, 11],
          iconAnchor: [10, 5.5]
        });

        // Initialize at current offset position
        const startIndex = Math.min(curvePoints.length - 1, Math.floor(offset * curvePoints.length));
        const [startLat, startLng] = curvePoints[startIndex];

        const marker = L.marker([startLat, startLng], { icon: customIcon }).addTo(markersGroup);

        marker.bindPopup(`
          <div style="font-family: sans-serif; font-size: 11px; color: #1c1917; padding: 4px; line-height: 1.4;">
            <b style="color: #eb5e00; font-size: 12px; display: block; margin-bottom: 2px;">Transit Vehicle</b>
            <b>ID:</b> ${vehicle?.name || trip.vehicleId}<br/>
            <b>Type:</b> ${vehicle?.type ? vehicle.type.toUpperCase() : 'TRUCK'}<br/>
            <b>Route:</b> ${trip.source} &rarr; ${trip.destination}
          </div>
        `, { closeButton: false });

        movingVehicles.push({
          marker,
          curvePoints,
          offset
        });
      }
    });

    let animationFrameId: number;
    const startTime = Date.now();
    const duration = 240000; // 240 seconds per route (extremely slow movement)

    const animate = () => {
      const elapsed = Date.now() - startTime;
      
      movingVehicles.forEach(({ marker, curvePoints, offset }) => {
        const t = (elapsed / duration + offset) % 1.0;
        
        const index = Math.min(curvePoints.length - 1, Math.floor(t * curvePoints.length));
        const [lat, lng] = curvePoints[index];
        
        marker.setLatLng([lat, lng]);

        // Dynamic angle calculation based on next point on curve
        const nextIndex = Math.min(curvePoints.length - 1, index + 1);
        const nextPoint = curvePoints[nextIndex];
        const currentPoint = curvePoints[index];
        
        if (nextPoint && currentPoint) {
          const dy = nextPoint[0] - currentPoint[0];
          const dx = nextPoint[1] - currentPoint[1];
          const angleDeg = Math.atan2(-dy, dx) * 180 / Math.PI;
          
          const element = marker.getElement();
          if (element) {
            const innerDiv = element.querySelector('div');
            if (innerDiv) {
              innerDiv.style.transform = `rotate(${angleDeg}deg)`;
            }
          }
        }
      });

      animationFrameId = requestAnimationFrame(animate);
    };

    if (movingVehicles.length > 0) {
      animationFrameId = requestAnimationFrame(animate);
    }

    // 4. Zoom-fit dynamically if a specific trip is active or selected, else focus on India
    if (selectedTripId) {
      const selectedTrip = trips.find(t => t.id === selectedTripId);
      if (selectedTrip) {
        const sourceCoord = CITY_COORDS[selectedTrip.source];
        const destCoord = CITY_COORDS[selectedTrip.destination];
        if (sourceCoord && destCoord) {
          map.fitBounds([sourceCoord, destCoord], { padding: [60, 60], maxZoom: 6 });
        }
      }
    } else {
      // "only zoom in into india map" -> Center on India's centroid with stable zoom level 5
      map.setView([21.7679, 78.8718], 5);
    }

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [activeTrips, selectedTripId, trips, vehicles]);

  return (
    <div className={`relative h-[340px] md:h-full min-h-[300px] rounded-xl overflow-hidden border transition-all duration-300 ${
      theme === 'dark' 
        ? 'bg-zinc-950 border-zinc-900 shadow-inner' 
        : 'bg-white border-zinc-200 shadow-sm'
    }`}>
      {/* Real Leaflet Map Container Mount Point */}
      <div id="leaflet-map-element" ref={mapContainerRef} className="w-full h-full z-0" />

      {/* Clean Custom Map Legend (Bottom Left) */}
      <div className="absolute bottom-3 left-3 z-10 p-2.5 rounded-lg border flex flex-col gap-1.5 backdrop-blur-md bg-white/95 dark:bg-zinc-950/95 border-zinc-200 dark:border-zinc-850 shadow-md">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#eb5e00]" />
          <span className="text-[9px] font-bold text-zinc-600 dark:text-zinc-300 font-sans">Active Hub / Trip</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#ff944d]" />
          <span className="text-[9px] font-bold text-zinc-600 dark:text-zinc-300 font-sans">Available Fleet Node</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#ffd1b3]" />
          <span className="text-[9px] font-bold text-zinc-600 dark:text-zinc-300 font-sans">In-Shop bay</span>
        </div>
      </div>

      {/* Active filters status (Bottom Right) */}
      {activeFilters && (
        <div className="absolute bottom-3 right-3 z-10 py-1 px-2.5 rounded bg-white/90 dark:bg-zinc-950/90 backdrop-blur-sm border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-white/90 text-[9px] font-sans font-bold flex items-center gap-1 shadow-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-[#eb5e00] animate-ping" />
          <span>Active Paths: {activeTrips.length}</span>
        </div>
      )}
    </div>
  );
}
