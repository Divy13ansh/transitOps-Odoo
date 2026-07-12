import React, { useState } from 'react';
import { ShieldAlert, TrendingUp, Compass, Award, Activity, AlertTriangle, FileText, CheckCircle } from 'lucide-react';
import { jsPDF } from 'jspdf';

interface DispatcherAnalyticsProps {
  theme: 'light' | 'dark';
  userRole: string;
  language?: 'en' | 'hi';
}

const TRANSLATIONS = {
  en: {
    accessLocked: "ACCESS LOCKED",
    accessLockedDesc: "The Operational Analytics Dashboard requires Financial Analyst clearance.",
    title: "System Analytics & Fleet Performance",
    subtitle: "Real-time telemetry reports on aggregate operations, financial outputs, and utilization",
    exportCsv: "Export CSV",
    exportPdf: "Export PDF",
    totalDistance: "Total Distance Traveled",
    distanceTrend: "+12.4% vs. previous month",
    avgFuelEff: "Avg Fuel Efficiency",
    fuelEffDesc: "Maintained within target bounds",
    fleetUtil: "Fleet Utilization",
    fleetUtilDesc: "Optimal active dispatch allocation",
    outstandingMaint: "Outstanding Maintenance Costs",
    maintPendingDesc: "Currently pending in active service shop",
    chart1Title: "Fuel vs. Route Auxiliary Expenses",
    chart1Subtitle: "Weekly breakdown of direct transport operations",
    fuelCostsLegend: "Fuel Costs",
    otherExpensesLegend: "Other Expenses",
    chart2Title: "Fleet Utilization Rate (30 Days)",
    chart2Subtitle: "Aggregate daily run active operational time percentage",
    activeDispatchRatio: "Active Dispatch Ratio",
    successMsg: "Compilation Success: {format} operational report compiled and downloaded successfully."
  },
  hi: {
    accessLocked: "पहुंच अवरुद्ध",
    accessLockedDesc: "परिचालन विश्लेषिकी डैशबोर्ड के लिए वित्तीय विश्लेषक निकासी की आवश्यकता होती है।",
    title: "सिस्टम विश्लेषिकी और बेड़ा प्रदर्शन",
    subtitle: "कुल परिचालन, वित्तीय परिणामों और उपयोग पर वास्तविक समय टेलीमेट्री रिपोर्ट",
    exportCsv: "सीएसवी निर्यात करें",
    exportPdf: "पीडीएफ निर्यात करें",
    totalDistance: "कुल तय की गई दूरी",
    distanceTrend: "पिछले महीने की तुलना में +12.4%",
    avgFuelEff: "औसत ईंधन दक्षता",
    fuelEffDesc: "लक्षित सीमाओं के भीतर बनाए रखा गया",
    fleetUtil: "बेड़ा उपयोग",
    fleetUtilDesc: "इष्टतम सक्रिय प्रेषण आवंटन",
    outstandingMaint: "बकाया रखरखाव लागत",
    maintPendingDesc: "वर्तमान में सक्रिय सेवा दुकान में लंबित है",
    chart1Title: "ईंधन बनाम मार्ग सहायक व्यय",
    chart1Subtitle: "प्रत्यक्ष परिवहन संचालन का साप्ताहिक विवरण",
    fuelCostsLegend: "ईंधन लागत",
    otherExpensesLegend: "अन्य व्यय",
    chart2Title: "बेड़ा उपयोग दर (30 दिन)",
    chart2Subtitle: "कुल दैनिक सक्रिय परिचालन समय प्रतिशत",
    activeDispatchRatio: "सक्रिय प्रेषण अनुपात",
    successMsg: "संकलन सफलता: {format} परिचालन रिपोर्ट सफलतापूर्वक संकलित और डाउनलोड की गई।"
  }
};

