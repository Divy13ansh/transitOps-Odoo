import React, { useState } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { Vehicle, VehicleType, VehicleStatus } from '../types';
import { Search, ChevronDown, Plus, Edit2, AlertCircle, Check, X, ShieldAlert } from 'lucide-react';
import Dropdown from './Dropdown';

interface DispatcherFleetProps {
  theme: 'light' | 'dark';
  vehicles: Vehicle[];
  onAddVehicle: (v: Vehicle) => void;
  onUpdateVehicle: (v: Vehicle) => void;
  userRole: string;
}

export default function DispatcherFleet({
  theme,
  vehicles,
  onAddVehicle,
  onUpdateVehicle,
  userRole
}: DispatcherFleetProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'All' | VehicleType>('All');
  const [statusFilter, setStatusFilter] = useState<'All' | VehicleStatus>('All');
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [formRegNo, setFormRegNo] = useState('');
  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState<VehicleType>('semi');
  const [formCapacity, setFormCapacity] = useState<number>(3000);
  const [formOdometer, setFormOdometer] = useState<number>(10000);
  const [formCost, setFormCost] = useState<number>(35000);
  const [formStatus, setFormStatus] = useState<VehicleStatus>('available');

  // Manual status override confirmation gate
  const [showOverrideConfirm, setShowOverrideConfirm] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<VehicleStatus | null>(null);

  const [errorMsg, setErrorMsg] = useState('');

  const { t } = useLanguage();

  // Enforce Fleet Manager role access
  const isAuthorized = userRole === 'manager' || userRole === 'admin';

  if (!isAuthorized) {
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

  // Handle open add / edit modal
  const openModal = (vehicle?: Vehicle) => {
    if (vehicle) {
      setEditingVehicle(vehicle);
      setFormRegNo(vehicle.id);
      setFormName(vehicle.name);
      setFormType(vehicle.type);
      setFormCapacity(vehicle.capacity);
      setFormOdometer(vehicle.currentOdometer);
      setFormCost((vehicle as any).acquisitionCost || 45000);
      setFormStatus(vehicle.status);
    } else {
      setEditingVehicle(null);
      setFormRegNo('');
      setFormName('');
      setFormType('semi');
      setFormCapacity(40000);
      setFormOdometer(0);
      setFormCost(65000);
      setFormStatus('available');
    }
    setErrorMsg('');
    setShowOverrideConfirm(false);
    setIsModalOpen(true);
  };

  // Adjust default capacity depending on selected truck type
  const handleTypeChange = (type: VehicleType) => {
    setFormType(type);
    if (type === 'semi') setFormCapacity(40000);
    else if (type === 'box') setFormCapacity(10000);
    else if (type === 'van') setFormCapacity(3000);
  };

  const handleStatusChangeAttempt = (status: VehicleStatus) => {
    // If vehicle is being edited and status changed from in_shop to available, prompt confirmation
    if (editingVehicle && editingVehicle.status === 'in_shop' && status === 'available') {
      setPendingStatus(status);
      setShowOverrideConfirm(true);
    } else {
      setFormStatus(status);
    }
  };

  const confirmStatusOverride = () => {
    if (pendingStatus) {
      setFormStatus(pendingStatus);
    }
    setShowOverrideConfirm(false);
    setPendingStatus(null);
  };

  // Submit Handler
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formRegNo.trim() || !formName.trim()) {
      setErrorMsg(t.requiredFieldsErr);
      return;
    }

    // Uniqueness checks
    const alreadyExists = vehicles.some(v => v.id.toLowerCase() === formRegNo.trim().toLowerCase() && (!editingVehicle || editingVehicle.id !== v.id));
    if (alreadyExists) {
      setErrorMsg(t.alreadyExistsErr.replace('{formRegNo}', formRegNo));
      return;
    }

    const payload: Vehicle & { acquisitionCost?: number } = {
      id: formRegNo.trim().toUpperCase(),
      name: formName.trim(),
      type: formType,
      status: formStatus,
      capacity: formCapacity,
      currentOdometer: formOdometer,
      acquisitionCost: formCost
    };

    if (editingVehicle) {
      onUpdateVehicle(payload);
    } else {
      onAddVehicle(payload);
    }
    setIsModalOpen(false);
  };

  // Filtering list
  const filteredVehicles = vehicles.filter(v => {
    const matchesSearch = v.id.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          v.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = typeFilter === 'All' || v.type === typeFilter;
    const matchesStatus = statusFilter === 'All' || v.status === statusFilter;
    return matchesSearch && matchesType && matchesStatus;
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
        <button
          onClick={() => openModal()}
          className="px-4 py-2.5 rounded-xl text-xs font-bold bg-[#eb5e00] hover:bg-[#d45500] text-white flex items-center justify-center gap-2 transition-all shadow-md self-start sm:self-center cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>{t('addVehicle')}</span>
        </button>
      </div>

      {/* Filter / Search Bar */}
      <div className={`p-4 rounded-xl border flex flex-col md:flex-row gap-4 items-center justify-between ${
        theme === 'dark' ? 'bg-zinc-900/20 border-zinc-900' : 'bg-white border-zinc-200 shadow-sm'
      }`}>
        {/* Search */}
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

        {/* Multi Filters wrapper */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-end">
          {/* Type dropdown */}
          <Dropdown
            theme={theme}
            value={typeFilter}
            onChange={(val) => setTypeFilter(val as any)}
            options={[
              { value: 'All', label: t('allTypes') },
              { value: 'semi', label: t('semi') },
              { value: 'box', label: t('box') },
              { value: 'van', label: t('van') }
            ]}
          />

          {/* Status dropdown */}
          <Dropdown
            theme={theme}
            value={statusFilter}
            onChange={(val) => setStatusFilter(val as any)}
            options={[
              { value: 'All', label: t('allStatuses') },
              { value: 'available', label: t('available') },
              { value: 'on_trip', label: t('onTrip') },
              { value: 'in_shop', label: t('inShop') }
            ]}
          />
        </div>
      </div>

      {/* Fleet Table (Scrolls on Tablet, stacked on Mobile) */}
      <div className={`rounded-xl border transition-all overflow-hidden ${
        theme === 'dark' ? 'bg-zinc-900/20 border-zinc-900' : 'bg-white border-zinc-200 shadow-sm'
      }`}>
        
        {/* Desktop & Tablet Table */}
        <div className="hidden sm:block overflow-x-auto scrollbar-none">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className={`border-b text-[10px] font-black uppercase tracking-wider ${
                theme === 'dark' ? 'bg-zinc-950/40 border-zinc-850 text-zinc-400' : 'bg-zinc-50 border-zinc-200 text-zinc-500'
              }`}>
                <th className="p-4 pl-5">{t('regNoHeader')}</th>
                <th className="p-4">{t('nameHeader')}</th>
                <th className="p-4">{t('typeHeader')}</th>
                <th className="p-4 text-right">{t('capacityHeader')}</th>
                <th className="p-4 text-right">{t('odometerHeader')}</th>
                <th className="p-4 text-right">{t('costHeader')}</th>
                <th className="p-4 text-center">{t('statusHeader')}</th>
                <th className="p-4 pr-5 text-right">{t('actionsHeader')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-150 dark:divide-zinc-850">
              {filteredVehicles.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-xs text-zinc-400 font-medium">
                    {t('noRecords')}
                  </td>
                </tr>
              ) : (
                filteredVehicles.map(v => {
                  const acqCost = (v as any).acquisitionCost || 45000;
                  return (
                    <tr key={v.id} className="text-xs hover:bg-zinc-50/30 dark:hover:bg-zinc-900/10 transition-colors">
                      <td className="p-4 pl-5 font-mono font-bold text-[#eb5e00]">{v.id}</td>
                      <td className="p-4 font-bold">{v.name}</td>
                      <td className="p-4 capitalize text-zinc-400 font-medium">
                        {v.type === 'semi' ? t('semi') : v.type === 'box' ? t('box') : t('van')}
                      </td>
                      <td className="p-4 text-right font-mono text-zinc-400">{v.capacity.toLocaleString()}</td>
                      <td className="p-4 text-right font-mono text-zinc-400">{v.currentOdometer.toLocaleString()}</td>
                      <td className="p-4 text-right font-mono text-zinc-400">₹{acqCost.toLocaleString()}</td>
                      <td className="p-4 text-center">
                        <span className={`inline-flex items-center px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider border ${
                          v.status === 'available'
                            ? 'bg-[#eb5e00]/10 border-[#eb5e00]/20 text-[#eb5e00]'
                            : v.status === 'on_trip'
                              ? 'bg-zinc-950 border-zinc-850 text-zinc-400'
                              : 'bg-zinc-500/10 border-zinc-500/15 text-zinc-400'
                        }`}>
                          {v.status === 'available' ? t('available') : v.status === 'on_trip' ? t('onTrip') : t('inShop')}
                        </span>
                      </td>
                      <td className="p-4 pr-5 text-right">
                        <button
                          onClick={() => openModal(v)}
                          className={`p-2 rounded-lg border transition-all cursor-pointer ${
                            theme === 'dark' 
                              ? 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-800' 
                              : 'bg-zinc-50 border-zinc-200 text-zinc-700 hover:bg-zinc-100'
                          }`}
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile View (Stacked Cards) */}
        <div className="block sm:hidden divide-y divide-zinc-150 dark:divide-zinc-850">
          {filteredVehicles.length === 0 ? (
            <div className="p-8 text-center text-xs text-zinc-400">
              {t('noRecords')}
            </div>
          ) : (
            filteredVehicles.map(v => {
              const acqCost = (v as any).acquisitionCost || 45000;
              return (
                <div key={v.id} className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-[#eb5e00]">{v.id}</span>
                    <span className={`inline-flex items-center px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-wider border ${
                      v.status === 'available'
                        ? 'bg-[#eb5e00]/10 border-[#eb5e00]/20 text-[#eb5e00]'
                        : v.status === 'on_trip'
                          ? 'bg-zinc-950 border-zinc-850 text-zinc-400'
                          : 'bg-zinc-500/10 border-zinc-500/15 text-zinc-400'
                    }`}>
                      {v.status === 'available' ? t('available') : v.status === 'on_trip' ? t('onTrip') : t('inShop')}
                    </span>
                  </div>
                  
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-zinc-400 font-sans">{t('nameHeader')}:</span>
                      <span className="font-bold">{v.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-400 font-sans">{t('typeHeader')}:</span>
                      <span className="capitalize">{v.type === 'semi' ? t('semi') : v.type === 'box' ? t('box') : t('van')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-400 font-sans">{t('capacityHeader')}:</span>
                      <span className="font-mono">{v.capacity.toLocaleString()} lbs</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-400 font-sans">{t('odometerHeader')}:</span>
                      <span className="font-mono">{v.currentOdometer.toLocaleString()} MI</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-400 font-sans">{t('costHeader')}:</span>
                      <span className="font-mono">₹{acqCost.toLocaleString()}</span>
                    </div>
                  </div>

                  <div className="flex justify-end pt-1">
                    <button
                      onClick={() => openModal(v)}
                      className={`px-3 py-1.5 rounded-lg border text-[11px] font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                        theme === 'dark' 
                          ? 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-800' 
                          : 'bg-zinc-50 border-zinc-200 text-zinc-700 hover:bg-zinc-100'
                      }`}
                    >
                      <Edit2 className="w-3 h-3" />
                      <span>{t('editVehicleBtn')}</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Modal - Add / Edit Vehicle */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Overlay */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-xs" onClick={() => setIsModalOpen(false)} />
          
          {/* Card */}
          <div className={`relative w-full max-w-md p-6 rounded-2xl border shadow-xl space-y-4 transition-all ${
            theme === 'dark' ? 'bg-zinc-950 border-zinc-900 text-white' : 'bg-white border-zinc-200 text-zinc-800'
          }`}>
            <div className="flex justify-between items-center pb-2 border-b border-zinc-100 dark:border-zinc-900">
              <h3 className="text-sm font-black uppercase tracking-wider font-sans text-[#eb5e00]">
                {editingVehicle ? t('modalEditSpec') : t('modalAddNew')}
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
              {/* Reg No */}
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-wider text-zinc-400 block">{t('formRegNo')}</label>
                <input
                  type="text"
                  placeholder="e.g. V-304"
                  value={formRegNo}
                  onChange={(e) => setFormRegNo(e.target.value)}
                  disabled={!!editingVehicle}
                  className={`w-full px-4 py-2 text-xs font-bold rounded-xl border outline-none transition-all ${
                    editingVehicle ? 'opacity-50 cursor-not-allowed bg-zinc-900/20' : ''
                  } ${
                    theme === 'dark' 
                      ? 'bg-zinc-900/50 border-zinc-800 text-zinc-200 focus:border-[#eb5e00]' 
                      : 'bg-zinc-50 border-zinc-200 text-zinc-700 focus:border-[#eb5e00]'
                  }`}
                />
              </div>

              {/* Name */}
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-wider text-zinc-400 block">{t('formFriendlyName')}</label>
                <input
                  type="text"
                  placeholder="e.g. Delivery Van #T-304"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className={`w-full px-4 py-2 text-xs font-bold rounded-xl border outline-none transition-all ${
                    theme === 'dark' 
                      ? 'bg-zinc-900/50 border-zinc-800 text-zinc-200 focus:border-[#eb5e00]' 
                      : 'bg-zinc-50 border-zinc-200 text-zinc-700 focus:border-[#eb5e00]'
                  }`}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Type */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-wider text-zinc-400 block">{t('formType')}</label>
                  <Dropdown
                    theme={theme}
                    value={formType}
                    onChange={(val) => handleTypeChange(val as VehicleType)}
                    options={[
                      { value: 'semi', label: t('semi') },
                      { value: 'box', label: t('box') },
                      { value: 'van', label: t('van') }
                    ]}
                    className="w-full"
                    buttonClassName="w-full"
                  />
                </div>

                {/* Capacity */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-wider text-zinc-400 block">{t('formMaxCapacity')}</label>
                  <input
                    type="number"
                    value={formCapacity}
                    onChange={(e) => setFormCapacity(Number(e.target.value))}
                    className={`w-full px-4 py-2 text-xs font-bold rounded-xl border outline-none transition-all ${
                      theme === 'dark' 
                        ? 'bg-zinc-900/50 border-zinc-800 text-zinc-200 focus:border-[#eb5e00]' 
                        : 'bg-zinc-50 border-zinc-200 text-zinc-700 focus:border-[#eb5e00]'
                    }`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Odometer */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-wider text-zinc-400 block">{t('formOdometer')}</label>
                  <input
                    type="number"
                    value={formOdometer}
                    onChange={(e) => setFormOdometer(Number(e.target.value))}
                    className={`w-full px-4 py-2 text-xs font-bold rounded-xl border outline-none transition-all ${
                      theme === 'dark' 
                        ? 'bg-zinc-900/50 border-zinc-800 text-zinc-200 focus:border-[#eb5e00]' 
                        : 'bg-zinc-50 border-zinc-200 text-zinc-700 focus:border-[#eb5e00]'
                    }`}
                  />
                </div>

                {/* Cost */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-wider text-zinc-400 block">{t('formCost')}</label>
                  <input
                    type="number"
                    value={formCost}
                    onChange={(e) => setFormCost(Number(e.target.value))}
                    className={`w-full px-4 py-2 text-xs font-bold rounded-xl border outline-none transition-all ${
                      theme === 'dark' 
                        ? 'bg-zinc-900/50 border-zinc-800 text-zinc-200 focus:border-[#eb5e00]' 
                        : 'bg-zinc-50 border-zinc-200 text-zinc-700 focus:border-[#eb5e00]'
                    }`}
                  />
                </div>
              </div>

              {/* Status with override warn */}
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-wider text-zinc-400 block">{t('formStatus')}</label>
                <Dropdown
                  theme={theme}
                  value={formStatus}
                  onChange={(val) => handleStatusChangeAttempt(val as VehicleStatus)}
                  options={[
                    { value: 'available', label: t('available') },
                    { value: 'in_shop', label: t('inShop') },
                    ...(editingVehicle?.status === 'on_trip' ? [{ value: 'on_trip', label: t('onTrip') }] : [])
                  ]}
                  className="w-full"
                  buttonClassName="w-full"
                />
              </div>

              {/* Double confirmation box */}
              {showOverrideConfirm && (
                <div className="p-3 bg-[#eb5e00]/10 border border-[#eb5e00]/20 rounded-xl space-y-2">
                  <p className="text-[10px] text-[#eb5e00] font-medium">
                    {t('formConfirmMaintenance')}
                  </p>
                  <div className="flex gap-2 justify-end">
                    <button
                      type="button"
                      onClick={() => { setShowOverrideConfirm(false); setPendingStatus(null); }}
                      className="px-2.5 py-1 text-[9px] font-bold rounded-lg border border-zinc-700 hover:bg-zinc-850 text-zinc-400"
                    >
                      {t('formCancel')}
                    </button>
                    <button
                      type="button"
                      onClick={confirmStatusOverride}
                      className="px-2.5 py-1 text-[9px] font-black bg-[#eb5e00] hover:bg-[#d45500] text-white rounded-lg"
                    >
                      {t('yesOverride')}
                    </button>
                  </div>
                </div>
              )}

              {/* Action buttons */}
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
