import React, { useState } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { Driver, DriverStatus } from '../types';
import { Search, ChevronDown, Plus, Edit2, AlertCircle, X, ShieldAlert, Star } from 'lucide-react';
import Dropdown from './Dropdown';

interface ExtendedDriver {
  id: string;
  name: string;
  licenseNo: string;
  category: string;
  expiry: string; // e.g. '2026-06-15'
  contact: string;
  tripCompliance: number; // e.g. 96 (%)
  safetyScore: number; // e.g. 92
  status: DriverStatus | 'suspended';
}

interface DispatcherDriversProps {
  theme: 'light' | 'dark';
  drivers: Driver[];
  onAddDriver: (d: Driver) => void;
  onUpdateDriver: (d: Driver) => void;
  userRole: string;
}

// Map standard Driver to ExtendedDriver with mock default values if missing
const extendDrivers = (rawDrivers: Driver[]): ExtendedDriver[] => {
  const mockLicenseData: Record<string, Partial<ExtendedDriver>> = {
    'D-01': { licenseNo: 'DL-90204A', category: 'Heavy Commercial', expiry: '2027-05-12', contact: '+91 98402 12053', tripCompliance: 98, safetyScore: 94 },
    'D-02': { licenseNo: 'DL-81530B', category: 'Heavy Commercial', expiry: '2026-03-10', contact: '+91 91204 88301', tripCompliance: 95, safetyScore: 88 },
    'D-03': { licenseNo: 'DL-74910C', category: 'Heavy Commercial', expiry: '2027-08-22', contact: '+91 97720 41042', tripCompliance: 92, safetyScore: 90 },
    'D-04': { licenseNo: 'DL-30129D', category: 'Medium Goods', expiry: '2026-05-01', contact: '+91 96541 32905', tripCompliance: 96, safetyScore: 91 },
    'D-05': { licenseNo: 'DL-11029E', category: 'Light Goods', expiry: '2027-11-30', contact: '+91 91102 94812', tripCompliance: 99, safetyScore: 97 },
    'D-06': { licenseNo: 'DL-88204F', category: 'Heavy Commercial', expiry: '2026-06-14', contact: '+91 98820 41410', tripCompliance: 90, safetyScore: 85 },
    'D-07': { licenseNo: 'DL-39501G', category: 'Medium Goods', expiry: '2027-01-20', contact: '+91 93950 12024', tripCompliance: 94, safetyScore: 89 },
    'D-08': { licenseNo: 'DL-72100H', category: 'Light Goods', expiry: '2026-02-15', contact: '+91 97210 03051', tripCompliance: 97, safetyScore: 95 }
  };

  return rawDrivers.map(d => {
    const extra = mockLicenseData[d.id] || {
      licenseNo: `DL-${Math.floor(10000 + Math.random() * 90000)}X`,
      category: 'Medium Goods',
      expiry: '2027-01-01',
      contact: '+91 90000 00000',
      tripCompliance: 95,
      safetyScore: 90
    };
    return {
      ...d,
      ...extra
    } as ExtendedDriver;
  });
};

