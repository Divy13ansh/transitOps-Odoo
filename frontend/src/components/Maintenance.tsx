import React, { useState } from 'react';
import { Vehicle, VehicleStatus } from '../types';
import { ChevronDown, AlertCircle, ShieldAlert, Wrench, CheckCircle } from 'lucide-react';
import Dropdown from './Dropdown';

interface MaintenanceRecord {
  id: string;
  vehicleId: string;
  serviceType: string;
  cost: number;
  date: string;
  status: 'active' | 'closed';
}

interface DispatcherMaintenanceProps {
  theme: 'light' | 'dark';
  vehicles: Vehicle[];
  onUpdateVehicleStatus: (vehicleId: string, status: VehicleStatus) => void;
  userRole: string;
  language?: 'en' | 'hi';
}

const INITIAL_RECORDS: MaintenanceRecord[] = [
  { id: 'M-101', vehicleId: 'V-103', serviceType: 'Engine Overhaul', cost: 18450, date: '2026-07-09', status: 'active' },
  { id: 'M-102', vehicleId: 'V-102', serviceType: 'Brake Pad Replacement', cost: 4200, date: '2026-06-25', status: 'closed' },
  { id: 'M-103', vehicleId: 'V-201', serviceType: 'Tire Rotation & Alignment', cost: 2800, date: '2026-07-02', status: 'closed' }
];

const TRANSLATIONS = {
  en: {
    accessLocked: "ACCESS LOCKED",
    accessLockedDesc: "The Fleet Maintenance module requires Fleet Manager authorization. Please switch sessions to proceed.",
    title: "Maintenance & Service Log",
    subtitle: "Active maintenance → vehicle status auto-changes to In Shop · Closing maintenance → reverts to Available",
    logTitle: "Log Service Record",
    selectVehicle: "Select Vehicle",
    serviceTypeLbl: "Service Type / details",
    serviceCostLbl: "Service Cost (₹)",
    serviceDateLbl: "Service Date",
    recordStatusLbl: "Record Status",
    activeInShop: "Active (Vehicle In Shop)",
    closedReverted: "Closed (Vehicle Reverted)",
    addRecordBtn: "Add Record",
    logIdHeader: "Log ID",
    vehicleHeader: "Vehicle",
    detailsHeader: "Service Details",
    costHeader: "Cost (₹)",
    dateHeader: "Service Date",
    statusHeader: "Status",
    actionsHeader: "Actions",
    activeShop: "Active / Shop",
    closedResolved: "Closed / Resolved",
    editDetails: "Edit Details",
    closeLog: "Close Log",
    saveBtn: "Save",
    cancelBtn: "Cancel",
    resolveBtn: "Resolve & Open Vehicle",
    noRecords: "No active or historic service logs.",
    selectVehicleErr: "Please select a valid vehicle.",
    specifyServiceErr: "Please specify service type details."
  },
  hi: {
    accessLocked: "पहुंच अवरुद्ध",
    accessLockedDesc: "बेड़ा रखरखाव मॉड्यूल के लिए बेड़ा प्रबंधक प्राधिकरण की आवश्यकता होती है। आगे बढ़ने के लिए कृपया सत्र बदलें।",
    title: "रखरखाव और सेवा लॉग",
    subtitle: "सक्रिय रखरखाव → वाहन की स्थिति स्वचालित रूप से 'दुकान में' में बदल जाती है · रखरखाव बंद करना → 'उपलब्ध' पर वापस आ जाता है",
    logTitle: "सेवा रिकॉर्ड लॉग करें",
    selectVehicle: "वाहन का चयन करें",
    serviceTypeLbl: "सेवा प्रकार / विवरण",
    serviceCostLbl: "सेवा लागत (₹)",
    serviceDateLbl: "सेवा तिथि",
    recordStatusLbl: "रिकॉर्ड स्थिति",
    activeInShop: "सक्रिय (वाहन दुकान में है)",
    closedReverted: "बंद (वाहन वापस आ गया)",
    addRecordBtn: "रिकॉर्ड जोड़ें",
    logIdHeader: "लॉग आईडी",
    vehicleHeader: "वाहन",
    detailsHeader: "सेवा विवरण",
    costHeader: "लागत (₹)",
    dateHeader: "सेवा तिथि",
    statusHeader: "स्थिति",
    actionsHeader: "कार्रवाई",
    activeShop: "सक्रिय / दुकान",
    closedResolved: "बंद / हल किया गया",
    editDetails: "विवरण संपादित करें",
    closeLog: "लॉग बंद करें",
    saveBtn: "सहेजें",
    cancelBtn: "रद्द करें",
    resolveBtn: "हल करें और वाहन खोलें",
    noRecords: "कोई सक्रिय या ऐतिहासिक सेवा लॉग नहीं है।",
    selectVehicleErr: "कृपया एक मान्य वाहन का चयन करें।",
    specifyServiceErr: "कृपया सेवा प्रकार के विवरण निर्दिष्ट करें।"
  }
};

