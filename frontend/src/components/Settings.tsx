import React, { useState } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { Sun, Moon, Globe, User, LogOut, ChevronDown, Shield, Database, MapPin, DollarSign, Ruler, ChevronRight } from 'lucide-react';
import Dropdown from './Dropdown';

interface DispatcherSettingsProps {
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  userEmail: string;
  userRole: string;
  onLogout: () => void;
}

const DEFAULT_RBAC = [
  { role: 'manager', label: 'Fleet Manager', permissions: { dashboard: 'view', trips: 'none', fleet: 'edit', drivers: 'view', maintenance: 'edit', fuelExpenses: 'none', analytics: 'view', settings: 'edit' } },
  { role: 'dispatcher', label: 'Dispatcher', permissions: { dashboard: 'view', trips: 'edit', fleet: 'none', drivers: 'none', maintenance: 'none', fuelExpenses: 'none', analytics: 'none', settings: 'none' } },
  { role: 'safety', label: 'Safety Officer', permissions: { dashboard: 'view', trips: 'none', fleet: 'none', drivers: 'edit', maintenance: 'none', fuelExpenses: 'none', analytics: 'none', settings: 'none' } },
  { role: 'finance', label: 'Financial Analyst', permissions: { dashboard: 'view', trips: 'none', fleet: 'none', drivers: 'none', maintenance: 'none', fuelExpenses: 'edit', analytics: 'edit', settings: 'none' } },
];

const MODULES = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'trips', label: 'Trips' },
  { key: 'fleet', label: 'Fleet' },
  { key: 'drivers', label: 'Drivers' },
  { key: 'maintenance', label: 'Maintenance' },
  { key: 'fuelExpenses', label: 'Fuel & Expenses' },
  { key: 'analytics', label: 'Analytics' },
  { key: 'settings', label: 'Settings' }
];

