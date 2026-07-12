import React, { useState } from 'react';
import { Vehicle } from '../types';
import { ChevronDown, Plus, ShieldAlert, Sparkles, Calendar, Landmark, X } from 'lucide-react';
import Dropdown from './Dropdown';

interface FuelLog {
  id: string;
  vehicleId: string;
  date: string;
  liters: number;
  cost: number;
}

interface OtherExpense {
  id: string;
  tripId: string;
  vehicleId: string;
  toll: number;
  misc: number;
  total: number;
}

interface DispatcherFuelExpensesProps {
  theme: 'light' | 'dark';
  vehicles: Vehicle[];
  userRole: string;
  language?: 'en' | 'hi';
}

const INITIAL_FUEL_LOGS: FuelLog[] = [
  { id: 'FL-01', vehicleId: 'V-101', date: '2026-07-11', liters: 120, cost: 11400 },
  { id: 'FL-02', vehicleId: 'V-102', date: '2026-07-10', liters: 180, cost: 17100 },
  { id: 'FL-03', vehicleId: 'V-301', date: '2026-07-09', liters: 45, cost: 4275 }
];

const INITIAL_EXPENSES: OtherExpense[] = [
  { id: 'EX-01', tripId: 'TR-8041', vehicleId: 'V-101', toll: 1800, misc: 450, total: 2250 },
  { id: 'EX-02', tripId: 'TR-8044', vehicleId: 'V-102', toll: 1200, misc: 800, total: 2000 },
  { id: 'EX-03', tripId: 'TR-8043', vehicleId: 'V-301', toll: 600, misc: 200, total: 800 }
];

const TRANSLATIONS = {
  en: {
    accessLocked: "ACCESS LOCKED",
    accessLockedDesc: "The Financial Fuel & Expenses module is gated. Please connect with your Financial Analyst profile to view operational costs.",
    title: "Fuel & Operational Expenses",
    subtitle: "Real-time balance log of active fuel intake and road transport auxiliary costs",
    totalOperationalCost: "Total Operational Cost",
    derivedCostDesc: "Derived = Fuel + Maintenance + Toll/Misc",
    queryFilters: "Log Query Filters",
    allVehicles: "All Vehicles",
    fuelRefillsLog: "Fuel Refills Log",
    logFuelBtn: "Log Fuel",
    logIdHeader: "Log ID",
    vehicleHeader: "Vehicle",
    dateHeader: "Date",
    litersHeader: "Liters (L)",
    costHeader: "Cost (₹)",
    otherExpensesLog: "Other Expenses Log",
    addExpenseBtn: "Add Expense",
    tripIdHeader: "Trip ID",
    tollFeeHeader: "Toll Fee (₹)",
    miscHeader: "Misc (₹)",
    totalHeader: "Total (₹)",
    logFuelIntakeTitle: "Log Fuel Intake",
    selectVehicle: "Select Vehicle",
    refillDate: "Refill Date",
    quantityLiters: "Quantity (Liters)",
    cancelBtn: "Cancel",
    logRecordBtn: "Log Record",
    addRouteExpenseTitle: "Add Route Expense",
    miscOther: "Misc / Other (₹)",
    pleaseSelectVehicle: "Please select a vehicle.",
    pleaseEnterTrip: "Please enter a trip ID."
  },
  hi: {
    accessLocked: "पहुंच अवरुद्ध",
    accessLockedDesc: "वित्तीय ईंधन और व्यय मॉड्यूल प्रतिबंधित है। परिचालन लागत देखने के लिए कृपया अपने वित्तीय विश्लेषक प्रोफ़ाइल के साथ कनेक्ट करें।",
    title: "ईंधन और परिचालन व्यय",
    subtitle: "सक्रिय ईंधन सेवन और सड़क परिवहन सहायक लागतों का वास्तविक समय शेष लॉग",
    totalOperationalCost: "कुल परिचालन लागत",
    derivedCostDesc: "व्युत्पन्न = ईंधन + रखरखाव + टोल/विविध",
    queryFilters: "लॉग क्वेरी फ़िल्टर",
    allVehicles: "सभी वाहन",
    fuelRefillsLog: "ईंधन रिफिल लॉग",
    logFuelBtn: "ईंधन लॉग करें",
    logIdHeader: "लॉग आईडी",
    vehicleHeader: "वाहन",
    dateHeader: "तिथि",
    litersHeader: "लीटर (L)",
    costHeader: "लागत (₹)",
    otherExpensesLog: "अन्य व्यय लॉग",
    addExpenseBtn: "व्यय जोड़ें",
    tripIdHeader: "यात्रा आईडी",
    tollFeeHeader: "टोल शुल्क (₹)",
    miscHeader: "विविध (₹)",
    totalHeader: "कुल (₹)",
    logFuelIntakeTitle: "ईंधन का सेवन लॉग करें",
    selectVehicle: "वाहन का चयन करें",
    refillDate: "रिफिल तिथि",
    quantityLiters: "मात्रा (लीटर)",
    cancelBtn: "रद्द करें",
    logRecordBtn: "रिकॉर्ड लॉग करें",
    addRouteExpenseTitle: "मार्ग व्यय जोड़ें",
    miscOther: "विविध / अन्य (₹)",
    pleaseSelectVehicle: "कृपया एक वाहन चुनें।",
    pleaseEnterTrip: "कृपया यात्रा आईडी दर्ज करें।"
  }
};