export default function DispatcherMaintenance({
  theme,
  vehicles,
  onUpdateVehicleStatus,
  userRole,
  language = 'en'
}: DispatcherMaintenanceProps) {
  const [records, setRecords] = useState<MaintenanceRecord[]>(INITIAL_RECORDS);

  // Form States
  const [selectedVehicleId, setSelectedVehicleId] = useState(vehicles[0]?.id || '');
  const [serviceType, setServiceType] = useState('Routine Inspection');
  const [cost, setCost] = useState<number>(1500);
  const [date, setDate] = useState('2026-07-11');
  const [status, setStatus] = useState<'active' | 'closed'>('active');

  // Edit states for cost & date on open/active records
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [editCost, setEditCost] = useState<number>(0);
  const [editDate, setEditDate] = useState('');

  const [errorMsg, setErrorMsg] = useState('');

  const t = TRANSLATIONS[language];

  // Role Access: Fleet Manager (full CRUD). All other roles: no access.
  const isAuthorized = userRole === 'manager' || userRole === 'admin';

  if (!isAuthorized) {
    return (
      <div className={`p-8 rounded-xl border text-center flex flex-col items-center justify-center min-h-[400px] ${
        theme === 'dark' ? 'bg-zinc-900/20 border-zinc-900' : 'bg-white border-zinc-200'
      }`}>
        <ShieldAlert className="w-12 h-12 text-[#eb5e00] mb-4" />
        <h3 className="text-sm font-bold font-sans uppercase tracking-wider mb-2">{t.accessLocked}</h3>
        <p className="text-xs text-zinc-400 max-w-sm leading-relaxed">
          {t.accessLockedDesc}
        </p>
      </div>
    );
  }

  // Log Service record
  const handleAddRecord = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVehicleId) {
      setErrorMsg(t.selectVehicleErr);
      return;
    }
    if (!serviceType.trim()) {
      setErrorMsg(t.specifyServiceErr);
      return;
    }

    const newRecord: MaintenanceRecord = {
      id: `M-${Math.floor(104 + Math.random() * 900)}`,
      vehicleId: selectedVehicleId,
      serviceType: serviceType.trim(),
      cost: Number(cost),
      date: date,
      status: status
    };

    setRecords(prev => [newRecord, ...prev]);

    // Triggers auto-change on vehicle status
    if (status === 'active') {
      onUpdateVehicleStatus(selectedVehicleId, 'in_shop');
    }

    // Reset fields
    setServiceType('Routine Inspection');
    setCost(1500);
    setErrorMsg('');
  };

  // Close service record → reverts vehicle status to Available
  const handleCloseRecord = (recordId: string) => {
    const record = records.find(r => r.id === recordId);
    if (!record) return;

    setRecords(prev => prev.map(r => r.id === recordId ? { ...r, status: 'closed' as const } : r));
    
    // revert vehicle status
    onUpdateVehicleStatus(record.vehicleId, 'available');
  };

  // Edit service records
  const startEditing = (rec: MaintenanceRecord) => {
    setEditingRecordId(rec.id);
    setEditCost(rec.cost);
    setEditDate(rec.date);
  };

  const saveEdit = (recId: string) => {
    setRecords(prev => prev.map(r => r.id === recId ? { ...r, cost: editCost, date: editDate } : r));
    setEditingRecordId(null);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h2 className="text-sm font-black uppercase tracking-wider font-sans text-zinc-400">
          {t.title}
        </h2>
      </div>

      {/* Main Grid Content (Left Form, Right Service list table) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Service logging form */}
        <div className={`lg:col-span-4 p-5 rounded-xl border space-y-4 ${
          theme === 'dark' ? 'bg-zinc-900/40 border-zinc-900' : 'bg-white border-zinc-200 shadow-sm'
        }`}>
          <div className="flex items-center gap-2 pb-2 border-b border-zinc-150 dark:border-zinc-850">
            <Wrench className="w-4 h-4 text-[#eb5e00]" />
            <h3 className="text-xs font-black uppercase tracking-wider font-sans text-zinc-400">
              {t.logTitle}
            </h3>
          </div>

          {errorMsg && (
            <div className="p-3 text-[11px] text-[#eb5e00] border border-[#eb5e00]/20 rounded-xl bg-[#eb5e00]/5 flex items-start gap-1.5">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleAddRecord} className="space-y-4 text-xs">
            {/* Vehicle Selector */}
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-wider text-zinc-400 block">{t.selectVehicle}</label>
              <Dropdown
                theme={theme}
                value={selectedVehicleId}
                onChange={setSelectedVehicleId}
                options={vehicles.map(v => ({
                  value: v.id,
                  label: `${v.id} - ${v.name} (${v.status})`
                }))}
                className="w-full"
                buttonClassName="w-full"
              />
            </div>

            {/* Service Type */}
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-wider text-zinc-400 block">{t.serviceTypeLbl}</label>
              <input
                type="text"
                placeholder="e.g. Engine Overhaul, Brake replacement..."
                value={serviceType}
                onChange={(e) => setServiceType(e.target.value)}
                className={`w-full px-4 py-2 text-xs font-bold rounded-xl border outline-none transition-all ${
                  theme === 'dark' 
                    ? 'bg-zinc-900/50 border-zinc-800 text-zinc-200 focus:border-[#eb5e00]' 
                    : 'bg-zinc-50 border-zinc-200 text-zinc-700 focus:border-[#eb5e00]'
                }`}
              />
            </div>

            {/* Cost and Date */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-wider text-zinc-400 block">{t.serviceCostLbl}</label>
                <input
                  type="number"
                  value={cost}
                  onChange={(e) => setCost(Number(e.target.value))}
                  className={`w-full px-4 py-2 text-xs font-bold rounded-xl border outline-none transition-all ${
                    theme === 'dark' 
                      ? 'bg-zinc-900/50 border-zinc-800 text-zinc-200 focus:border-[#eb5e00]' 
                      : 'bg-zinc-50 border-zinc-200 text-zinc-700 focus:border-[#eb5e00]'
                  }`}
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-wider text-zinc-400 block">{t.serviceDateLbl}</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className={`w-full px-4 py-2 text-xs font-bold rounded-xl border outline-none transition-all ${
                    theme === 'dark' 
                      ? 'bg-zinc-900/50 border-zinc-800 text-zinc-200 focus:border-[#eb5e00]' 
                      : 'bg-zinc-50 border-zinc-200 text-zinc-700 focus:border-[#eb5e00]'
                  }`}
                />
              </div>
            </div>

            {/* Status */}
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-wider text-zinc-400 block">{t.recordStatusLbl}</label>
              <Dropdown
                theme={theme}
                value={status}
                onChange={(val) => setStatus(val as any)}
                options={[
                  { value: 'active', label: t.activeInShop },
                  { value: 'closed', label: t.closedReverted }
                ]}
                className="w-full"
                buttonClassName="w-full"
              />
            </div>

            <button
              type="submit"
              className="w-full py-3 px-4 rounded-xl font-black bg-[#eb5e00] hover:bg-[#d45500] text-white transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>{t.addRecordBtn}</span>
            </button>
          </form>
        </div>

        {/* Right Service Logs table */}
        <div className={`lg:col-span-8 rounded-xl border overflow-hidden ${
          theme === 'dark' ? 'bg-zinc-900/20 border-zinc-900' : 'bg-white border-zinc-200 shadow-sm'
        }`}>
          {/* Table view (Tablet/Desktop scrolls horizontally) */}
          <div className="hidden sm:block overflow-x-auto scrollbar-none">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className={`border-b text-[10px] font-black uppercase tracking-wider ${
                  theme === 'dark' ? 'bg-zinc-950/40 border-zinc-850 text-zinc-400' : 'bg-zinc-50 border-zinc-200 text-zinc-500'
                }`}>
                  <th className="p-4 pl-5">{t.logIdHeader}</th>
                  <th className="p-4">{t.vehicleHeader}</th>
                  <th className="p-4">{t.detailsHeader}</th>
                  <th className="p-4 text-right">{t.costHeader}</th>
                  <th className="p-4">{t.dateHeader}</th>
                  <th className="p-4 text-center">{t.statusHeader}</th>
                  <th className="p-4 pr-5 text-right">{t.actionsHeader}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-150 dark:divide-zinc-850 text-xs">
                {records.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-zinc-400">{t.noRecords}</td>
                  </tr>
                ) : (
                  records.map(r => {
                    const isEditing = editingRecordId === r.id;
                    return (
                      <tr key={r.id} className="hover:bg-zinc-50/20 dark:hover:bg-zinc-900/10 transition-colors">
                        <td className="p-4 pl-5 font-mono font-bold text-[#eb5e00]">{r.id}</td>
                        <td className="p-4 font-bold text-[#eb5e00] font-mono">{r.vehicleId}</td>
                        <td className="p-4 font-bold">{r.serviceType}</td>
                        
                        <td className="p-4 text-right font-mono font-semibold">
                          {isEditing ? (
                            <input
                              type="number"
                              value={editCost}
                              onChange={(e) => setEditCost(Number(e.target.value))}
                              className={`w-24 px-2 py-1 text-right text-xs rounded-lg border outline-none ${
                                theme === 'dark' ? 'bg-zinc-900 border-zinc-800' : 'bg-zinc-50 border-zinc-200'
                              }`}
                            />
                          ) : (
                            `₹${r.cost.toLocaleString()}`
                          )}
                        </td>

                        <td className="p-4 font-mono font-semibold">
                          {isEditing ? (
                            <input
                              type="date"
                              value={editDate}
                              onChange={(e) => setEditDate(e.target.value)}
                              className={`px-2 py-1 text-xs rounded-lg border outline-none ${
                                theme === 'dark' ? 'bg-zinc-900 border-zinc-800' : 'bg-zinc-50 border-zinc-200'
                              }`}
                            />
                          ) : (
                            r.date
                          )}
                        </td>

                        <td className="p-4 text-center">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider border ${
                            r.status === 'active'
                              ? 'bg-[#eb5e00]/10 border-[#eb5e00]/20 text-[#eb5e00]'
                              : 'bg-zinc-500/10 border-zinc-500/15 text-zinc-400'
                          }`}>
                            {r.status === 'active' ? t.activeShop : t.closedResolved}
                          </span>
                        </td>

                        <td className="p-4 pr-5 text-right">
                          <div className="flex gap-2 justify-end">
                            {isEditing ? (
                              <>
                                <button
                                  onClick={() => saveEdit(r.id)}
                                  className="px-2.5 py-1.5 bg-[#eb5e00] hover:bg-[#d45500] text-white rounded-lg text-[10px] font-black cursor-pointer"
                                >
                                  {t.saveBtn}
                                </button>
                                <button
                                  onClick={() => setEditingRecordId(null)}
                                  className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold border ${
                                    theme === 'dark' ? 'bg-zinc-900 border-zinc-800' : 'bg-zinc-50 border-zinc-200'
                                  }`}
                                >
                                  {t.cancelBtn}
                                </button>
                              </>
                            ) : (
                              <>
                                {r.status === 'active' && (
                                  <>
                                    <button
                                      onClick={() => startEditing(r)}
                                      className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold border transition-all ${
                                        theme === 'dark' 
                                          ? 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-800' 
                                          : 'bg-zinc-50 border-zinc-200 text-zinc-700 hover:bg-zinc-100'
                                      }`}
                                    >
                                      {t.editDetails}
                                    </button>
                                    <button
                                      onClick={() => handleCloseRecord(r.id)}
                                      className="px-2.5 py-1.5 bg-[#eb5e00] hover:bg-[#d45500] text-white rounded-lg text-[10px] font-black flex items-center gap-1"
                                    >
                                      <CheckCircle className="w-3 h-3" />
                                      <span>{t.closeLog}</span>
                                    </button>
                                  </>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile view (Stacked Cards) */}
          <div className="block sm:hidden divide-y divide-zinc-150 dark:divide-zinc-850 text-xs">
            {records.map(r => {
              const isEditing = editingRecordId === r.id;
              return (
                <div key={r.id} className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-[#eb5e00]">{r.id}</span>
                    <span className={`inline-flex items-center px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-wider border ${
                      r.status === 'active'
                        ? 'bg-[#eb5e00]/10 border-[#eb5e00]/20 text-[#eb5e00]'
                        : 'bg-zinc-500/10 border-zinc-500/15 text-zinc-400'
                    }`}>
                      {r.status === 'active' ? t.activeShop : t.closedResolved}
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between">
                      <span className="text-zinc-400">{t.vehicleHeader} ID:</span>
                      <span className="font-mono font-bold text-[#eb5e00]">{r.vehicleId}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-400">{t.detailsHeader}:</span>
                      <span className="font-bold">{r.serviceType}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-zinc-400">{t.costHeader}:</span>
                      {isEditing ? (
                        <input
                          type="number"
                          value={editCost}
                          onChange={(e) => setEditCost(Number(e.target.value))}
                          className={`w-28 px-2 py-1 text-right text-xs rounded-lg border outline-none ${
                            theme === 'dark' ? 'bg-zinc-900 border-zinc-800 text-white' : 'bg-zinc-50 border-zinc-200 text-zinc-800'
                          }`}
                        />
                      ) : (
                        <span className="font-mono font-bold">₹{r.cost.toLocaleString()}</span>
                      )}
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-zinc-400">{t.dateHeader}:</span>
                      {isEditing ? (
                        <input
                          type="date"
                          value={editDate}
                          onChange={(e) => setEditDate(e.target.value)}
                          className={`px-2 py-1 text-xs rounded-lg border outline-none ${
                            theme === 'dark' ? 'bg-zinc-900 border-zinc-800 text-white' : 'bg-zinc-50 border-zinc-200 text-zinc-800'
                          }`}
                        />
                      ) : (
                        <span className="font-mono">{r.date}</span>
                      )}
                    </div>
                  </div>

                  {r.status === 'active' && (
                    <div className="flex justify-end gap-2 pt-1">
                      {isEditing ? (
                        <>
                          <button
                            onClick={() => saveEdit(r.id)}
                            className="px-2.5 py-1.5 bg-[#eb5e00] hover:bg-[#d45500] text-white rounded-lg text-[10px] font-black cursor-pointer"
                          >
                            {t.saveBtn}
                          </button>
                          <button
                            onClick={() => setEditingRecordId(null)}
                            className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold border ${
                              theme === 'dark' ? 'bg-zinc-900 border-zinc-800 text-zinc-300' : 'bg-zinc-50 border-zinc-200 text-zinc-700'
                            }`}
                          >
                            {t.cancelBtn}
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => startEditing(r)}
                            className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold border transition-all cursor-pointer ${
                              theme === 'dark' 
                                ? 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-800' 
                                : 'bg-zinc-50 border-zinc-200 text-zinc-700 hover:bg-zinc-100'
                            }`}
                          >
                            {t.editDetails}
                          </button>
                          <button
                            onClick={() => handleCloseRecord(r.id)}
                            className="px-2.5 py-1.5 bg-[#eb5e00] hover:bg-[#d45500] text-white rounded-lg text-[10px] font-black flex items-center gap-1 cursor-pointer"
                          >
                            <CheckCircle className="w-3 h-3" />
                            <span>{t.closeLog}</span>
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}