export default function DispatcherSettings({
  theme,
  toggleTheme,
  userEmail,
  userRole,
  onLogout
}: DispatcherSettingsProps) {
  const { language, setLanguage, t } = useLanguage();
  
  // RBAC state
  const [rbacMatrix, setRbacMatrix] = useState(DEFAULT_RBAC);
  const [expandedRoleMobile, setExpandedRoleMobile] = useState<string | null>(null);

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

  // Handle permission change
  const handlePermissionChange = (roleKey: string, moduleKey: string, newValue: string) => {
    setRbacMatrix(prev => prev.map(r => {
      if (r.role === roleKey) {
        return {
          ...r,
          permissions: {
            ...r.permissions,
            [moduleKey]: newValue
          }
        };
      }
      return r;
    }));
  };

  const isFleetManager = userRole === 'manager' || userRole === 'admin';

  return (
    <div className="w-full space-y-6">
      <div className="flex items-center gap-2 pb-2 border-b border-zinc-150 dark:border-zinc-850">
        <span className="text-xs font-black uppercase tracking-wider font-sans text-zinc-400">
          {t('settingsConsole')}
        </span>
      </div>

      {/* Profile Section */}
      <div className={`p-5 rounded-xl border transition-all ${
        theme === 'dark' ? 'bg-zinc-900/40 border-zinc-900' : 'bg-white border-zinc-200 shadow-sm'
      }`}>
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-[#eb5e00] text-white flex items-center justify-center font-bold text-lg">
            {initials}
          </div>
          <div>
            <h4 className="text-sm font-bold font-sans">{t('terminalSession')}</h4>
            <div className="flex flex-wrap items-center gap-2 mt-0.5">
              <span className="text-xs text-zinc-400">{userEmail || 'operator.ops@transitops.in'}</span>
              <span className="text-[10px] bg-[#eb5e00]/10 text-[#eb5e00] font-black tracking-wider uppercase px-2 py-0.5 rounded-md border border-[#eb5e00]/20">
                {userRole === 'manager' ? t('managerRole') : userRole === 'dispatcher' ? t('dispatcherRole') : userRole === 'safety' ? t('safetyRole') : userRole === 'finance' ? t('financeRole') : t('adminRole')}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Accessible Preferences */}
      <div className={`p-5 rounded-xl border transition-all space-y-5 ${
        theme === 'dark' ? 'bg-zinc-900/40 border-zinc-900' : 'bg-white border-zinc-200 shadow-sm'
      }`}>
        <h3 className="text-xs font-bold font-sans uppercase tracking-widest text-zinc-400 mb-2">
          {t('personalPrefs')}
        </h3>
        
        {/* Theme Toggle option */}
        <div className="flex items-center justify-between pb-3.5 border-b border-zinc-100 dark:border-zinc-900">
          <div className="flex items-center gap-3">
            {theme === 'dark' ? <Moon className="w-4 h-4 text-[#eb5e00]" /> : <Sun className="w-4 h-4 text-[#eb5e00]" />}
            <div>
              <span className="text-xs font-semibold block">{t('visualTheme')}</span>
              <span className="text-[10px] text-zinc-400">{t('switchTheme')}</span>
            </div>
          </div>

          <button
            onClick={toggleTheme}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
              theme === 'dark' 
                ? 'bg-zinc-900 border-zinc-800 text-white hover:bg-zinc-800' 
                : 'bg-zinc-50 border-zinc-250 text-zinc-800 hover:bg-zinc-100'
            }`}
          >
            {theme === 'dark' ? t('lightTheme') : t('darkTheme')}
          </button>
        </div>

        {/* Language selector option */}
        <div className="flex items-center justify-between pb-3.5 border-b border-zinc-100 dark:border-zinc-900">
          <div className="flex items-center gap-3">
            <Globe className="w-4 h-4 text-[#eb5e00]" />
            <div>
              <span className="text-xs font-semibold block">{t('terminalLang')}</span>
              <span className="text-[10px] text-zinc-400">{t('localeDesc')}</span>
            </div>
          </div>

          <Dropdown
            theme={theme}
            value={language}
            onChange={(val) => setLanguage(val as 'en' | 'hi')}
            options={[
              { value: 'en', label: 'English' },
              { value: 'hi', label: 'हिन्दी (Hindi)' }
            ]}
          />
        </div>

        {/* Terminate Session / Logout Button */}
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <LogOut className="w-4 h-4 text-[#eb5e00]" />
            <div>
              <span className="text-xs font-semibold block">{t('sessionTitle')}</span>
              <span className="text-[10px] text-zinc-400">{t('logoutDesc')}</span>
            </div>
          </div>

          <button
            onClick={onLogout}
            className="px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer bg-[#eb5e00] hover:bg-[#d45500] text-white shadow-sm flex items-center gap-2"
          >
            {t('logout')}
          </button>
        </div>
      </div>

      {/* Fleet Manager Only Section */}
      {isFleetManager && (
        <>
          {/* RBAC Matrix Section */}
          <div className={`p-5 rounded-xl border transition-all space-y-4 ${
            theme === 'dark' ? 'bg-zinc-900/40 border-zinc-900' : 'bg-white border-zinc-200 shadow-sm'
          }`}>
            <div className="flex items-center gap-2 mb-1">
              <Shield className="w-4 h-4 text-[#eb5e00]" />
              <div>
                <h3 className="text-xs font-bold font-sans uppercase tracking-widest text-zinc-400">
                  {t('rbacTitle')}
                </h3>
                <p className="text-[10px] text-zinc-400 mt-0.5">{t('rbacDesc')}</p>
              </div>
            </div>

            {/* Desktop / Tablet View (Table, Horizontally scrollable on tablet) */}
            <div className="hidden sm:block overflow-x-auto scrollbar-none border border-zinc-150 dark:border-zinc-850 rounded-xl">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className={`border-b text-[10px] font-black uppercase tracking-wider ${
                    theme === 'dark' ? 'bg-zinc-950/40 border-zinc-850 text-zinc-400' : 'bg-zinc-50 border-zinc-200 text-zinc-500'
                  }`}>
                    <th className="p-3.5 pl-4 font-sans font-black">Role / Module</th>
                    {MODULES.map(m => (
                      <th key={m.key} className="p-3.5 text-center font-sans font-black">{m.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-150 dark:divide-zinc-850">
                  {rbacMatrix.map(row => (
                    <tr 
                      key={row.role}
                      className={`text-xs hover:bg-zinc-50/40 dark:hover:bg-zinc-900/20 transition-all`}
                    >
                      <td className="p-3.5 pl-4 font-bold text-zinc-700 dark:text-zinc-200 font-sans">
                        {row.label}
                      </td>
                      {MODULES.map(m => {
                        const permValue = row.permissions[m.key as keyof typeof row.permissions] || 'none';
                        return (
                          <td key={m.key} className="p-2 text-center">
                            <Dropdown
                              theme={theme}
                              value={permValue}
                              onChange={(val) => handlePermissionChange(row.role, m.key, val)}
                              options={[
                                { value: 'none', label: 'None' },
                                { value: 'view', label: 'View' },
                                { value: 'edit', label: 'Edit' }
                              ]}
                              buttonClassName={`text-[10px] font-bold text-center px-2 py-1 pr-6 rounded-lg transition-all ${
                                permValue === 'edit'
                                  ? 'bg-[#eb5e00]/10 border-[#eb5e00]/30 text-[#eb5e00]'
                                  : permValue === 'view'
                                    ? 'bg-zinc-500/10 border-zinc-500/15 text-zinc-400'
                                    : 'bg-zinc-900 border-zinc-850 text-zinc-400 dark:text-zinc-500'
                              }`}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile View (Accordion format) */}
            <div className="block sm:hidden space-y-3">
              {rbacMatrix.map(row => {
                const isOpen = expandedRoleMobile === row.role;
                return (
                  <div 
                    key={row.role}
                    className={`rounded-xl border transition-all overflow-hidden ${
                      theme === 'dark' ? 'border-zinc-850 bg-zinc-950/20' : 'border-zinc-200 bg-zinc-50/50'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setExpandedRoleMobile(isOpen ? null : row.role)}
                      className="w-full p-4 flex items-center justify-between font-sans text-xs font-bold text-left"
                    >
                      <span>{row.label}</span>
                      <ChevronRight className={`w-4 h-4 text-zinc-400 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
                    </button>
                    {isOpen && (
                      <div className="p-4 pt-0 border-t border-zinc-150 dark:border-zinc-850 divide-y divide-zinc-100 dark:divide-zinc-900 text-xs">
                        {MODULES.map(m => {
                          const permValue = row.permissions[m.key as keyof typeof row.permissions] || 'none';
                          return (
                            <div key={m.key} className="py-2.5 flex items-center justify-between">
                              <span className="text-zinc-400 text-[11px] font-sans font-bold">{m.label}</span>
                              <Dropdown
                                theme={theme}
                                value={permValue}
                                onChange={(val) => handlePermissionChange(row.role, m.key, val)}
                                options={[
                                  { value: 'none', label: 'None' },
                                  { value: 'view', label: 'View' },
                                  { value: 'edit', label: 'Edit' }
                                ]}
                                buttonClassName={`text-[10px] font-bold px-3 py-1.5 pr-8 rounded-lg transition-all ${
                                  permValue === 'edit'
                                    ? 'bg-[#eb5e00]/10 border-[#eb5e00]/30 text-[#eb5e00]'
                                    : permValue === 'view'
                                      ? 'bg-zinc-500/10 border-zinc-500/15 text-zinc-400'
                                      : 'bg-zinc-900 border-zinc-850 text-zinc-400 dark:text-zinc-500'
                                }`}
                              />
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
