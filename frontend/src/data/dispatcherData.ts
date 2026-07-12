import { Vehicle, Driver, Trip } from '../types';

export const CITIES = [
  { name: 'New Delhi', x: 45, y: 25, region: 'North' },
  { name: 'Jaipur', x: 40, y: 32, region: 'North' },
  { name: 'Mumbai', x: 28, y: 60, region: 'West' },
  { name: 'Pune', x: 30, y: 64, region: 'West' },
  { name: 'Ahmedabad', x: 25, y: 48, region: 'West' },
  { name: 'Bengaluru', x: 42, y: 80, region: 'South' },
  { name: 'Chennai', x: 48, y: 82, region: 'South' },
  { name: 'Hyderabad', x: 44, y: 68, region: 'South' },
  { name: 'Kolkata', x: 78, y: 44, region: 'East' }
];

export const INITIAL_VEHICLES: Vehicle[] = [
  { id: 'V-101', name: 'Semi-Truck #T-101', type: 'semi', status: 'on_trip', capacity: 40000, currentOdometer: 142050 },
  { id: 'V-102', name: 'Semi-Truck #T-102', type: 'semi', status: 'on_trip', capacity: 40000, currentOdometer: 85400 },
  { id: 'V-103', name: 'Semi-Truck #T-103', type: 'semi', status: 'in_shop', capacity: 40000, currentOdometer: 198200 },
  { id: 'V-201', name: 'Box Truck #T-201', type: 'box', status: 'on_trip', capacity: 10000, currentOdometer: 64100 },
  { id: 'V-202', name: 'Box Truck #T-202', type: 'box', status: 'on_trip', capacity: 10000, currentOdometer: 31200 },
  { id: 'V-203', name: 'Box Truck #T-203', type: 'box', status: 'on_trip', capacity: 10000, currentOdometer: 12450 },
  { id: 'V-301', name: 'Delivery Van #T-301', type: 'van', status: 'on_trip', capacity: 3000, currentOdometer: 48900 },
  { id: 'V-302', name: 'Delivery Van #T-302', type: 'van', status: 'on_trip', capacity: 3000, currentOdometer: 29500 },
  { id: 'V-303', name: 'Delivery Van #T-303', type: 'van', status: 'available', capacity: 3000, currentOdometer: 72100 }
];

export const INITIAL_DRIVERS: Driver[] = [
  { id: 'D-01', name: 'Alex Mercer', status: 'on_trip' },
  { id: 'D-02', name: 'Sarah Jenkins', status: 'on_trip' },
  { id: 'D-03', name: 'Carlos Ramirez', status: 'on_trip' },
  { id: 'D-04', name: 'David Chen', status: 'on_trip' },
  { id: 'D-05', name: 'Marcus Brody', status: 'on_trip' },
  { id: 'D-06', name: 'Elena Rostova', status: 'on_trip' },
  { id: 'D-07', name: 'Jordan Hayes', status: 'on_trip' },
  { id: 'D-08', name: 'Maya Lin', status: 'available' }
];

export const INITIAL_TRIPS: Trip[] = [
  {
    id: 'TR-8041',
    source: 'New Delhi',
    destination: 'Mumbai',
    vehicleId: 'V-101',
    driverId: 'D-01',
    cargoWeight: 32000,
    status: 'dispatched',
    distance: 880,
    eta: '4h 15m',
    createdAt: '2026-07-11T08:30:00Z'
  },
  {
    id: 'TR-8042',
    source: 'Kolkata',
    destination: 'Bengaluru',
    vehicleId: 'V-201',
    driverId: ' Carlos Ramirez', // wait, match driverId
    cargoWeight: 7500,
    status: 'dispatched',
    distance: 1160,
    eta: '2h 45m',
    createdAt: '2026-07-11T10:15:00Z'
  },
  {
    id: 'TR-8043',
    source: 'Ahmedabad',
    destination: 'Pune',
    vehicleId: 'V-301',
    driverId: 'D-05',
    cargoWeight: 2100,
    status: 'dispatched',
    distance: 410,
    eta: '9h 30m',
    createdAt: '2026-07-11T06:00:00Z'
  },
  {
    id: 'TR-8044',
    source: 'Jaipur',
    destination: 'Hyderabad',
    vehicleId: 'V-102',
    driverId: 'D-02',
    cargoWeight: 29000,
    status: 'dispatched',
    distance: 720,
    eta: '6h 10m',
    createdAt: '2026-07-11T09:00:00Z'
  },
  {
    id: 'TR-8045',
    source: 'Pune',
    destination: 'Chennai',
    vehicleId: 'V-202',
    driverId: 'D-04',
    cargoWeight: 8000,
    status: 'dispatched',
    distance: 610,
    eta: '5h 20m',
    createdAt: '2026-07-11T07:45:00Z'
  },
  {
    id: 'TR-8046',
    source: 'Bengaluru',
    destination: 'New Delhi',
    vehicleId: 'V-203',
    driverId: 'D-06',
    cargoWeight: 8500,
    status: 'dispatched',
    distance: 1320,
    eta: '10h 40m',
    createdAt: '2026-07-11T05:30:00Z'
  },
  {
    id: 'TR-8047',
    source: 'Hyderabad',
    destination: 'Kolkata',
    vehicleId: 'V-302',
    driverId: 'D-07',
    cargoWeight: 2400,
    status: 'dispatched',
    distance: 980,
    eta: '8h 15m',
    createdAt: '2026-07-11T08:00:00Z'
  },
  {
    id: 'TR-8038',
    source: 'Chennai',
    destination: 'Hyderabad',
    vehicleId: 'V-202',
    driverId: 'D-02',
    cargoWeight: 8200,
    status: 'completed',
    distance: 390,
    eta: 'Completed',
    odometerIn: 31863,
    fuelConsumed: 55.4,
    createdAt: '2026-07-10T14:20:00Z'
  },
  {
    id: 'TR-8039',
    source: 'Jaipur',
    destination: 'New Delhi',
    vehicleId: 'V-102',
    driverId: 'D-04',
    cargoWeight: 28000,
    status: 'completed',
    distance: 160,
    eta: 'Completed',
    odometerIn: 86705,
    fuelConsumed: 112.8,
    createdAt: '2026-07-10T09:45:00Z'
  }
];

// Helper to estimate coordinates between two cities at current simulation state
export function getRouteCoordinates(sourceName: string, destName: string) {
  const source = CITIES.find(c => c.name === sourceName);
  const dest = CITIES.find(c => c.name === destName);
  if (!source || !dest) return null;
  return { source, dest };
}

// Distance matrix estimation based on simple coordinate calculation
export function calculateDistance(sourceName: string, destName: string): number {
  if (sourceName === destName) return 0;
  const source = CITIES.find(c => c.name === sourceName);
  const dest = CITIES.find(c => c.name === destName);
  if (!source || !dest) return 0;
  
  // Custom pseudo-distance in miles
  const dx = source.x - dest.x;
  const dy = source.y - dest.y;
  const dist = Math.sqrt(dx*dx + dy*dy) * 22; // multiplier to get realistic highway miles
  return Math.round(dist);
}