export default function DispatcherDrivers({
  theme,
  drivers,
  onAddDriver,
  onUpdateDriver,
  userRole
}: DispatcherDriversProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | DriverStatus | 'suspended'>('All');
  
  // Expand states for Tablet Mode
  const [expandedDriverId, setExpandedDriverId] = useState<string | null>(null);

  // Modal / Form States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDriver, setEditingDriver] = useState<ExtendedDriver | null>(null);
  
  const [formName, setFormName] = useState('');
  const [formLicense, setFormLicense] = useState('');
  const [formCategory, setFormCategory] = useState('Heavy Commercial');
  const [formExpiry, setFormExpiry] = useState('');
  const [formContact, setFormContact] = useState('');
  const [formCompliance, setFormCompliance] = useState<number>(95);
  const [formSafetyScore, setFormSafetyScore] = useState<number>(90);
  const [formStatus, setFormStatus] = useState<DriverStatus | 'suspended'>('available');

  const [errorMsg, setErrorMsg] = useState('');

  const { t } = useLanguage();

  // Role Gate Enforcements:
  // Safety Officer: full CRUD. All other roles: no access.
  const hasWriteAccess = userRole === 'safety' || userRole === 'admin';
  const hasReadAccess = userRole === 'safety' || userRole === 'admin';

  if (!hasReadAccess) {
    return (
      <div className={`p-8 rounded-xl border text-center flex flex-col items-center justify-center min-h-[400px] ${
        theme === 'dark' ? 'bg-zinc-900/20 border-zinc-900' : 'bg-white border-zinc-200'
      }`}>
        <ShieldAlert className="w-12 h-12 text-[#eb5e00] mb-4" />
        <h3 className="text-sm font-bold font-sans uppercase tracking-wider mb-2">{t('accessLocked')}</h3>
        <p className="text-xs text-zinc-400 max-w-sm leading-relaxed">
          {t('accessLockedDesc')}
        </p>
      </div>
    );
  }

  // Extend data
  const extendedDriversList = extendDrivers(drivers);

  // Check if license is expired relative to current local time (2026-07-11)
  const isExpired = (dateStr: string) => {
    const today = new Date('2026-07-11');
    const expiryDate = new Date(dateStr);
    return expiryDate < today;
  };

  const openModal = (driver?: ExtendedDriver) => {
    if (!hasWriteAccess) return; // double guard

    if (driver) {
      setEditingDriver(driver);
      setFormName(driver.name);
      setFormLicense(driver.licenseNo);
      setFormCategory(driver.category);
      setFormExpiry(driver.expiry);
      setFormContact(driver.contact);
      setFormCompliance(driver.tripCompliance);
      setFormSafetyScore(driver.safetyScore);
      setFormStatus(driver.status);
    } else {
      setEditingDriver(null);
      setFormName('');
      setFormLicense('');
      setFormCategory('Heavy Commercial');
      setFormExpiry('2027-12-31');
      setFormContact('');
      setFormCompliance(100);
      setFormSafetyScore(95);
      setFormStatus('available');
    }
    setErrorMsg('');
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formLicense.trim() || !formExpiry.trim()) {
      setErrorMsg(t('requiredFieldsErr'));
      return;
    }

    const payload: ExtendedDriver = {
      id: editingDriver ? editingDriver.id : `D-${Math.floor(10 + Math.random() * 90)}`,
      name: formName.trim(),
      licenseNo: formLicense.trim().toUpperCase(),
      category: formCategory,
      expiry: formExpiry,
      contact: formContact.trim(),
      tripCompliance: formCompliance,
      safetyScore: formSafetyScore,
      status: formStatus
    };

    if (editingDriver) {
      onUpdateDriver(payload);
    } else {
      onAddDriver(payload);
    }
    setIsModalOpen(false);
  };

  const filteredDrivers = extendedDriversList.filter(d => {
    const matchesSearch = d.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          d.licenseNo.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'All' || d.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-sm font-black uppercase tracking-wider font-sans text-zinc-400">
            {t('title')}
          </h2>
        </div>
        {hasWriteAccess && (
          <button
            onClick={() => openModal()}
            className="px-4 py-2.5 rounded-xl text-xs font-bold bg-[#eb5e00] hover:bg-[#d45500] text-white flex items-center justify-center gap-2 transition-all shadow-md self-start sm:self-center cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{t('addOperator')}</span>
          </button>
        )}
      </div>

      {/* Search & Filter Bar */}
      <div className={`p-4 rounded-xl border flex flex-col md:flex-row gap-4 items-center justify-between ${
        theme === 'dark' ? 'bg-zinc-900/20 border-zinc-900' : 'bg-white border-zinc-200 shadow-sm'
      }`}>
        <div className="relative w-full md:w-80">
          <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder={t('searchPlaceholder')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={`w-full pl-9 pr-4 py-2 text-xs rounded-xl border outline-none transition-all ${
              theme === 'dark' 
                ? 'bg-zinc-950/40 border-zinc-850 text-white focus:border-[#eb5e00]' 
                : 'bg-zinc-50 border-zinc-200 text-zinc-800 focus:border-[#eb5e00]'
            }`}
          />
        </div>

        <Dropdown
          theme={theme}
          value={statusFilter}
          onChange={(val) => setStatusFilter(val as any)}
          options={[
            { value: 'All', label: t('allStatuses') },
            { value: 'available', label: t('available') },
            { value: 'on_trip', label: t('onTrip') },
            { value: 'off_duty', label: t('offDuty') },
            { value: 'suspended', label: t('suspended') }
          ]}
        />
      </div>

      {/* Registry Table */}
      <div className={`rounded-xl border transition-all overflow-hidden ${
        theme === 'dark' ? 'bg-zinc-900/20 border-zinc-900' : 'bg-white border-zinc-200 shadow-sm'
      }`}>
        
        {/* Desktop View */}
        <div className="hidden sm:block overflow-x-auto scrollbar-none">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className={`border-b text-[10px] font-black uppercase tracking-wider ${
                theme === 'dark' ? 'bg-zinc-950/40 border-zinc-850 text-zinc-400' : 'bg-zinc-50 border-zinc-200 text-zinc-500'
              }`}>
                <th className="p-4 pl-5">{t('nameHeader')}</th>
                <th className="p-4">{t('licenseHeader')}</th>
                <th className="p-4">{t('categoryHeader')}</th>
                <th className="p-4">{t('contactHeader')}</th>
                <th className="p-4 text-center">{t('performanceHeader')}</th>
                <th className="p-4 text-center">{t('safetyScoreHeader')}</th>
                <th className="p-4 text-center">{t('statusHeader')}</th>
                {hasWriteAccess && <th className="p-4 pr-5 text-right">{t('actionsHeader')}</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-150 dark:divide-zinc-850">
              {filteredDrivers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-xs text-zinc-400 font-medium">
                    {t('noRecords')}
                  </td>
                </tr>
              ) : (
                filteredDrivers.map(d => {
                  const expired = isExpired(d.expiry);
                  
                  return (
                    <tr key={d.id} className="text-xs hover:bg-zinc-50/30 dark:hover:bg-zinc-900/10 transition-colors">
                      <td className="p-4 pl-5">
                        <div className="font-bold">{d.name}</div>
                        <div className="text-[10px] text-zinc-400 font-mono mt-0.5">{d.id}</div>
                      </td>
                      <td className="p-4">
                        <div className="font-mono font-bold">{d.licenseNo}</div>
                        <div className={`text-[10px] flex items-center gap-1 font-bold mt-0.5 ${
                          expired ? 'text-[#eb5e00]' : 'text-zinc-400'
                        }`}>
                          <span>{t('formExpiry')}: {d.expiry}</span>
                          <span>•</span>
                          <span>{expired ? t('expired') : t('valid')}</span>
                        </div>
                      </td>
                      <td className="p-4 text-zinc-400 font-medium">
                        {d.category === 'Heavy Commercial' ? t('heavyCommercial') : d.category === 'Medium Goods' ? t('mediumGoods') : t('lightGoods')}
                      </td>
                      <td className="p-4 font-mono text-zinc-400">{d.contact}</td>
                      
                      {/* Performance */}
                      <td className="p-4 text-center font-mono">
                        <span className="font-bold">{d.tripCompliance}%</span>
                      </td>

                      {/* Safety */}
                      <td className="p-4 text-center font-mono">
                        <div className="flex items-center justify-center gap-1">
                          <Star className="w-3 h-3 text-[#eb5e00] fill-[#eb5e00]" />
                          <span className="font-bold">{d.safetyScore}</span>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="p-4 text-center">
                        <span className={`inline-flex items-center px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider border ${
                          d.status === 'available'
                            ? 'bg-[#eb5e00]/10 border-[#eb5e00]/20 text-[#eb5e00]'
                            : d.status === 'on_trip'
                              ? 'bg-zinc-950 border-zinc-850 text-zinc-400'
                              : d.status === 'off_duty'
                                ? 'bg-zinc-500/10 border-zinc-500/15 text-zinc-400'
                                : 'bg-zinc-900 border-zinc-800 text-zinc-300 font-bold'
                        }`}>
                          {d.status === 'available' ? t('available') : d.status === 'on_trip' ? t('onTrip') : d.status === 'off_duty' ? t('offDuty') : t('suspended')}
                        </span>
                      </td>

                      {/* Actions */}
                      {hasWriteAccess && (
                        <td className="p-4 pr-5 text-right">
                          <button
                            onClick={() => openModal(d)}
                            className={`p-2 rounded-lg border transition-all cursor-pointer ${
                              theme === 'dark' 
                                ? 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-800' 
                                : 'bg-zinc-50 border-zinc-200 text-zinc-700 hover:bg-zinc-100'
                            }`}
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile View */}
        <div className="block sm:hidden divide-y divide-zinc-150 dark:divide-zinc-850">
          {filteredDrivers.length === 0 ? (
            <div className="p-8 text-center text-xs text-zinc-400">
              {t('noRecords')}
            </div>
          ) : (
            filteredDrivers.map(d => {
              const expired = isExpired(d.expiry);
              
              return (
                <div key={d.id} className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-bold text-sm block">{d.name}</span>
                      <span className="font-mono text-[10px] text-zinc-400">{d.id}</span>
                    </div>
                    <span className={`inline-flex items-center px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-wider border ${
                      d.status === 'available'
                        ? 'bg-[#eb5e00]/10 border-[#eb5e00]/20 text-[#eb5e00]'
                        : d.status === 'on_trip'
                          ? 'bg-zinc-950 border-zinc-850 text-zinc-400'
                          : d.status === 'off_duty'
                            ? 'bg-zinc-500/10 border-zinc-500/15 text-zinc-400'
                            : 'bg-zinc-900 border-zinc-800 text-zinc-300 font-bold'
                    }`}>
                      {d.status === 'available' ? t('available') : d.status === 'on_trip' ? t('onTrip') : d.status === 'off_duty' ? t('offDuty') : t('suspended')}
                    </span>
                  </div>

                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-zinc-400">{t('licenseHeader')}:</span>
                      <span className="font-mono">{d.licenseNo}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-400">{t('formExpiry')}:</span>
                      <span className={expired ? 'text-[#eb5e00] font-bold' : 'text-zinc-300'}>{d.expiry}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-400">{t('categoryHeader')}:</span>
                      <span>{d.category === 'Heavy Commercial' ? t('heavyCommercial') : d.category === 'Medium Goods' ? t('mediumGoods') : t('lightGoods')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-400">{t('contactHeader')}:</span>
                      <span className="font-mono">{d.contact}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-400">{t('performanceHeader')}:</span>
                      <span className="font-mono font-bold">{d.tripCompliance}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-400">{t('safetyScoreHeader')}:</span>
                      <span className="font-mono font-bold flex items-center gap-1">
                        <Star className="w-2.5 h-2.5 text-[#eb5e00] fill-[#eb5e00]" />
                        {d.safetyScore}
                      </span>
                    </div>
                  </div>

                  {hasWriteAccess && (
                    <div className="flex justify-end pt-1">
                      <button
                        onClick={() => openModal(d)}
                        className={`px-3 py-1.5 rounded-lg border text-[11px] font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                          theme === 'dark' 
                            ? 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-800' 
                            : 'bg-zinc-50 border-zinc-200 text-zinc-700 hover:bg-zinc-100'
                        }`}
                      >
                        <Edit2 className="w-3 h-3" />
                        <span>{t('modalEditSpec')}</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Modal - Add / Edit Operator */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-xs" onClick={() => setIsModalOpen(false)} />
          
          <div className={`relative w-full max-w-md p-6 rounded-2xl border shadow-xl space-y-4 transition-all ${
            theme === 'dark' ? 'bg-zinc-950 border-zinc-900 text-white' : 'bg-white border-zinc-200 text-zinc-800'
          }`}>
            <div className="flex justify-between items-center pb-2 border-b border-zinc-100 dark:border-zinc-900">
              <h3 className="text-sm font-black uppercase tracking-wider font-sans text-[#eb5e00]">
                {editingDriver ? t('modalEditSpec') : t('modalAddNew')}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-zinc-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            {errorMsg && (
              <div className="p-3 text-[11px] text-[#eb5e00] border border-[#eb5e00]/20 rounded-xl bg-[#eb5e00]/5 flex items-start gap-1.5">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              {/* Name */}
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-wider text-zinc-400 block">{t('formName')}</label>
                <input
                  type="text"
                  placeholder="e.g. Ramesh Kumar"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className={`w-full px-4 py-2 text-xs font-bold rounded-xl border outline-none transition-all ${
                    theme === 'dark' 
                      ? 'bg-zinc-900/50 border-zinc-800 text-zinc-200 focus:border-[#eb5e00]' 
                      : 'bg-zinc-50 border-zinc-200 text-zinc-700 focus:border-[#eb5e00]'
                  }`}
                />
              </div>

              {/* DL No & Expiry */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-wider text-zinc-400 block">{t('formLicense')}</label>
                  <input
                    type="text"
                    placeholder="e.g. DL-90204A"
                    value={formLicense}
                    onChange={(e) => setFormLicense(e.target.value)}
                    className={`w-full px-4 py-2 text-xs font-bold rounded-xl border outline-none transition-all ${
                      theme === 'dark' 
                        ? 'bg-zinc-900/50 border-zinc-800 text-zinc-200 focus:border-[#eb5e00]' 
                        : 'bg-zinc-50 border-zinc-200 text-zinc-700 focus:border-[#eb5e00]'
                    }`}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-wider text-zinc-400 block">{t('formExpiry')}</label>
                  <input
                    type="date"
                    value={formExpiry}
                    onChange={(e) => setFormExpiry(e.target.value)}
                    className={`w-full px-4 py-2 text-xs font-bold rounded-xl border outline-none transition-all ${
                      theme === 'dark' 
                        ? 'bg-zinc-900/50 border-zinc-800 text-zinc-200 focus:border-[#eb5e00]' 
                        : 'bg-zinc-50 border-zinc-200 text-zinc-700 focus:border-[#eb5e00]'
                    }`}
                  />
                </div>
              </div>

              {/* Category & Contact */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-wider text-zinc-400 block">{t('formCategory')}</label>
                  <Dropdown
                    theme={theme}
                    value={formCategory}
                    onChange={setFormCategory}
                    options={[
                      { value: 'Heavy Commercial', label: t('heavyCommercial') },
                      { value: 'Medium Goods', label: t('mediumGoods') },
                      { value: 'Light Goods', label: t('lightGoods') }
                    ]}
                    className="w-full"
                    buttonClassName="w-full"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-wider text-zinc-400 block">{t('formContact')}</label>
                  <input
                    type="text"
                    placeholder="e.g. +91 97210 03051"
                    value={formContact}
                    onChange={(e) => setFormContact(e.target.value)}
                    className={`w-full px-4 py-2 text-xs font-bold rounded-xl border outline-none transition-all ${
                      theme === 'dark' 
                        ? 'bg-zinc-900/50 border-zinc-800 text-zinc-200 focus:border-[#eb5e00]' 
                        : 'bg-zinc-50 border-zinc-200 text-zinc-700 focus:border-[#eb5e00]'
                    }`}
                  />
                </div>
              </div>

              {/* Compliance & Safety score (editable numeric) */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-wider text-zinc-400 block">{t('formCompliance')}</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={formCompliance}
                    onChange={(e) => setFormCompliance(Number(e.target.value))}
                    className={`w-full px-4 py-2 text-xs font-bold rounded-xl border outline-none transition-all ${
                      theme === 'dark' 
                        ? 'bg-zinc-900/50 border-zinc-800 text-zinc-200 focus:border-[#eb5e00]' 
                        : 'bg-zinc-50 border-zinc-200 text-zinc-700 focus:border-[#eb5e00]'
                    }`}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-wider text-zinc-400 block">{t('formSafetyScore')}</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={formSafetyScore}
                    onChange={(e) => setFormSafetyScore(Number(e.target.value))}
                    className={`w-full px-4 py-2 text-xs font-bold rounded-xl border outline-none transition-all ${
                      theme === 'dark' 
                        ? 'bg-zinc-900/50 border-zinc-800 text-zinc-200 focus:border-[#eb5e00]' 
                        : 'bg-zinc-50 border-zinc-200 text-zinc-700 focus:border-[#eb5e00]'
                    }`}
                  />
                </div>
              </div>

              {/* Status Selector (Including Suspended option) */}
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-wider text-zinc-400 block">{t('formStatus')}</label>
                <Dropdown
                  theme={theme}
                  value={formStatus}
                  onChange={setFormStatus}
                  options={[
                    { value: 'available', label: t('available') },
                    { value: 'on_trip', label: t('onTrip') },
                    { value: 'off_duty', label: t('offDuty') },
                    { value: 'suspended', label: t('suspended') }
                  ]}
                  className="w-full"
                  buttonClassName="w-full"
                />
              </div>

              {/* Form buttons */}
              <div className="flex items-center gap-3 pt-3 justify-end border-t border-zinc-150 dark:border-zinc-850">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                    theme === 'dark'
                      ? 'bg-zinc-900 border-zinc-800 text-white hover:bg-zinc-800'
                      : 'bg-zinc-50 border-zinc-200 text-zinc-800 hover:bg-zinc-100'
                  }`}
                >
                  {t('formCancel')}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-black bg-[#eb5e00] hover:bg-[#d45500] text-white transition-all cursor-pointer shadow-md"
                >
                  {t('formSave')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
