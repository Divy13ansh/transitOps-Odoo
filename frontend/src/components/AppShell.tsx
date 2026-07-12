import React, { useState } from 'react';
import { Vehicle, Driver, Trip, ActiveScreen } from '../types';
import { INITIAL_VEHICLES, INITIAL_DRIVERS, INITIAL_TRIPS } from '../data/dispatcherData';
import { useLanguage } from '../i18n/LanguageContext';
import Dashboard from './Dashboard';
import DispatcherTrips from './DispatcherTrips';
import Settings from './Settings';
import Fleet from './Fleet';
import Drivers from './Drivers';
import Maintenance from './Maintenance';
import FuelExpenses from './FuelExpenses';
import Analytics from './Analytics';
import { 
  LayoutDashboard, 
  Map, 
  Settings as SettingsIcon, 
  Search, 
  Sun, 
  Moon, 
  Activity,
  Truck,
  Users,
  Wrench,
  Fuel,
  BarChart3
} from 'lucide-react';

interface AppShellProps {
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  userEmail: string;
  userRole?: string;
  onLogout: () => void;
}

export default function AppShell({
  theme,
  toggleTheme,
  userEmail,
  userRole = 'dispatcher',
  onLogout
}: AppShellProps) {
  const { language, setLanguage, t } = useLanguage();

  // Global states for vehicles, drivers, and trips inside current session
  const [vehicles, setVehicles] = useState<Vehicle[]>(INITIAL_VEHICLES);
  const [drivers, setDrivers] = useState<Driver[]>(INITIAL_DRIVERS);
  const [trips, setTrips] = useState<Trip[]>(INITIAL_TRIPS);
  const [activeScreen, setActiveScreen] = useState<ActiveScreen>('dashboard');
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);

  // Status changes callbacks
  const handleUpdateTrip = (updatedTrip: Trip) => {
    setTrips(prev => prev.map(t => t.id === updatedTrip.id ? updatedTrip : t));
  };

  const handleAddTrip = (newTrip: Trip) => {
    setTrips(prev => [newTrip, ...prev]);
  };

  const handleUpdateVehicleStatus = (vehicleId: string, status: any) => {
    setVehicles(prev => prev.map(v => v.id === vehicleId ? { ...v, status } : v));
  };

  const handleUpdateDriverStatus = (driverId: string, status: any) => {
    setDrivers(prev => prev.map(d => d.id === driverId ? { ...d, status } : d));
  };

  const handleUpdateVehicle = (updatedVehicle: Vehicle) => {
    setVehicles(prev => prev.map(v => v.id === updatedVehicle.id ? updatedVehicle : v));
  };

  const handleAddVehicle = (newVehicle: Vehicle) => {
    setVehicles(prev => [...prev, newVehicle]);
  };

  const handleUpdateDriver = (updatedDriver: Driver) => {
    setDrivers(prev => prev.map(d => d.id === updatedDriver.id ? updatedDriver : d));
  };

  const handleAddDriver = (newDriver: Driver) => {
    setDrivers(prev => [...prev, newDriver]);
  };

  // Fleet Pulse Segment Status Counter counts
  const availableCount = vehicles.filter(v => v.status === 'available').length;
  const onTripCount = vehicles.filter(v => v.status === 'on_trip').length;
  const inShopCount = vehicles.filter(v => v.status === 'in_shop').length;
  const retiredCount = 1; // fixed baseline retired

  const totalPulseUnits = availableCount + onTripCount + inShopCount + retiredCount;

  // Percentage calculations for Pulse segmented bars
  const availPercent = totalPulseUnits > 0 ? (availableCount / totalPulseUnits) * 100 : 0;
  const transitPercent = totalPulseUnits > 0 ? (onTripCount / totalPulseUnits) * 100 : 0;
  const shopPercent = totalPulseUnits > 0 ? (inShopCount / totalPulseUnits) * 100 : 0;
  const retiredPercent = totalPulseUnits > 0 ? (retiredCount / totalPulseUnits) * 100 : 0;

  // Calculate initials from the user's email
  const getInitials = (email: string) => {
    if (!email) return 'U';
    const localPart = email.split('@')[0];
    const parts = localPart.split(/[._-]/);
    if (parts.length > 1) {
      const first = parts[0].charAt(0).toUpperCase();
      const second = parts[1].charAt(0).toUpperCase();
      if (/[A-Z]/.test(first) && /[A-Z]/.test(second)) {
        return first + second;
      }
      return first;
    }
    return localPart.substring(0, 2).toUpperCase() || 'U';
  };

  const initials = getInitials(userEmail);

  return (
    <div className={`min-h-screen w-full flex flex-col md:flex-row font-sans transition-all duration-350 ${
      theme === 'dark' ? 'bg-zinc-900 text-zinc-100' : 'bg-[#FAFAFA] text-zinc-800'
    }`}>
      
      {/* 1. SIDEBAR - White in light view, dark in dark view */}
      <aside className={`w-full md:w-64 flex flex-col justify-between border-r md:h-screen sticky top-0 z-40 transition-colors duration-350 ${
        theme === 'dark'
          ? 'bg-zinc-850 text-white border-zinc-800'
          : 'bg-white text-zinc-800 border-zinc-200'
      }`}>
        <div>
          {/* Logo Heading (TransitOps & Dispatcher badges removed as per request) */}
          <div className={`p-6 pb-4 border-b flex items-center gap-3 ${
            theme === 'dark' ? 'border-zinc-900' : 'border-zinc-100'
          }`}>
            <div>
              <span className={`font-sans font-[900] tracking-wider text-base ${
                theme === 'dark' ? 'text-white' : 'text-zinc-900'
              }`}>TRANSITOPS</span>
            </div>
          </div>

          {/* Navigation Links for Dispatcher */}
          <nav className="p-4 space-y-1.5">
            <button
              onClick={() => { setActiveScreen('dashboard'); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeScreen === 'dashboard'
                  ? 'bg-[#eb5e00] text-white shadow-md'
                  : theme === 'dark'
                    ? 'text-zinc-400 hover:text-white hover:bg-zinc-900/60'
                    : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100'
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>{t('dashboard')}</span>
            </button>

            {(userRole === 'dispatcher' || userRole === 'admin') && (
              <button
                onClick={() => { setActiveScreen('trips'); }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeScreen === 'trips'
                    ? 'bg-[#eb5e00] text-white shadow-md'
                    : theme === 'dark'
                      ? 'text-zinc-400 hover:text-white hover:bg-zinc-900/60'
                      : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100'
                }`}
              >
                <Map className="w-4 h-4" />
                <span>{t('trips')}</span>
              </button>
            )}

            {/* Fleet Page */}
            {(userRole === 'manager' || userRole === 'admin') && (
              <button
                onClick={() => { setActiveScreen('fleet'); }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeScreen === 'fleet'
                    ? 'bg-[#eb5e00] text-white shadow-md'
                    : theme === 'dark'
                      ? 'text-zinc-400 hover:text-white hover:bg-zinc-900/60'
                      : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100'
                }`}
              >
                <Truck className="w-4 h-4" />
                <span>{t('fleet')}</span>
              </button>
            )}

            {/* Drivers Page */}
            {(userRole === 'safety' || userRole === 'admin') && (
              <button
                onClick={() => { setActiveScreen('drivers'); }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeScreen === 'drivers'
                    ? 'bg-[#eb5e00] text-white shadow-md'
                    : theme === 'dark'
                      ? 'text-zinc-400 hover:text-white hover:bg-zinc-900/60'
                      : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100'
                }`}
              >
                <Users className="w-4 h-4" />
                <span>{t('drivers')}</span>
              </button>
            )}

            {/* Maintenance Page */}
            {(userRole === 'manager' || userRole === 'admin') && (
              <button
                onClick={() => { setActiveScreen('maintenance'); }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeScreen === 'maintenance'
                    ? 'bg-[#eb5e00] text-white shadow-md'
                    : theme === 'dark'
                      ? 'text-zinc-400 hover:text-white hover:bg-zinc-900/60'
                      : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100'
                }`}
              >
                <Wrench className="w-4 h-4" />
                <span>{t('maintenance')}</span>
              </button>
            )}

            {/* Fuel & Expenses */}
            {(userRole === 'finance' || userRole === 'admin') && (
              <button
                onClick={() => { setActiveScreen('fuel-expenses'); }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeScreen === 'fuel-expenses'
                    ? 'bg-[#eb5e00] text-white shadow-md'
                    : theme === 'dark'
                      ? 'text-zinc-400 hover:text-white hover:bg-zinc-900/60'
                      : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100'
                }`}
              >
                <Fuel className="w-4 h-4" />
                <span>{t('fuelExpenses')}</span>
              </button>
            )}

            {/* Analytics */}
            {(userRole === 'finance' || userRole === 'admin') && (
              <button
                onClick={() => { setActiveScreen('analytics'); }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeScreen === 'analytics'
                    ? 'bg-[#eb5e00] text-white shadow-md'
                    : theme === 'dark'
                      ? 'text-zinc-400 hover:text-white hover:bg-zinc-900/60'
                      : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100'
                }`}
              >
                <BarChart3 className="w-4 h-4" />
                <span>{t('analytics')}</span>
              </button>
            )}

            <button
              onClick={() => { setActiveScreen('settings'); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeScreen === 'settings'
                  ? 'bg-[#eb5e00] text-white shadow-md'
                  : theme === 'dark'
                    ? 'text-zinc-400 hover:text-white hover:bg-zinc-900/60'
                    : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100'
              }`}
            >
              <SettingsIcon className="w-4 h-4" />
              <span>{t('settings')}</span>
            </button>
          </nav>
        </div>

        {/* User context footer in Sidebar (Logout button removed from here, moved to settings screen) */}
        <div className={`p-4 border-t flex flex-col gap-3 ${
          theme === 'dark' ? 'bg-zinc-850 border-zinc-800' : 'bg-zinc-50/60 border-zinc-100'
        }`}>
          <div className="flex items-center gap-3 px-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-sans font-[900] text-xs ${
              theme === 'dark' ? 'bg-zinc-800 border border-zinc-700 text-[#eb5e00]' : 'bg-orange-50 border border-orange-100 text-[#eb5e00]'
            }`}>
              {initials}
            </div>
            <div className="truncate max-w-[140px]">
              <span className={`block text-xs font-[900] truncate ${theme === 'dark' ? 'text-zinc-200' : 'text-zinc-800'}`}>{userEmail}</span>
              <span className="block text-[10px] font-sans font-bold text-[#eb5e00] uppercase tracking-wider">
                {userRole === 'manager' ? t('managerRole') : userRole === 'dispatcher' ? t('dispatcherRole') : userRole === 'safety' ? t('safetyRole') : userRole === 'finance' ? t('financeRole') : t('adminRole')}
              </span>
            </div>
          </div>
        </div>
      </aside>

      {/* 2. MAIN CONTAINER AREA */}
      <main className="flex-1 flex flex-col md:h-screen md:overflow-y-auto">
        
        {/* Top bar with Search, Theme toggle, Avatar (Role badge removed as per request) */}
        <header className={`p-4 md:px-8 border-b flex flex-col sm:flex-row gap-4 items-stretch sm:items-center justify-between ${
          theme === 'dark' ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'
        }`}>
          {/* Left search */}
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder={t('searchPlaceholder')}
              className={`w-full pl-9 pr-4 py-2 rounded-xl text-xs outline-none border transition-all ${
                theme === 'dark'
                  ? 'bg-zinc-900 border-zinc-850 text-white focus:border-[#eb5e00]'
                  : 'bg-zinc-50 border-zinc-200 text-zinc-800 focus:border-[#eb5e00]'
              }`}
            />
          </div>

          {/* Right section widgets */}
          <div className="flex items-center gap-4 justify-between sm:justify-end">
            
            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              aria-label="Toggle visual theme"
              className={`p-2.5 rounded-full shadow-sm transition-all hover:scale-105 border cursor-pointer ${
                theme === 'dark' 
                  ? 'bg-zinc-900 border-zinc-850 text-[#eb5e00] hover:bg-zinc-800' 
                  : 'bg-zinc-50 border-zinc-200 text-[#eb5e00] hover:bg-zinc-150'
              }`}
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            {/* Micro avatar displaying users credentials initial as pure text */}
            <button
              onClick={() => setActiveScreen('settings')}
              title={t('settings')}
              className={`w-8 h-8 rounded-full flex items-center justify-center border font-sans font-bold text-xs cursor-pointer hover:scale-105 transition-all ${
                theme === 'dark' ? 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-800' : 'bg-zinc-100 border-zinc-200 text-zinc-700 hover:bg-zinc-150'
              }`}
            >
              {initials}
            </button>
          </div>
        </header>

        {/* FLEET PULSE STRIP (counts: orange shade hierarchy instead of multiple colors) */}
        <section className={`px-4 md:px-8 py-3 border-b flex flex-col md:flex-row gap-3 md:items-center justify-between ${
          theme === 'dark' ? 'bg-zinc-900/60 border-zinc-800' : 'bg-zinc-50 border-zinc-200'
        }`}>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-[#eb5e00]" />
            <span className="text-[10px] font-sans font-black text-zinc-400 uppercase tracking-wider">{t('statusOverview')}</span>
          </div>

          {/* Progress Segmented Bar (using shades of orange) */}
          <div className="flex-1 max-w-xl h-2 rounded-full overflow-hidden flex bg-zinc-200 dark:bg-zinc-800 mx-0 md:mx-4">
            <div style={{ width: `${availPercent}%` }} className="h-full bg-[#ff944d] transition-all duration-500" title={`${t('available')}: ${availableCount}`} />
            <div style={{ width: `${transitPercent}%` }} className="h-full bg-[#eb5e00] transition-all duration-500" title={`${t('onTrip')}: ${onTripCount}`} />
            <div style={{ width: `${shopPercent}%` }} className="h-full bg-[#ffd1b3] transition-all duration-500" title={`${t('inShop')}: ${inShopCount}`} />
            <div style={{ width: `${retiredPercent}%` }} className="h-full bg-zinc-300 dark:bg-zinc-700 transition-all duration-500" title={`${t('retired')}: ${retiredCount}`} />
          </div>

          {/* Counts metrics (pure orange and grayscale) */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] font-sans font-bold">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#ff944d]" />
              <span className="text-zinc-500">{t('available')}:</span>
              <span>{availableCount}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#eb5e00]" />
              <span className="text-zinc-500">{t('onTrip')}:</span>
              <span>{onTripCount}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#ffd1b3]" />
              <span className="text-zinc-500">{t('inShop')}:</span>
              <span>{inShopCount}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-zinc-300 dark:bg-zinc-700" />
              <span className="text-zinc-500">{t('retired')}:</span>
              <span>{retiredCount}</span>
            </div>
          </div>
        </section>

        {/* Dynamic Screen Area with standard margin layout */}
        <div className="p-4 md:p-8 flex-1">
          {activeScreen === 'dashboard' && (
            <Dashboard 
              theme={theme}
              trips={trips}
              vehicles={vehicles}
              drivers={drivers}
              onSelectTrip={(tripId) => {
                setSelectedTripId(tripId);
                setActiveScreen('trips');
              }}
              setScreen={(screen) => setActiveScreen(screen)}
            />
          )}

          {activeScreen === 'trips' && (
            <DispatcherTrips 
              theme={theme}
              trips={trips}
              vehicles={vehicles}
              drivers={drivers}
              selectedTripId={selectedTripId}
              onSelectTrip={(tripId) => setSelectedTripId(tripId)}
              onUpdateTrip={handleUpdateTrip}
              onAddTrip={handleAddTrip}
              onUpdateVehicleStatus={handleUpdateVehicleStatus}
              onUpdateDriverStatus={handleUpdateDriverStatus}
            />
          )}

          {activeScreen === 'fleet' && (
            <Fleet
              theme={theme}
              vehicles={vehicles}
              onAddVehicle={handleAddVehicle}
              onUpdateVehicle={handleUpdateVehicle}
              userRole={userRole}
            />
          )}

          {activeScreen === 'drivers' && (
            <Drivers
              theme={theme}
              drivers={drivers}
              onAddDriver={handleAddDriver}
              onUpdateDriver={handleUpdateDriver}
              userRole={userRole}
            />
          )}

          {activeScreen === 'maintenance' && (
            <Maintenance
              theme={theme}
              vehicles={vehicles}
              onUpdateVehicleStatus={handleUpdateVehicleStatus}
              userRole={userRole}
              language={language}
            />
          )}

          {activeScreen === 'fuel-expenses' && (
            <FuelExpenses
              theme={theme}
              vehicles={vehicles}
              userRole={userRole}
              language={language}
            />
          )}

          {activeScreen === 'analytics' && (
            <Analytics
              theme={theme}
              userRole={userRole}
              language={language}
            />
          )}

          {activeScreen === 'settings' && (
            <Settings 
              theme={theme}
              toggleTheme={toggleTheme}
              userEmail={userEmail}
              userRole={userRole}
              onLogout={onLogout}
            />
          )}
        </div>
      </main>

    </div>
  );
}
