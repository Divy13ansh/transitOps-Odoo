import React, { useState, useMemo } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { Trip, Vehicle, Driver, ActiveScreen } from '../types';
import { CITIES } from '../data/dispatcherData';
import MapContainer from './MapContainer';
import { 
  TrendingUp, 
  Truck, 
  UserCheck, 
  Calendar, 
  Clock, 
  Wrench, 
  Zap, 
  ArrowRight,
  Filter,
  Sparkles,
  ChevronDown
} from 'lucide-react';

interface DispatcherDashboardProps {
  theme: 'light' | 'dark';
  trips: Trip[];
  vehicles: Vehicle[];
  drivers: Driver[];
  onSelectTrip: (tripId: string) => void;
  setScreen: (screen: ActiveScreen) => void;
}

export default function DispatcherDashboard({
  theme,
  trips,
  vehicles,
  drivers,
  onSelectTrip,
  setScreen
}: DispatcherDashboardProps) {
  // Filters state
  const [vehicleTypeFilter, setVehicleTypeFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [regionFilter, setRegionFilter] = useState('All');

  const { language, t } = useLanguage();

  // KPI Calculations
  const stats = useMemo(() => {
    const activeVehicles = vehicles.filter(v => v.status === 'on_trip').length;
    const availableVehicles = vehicles.filter(v => v.status === 'available').length;
    const maintenanceVehicles = vehicles.filter(v => v.status === 'in_shop').length;
    
    const activeTrips = trips.filter(t => t.status === 'dispatched').length;
    const pendingTrips = trips.filter(t => t.status === 'draft').length;
    
    const driversOnDuty = drivers.filter(d => d.status === 'available' || d.status === 'on_trip').length;
    
    const totalVehicles = vehicles.length;
    const fleetUtilization = totalVehicles > 0 
      ? Math.round((activeVehicles / totalVehicles) * 100) 
      : 0;

    return {
      activeVehicles,
      availableVehicles,
      maintenanceVehicles,
      activeTrips,
      pendingTrips,
      driversOnDuty,
      fleetUtilization
    };
  }, [vehicles, trips, drivers]);

  // Daily briefing content derived dynamically from actual fleet status
  const aiBriefingText = useMemo(() => {
    const activeCount = stats.activeTrips;
    const shopCount = stats.maintenanceVehicles;
    const util = stats.fleetUtilization;
    const availableCount = stats.availableVehicles;
    
    if (language === 'hi') {
      let priorityNote = "सभी सक्रिय मार्ग स्थिर मापदंडों के तहत संचालित हो रहे हैं।";
      if (shopCount > 2) {
        priorityNote = `शेड्यूलिंग जांच की सिफारिश की जाती है: ${shopCount} इकाइयां वर्तमान में रखरखाव बे में हैं।`;
      } else if (util > 75) {
        priorityNote = "उच्च लोड अलर्ट: बेड़े का उपयोग चरम पर है। आराम अनुपालन के लिए ड्राइवर लॉग की निगरानी करें।";
      }
      return `टर्मिनल पुष्टि करता है कि ${activeCount} प्रेषण प्राथमिक माल ढुलाई मार्गों पर सक्रिय रूप से ट्रैक कर रहे हैं। बेड़े का उपयोग वर्तमान में ${util}% है और ${availableCount} वाहन तत्काल तैनाती के लिए तैयार हैं। ${priorityNote} अगले 12 घंटों के लिए क्षेत्रीय मौसम और सड़कें साफ हैं।`;
    } else {
      let priorityNote = "All active routes are operating under stable green parameters.";
      if (shopCount > 2) {
        priorityNote = `Scheduling check recommended: ${shopCount} units are currently sidelined in maintenance bays.`;
      } else if (util > 75) {
        priorityNote = "High load alert: Fleet utilization is peak. Monitor driver logs for rest compliance.";
      }
      return `Terminal confirms ${activeCount} dispatches are actively tracking on primary freight lines. Fleet utilization is currently at ${util}% with ${availableCount} vehicles ready for immediate deployment. ${priorityNote} Regional weather and roads are clear for the next 12 hours.`;
    }
  }, [stats, language]);

  // Filter recent trips table
  const filteredTrips = useMemo(() => {
    return trips.filter(trip => {
      // Vehicle type filter
      const vehicle = vehicles.find(v => v.id === trip.vehicleId);
      if (vehicleTypeFilter !== 'All' && vehicle?.type !== vehicleTypeFilter) return false;

      // Trip status filter (all, dispatched, completed, draft, cancelled)
      if (statusFilter !== 'All') {
        if (statusFilter === 'available' && trip.status !== 'completed') return false; // Available vehicles match completed/unused trips
        if (statusFilter === 'on_trip' && trip.status !== 'dispatched') return false;
        if (statusFilter === 'in_shop' && trip.status !== 'draft') return false; // mock mapped draft trips
        if (statusFilter !== 'available' && statusFilter !== 'on_trip' && statusFilter !== 'in_shop') {
          if (trip.status !== statusFilter) return false;
        }
      }

      // Region filter
      if (regionFilter !== 'All') {
        const sourceCity = CITIES.find(c => c.name === trip.source);
        const destCity = CITIES.find(c => c.name === trip.destination);
        if (sourceCity?.region !== regionFilter && destCity?.region !== regionFilter) return false;
      }

      return true;
    });
  }, [trips, vehicles, vehicleTypeFilter, statusFilter, regionFilter]);

  return (
    <div className="space-y-6">
      {/* Daily Ops Briefing Card */}
      <div className="p-5 rounded-xl border relative overflow-hidden bg-[#eb5e00] border-[#d45500] shadow-md">
        {/* Subtle decorative mesh background */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent pointer-events-none opacity-40" />
        <div className="flex items-start gap-4 relative z-10">
          <div className="space-y-1">
            <h5 className="text-xs font-black font-sans uppercase tracking-widest text-orange-100">{t('dailyBriefing')}</h5>
            <p className="text-xs md:text-sm leading-relaxed font-sans font-bold text-white">
              {aiBriefingText}
            </p>
          </div>
        </div>
      </div>

      {/* 1. KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-7 gap-4">
        {/* Active Vehicles */}
        <div className={`p-4 rounded-xl border flex flex-col justify-between transition-all ${
          theme === 'dark' ? 'bg-zinc-900/60 border-zinc-800' : 'bg-white border-zinc-200'
        }`}>
          <div className="flex justify-between items-start mb-2">
            <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider font-sans">{t('activeVehicles')}</span>
            <span className="w-2 h-2 rounded-full bg-[#eb5e00]" />
          </div>
          <div>
            <h4 className="text-2xl font-[900] font-sans leading-tight tracking-tight">{stats.activeVehicles}</h4>
            <p className="text-[10px] text-zinc-400 mt-1 font-sans font-medium">{t('liveInTransit')}</p>
          </div>
        </div>

        {/* Available Vehicles */}
        <div className={`p-4 rounded-xl border flex flex-col justify-between transition-all ${
          theme === 'dark' ? 'bg-zinc-900/60 border-zinc-800' : 'bg-white border-zinc-200'
        }`}>
          <div className="flex justify-between items-start mb-2">
            <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider font-sans">{t('available')}</span>
            <span className="w-2 h-2 rounded-full bg-orange-400" />
          </div>
          <div>
            <h4 className="text-2xl font-[900] font-sans leading-tight tracking-tight">{stats.availableVehicles}</h4>
            <p className="text-[10px] text-zinc-400 mt-1 font-sans font-medium">{t('readyDispatch')}</p>
          </div>
        </div>

        {/* Vehicles in Shop */}
        <div className={`p-4 rounded-xl border flex flex-col justify-between transition-all ${
          theme === 'dark' ? 'bg-zinc-900/60 border-zinc-800' : 'bg-white border-zinc-200'
        }`}>
          <div className="flex justify-between items-start mb-2">
            <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider font-sans">{t('inShop')}</span>
            <span className="w-2 h-2 rounded-full bg-zinc-400 dark:bg-zinc-500" />
          </div>
          <div>
            <h4 className="text-2xl font-[900] font-sans leading-tight tracking-tight">{stats.maintenanceVehicles}</h4>
            <p className="text-[10px] text-zinc-400 mt-1 font-sans font-medium">{t('bayMaintenance')}</p>
          </div>
        </div>

        {/* Active Trips */}
        <div className={`p-4 rounded-xl border flex flex-col justify-between transition-all ${
          theme === 'dark' ? 'bg-zinc-900/60 border-zinc-800' : 'bg-white border-zinc-200'
        }`}>
          <div className="flex justify-between items-start mb-2">
            <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider font-sans">{t('activeTrips')}</span>
            <span className="w-2 h-2 rounded-full bg-[#eb5e00]" />
          </div>
          <div>
            <h4 className="text-2xl font-[900] font-sans leading-tight tracking-tight">{stats.activeTrips}</h4>
            <p className="text-[10px] text-zinc-400 mt-1 font-sans font-medium">{t('dispatchedOrders')}</p>
          </div>
        </div>

        {/* Pending Trips */}
        <div className={`p-4 rounded-xl border flex flex-col justify-between transition-all ${
          theme === 'dark' ? 'bg-zinc-900/60 border-zinc-800' : 'bg-white border-zinc-200'
        }`}>
          <div className="flex justify-between items-start mb-2">
            <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider font-sans">{t('pending')}</span>
            <span className="w-2 h-2 rounded-full bg-zinc-400 dark:bg-zinc-500" />
          </div>
          <div>
            <h4 className="text-2xl font-[900] font-sans leading-tight tracking-tight">{stats.pendingTrips}</h4>
            <p className="text-[10px] text-zinc-400 mt-1 font-sans font-medium">{t('draftState')}</p>
          </div>
        </div>

        {/* Drivers On Duty */}
        <div className={`p-4 rounded-xl border flex flex-col justify-between transition-all ${
          theme === 'dark' ? 'bg-zinc-900/60 border-zinc-800' : 'bg-white border-zinc-200'
        }`}>
          <div className="flex justify-between items-start mb-2">
            <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider font-sans">{t('onDuty')}</span>
            <span className="w-2 h-2 rounded-full bg-orange-400" />
          </div>
          <div>
            <h4 className="text-2xl font-[900] font-sans leading-tight tracking-tight">{stats.driversOnDuty}</h4>
            <p className="text-[10px] text-zinc-400 mt-1 font-sans font-medium">{t('activeOperators')}</p>
          </div>
        </div>

        {/* Fleet Utilization */}
        <div className={`p-4 rounded-xl border col-span-2 lg:col-span-1 flex flex-col justify-between transition-all ${
          theme === 'dark' ? 'bg-zinc-900/60 border-zinc-800' : 'bg-white border-zinc-200'
        }`}>
          <div className="flex justify-between items-start mb-2">
            <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider font-sans">{t('utilization')}</span>
            <span className="w-2 h-2 rounded-full bg-[#eb5e00]" />
          </div>
          <div>
            <h4 className="text-2xl font-[900] font-sans leading-tight tracking-tight text-[#eb5e00]">{stats.fleetUtilization}%</h4>
            <p className="text-[10px] text-zinc-400 mt-1 font-sans font-medium">{t('activeRatio')}</p>
          </div>
        </div>
      </div>

      {/* 2. Filters Row */}
      <div className="flex flex-wrap gap-x-6 gap-y-4 items-center justify-start w-full">
        {/* Vehicle Type Filter */}
        <div className="flex items-center gap-2">
          <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider font-sans">{t('vehicleType')}</label>
          <div className="relative">
            <select
              value={vehicleTypeFilter}
              onChange={(e) => setVehicleTypeFilter(e.target.value)}
              className={`appearance-none text-xs pl-4 pr-11 py-2 rounded-xl border outline-none cursor-pointer transition-all font-sans font-bold ${
                theme === 'dark' 
                  ? 'bg-zinc-900/50 border-zinc-800 text-zinc-200 hover:bg-zinc-900 focus:border-[#eb5e00]' 
                  : 'bg-zinc-50 border-zinc-250 text-zinc-700 hover:bg-zinc-100/50 focus:border-[#eb5e00]'
              }`}
            >
              <option value="All">{t('allTypes')}</option>
              <option value="semi">{t('semi')}</option>
              <option value="box">{t('box')}</option>
              <option value="van">{t('van')}</option>
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-5 flex items-center text-zinc-400">
              <ChevronDown className="w-3.5 h-3.5" />
            </div>
          </div>
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-2">
          <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider font-sans">{t('fleetStatus')}</label>
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className={`appearance-none text-xs pl-4 pr-11 py-2 rounded-xl border outline-none cursor-pointer transition-all font-sans font-bold ${
                theme === 'dark' 
                  ? 'bg-zinc-900/50 border-zinc-800 text-zinc-200 hover:bg-zinc-900 focus:border-[#eb5e00]' 
                  : 'bg-zinc-50 border-zinc-250 text-zinc-700 hover:bg-zinc-100/50 focus:border-[#eb5e00]'
              }`}
            >
              <option value="All">{t('allStatuses')}</option>
              <option value="on_trip">{t('onTripDispatched')}</option>
              <option value="available">{t('availableCompleted')}</option>
              <option value="in_shop">{t('inShopDraft')}</option>
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-5 flex items-center text-zinc-400">
              <ChevronDown className="w-3.5 h-3.5" />
            </div>
          </div>
        </div>

        {/* Region Filter */}
        <div className="flex items-center gap-2">
          <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider font-sans">{t('logisticsRegion')}</label>
          <div className="relative">
            <select
              value={regionFilter}
              onChange={(e) => setRegionFilter(e.target.value)}
              className={`appearance-none text-xs pl-4 pr-11 py-2 rounded-xl border outline-none cursor-pointer transition-all font-sans font-bold ${
                theme === 'dark' 
                  ? 'bg-zinc-900/50 border-zinc-800 text-zinc-200 hover:bg-zinc-900 focus:border-[#eb5e00]' 
                  : 'bg-zinc-50 border-zinc-250 text-zinc-700 hover:bg-zinc-100/50 focus:border-[#eb5e00]'
              }`}
            >
              <option value="All">{t('allRegions')}</option>
              <option value="North">{t('northIndia')}</option>
              <option value="West">{t('westIndia')}</option>
              <option value="South">{t('southIndia')}</option>
              <option value="East">{t('eastIndia')}</option>
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-5 flex items-center text-zinc-400">
              <ChevronDown className="w-3.5 h-3.5" />
            </div>
          </div>
        </div>
      </div>

      {/* 3. Split Layout: Interactive Map Left, Recent Trips Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Map Panel (7 columns) */}
        <div className="lg:col-span-7 flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider font-sans text-zinc-400">{t('hubStatus')}</span>
          </div>
          <div className="flex-1 min-h-[360px]">
            <MapContainer 
              theme={theme} 
              trips={trips} 
              vehicles={vehicles} 
              activeFilters={{
                vehicleType: vehicleTypeFilter,
                status: statusFilter,
                region: regionFilter
              }}
            />
          </div>
        </div>

        {/* Trips Table Panel (5 columns) */}
        <div className="lg:col-span-5 flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider font-sans text-zinc-400">{t('recentActivity')}</span>
            <span className="text-[10px] font-sans font-bold text-zinc-400">{filteredTrips.length} {t('activeMatching')}</span>
          </div>

          <div className={`flex-1 rounded-xl border overflow-hidden transition-all flex flex-col justify-between ${
            theme === 'dark' ? 'bg-zinc-900/30 border-zinc-900' : 'bg-white border-zinc-200 shadow-sm'
          }`}>
            <div className="overflow-x-auto flex-1">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className={`border-b text-[10px] font-bold uppercase tracking-wider font-sans ${
                    theme === 'dark' ? 'border-zinc-800 text-zinc-500 bg-zinc-950/60' : 'border-zinc-150 text-zinc-400 bg-zinc-50/50'
                  }`}>
                    <th className="p-3.5 pl-4">{t('tripId')}</th>
                    <th className="p-3.5">{t('route')}</th>
                    <th className="p-3.5">{t('status')}</th>
                    <th className="p-3.5 pr-4 text-right">{t('eta')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-900">
                  {filteredTrips.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-10 text-center text-xs text-zinc-400 font-sans">
                        {t('noRecords')}
                      </td>
                    </tr>
                  ) : (
                    filteredTrips.map((trip) => {
                      const veh = vehicles.find(v => v.id === trip.vehicleId);
                      const drv = drivers.find(d => d.id === trip.driverId);
                      
                      return (
                        <tr 
                          key={trip.id}
                          onClick={() => {
                            onSelectTrip(trip.id);
                            setScreen('trips');
                          }}
                          className={`group cursor-pointer transition-colors text-xs ${
                            theme === 'dark' 
                              ? 'hover:bg-zinc-900/60 text-zinc-200' 
                              : 'hover:bg-zinc-50/70 text-zinc-700'
                          }`}
                        >
                          {/* Trip ID */}
                          <td className="p-3 pl-4 font-sans font-bold text-[#eb5e00] group-hover:underline">
                            {trip.id}
                          </td>

                          {/* Route & Details */}
                          <td className="p-3">
                            <div className="font-bold tracking-tight">{trip.source} → {trip.destination}</div>
                            <div className="text-[10px] text-zinc-400 mt-0.5 truncate max-w-[140px] font-sans font-medium">
                              {veh?.name} • {drv?.name || t('driverAssign')}
                            </div>
                          </td>

                          {/* Status Pill */}
                          <td className="p-3">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[9px] font-sans font-bold uppercase tracking-wider border ${
                              trip.status === 'dispatched'
                                ? 'bg-orange-50 text-[#eb5e00] border-orange-200/40 dark:bg-orange-950/20 dark:text-[#eb5e00] dark:border-[#eb5e00]/25'
                                : trip.status === 'completed'
                                  ? 'bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700'
                                  : trip.status === 'draft'
                                    ? 'bg-zinc-50 text-zinc-400 border-zinc-150 dark:bg-zinc-900 dark:text-zinc-500 dark:border-zinc-800'
                                    : 'bg-zinc-100 text-zinc-400 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700'
                            }`}>
                              {trip.status === 'dispatched' ? t('onTripStatus') : trip.status}
                            </span>
                          </td>

                          {/* ETA */}
                          <td className="p-3 pr-4 text-right font-sans font-bold text-zinc-500 dark:text-zinc-400">
                            {trip.status === 'dispatched' ? (
                              <div className="flex items-center justify-end gap-1 font-sans font-semibold">
                                <Clock className="w-3 h-3 text-[#eb5e00]" />
                                <span>{trip.eta}</span>
                              </div>
                            ) : (
                              <span>--</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination/Action Footer */}
            <div className={`p-3 border-t text-center flex justify-between items-center ${
              theme === 'dark' ? 'border-zinc-900 bg-zinc-950/20' : 'border-zinc-150 bg-zinc-50/20'
            }`}>
              <span className="text-[10px] font-sans font-medium text-zinc-400">{t('showingRecords')} {filteredTrips.slice(0, 5).length} {t('records')}</span>
              <button 
                onClick={() => setScreen('trips')}
                className="text-[10px] font-bold text-[#eb5e00] hover:underline flex items-center gap-1 cursor-pointer font-sans"
              >
                <span>{t('dispatchConsole')}</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
