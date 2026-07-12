export type TripStatus = 'draft' | 'dispatched' | 'completed' | 'cancelled';
export type VehicleStatus = 'available' | 'on_trip' | 'in_shop';
export type DriverStatus = 'available' | 'on_trip' | 'off_duty' | 'suspended';
export type VehicleType = 'semi' | 'box' | 'van';

export interface Vehicle {
  id: string;
  name: string;
  type: VehicleType;
  status: VehicleStatus;
  capacity: number; // in lbs
  currentOdometer: number;
}

export interface Driver {
  id: string;
  name: string;
  status: DriverStatus;
}

export interface Trip {
  id: string;
  source: string;
  destination: string;
  vehicleId: string;
  driverId: string;
  cargoWeight: number; // in lbs
  status: TripStatus;
  distance: number; // in miles
  eta: string; // duration or timestamp
  odometerIn?: number;
  fuelConsumed?: number;
  createdAt: string;
}

export type ActiveScreen = 'dashboard' | 'trips' | 'fleet' | 'drivers' | 'maintenance' | 'fuel-expenses' | 'analytics' | 'settings';