export default function DispatcherAnalytics({
  theme,
  userRole,
  language = 'en'
}: DispatcherAnalyticsProps) {
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  
  // Interactive Chart Tooltips state
  const [hoveredBarIndex, setHoveredBarIndex] = useState<number | null>(null);
  const [hoveredLineIndex, setHoveredLineIndex] = useState<number | null>(null);

  const t = TRANSLATIONS[language];

  // Real CSV Export Generator (no popup alert)
  const handleExportCSV = () => {
    const headers = ['Week', 'Fuel Costs (INR)', 'Other Expenses (INR)'];
    const rows = barChartData.map(d => [d.week, d.fuel, d.other]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `fleet_operations_report_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Real PDF Export Generator (no popup alert)
  const handleExportPDF = () => {
    const doc = new jsPDF();
    
    // Header Title
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(235, 94, 0); // TransitOps orange brand color (#eb5e00)
    doc.text("TRANSITOPS - FLEET OPERATIONS REPORT", 14, 20);
    
    // Subtitle & Metadata
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(110, 110, 110);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 26);
    doc.text("Role Authorization: Financial Analyst / System Admin", 14, 31);
    
    // Separator line
    doc.setDrawColor(210, 210, 210);
    doc.setLineWidth(0.5);
    doc.line(14, 35, 196, 35);
    
    // Section Title
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(50, 50, 50);
    doc.text("WEEKLY DIRECT EXPENSES (LAST 6 WEEKS)", 14, 43);
    
    // Table Headers
    doc.setFontSize(9);
    doc.setTextColor(235, 94, 0);
    doc.text("Week ID", 14, 52);
    doc.text("Fuel Costs (INR)", 50, 52);
    doc.text("Other Aux Expenses (INR)", 110, 52);
    doc.text("Total Cost (INR)", 160, 52);
    
    // Header Line
    doc.setDrawColor(235, 94, 0);
    doc.setLineWidth(0.3);
    doc.line(14, 55, 196, 55);
    
    // Table Rows
    doc.setFont("helvetica", "normal");
    doc.setTextColor(60, 60, 60);
    let yPos = 62;
    let grandTotalFuel = 0;
    let grandTotalOther = 0;
    
    barChartData.forEach(d => {
      const total = d.fuel + d.other;
      grandTotalFuel += d.fuel;
      grandTotalOther += d.other;
      
      doc.text(d.week, 14, yPos);
      doc.text(`INR ${d.fuel.toLocaleString()}`, 50, yPos);
      doc.text(`INR ${d.other.toLocaleString()}`, 110, yPos);
      
      doc.setFont("helvetica", "bold");
      doc.text(`INR ${total.toLocaleString()}`, 160, yPos);
      doc.setFont("helvetica", "normal");
      
      doc.setDrawColor(245, 245, 245);
      doc.line(14, yPos + 3, 196, yPos + 3);
      yPos += 9;
    });
    
    // Grand Total Row
    yPos += 2;
    doc.setFont("helvetica", "bold");
    doc.setTextColor(40, 40, 40);
    doc.text("Cumulative Total", 14, yPos);
    doc.text(`INR ${grandTotalFuel.toLocaleString()}`, 50, yPos);
    doc.text(`INR ${grandTotalOther.toLocaleString()}`, 110, yPos);
    
    doc.setTextColor(235, 94, 0);
    doc.text(`INR ${(grandTotalFuel + grandTotalOther).toLocaleString()}`, 160, yPos);
    
    // Footer notice
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text("TransitOps Dispatch System - End of Report", 14, yPos + 15);
    
    // Save generated file
    doc.save(`fleet_operations_report_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  // Role Gate: Financial Analyst only. All other roles: no access.
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

  // Handle Export actions
  const triggerExport = (format: 'CSV' | 'PDF') => {
    const formattedMsg = t.successMsg.replace('{format}', format);
    setToastMessage(formattedMsg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // Mock data for Chart 1: Bar chart showing Fuel Cost vs. Other Expenses (Last 6 weeks)
  const barChartData = [
    { week: 'Wk 23', fuel: 24000, other: 12000 },
    { week: 'Wk 24', fuel: 28000, other: 15000 },
    { week: 'Wk 25', fuel: 22000, other: 9000 },
    { week: 'Wk 26', fuel: 32000, other: 18000 },
    { week: 'Wk 27', fuel: 35000, other: 16000 },
    { week: 'Wk 28', fuel: 38000, other: 21000 },
  ];

  // Mock data for Chart 2: Fleet Utilization over the last 30 days (10 selected points)
  const lineChartData = [
    { day: 'Day 3', rate: 72 },
    { day: 'Day 6', rate: 78 },
    { day: 'Day 9', rate: 75 },
    { day: 'Day 12', rate: 85 },
    { day: 'Day 15', rate: 89 },
    { day: 'Day 18', rate: 82 },
    { day: 'Day 21', rate: 91 },
    { day: 'Day 24', rate: 86 },
    { day: 'Day 27', rate: 94 },
    { day: 'Day 30', rate: 96 },
  ];

  return (
    <div className="space-y-6">
      {/* Toast Alert Banner */}
      {toastMessage && (
        <div className="fixed top-6 right-6 z-50 p-4 bg-[#eb5e00] text-white border border-[#d45500] rounded-xl shadow-xl flex items-center gap-2.5 text-xs font-bold font-sans animate-bounce">
          <CheckCircle className="w-4 h-4 text-white" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-sm font-black uppercase tracking-wider font-sans text-zinc-400">
            {t.title}
          </h2>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 cursor-pointer ${
              theme === 'dark' 
                ? 'bg-zinc-900 border-zinc-800 hover:bg-zinc-800 text-white' 
                : 'bg-white border-zinc-250 text-zinc-700 hover:bg-zinc-50 shadow-xs'
            }`}
          >
            <FileText className="w-3.5 h-3.5 text-[#eb5e00]" />
            <span>{t.exportCsv}</span>
          </button>
          
          <button
            onClick={handleExportPDF}
            className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 cursor-pointer ${
              theme === 'dark' 
                ? 'bg-zinc-900 border-zinc-800 hover:bg-zinc-800 text-white' 
                : 'bg-white border-zinc-250 text-zinc-700 hover:bg-zinc-50 shadow-xs'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5 text-[#eb5e00]" />
            <span>{t.exportPdf}</span>
          </button>
        </div>
      </div>

      {/* KPI Blocks Grid (4 blocks) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1 */}
        <div className={`p-5 rounded-xl border transition-all ${
          theme === 'dark' ? 'bg-zinc-900/40 border-zinc-900' : 'bg-white border-zinc-200 shadow-sm'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-black uppercase tracking-wider text-zinc-400">{t.totalDistance}</span>
            <Compass className="w-4 h-4 text-[#eb5e00]" />
          </div>
          <div className="mt-3">
            <span className="text-xl font-black font-mono">148,920 MI</span>
            <div className="text-[9px] text-[#eb5e00] mt-1 font-bold">
              {t.distanceTrend}
            </div>
          </div>
        </div>

        {/* KPI 2 */}
        <div className={`p-5 rounded-xl border transition-all ${
          theme === 'dark' ? 'bg-zinc-900/40 border-zinc-900' : 'bg-white border-zinc-200 shadow-sm'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-black uppercase tracking-wider text-zinc-400">{t.avgFuelEff}</span>
            <Activity className="w-4 h-4 text-[#eb5e00]" />
          </div>
          <div className="mt-3">
            <span className="text-xl font-black font-mono">14.2 MI/gal</span>
            <div className="text-[9px] text-zinc-400 mt-1">
              {t.fuelEffDesc}
            </div>
          </div>
        </div>

        {/* KPI 3 */}
        <div className={`p-5 rounded-xl border transition-all ${
          theme === 'dark' ? 'bg-zinc-900/40 border-zinc-900' : 'bg-white border-zinc-200 shadow-sm'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-black uppercase tracking-wider text-zinc-400">{t.fleetUtil}</span>
            <Award className="w-4 h-4 text-[#eb5e00]" />
          </div>
          <div className="mt-3">
            <span className="text-xl font-black font-mono">87.5 %</span>
            <div className="text-[9px] text-[#eb5e00] mt-1 font-bold">
              {t.fleetUtilDesc}
            </div>
          </div>
        </div>

        {/* KPI 4 */}
        <div className={`p-5 rounded-xl border transition-all ${
          theme === 'dark' ? 'bg-zinc-900/40 border-zinc-900' : 'bg-white border-zinc-200 shadow-sm'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-black uppercase tracking-wider text-zinc-400">{t.outstandingMaint}</span>
            <AlertTriangle className="w-4 h-4 text-[#eb5e00]" />
          </div>
          <div className="mt-3">
            <span className="text-xl font-black font-mono">₹18,450</span>
            <div className="text-[9px] text-[#eb5e00] mt-1 font-semibold">
              {t.maintPendingDesc}
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Custom SVG Charts Section (Stack vertically on Tablet/Mobile) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Chart 1: Bar Chart of Fuel vs. Other Expenses */}
        <div className={`p-5 rounded-xl border transition-all flex flex-col justify-between ${
          theme === 'dark' ? 'bg-zinc-900/40 border-zinc-900' : 'bg-white border-zinc-200 shadow-sm'
        }`}>
          <div className="space-y-1">
            <h3 className="text-xs font-black uppercase tracking-wider font-sans text-zinc-400">
              {t.chart1Title}
            </h3>
            <p className="text-[10px] text-zinc-400">{t.chart1Subtitle}</p>
          </div>

          {/* Chart Legends */}
          <div className="flex items-center gap-4 py-3 text-[10px] font-sans font-black uppercase tracking-wider text-zinc-400">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-[#eb5e00]" /> {t.fuelCostsLegend}</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-zinc-400 dark:bg-zinc-600" /> {t.otherExpensesLegend}</span>
          </div>

          {/* Interactive Custom Responsive SVG Chart */}
          <div className="relative h-64 w-full">
            <svg viewBox="0 0 500 240" className="w-full h-full">
              {/* Grid Lines */}
              <line x1="40" y1="40" x2="480" y2="40" stroke={theme === 'dark' ? '#27272a' : '#e4e4e7'} strokeWidth="1" strokeDasharray="3" />
              <line x1="40" y1="100" x2="480" y2="100" stroke={theme === 'dark' ? '#27272a' : '#e4e4e7'} strokeWidth="1" strokeDasharray="3" />
              <line x1="40" y1="160" x2="480" y2="160" stroke={theme === 'dark' ? '#27272a' : '#e4e4e7'} strokeWidth="1" strokeDasharray="3" />
              <line x1="40" y1="200" x2="480" y2="200" stroke={theme === 'dark' ? '#27272a' : '#e4e4e7'} strokeWidth="1" strokeDasharray="3" />

              {/* Y Axis Legend */}
              <text x="5" y="45" fill="#a1a1aa" fontSize="8" fontFamily="monospace">40k</text>
              <text x="5" y="105" fill="#a1a1aa" fontSize="8" fontFamily="monospace">25k</text>
              <text x="5" y="165" fill="#a1a1aa" fontSize="8" fontFamily="monospace">10k</text>
              <text x="5" y="205" fill="#a1a1aa" fontSize="8" fontFamily="monospace">0k</text>

              {/* Render Bars */}
              {barChartData.map((d, index) => {
                const step = 440 / barChartData.length;
                const xBase = 40 + index * step + step / 4;
                
                // Max value mapped to 160 pixels height (from y=200 down to y=40)
                const fuelHeight = (d.fuel / 40000) * 160;
                const otherHeight = (d.other / 40000) * 160;

                const isHovered = hoveredBarIndex === index;

                return (
                  <g 
                    key={d.week} 
                    onMouseEnter={() => setHoveredBarIndex(index)}
                    onMouseLeave={() => setHoveredBarIndex(null)}
                    className="cursor-pointer"
                  >
                    {/* Fuel bar (Accent color) */}
                    <rect
                      x={xBase}
                      y={200 - fuelHeight}
                      width="16"
                      height={Math.max(fuelHeight, 2)}
                      fill={isHovered ? '#ff7e29' : '#eb5e00'}
                      rx="3"
                      className="transition-all duration-150"
                    />

                    {/* Other expenses bar (Grey) */}
                    <rect
                      x={xBase + 18}
                      y={200 - otherHeight}
                      width="16"
                      height={Math.max(otherHeight, 2)}
                      fill={theme === 'dark' ? (isHovered ? '#52525b' : '#3f3f46') : (isHovered ? '#a1a1aa' : '#d4d4d8')}
                      rx="3"
                      className="transition-all duration-150"
                    />

                    {/* X axis week labels */}
                    <text
                      x={xBase + 16}
                      y="222"
                      fill="#71717a"
                      fontSize="9"
                      fontFamily="sans-serif"
                      fontWeight="bold"
                      textAnchor="middle"
                    >
                      {d.week}
                    </text>
                  </g>
                );
              })}
            </svg>

            {/* Hover Tooltip Overlay */}
            {hoveredBarIndex !== null && (
              <div className="absolute top-4 right-4 p-2.5 rounded-lg border text-[10px] font-sans font-bold space-y-1 bg-zinc-950 border-zinc-900 text-white shadow-xl">
                <span className="text-[#eb5e00] text-[9px] uppercase tracking-wider block">{barChartData[hoveredBarIndex].week} Report</span>
                <div className="flex gap-4">
                  <span>Fuel: ₹{barChartData[hoveredBarIndex].fuel.toLocaleString()}</span>
                  <span>Misc: ₹{barChartData[hoveredBarIndex].other.toLocaleString()}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Chart 2: Line Chart of Fleet Utilization */}
        <div className={`p-5 rounded-xl border transition-all flex flex-col justify-between ${
          theme === 'dark' ? 'bg-zinc-900/40 border-zinc-900' : 'bg-white border-zinc-200 shadow-sm'
        }`}>
          <div className="space-y-1">
            <h3 className="text-xs font-black uppercase tracking-wider font-sans text-zinc-400">
              {t.chart2Title}
            </h3>
            <p className="text-[10px] text-zinc-400">{t.chart2Subtitle}</p>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 py-3 text-[10px] font-sans font-black uppercase tracking-wider text-zinc-400">
            <span className="flex items-center gap-1.5"><span className="w-5 h-0.5 bg-[#eb5e00]" /> {t.activeDispatchRatio}</span>
          </div>

          {/* Interactive Custom Line SVG */}
          <div className="relative h-64 w-full">
            <svg viewBox="0 0 500 240" className="w-full h-full">
              {/* Horizontal Reference Lines */}
              <line x1="40" y1="40" x2="480" y2="40" stroke={theme === 'dark' ? '#27272a' : '#e4e4e7'} strokeWidth="1" strokeDasharray="3" />
              <line x1="40" y1="120" x2="480" y2="120" stroke={theme === 'dark' ? '#27272a' : '#e4e4e7'} strokeWidth="1" strokeDasharray="3" />
              <line x1="40" y1="200" x2="480" y2="200" stroke={theme === 'dark' ? '#27272a' : '#e4e4e7'} strokeWidth="1" strokeDasharray="3" />

              {/* Y Axis rates */}
              <text x="5" y="45" fill="#a1a1aa" fontSize="8" fontFamily="monospace">100%</text>
              <text x="5" y="125" fill="#a1a1aa" fontSize="8" fontFamily="monospace">50%</text>
              <text x="5" y="205" fill="#a1a1aa" fontSize="8" fontFamily="monospace">0%</text>

              {/* Path calculation helper */}
              {(() => {
                const step = 440 / (lineChartData.length - 1);
                const points = lineChartData.map((d, index) => {
                  const x = 40 + index * step;
                  // Max 100% mapped to y=40, 0% to y=200
                  const y = 200 - (d.rate / 100) * 160;
                  return { x, y };
                });

                const pathD = points.reduce((acc, p, index) => {
                  return index === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`;
                }, '');

                return (
                  <>
                    {/* Shadow Area below the curve */}
                    <path
                      d={`${pathD} L ${points[points.length - 1].x} 200 L 40 200 Z`}
                      fill="url(#orangeGrad)"
                      opacity="0.1"
                    />

                    {/* Line curve */}
                    <path
                      d={pathD}
                      fill="none"
                      stroke="#eb5e00"
                      strokeWidth="2.5"
                    />

                    {/* Gradient definition */}
                    <defs>
                      <linearGradient id="orangeGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#eb5e00" />
                        <stop offset="100%" stopColor="#eb5e00" stopOpacity="0" />
                      </linearGradient>
                    </defs>

                    {/* Active hover tracking circles */}
                    {points.map((p, index) => {
                      const isHovered = hoveredLineIndex === index;
                      return (
                        <g 
                          key={index}
                          onMouseEnter={() => setHoveredLineIndex(index)}
                          onMouseLeave={() => setHoveredLineIndex(null)}
                          className="cursor-pointer"
                        >
                          {/* Invisible hover helper target zone */}
                          <circle cx={p.x} cy={p.y} r="15" fill="transparent" />
                          
                          {/* Anchor dots */}
                          <circle
                            cx={p.x}
                            cy={p.y}
                            r={isHovered ? "5" : "3.5"}
                            fill="#eb5e00"
                            stroke="#fff"
                            strokeWidth={isHovered ? "2" : "1"}
                            className="transition-all duration-150"
                          />

                          {/* X labels */}
                          <text
                            x={p.x}
                            y="222"
                            fill="#71717a"
                            fontSize="8"
                            fontFamily="sans-serif"
                            fontWeight="bold"
                            textAnchor="middle"
                          >
                            {lineChartData[index].day}
                          </text>
                        </g>
                      );
                    })}
                  </>
                );
              })()}
            </svg>

            {/* Line Hover Tooltip Overlay */}
            {hoveredLineIndex !== null && (
              <div className="absolute top-4 right-4 p-2.5 rounded-lg border text-[10px] font-sans font-bold space-y-0.5 bg-zinc-950 border-zinc-900 text-white shadow-xl">
                <span className="text-[#eb5e00] text-[9px] uppercase tracking-wider block">Utilization Report</span>
                <span>{lineChartData[hoveredLineIndex].day}: {lineChartData[hoveredLineIndex].rate}% active run</span>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
