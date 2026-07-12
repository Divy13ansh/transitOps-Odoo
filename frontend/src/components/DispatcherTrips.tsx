import React, { useState, useEffect, useMemo } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { Trip, Vehicle, Driver } from '../types';
import { CITIES, calculateDistance } from '../data/dispatcherData';
import MapContainer from './MapContainer';
import { 
  Plus, 
  Send, 
  X, 
  Check, 
  AlertCircle, 
  Info,
  ChevronDown
} from 'lucide-react';

interface DispatcherTripsProps {
  theme: 'light' | 'dark';
  trips: Trip[];
  vehicles: Vehicle[];
  drivers: Driver[];
  selectedTripId: string | null;
  onSelectTrip: (tripId: string | null) => void;
  onUpdateTrip: (updatedTrip: Trip) => void;
  onAddTrip: (newTrip: Trip) => void;
  onUpdateVehicleStatus: (vehicleId: string, status: 'available' | 'on_trip' | 'in_shop') => void;
  onUpdateDriverStatus: (driverId: string, status: 'available' | 'on_trip' | 'off_duty') => void;
}

export default function DispatcherTrips({
  theme,
  trips,
  vehicles,
  drivers,
  selectedTripId,
  onSelectTrip,
  onUpdateTrip,
  onAddTrip,
  onUpdateVehicleStatus,
  onUpdateDriverStatus
}: DispatcherTripsProps) {
  const { t } = useLanguage();
  
  // Find current trip if selected
  const currentTrip = useMemo(() => {
    if (!selectedTripId) return null;
    return trips.find(t => t.id === selectedTripId) || null;
  }, [selectedTripId, trips]);

  // Form states for NEW TRIP
  const [source, setSource] = useState(CITIES[0].name);
  const [destination, setDestination] = useState(CITIES[1].name);
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [cargoWeight, setCargoWeight] = useState<number>(5000);
  const [cargoWeightInput, setCargoWeightInput] = useState<number>(5000);
  const [weightUnit, setWeightUnit] = useState<'lbs' | 'kg' | 'tons'>('lbs');
  const [aiSuggestActive, setAiSuggestActive] = useState(false);

  // Unit transformation handlers
  const handleUnitChange = (newUnit: 'lbs' | 'kg' | 'tons') => {
    let newInputValue = cargoWeightInput;
    if (weightUnit === 'lbs') {
      if (newUnit === 'kg') {
        newInputValue = Math.round(cargoWeightInput * 0.45359237);
      } else if (newUnit === 'tons') {
        newInputValue = Number((cargoWeightInput / 2000).toFixed(2));
      }
    } else if (weightUnit === 'kg') {
      if (newUnit === 'lbs') {
        newInputValue = Math.round(cargoWeightInput * 2.20462);
      } else if (newUnit === 'tons') {
        newInputValue = Number(((cargoWeightInput * 2.20462) / 2000).toFixed(2));
      }
    } else if (weightUnit === 'tons') {
      if (newUnit === 'lbs') {
        newInputValue = Math.round(cargoWeightInput * 2000);
      } else if (newUnit === 'kg') {
        newInputValue = Math.round(cargoWeightInput * 2000 * 0.45359237);
      }
    }
    setWeightUnit(newUnit);
    setCargoWeightInput(newInputValue);

    // Sync underlying weight in Lbs for validation & trip models
    let weightInLbs = newInputValue;
    if (newUnit === 'kg') {
      weightInLbs = Math.round(newInputValue * 2.20462);
    } else if (newUnit === 'tons') {
      weightInLbs = Math.round(newInputValue * 2000);
    }
    setCargoWeight(weightInLbs);
  };

  const handleWeightInputChange = (val: number) => {
    setCargoWeightInput(val);
    let weightInLbs = val;
    if (weightUnit === 'kg') {
      weightInLbs = Math.round(val * 2.20462);
    } else if (weightUnit === 'tons') {
      weightInLbs = Math.round(val * 2000);
    }
    setCargoWeight(weightInLbs);
  };

  // States for COMPLETE TRIP Modal / Inline form
  const [isCompleting, setIsCompleting] = useState(false);
  const [odometerIn, setOdometerIn] = useState<number>(0);
  const [fuelConsumed, setFuelConsumed] = useState<number>(0);

  // Filter available resources for the dropdowns
  const availableVehicles = useMemo(() => {
    return vehicles.filter(v => v.status === 'available');
  }, [vehicles]);

  const availableDrivers = useMemo(() => {
    return drivers.filter(d => d.status === 'available');
  }, [drivers]);

  // Auto-set first available vehicle and driver when lists update
  useEffect(() => {
    if (availableVehicles.length > 0 && !selectedVehicleId) {
      setSelectedVehicleId(availableVehicles[0].id);
    }
  }, [availableVehicles, selectedVehicleId]);

  useEffect(() => {
    if (availableDrivers.length > 0 && !selectedDriverId) {
      setSelectedDriverId(availableDrivers[0].id);
    }
  }, [availableDrivers, selectedDriverId]);

  // Sync selected trip stats with default completion parameters
  useEffect(() => {
    if (currentTrip) {
      const veh = vehicles.find(v => v.id === currentTrip.vehicleId);
      if (veh) {
        setOdometerIn(veh.currentOdometer + currentTrip.distance);
        // Estimate 7.5 miles per gallon average
        setFuelConsumed(Math.round((currentTrip.distance / 7.5) * 10) / 10);
      }
    }
  }, [currentTrip, vehicles]);

  // Dynamic values based on selections
  const distance = useMemo(() => {
    return calculateDistance(source, destination);
  }, [source, destination]);

  const selectedVehicle = useMemo(() => {
    return vehicles.find(v => v.id === selectedVehicleId) || null;
  }, [selectedVehicleId, vehicles]);

  // Capacity validation
  const isWeightValid = useMemo(() => {
    if (!selectedVehicle) return true;
    return cargoWeight <= selectedVehicle.capacity;
  }, [cargoWeight, selectedVehicle]);

  // AI Suggestions Generator
  const aiRecommendations = useMemo(() => {
    if (!cargoWeight || availableVehicles.length === 0 || availableDrivers.length === 0) return [];
    
    // Sort available vehicles that can handle the cargo weight
    const vehiclesWithCapacity = availableVehicles.filter(v => v.capacity >= cargoWeight);
    if (vehiclesWithCapacity.length === 0) return [];

    // Form ranked recommendations
    return vehiclesWithCapacity.map((veh, idx) => {
      const driver = availableDrivers[idx % availableDrivers.length];
      let reason = '';
      if (veh.type === 'van' && cargoWeight < 3000) {
        reason = `Van #${veh.id} is 100% efficient for lightweight city transit. Saves 45% fuel compared to heavy engines.`;
      } else if (veh.type === 'box' && cargoWeight < 10000) {
        reason = `Box Truck #${veh.id} perfectly balances load and capacity ratio. Driver ${driver?.name || 'available'} is fully certified.`;
      } else {
        reason = `Semi-Truck #${veh.id} is ideal for long haul of ${distance} miles. Maximum payload capacity guaranteed.`;
      }

      return {
        id: `rec-${idx}`,
        vehicle: veh,
        driver: driver,
        rank: idx + 1,
        reason
      };
    });
  }, [cargoWeight, availableVehicles, availableDrivers, distance]);

  // Dispatch workflow: Draft (new) -> Dispatched
  const handleCreateDraft = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isWeightValid || !selectedVehicleId || !selectedDriverId) return;

    const newTrip = {
      id: `TR-${Math.floor(8000 + Math.random() * 2000)}`,
      source,
      destination,
      vehicleId: selectedVehicleId,
      driverId: selectedDriverId,
      cargoWeight,
      status: 'draft' as const,
      distance,
      eta: `${Math.floor(distance / 50 + 1)}h 30m`,
      createdAt: new Date().toISOString()
    };

    onAddTrip(newTrip);
    onSelectTrip(newTrip.id);
  };

  const handleApplyAiSuggestion = (rec: { vehicle: Vehicle; driver: Driver }) => {
    if (rec.vehicle) setSelectedVehicleId(rec.vehicle.id);
    if (rec.driver) setSelectedDriverId(rec.driver.id);
    setAiSuggestActive(false);
  };

  const handleDispatchTrip = () => {
    if (!currentTrip) return;
    
    // Update trip status to dispatched
    const updatedTrip = {
      ...currentTrip,
      status: 'dispatched' as const
    };
    onUpdateTrip(updatedTrip);

    // Update vehicle + driver statuses to on_trip
    onUpdateVehicleStatus(currentTrip.vehicleId, 'on_trip');
    onUpdateDriverStatus(currentTrip.driverId, 'on_trip');
  };

  const handleCompleteTripSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentTrip) return;

    // Finish trip completion
    const updatedTrip = {
      ...currentTrip,
      status: 'completed' as const,
      odometerIn,
      fuelConsumed,
      eta: 'Completed'
    };
    onUpdateTrip(updatedTrip);

    // Revert vehicle + driver statuses to available
    onUpdateVehicleStatus(currentTrip.vehicleId, 'available');
    onUpdateDriverStatus(currentTrip.driverId, 'available');
    
    setIsCompleting(false);
  };

  const handleCancelTrip = () => {
    if (!currentTrip) return;

    const updatedTrip = {
      ...currentTrip,
      status: 'cancelled' as const,
      eta: 'Cancelled'
    };
    onUpdateTrip(updatedTrip);

    // Revert vehicle + driver statuses to available
    onUpdateVehicleStatus(currentTrip.vehicleId, 'available');
    onUpdateDriverStatus(currentTrip.driverId, 'available');
  };

  return (
    <div className="space-y-6">
      
      {/* 1. Stepper indicator for selected trip (Lifecycle View) */}
      {currentTrip && (
        <div className={`p-4 rounded-xl border transition-all ${
          theme === 'dark' ? 'bg-zinc-900/60 border-zinc-800' : 'bg-white border-zinc-200'
        }`}>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
            <div>
              <span className="text-[10px] font-sans font-bold text-zinc-400 uppercase tracking-widest">{t('activeDispatchSeq')}</span>
              <h3 className="text-sm font-bold font-sans text-[#eb5e00] mt-0.5">{currentTrip.id} ({currentTrip.source} → {currentTrip.destination})</h3>
            </div>
            
            <div className="flex items-center gap-2">
              {currentTrip.status === 'draft' && (
                <button
                  onClick={handleDispatchTrip}
                  className="px-4 py-1.5 rounded-lg text-xs font-bold bg-[#eb5e00] hover:bg-[#d45500] text-white flex items-center gap-1 cursor-pointer transition-all shadow-md"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{t('dispatchTrip')}</span>
                </button>
              )}
              {currentTrip.status === 'dispatched' && (
                <>
                  <button
                    onClick={() => setIsCompleting(true)}
                    className="px-4 py-1.5 rounded-lg text-xs font-bold bg-zinc-900 hover:bg-zinc-850 text-white dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 flex items-center gap-1 cursor-pointer transition-all shadow-md"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>{t('completeTrip')}</span>
                  </button>
                  <button
                    onClick={handleCancelTrip}
                    className="px-4 py-1.5 rounded-lg text-xs font-bold border border-zinc-200 dark:border-zinc-880 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900 flex items-center gap-1 cursor-pointer transition-all shadow-md"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>{t('cancelTrip')}</span>
                  </button>
                </>
              )}
              <button
                onClick={() => onSelectTrip(null)}
                className={`p-1.5 rounded-lg border cursor-pointer transition-colors ${
                  theme === 'dark' ? 'border-zinc-800 hover:bg-zinc-800' : 'border-zinc-200 hover:bg-zinc-50'
                }`}
                title="Clear selected trip"
              >
                <X className="w-4 h-4 text-zinc-400" />
              </button>
            </div>
          </div>

          {/* Stepper display */}
          <div className="grid grid-cols-4 gap-2 relative">
            <div className="absolute top-[13px] left-[12.5%] right-[12.5%] h-0.5 bg-zinc-200 dark:bg-zinc-800 z-0" />
            
            {/* Draft */}
            <div className="flex flex-col items-center z-10 text-center">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center border font-sans text-xs font-bold ${
                currentTrip.status === 'draft'
                  ? 'bg-[#eb5e00] border-[#eb5e00] text-white shadow-md'
                  : 'bg-zinc-100 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-400'
              }`}>
                1
              </div>
              <span className="text-[10px] font-bold font-sans uppercase tracking-wider mt-1.5 text-zinc-500">{t('draft')}</span>
            </div>
            
            {/* Dispatched */}
            <div className="flex flex-col items-center z-10 text-center">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center border font-sans text-xs font-bold ${
                currentTrip.status === 'dispatched'
                  ? 'bg-[#eb5e00] border-[#eb5e00] text-white shadow-md'
                  : 'bg-zinc-100 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-400'
              }`}>
                2
              </div>
              <span className="text-[10px] font-bold font-sans uppercase tracking-wider mt-1.5 text-zinc-500">{t('onTrip')}</span>
            </div>
            
            {/* Completed */}
            <div className="flex flex-col items-center z-10 text-center">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center border font-sans text-xs font-bold ${
                currentTrip.status === 'completed'
                  ? 'bg-zinc-800 border-zinc-800 text-white dark:bg-zinc-200 dark:border-zinc-200 dark:text-zinc-900 shadow-md'
                  : 'bg-zinc-100 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-400'
              }`}>
                3
              </div>
              <span className="text-[10px] font-bold font-sans uppercase tracking-wider mt-1.5 text-zinc-500">{t('completed')}</span>
            </div>
            
            {/* Cancelled */}
            <div className="flex flex-col items-center z-10 text-center">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center border font-sans text-xs font-bold ${
                currentTrip.status === 'cancelled'
                  ? 'bg-zinc-500 border-zinc-500 text-white shadow-md'
                  : 'bg-zinc-100 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-400'
              }`}>
                4
              </div>
              <span className="text-[10px] font-bold font-sans uppercase tracking-wider mt-1.5 text-zinc-500">{t('cancelled')}</span>
            </div>
          </div>
        </div>
      )}

      {/* 2. Completion Modal overlay when dispatcher finishes a trip */}
      {isCompleting && currentTrip && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-50 p-4">
          <div className={`w-full max-w-md rounded-2xl border p-6 shadow-2xl ${
            theme === 'dark' ? 'bg-zinc-950 border-zinc-800 text-white' : 'bg-white border-zinc-200 text-zinc-800'
          }`}>
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-zinc-100 dark:border-zinc-900">
              <h4 className="font-sans font-black text-lg text-[#eb5e00]">{t('finalTripLog')}: {currentTrip.id}</h4>
              <button onClick={() => setIsCompleting(false)} className="p-1 cursor-pointer"><X className="w-5 h-5 text-zinc-400" /></button>
            </div>
            
            <form onSubmit={handleCompleteTripSubmit} className="space-y-4">
              <div className="p-3 rounded-lg bg-[#eb5e00]/5 text-[11px] leading-relaxed font-sans text-zinc-400 border border-[#eb5e00]/10 flex gap-2">
                <Info className="w-4 h-4 text-[#eb5e00] flex-shrink-0" />
                <span>{t('suggestDesc')} {currentTrip.distance} miles.</span>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider font-sans text-zinc-400 mb-1">{t('finalOdometer')}</label>
                <input
                  type="number"
                  required
                  value={odometerIn}
                  onChange={(e) => setOdometerIn(Number(e.target.value))}
                  className={`w-full px-4 py-2.5 rounded-xl border outline-none text-xs font-sans font-bold transition-all ${
                    theme === 'dark' 
                      ? 'bg-zinc-900 border-zinc-800 text-white focus:border-[#eb5e00]' 
                      : 'bg-zinc-50 border-zinc-200 text-zinc-800 focus:border-[#eb5e00]'
                  }`}
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider font-sans text-zinc-400 mb-1">{t('fuelConsumedGal')}</label>
                <input
                  type="number"
                  step="0.1"
                  required
                  value={fuelConsumed}
                  onChange={(e) => setFuelConsumed(Number(e.target.value))}
                  className={`w-full px-4 py-2.5 rounded-xl border outline-none text-xs font-sans font-bold transition-all ${
                    theme === 'dark' 
                      ? 'bg-zinc-900 border-zinc-800 text-white focus:border-[#eb5e00]' 
                      : 'bg-zinc-50 border-zinc-200 text-zinc-800 focus:border-[#eb5e00]'
                  }`}
                />
              </div>

              <div className="flex gap-2 pt-2 justify-end">
                <button
                  type="button"
                  onClick={() => setIsCompleting(false)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold border cursor-pointer ${
                    theme === 'dark' ? 'border-zinc-800 hover:bg-zinc-900' : 'border-zinc-200 hover:bg-zinc-100'
                  }`}
                >
                  {t('back')}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-[#eb5e00] hover:bg-[#d45500] text-white cursor-pointer shadow-md"
                >
                  {t('logAndComplete')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. Main Grid split: Create Form Left, Live Board + Route Map Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Form: Create Trip Wizard (5 columns) */}
        <div className="lg:col-span-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider font-sans text-zinc-400">{t('manifestTitle')}</span>
          </div>

          <div className={`p-5 rounded-xl border transition-all ${
            theme === 'dark' ? 'bg-zinc-900/40 border-zinc-900' : 'bg-white border-zinc-200 shadow-sm'
          }`}>
            <form onSubmit={handleCreateDraft} className="space-y-4">
              <div className="space-y-4">
              
              {/* Route: Source to Dest */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider font-sans text-zinc-400 mb-1">{t('sourceCity')}</label>
                  <div className="relative">
                    <select
                      value={source}
                      onChange={(e) => setSource(e.target.value)}
                      className={`appearance-none w-full px-4 py-2 pr-11 text-xs font-semibold rounded-xl border outline-none cursor-pointer transition-all ${
                        theme === 'dark' 
                          ? 'bg-zinc-900/50 border-zinc-800 text-zinc-200 hover:bg-zinc-900 focus:border-[#eb5e00]' 
                          : 'bg-zinc-50 border-zinc-200 text-zinc-700 hover:bg-zinc-100/50 focus:border-[#eb5e00]'
                      }`}
                    >
                      {CITIES.map(c => (
                        <option key={c.name} value={c.name}>{c.name}</option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-zinc-400">
                      <ChevronDown className="w-3.5 h-3.5" />
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider font-sans text-zinc-400 mb-1">{t('destination')}</label>
                  <div className="relative">
                    <select
                      value={destination}
                      onChange={(e) => setDestination(e.target.value)}
                      className={`appearance-none w-full px-4 py-2 pr-11 text-xs font-semibold rounded-xl border outline-none cursor-pointer transition-all ${
                        theme === 'dark' 
                          ? 'bg-zinc-900/50 border-zinc-800 text-zinc-200 hover:bg-zinc-900 focus:border-[#eb5e00]' 
                          : 'bg-zinc-50 border-zinc-200 text-zinc-700 hover:bg-zinc-100/50 focus:border-[#eb5e00]'
                      }`}
                    >
                      {CITIES.map(c => (
                        <option key={c.name} value={c.name}>{c.name}</option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-zinc-400">
                      <ChevronDown className="w-3.5 h-3.5" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Cargo Weight & Distance preview */}
              <div className="grid grid-cols-2 gap-4 items-end">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider font-sans text-zinc-400 mb-1">{t('cargoWeight')}</label>
                  <div className="relative">
                    <input
                      type="number"
                      min="1"
                      value={cargoWeightInput}
                      onChange={(e) => handleWeightInputChange(Number(e.target.value))}
                      className={`w-full pl-4 pr-20 py-2 text-xs font-bold rounded-xl border outline-none transition-all ${
                        theme === 'dark' 
                          ? 'bg-zinc-900/50 border-zinc-800 text-zinc-200 focus:border-zinc-700' 
                          : 'bg-zinc-50 border-zinc-200 text-zinc-700 focus:border-zinc-300'
                      }`}
                    />
                    <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center pr-1">
                      <select
                        value={weightUnit}
                        onChange={(e) => handleUnitChange(e.target.value as 'lbs' | 'kg' | 'tons')}
                        className={`appearance-none text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-lg border outline-none cursor-pointer transition-all ${
                          theme === 'dark'
                            ? 'bg-zinc-950 border-zinc-800 text-zinc-100 hover:bg-zinc-900'
                            : 'bg-white border-zinc-200 text-zinc-900 hover:bg-zinc-100'
                        }`}
                        style={{ color: theme === 'dark' ? '#f4f4f5' : '#18181b', borderColor: theme === 'dark' ? '#27272a' : '#e4e4e7', backgroundColor: theme === 'dark' ? '#09090b' : '#ffffff' }}
                      >
                        <option value="lbs">LBS</option>
                        <option value="kg">KG</option>
                        <option value="tons">TONS</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="flex items-center mb-1 h-[18px]">
                    <label className="block text-[10px] font-black uppercase tracking-wider font-sans text-zinc-400">{t('estDistance')}</label>
                  </div>
                  <div className={`w-full px-4 py-2 text-xs font-bold rounded-xl border flex items-center transition-all ${
                    theme === 'dark' 
                      ? 'bg-zinc-900/50 border-zinc-800 text-[#eb5e00]' 
                      : 'bg-zinc-50 border-zinc-200 text-[#eb5e00]'
                  }`}>
                    {distance} MI
                  </div>
                </div>
              </div>

              {/* Inline Capacity Validation Check - SINGLE LINE */}
              {!isWeightValid && selectedVehicle && (
                <div className="p-2.5 text-[11px] text-red-500 border border-red-500/15 rounded-xl bg-red-500/5 flex items-center gap-2 whitespace-nowrap overflow-x-auto scrollbar-none">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="truncate">
                    <strong>{t('payloadError')}:</strong> {t('exceedsMsg')} ({cargoWeight.toLocaleString()} lbs &gt; {selectedVehicle.capacity.toLocaleString()} lbs) for {selectedVehicle.name}. {t('dispatchLocked')}
                  </span>
                </div>
              )}

              {/* Vehicle Select (Available Only) */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-[10px] font-black uppercase tracking-wider font-sans text-zinc-400">{t('availableVehicle')}</label>
                  <button
                    type="button"
                    onClick={() => setAiSuggestActive(!aiSuggestActive)}
                    className="text-[10px] font-bold text-[#eb5e00] hover:underline flex items-center gap-1 cursor-pointer font-sans"
                  >
                    <span>{t('recommendResource')}</span>
                  </button>
                </div>
                
                {availableVehicles.length === 0 ? (
                  <div className="p-2 text-xs text-red-500 border border-red-500/15 rounded-xl bg-red-500/5 flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{t('warningNoVehicles')}</span>
                  </div>
                ) : (
                  <div className="relative">
                    <select
                      value={selectedVehicleId}
                      onChange={(e) => setSelectedVehicleId(e.target.value)}
                      className={`appearance-none w-full px-4 py-2 pr-11 text-xs font-semibold rounded-xl border outline-none cursor-pointer transition-all ${
                        theme === 'dark' 
                          ? 'bg-zinc-900/50 border-zinc-800 text-zinc-200 hover:bg-zinc-900 focus:border-[#eb5e00]' 
                          : 'bg-zinc-50 border-zinc-200 text-zinc-700 hover:bg-zinc-100/50 focus:border-[#eb5e00]'
                      }`}
                    >
                      {availableVehicles.map(v => (
                        <option key={v.id} value={v.id}>
                          {v.name} ({v.type.toUpperCase()} • Max {v.capacity.toLocaleString()} lbs)
                        </option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-zinc-400">
                      <ChevronDown className="w-3.5 h-3.5" />
                    </div>
                  </div>
                )}
              </div>

              {/* Driver Select (Available Only) */}
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider font-sans text-zinc-400 mb-1">{t('availableDriver')}</label>
                {availableDrivers.length === 0 ? (
                  <div className="p-2 text-xs text-red-500 border border-red-500/15 rounded-xl bg-red-500/5 flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{t('warningNoDrivers')}</span>
                  </div>
                ) : (
                  <div className="relative">
                    <select
                      value={selectedDriverId}
                      onChange={(e) => setSelectedDriverId(e.target.value)}
                      className={`appearance-none w-full px-4 py-2 pr-11 text-xs font-semibold rounded-xl border outline-none cursor-pointer transition-all ${
                        theme === 'dark' 
                          ? 'bg-zinc-900/50 border-zinc-800 text-zinc-200 hover:bg-zinc-900 focus:border-[#eb5e00]' 
                          : 'bg-zinc-50 border-zinc-200 text-zinc-700 hover:bg-zinc-100/50 focus:border-[#eb5e00]'
                      }`}
                    >
                      {availableDrivers.map(d => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-zinc-400">
                      <ChevronDown className="w-3.5 h-3.5" />
                    </div>
                  </div>
                )}
              </div>

              {/* Resource Recommendation Panel */}
              {aiSuggestActive && (
                <div className={`p-4 rounded-xl border ${
                  theme === 'dark' ? 'bg-zinc-950 border-[#eb5e00]/20' : 'bg-orange-500/5 border-[#eb5e00]/25'
                }`}>
                  <div className="flex justify-between items-center pb-2 border-b border-zinc-800 dark:border-zinc-200/10 mb-2">
                    <span className="text-[10px] font-black font-sans text-[#eb5e00] uppercase tracking-wider flex items-center gap-1">
                      {t('recBoardTitle')}
                    </span>
                    <button type="button" onClick={() => setAiSuggestActive(false)} className="text-zinc-400 cursor-pointer"><X className="w-4 h-4" /></button>
                  </div>
                  
                  {aiRecommendations.length === 0 ? (
                    <p className="text-[10px] text-zinc-400 font-sans">{t('noRecs')}</p>
                  ) : (
                    <div className="space-y-3">
                      {aiRecommendations.slice(0, 2).map((rec) => (
                        <div 
                          key={rec.id} 
                          className={`p-2.5 rounded-lg border text-[11px] flex flex-col justify-between items-start gap-1.5 transition-all ${
                            theme === 'dark' ? 'bg-zinc-900 border-zinc-850 hover:border-zinc-750' : 'bg-white border-zinc-200 hover:border-zinc-300'
                          }`}
                        >
                          <div className="w-full flex justify-between items-center">
                            <span className="font-sans font-bold text-[#eb5e00]">{t('rank')} #{rec.rank} - {rec.vehicle?.name}</span>
                            <button
                              type="button"
                              onClick={() => handleApplyAiSuggestion(rec)}
                              className="px-2 py-0.5 rounded text-[9px] font-bold bg-[#eb5e00] text-white hover:bg-[#d45500] cursor-pointer"
                            >
                              {t('applyBtn')}
                            </button>
                          </div>
                          <span className="text-zinc-500">{t('driverLbl')}: {rec.driver?.name || 'Unassigned'}</span>
                          <span className="text-[10px] text-zinc-400 font-medium italic mt-0.5 leading-tight">{rec.reason}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              </div>

              {/* Submit trigger button */}
              <button
                type="submit"
                disabled={!isWeightValid || !selectedVehicleId || !selectedDriverId}
                className={`w-full py-3 rounded-xl font-bold text-xs tracking-wide text-white transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm ${
                  (!isWeightValid || !selectedVehicleId || !selectedDriverId)
                    ? 'bg-zinc-600 cursor-not-allowed opacity-50' 
                    : 'bg-[#eb5e00] hover:bg-[#d45500] hover:scale-[1.01]'
                }`}
              >
                <Plus className="w-4 h-4" />
                <span>{t('createDraftBtn')}</span>
              </button>
            </form>
          </div>
        </div>

        {/* Right Panel: Interactive Active Transit Board + Selected Preview Map (7 columns) */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          
          {/* Active board cards */}
          <div className="flex-1 flex flex-col">
            <span className="text-xs font-bold uppercase tracking-wider font-sans text-zinc-400 mb-2">{t('freightBoard')}</span>
            
            <div className={`p-4 rounded-xl border flex-1 overflow-y-auto max-h-[290px] lg:max-h-[350px] space-y-3 transition-all ${
              theme === 'dark' ? 'bg-zinc-900/30 border-zinc-900' : 'bg-white border-zinc-200'
            }`}>
              {trips.map((trip) => {
                const isSelected = selectedTripId === trip.id;
                const veh = vehicles.find(v => v.id === trip.vehicleId);
                const drv = drivers.find(d => d.id === trip.driverId);

                return (
                  <div
                    key={trip.id}
                    onClick={() => onSelectTrip(isSelected ? null : trip.id)}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-all flex flex-col md:flex-row justify-between items-start md:items-center gap-3 ${
                      isSelected
                        ? 'border-[#eb5e00] bg-[#eb5e00]/5 shadow-sm'
                        : theme === 'dark'
                          ? 'border-zinc-850 bg-zinc-900/40 hover:bg-zinc-900/80 text-zinc-200'
                          : 'border-zinc-150 bg-zinc-50/50 hover:bg-zinc-50 text-zinc-700'
                    }`}
                  >
                    <div className="space-y-1 font-sans">
                      <div className="flex items-center gap-2">
                        <span className="font-sans font-black text-[#eb5e00] text-xs">{trip.id}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[8px] font-sans font-bold uppercase tracking-widest border ${
                          trip.status === 'dispatched'
                            ? 'bg-orange-50 text-[#eb5e00] border-orange-200/40 dark:bg-orange-950/20 dark:text-[#eb5e00] dark:border-[#eb5e00]/25'
                            : trip.status === 'completed'
                              ? 'bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700'
                              : trip.status === 'draft'
                                ? 'bg-zinc-50 text-zinc-400 border-zinc-150 dark:bg-zinc-900 dark:text-zinc-500 dark:border-zinc-800'
                                : 'bg-zinc-100 text-zinc-400 border-zinc-200 dark:bg-zinc-850 dark:text-zinc-400 dark:border-zinc-800'
                        }`}>
                          {trip.status === 'dispatched' ? t('onTrip') : trip.status === 'draft' ? t('draft') : trip.status === 'completed' ? t('completed') : t('cancelled')}
                        </span>
                      </div>
                      
                      <div className="text-xs font-black tracking-tight">{trip.source} → {trip.destination}</div>
                      <div className="text-[10px] text-zinc-400 font-semibold font-sans">
                        {veh?.name} • {drv?.name || 'Driver Assign'}
                      </div>
                    </div>

                    <div className="text-right font-sans text-[10px] space-y-1 self-stretch md:self-auto flex md:flex-col justify-between items-center md:items-end">
                      <span className="text-zinc-400 uppercase tracking-wider font-bold">{t('metrics')}</span>
                      <div className="font-bold text-zinc-600 dark:text-zinc-300">
                        {trip.distance} mi • {trip.cargoWeight.toLocaleString()} lbs
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Active Preview Map for selected or filtering routes */}
          <div className="h-[250px] lg:h-[270px]">
            <MapContainer 
              theme={theme}
              trips={trips}
              vehicles={vehicles}
              selectedTripId={selectedTripId || undefined}
              activeFilters={{
                vehicleType: 'All',
                status: 'All',
                region: 'All'
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