export default function DispatcherFuelExpenses({
  theme,
  vehicles,
  userRole,
  language = 'en'
}: DispatcherFuelExpensesProps) {
  const [fuelLogs, setFuelLogs] = useState<FuelLog[]>(INITIAL_FUEL_LOGS);
  const [expenses, setExpenses] = useState<OtherExpense[]>(INITIAL_EXPENSES);

  // Filters
  const [vehicleFilter, setVehicleFilter] = useState('All');
  const [dateFilter, setDateFilter] = useState('');

  // Modals / Input states
  const [isFuelModalOpen, setIsFuelModalOpen] = useState(false);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);

  const [fuelVehicle, setFuelVehicle] = useState(vehicles[0]?.id || '');
  const [fuelDate, setFuelDate] = useState('2026-07-11');
  const [fuelLiters, setFuelLiters] = useState<number>(100);
  const [fuelCost, setFuelCost] = useState<number>(9500);

  const [expTrip, setExpTrip] = useState('TR-8045');
  const [expVehicle, setExpVehicle] = useState(vehicles[0]?.id || '');
  const [expToll, setExpToll] = useState<number>(1000);
  const [expMisc, setExpMisc] = useState<number>(300);

  const [errorMsg, setErrorMsg] = useState('');

  const t = TRANSLATIONS[language];

  // Role: Financial Analyst (full CRUD). All other roles: no access.
  const isAuthorized = userRole === 'finance' || userRole === 'admin';

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

  // Derived calculations: Total operational cost = Fuel + Maintenance + Other Expenses
  const totalFuelCost = fuelLogs.reduce((sum, item) => sum + item.cost, 0);
  const totalOtherExpenses = expenses.reduce((sum, item) => sum + item.total, 0);
  const maintenanceBaseline = 25450;
  const totalOperationalCost = totalFuelCost + totalOtherExpenses + maintenanceBaseline;

  const handleAddFuelLog = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fuelVehicle) {
      setErrorMsg(t.pleaseSelectVehicle);
      return;
    }

    const newLog: FuelLog = {
      id: `FL-${Math.floor(10 + Math.random() * 90)}`,
      vehicleId: fuelVehicle,
      date: fuelDate,
      liters: Number(fuelLiters),
      cost: Number(fuelCost)
    };

    setFuelLogs(prev => [newLog, ...prev]);
    setIsFuelModalOpen(false);
    setErrorMsg('');
  };

  const handleAddExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!expTrip.trim()) {
      setErrorMsg(t.pleaseEnterTrip);
      return;
    }

    const totalExp = Number(expToll) + Number(expMisc);
    const newExp: OtherExpense = {
      id: `EX-${Math.floor(10 + Math.random() * 90)}`,
      tripId: expTrip.trim().toUpperCase(),
      vehicleId: expVehicle,
      toll: Number(expToll),
      misc: Number(expMisc),
      total: totalExp
    };

    setExpenses(prev => [newExp, ...prev]);
    setIsExpenseModalOpen(false);
    setErrorMsg('');
  };

  // Filter lists
  const filteredFuel = fuelLogs.filter(item => {
    const matchVeh = vehicleFilter === 'All' || item.vehicleId === vehicleFilter;
    const matchDate = !dateFilter || item.date === dateFilter;
    return matchVeh && matchDate;
  });

  const filteredExpenses = expenses.filter(item => {
    const matchVeh = vehicleFilter === 'All' || item.vehicleId === vehicleFilter;
    return matchVeh;
  });

  return (
    <div className="space-y-6">
      {/* Page Header & Operational Cost Card */}
      <div className="flex flex-col md:flex-row items-stretch justify-between gap-6">
        <div>
          <h2 className="text-sm font-black uppercase tracking-wider font-sans text-zinc-400">
            {t.title}
          </h2>
        </div>

        {/* Operational Cost KPI block (Pinned high up on Mobile) */}
        <div className={`p-4 md:px-6 rounded-xl border flex flex-col justify-center min-w-[220px] transition-all ${
          theme === 'dark' ? 'bg-[#eb5e00]/10 border-[#eb5e00]/20' : 'bg-orange-50 border-orange-200'
        }`}>
          <span className="text-[9px] font-sans font-black text-zinc-400 uppercase tracking-widest block">{t.totalOperationalCost}</span>
          <span className="text-xl md:text-2xl font-black font-sans mt-1 text-[#eb5e00] block">
            ₹{totalOperationalCost.toLocaleString()}
          </span>
          <span className="text-[9px] text-zinc-400 mt-1 block">
            {t.derivedCostDesc}
          </span>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className={`p-4 rounded-xl border flex flex-col md:flex-row gap-4 items-center justify-between ${
        theme === 'dark' ? 'bg-zinc-900/20 border-zinc-900' : 'bg-white border-zinc-200 shadow-sm'
      }`}>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Calendar className="w-3.5 h-3.5 text-[#eb5e00]" />
          <span className="text-[10px] font-black uppercase tracking-wider font-sans text-zinc-400">{t.queryFilters}</span>
        </div>

        {/* Filter inputs wrapper */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-end">
          {/* Vehicle Filter */}
          <Dropdown
            theme={theme}
            value={vehicleFilter}
            onChange={setVehicleFilter}
            options={[
              { value: 'All', label: language === 'hi' ? 'सभी वाहन' : t.allVehicles },
              ...vehicles.map(v => ({ value: v.id, label: v.id }))
            ]}
          />

          {/* Date Filter */}
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className={`px-4 py-2 text-xs font-bold rounded-xl border outline-none transition-all ${
              theme === 'dark' 
                ? 'bg-zinc-900/50 border-zinc-800 text-zinc-200 focus:border-[#eb5e00]' 
                : 'bg-zinc-50 border-zinc-200 text-zinc-700 focus:border-[#eb5e00]'
            }`}
          />
        </div>
      </div>

      {/* Two Tables Side-By-Side (Stack vertically on Tablet) */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
        
        {/* Table 1: Fuel Logs */}
        <div className={`rounded-xl border overflow-hidden flex flex-col ${
          theme === 'dark' ? 'bg-zinc-900/20 border-zinc-900' : 'bg-white border-zinc-200 shadow-sm'
        }`}>
          <div className="p-4 border-b border-zinc-150 dark:border-zinc-850 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#eb5e00]" />
              <h3 className="text-xs font-black uppercase tracking-wider font-sans text-zinc-400">
                {t.fuelRefillsLog}
              </h3>
            </div>
            <button
              onClick={() => { setIsFuelModalOpen(true); setErrorMsg(''); }}
              className="px-3 py-1.5 rounded-lg text-[10px] font-black bg-[#eb5e00] hover:bg-[#d45500] text-white flex items-center gap-1 cursor-pointer transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{t.logFuelBtn}</span>
            </button>
          </div>

          <div className="overflow-x-auto scrollbar-none text-xs">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className={`border-b text-[10px] font-black uppercase tracking-wider ${
                  theme === 'dark' ? 'bg-zinc-950/40 border-zinc-850 text-zinc-400' : 'bg-zinc-50 border-zinc-200 text-zinc-500'
                }`}>
                  <th className="p-3 pl-4">{t.logIdHeader}</th>
                  <th className="p-3">{t.vehicleHeader}</th>
                  <th className="p-3">{t.dateHeader}</th>
                  <th className="p-3 text-right">{t.litersHeader}</th>
                  <th className="p-3 text-right pr-4">{t.costHeader}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-150 dark:divide-zinc-850">
                {filteredFuel.map(f => (
                  <tr key={f.id} className="hover:bg-zinc-50/20 dark:hover:bg-zinc-900/10 transition-colors">
                    <td className="p-3 pl-4 font-mono font-bold text-zinc-400">{f.id}</td>
                    <td className="p-3 font-mono font-bold text-[#eb5e00]">{f.vehicleId}</td>
                    <td className="p-3 font-semibold text-zinc-400">{f.date}</td>
                    <td className="p-3 text-right font-mono font-bold">{f.liters} L</td>
                    <td className="p-3 text-right font-mono font-black pr-4">₹{f.cost.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Table 2: Other Expenses */}
        <div className={`rounded-xl border overflow-hidden flex flex-col ${
          theme === 'dark' ? 'bg-zinc-900/20 border-zinc-900' : 'bg-white border-zinc-200 shadow-sm'
        }`}>
          <div className="p-4 border-b border-zinc-150 dark:border-zinc-850 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Landmark className="w-4 h-4 text-[#eb5e00]" />
              <h3 className="text-xs font-black uppercase tracking-wider font-sans text-zinc-400">
                {t.otherExpensesLog}
              </h3>
            </div>
            <button
              onClick={() => { setIsExpenseModalOpen(true); setErrorMsg(''); }}
              className="px-3 py-1.5 rounded-lg text-[10px] font-black bg-[#eb5e00] hover:bg-[#d45500] text-white flex items-center gap-1 cursor-pointer transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{t.addExpenseBtn}</span>
            </button>
          </div>

          <div className="overflow-x-auto scrollbar-none text-xs">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className={`border-b text-[10px] font-black uppercase tracking-wider ${
                  theme === 'dark' ? 'bg-zinc-950/40 border-zinc-850 text-zinc-400' : 'bg-zinc-50 border-zinc-200 text-zinc-500'
                }`}>
                  <th className="p-3 pl-4">{t.logIdHeader}</th>
                  <th className="p-3">{t.tripIdHeader}</th>
                  <th className="p-3">{t.vehicleHeader}</th>
                  <th className="p-3 text-right">{t.tollFeeHeader}</th>
                  <th className="p-3 text-right">{t.miscHeader}</th>
                  <th className="p-3 text-right pr-4">{t.totalHeader}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-150 dark:divide-zinc-850">
                {filteredExpenses.map(e => (
                  <tr key={e.id} className="hover:bg-zinc-50/20 dark:hover:bg-zinc-900/10 transition-colors">
                    <td className="p-3 pl-4 font-mono text-zinc-400 font-bold">{e.id}</td>
                    <td className="p-3 font-mono font-bold text-[#eb5e00]">{e.tripId}</td>
                    <td className="p-3 font-mono font-bold text-[#eb5e00]">{e.vehicleId}</td>
                    <td className="p-3 text-right font-mono">₹{e.toll.toLocaleString()}</td>
                    <td className="p-3 text-right font-mono text-zinc-400">₹{e.misc.toLocaleString()}</td>
                    <td className="p-3 text-right font-mono font-black pr-4 text-[#eb5e00]">₹{e.total.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* Modal 1: Log Fuel */}
      {isFuelModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-xs" onClick={() => setIsFuelModalOpen(false)} />
          <div className={`relative w-full max-w-sm p-6 rounded-2xl border shadow-xl space-y-4 transition-all ${
            theme === 'dark' ? 'bg-zinc-950 border-zinc-900 text-white' : 'bg-white border-zinc-200 text-zinc-800'
          }`}>
            <div className="flex justify-between items-center pb-2 border-b border-zinc-100 dark:border-zinc-900">
              <h3 className="text-sm font-black uppercase tracking-wider font-sans text-[#eb5e00]">{t.logFuelIntakeTitle}</h3>
              <button onClick={() => setIsFuelModalOpen(false)} className="text-zinc-400 hover:text-white"><X className="w-4 h-4" /></button>
            </div>

            <form onSubmit={handleAddFuelLog} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-wider text-zinc-400 block">{t.selectVehicle}</label>
                <Dropdown
                  theme={theme}
                  value={fuelVehicle}
                  onChange={setFuelVehicle}
                  options={vehicles.map(v => ({ value: v.id, label: `${v.id} - ${v.name}` }))}
                  className="w-full"
                  buttonClassName="w-full"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-wider text-zinc-400 block">{t.refillDate}</label>
                <input
                  type="date"
                  value={fuelDate}
                  onChange={(e) => setFuelDate(e.target.value)}
                  className={`w-full px-4 py-2 text-xs font-bold rounded-xl border outline-none transition-all ${
                    theme === 'dark' 
                      ? 'bg-zinc-900/50 border-zinc-800 text-zinc-200 focus:border-[#eb5e00]' 
                      : 'bg-zinc-50 border-zinc-200 text-zinc-700 focus:border-[#eb5e00]'
                  }`}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-wider text-zinc-400 block">{t.quantityLiters}</label>
                  <input
                    type="number"
                    value={fuelLiters}
                    onChange={(e) => setFuelLiters(Number(e.target.value))}
                    className={`w-full px-4 py-2 text-xs font-bold rounded-xl border outline-none transition-all ${
                      theme === 'dark' 
                        ? 'bg-zinc-900/50 border-zinc-800 text-zinc-200 focus:border-[#eb5e00]' 
                        : 'bg-zinc-50 border-zinc-200 text-zinc-700 focus:border-[#eb5e00]'
                    }`}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-wider text-zinc-400 block">{t.costHeader}</label>
                  <input
                    type="number"
                    value={fuelCost}
                    onChange={(e) => setFuelCost(Number(e.target.value))}
                    className={`w-full px-4 py-2 text-xs font-bold rounded-xl border outline-none transition-all ${
                      theme === 'dark' 
                        ? 'bg-zinc-900/50 border-zinc-800 text-zinc-200 focus:border-[#eb5e00]' 
                        : 'bg-zinc-50 border-zinc-200 text-zinc-700 focus:border-[#eb5e00]'
                    }`}
                  />
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-2 border-t border-zinc-150 dark:border-zinc-850">
                <button type="button" onClick={() => setIsFuelModalOpen(false)} className="px-4 py-2 rounded-xl text-xs font-bold border transition-all hover:bg-zinc-850 cursor-pointer">{t.cancelBtn}</button>
                <button type="submit" className="px-4 py-2 rounded-xl text-xs font-black bg-[#eb5e00] hover:bg-[#d45500] text-white shadow-md cursor-pointer">{t.logRecordBtn}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Log Expense */}
      {isExpenseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-xs" onClick={() => setIsExpenseModalOpen(false)} />
          <div className={`relative w-full max-w-sm p-6 rounded-2xl border shadow-xl space-y-4 transition-all ${
            theme === 'dark' ? 'bg-zinc-950 border-zinc-900 text-white' : 'bg-white border-zinc-200 text-zinc-800'
          }`}>
            <div className="flex justify-between items-center pb-2 border-b border-zinc-100 dark:border-zinc-900">
              <h3 className="text-sm font-black uppercase tracking-wider font-sans text-[#eb5e00]">{t.addRouteExpenseTitle}</h3>
              <button onClick={() => setIsExpenseModalOpen(false)} className="text-zinc-400 hover:text-white"><X className="w-4 h-4" /></button>
            </div>

            <form onSubmit={handleAddExpense} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-wider text-zinc-400 block">{t.tripIdHeader}</label>
                  <input
                    type="text"
                    placeholder="e.g. TR-8045"
                    value={expTrip}
                    onChange={(e) => setExpTrip(e.target.value)}
                    className={`w-full px-4 py-2 text-xs font-bold rounded-xl border outline-none transition-all ${
                      theme === 'dark' 
                        ? 'bg-zinc-900/50 border-zinc-800 text-zinc-200 focus:border-[#eb5e00]' 
                        : 'bg-zinc-50 border-zinc-200 text-zinc-700 focus:border-[#eb5e00]'
                    }`}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-wider text-zinc-400 block">{t.vehicleHeader} ID</label>
                  <Dropdown
                    theme={theme}
                    value={expVehicle}
                    onChange={setExpVehicle}
                    options={vehicles.map(v => ({ value: v.id, label: v.id }))}
                    className="w-full"
                    buttonClassName="w-full"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-wider text-zinc-400 block">{t.tollFeeHeader}</label>
                  <input
                    type="number"
                    value={expToll}
                    onChange={(e) => setExpToll(Number(e.target.value))}
                    className={`w-full px-4 py-2 text-xs font-bold rounded-xl border outline-none transition-all ${
                      theme === 'dark' 
                        ? 'bg-zinc-900/50 border-zinc-800 text-zinc-200 focus:border-[#eb5e00]' 
                        : 'bg-zinc-50 border-zinc-200 text-zinc-700 focus:border-[#eb5e00]'
                    }`}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-wider text-zinc-400 block">{t.miscOther}</label>
                  <input
                    type="number"
                    value={expMisc}
                    onChange={(e) => setExpMisc(Number(e.target.value))}
                    className={`w-full px-4 py-2 text-xs font-bold rounded-xl border outline-none transition-all ${
                      theme === 'dark' 
                        ? 'bg-zinc-900/50 border-zinc-800 text-zinc-200 focus:border-[#eb5e00]' 
                        : 'bg-zinc-50 border-zinc-200 text-zinc-700 focus:border-[#eb5e00]'
                    }`}
                  />
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-2 border-t border-zinc-150 dark:border-zinc-850">
                <button type="button" onClick={() => setIsExpenseModalOpen(false)} className="px-4 py-2 rounded-xl text-xs font-bold border transition-all hover:bg-zinc-850 cursor-pointer">{t.cancelBtn}</button>
                <button type="submit" className="px-4 py-2 rounded-xl text-xs font-black bg-[#eb5e00] hover:bg-[#d45500] text-white shadow-md cursor-pointer">{t.logRecordBtn}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
