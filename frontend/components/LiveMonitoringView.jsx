"use client";

import { useState, useEffect } from "react";
import { 
  Activity, 
  Zap, 
  Thermometer, 
  Radio,
  Clock,
  Filter
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "motion/react";

// Helper to generate initial chart data
const generateInitialData = (pts = 40) => {
  return Array.from({ length: pts }).map((_, i) => ({
    time: i,
    freq: 50 + (Math.random() * 0.1 - 0.05),
    volt: 230 + (Math.random() * 2 - 1),
    therm: 45 + (Math.random() * 5 - 2.5),
  }));
};

const SENSORS = [
  { id: 'node-alpha-1', name: 'Node Alpha-1 (Main Bus)' },
  { id: 'node-beta-2', name: 'Node Beta-2 (Substation A)' },
  { id: 'node-gamma-3', name: 'Node Gamma-3 (Feeder 4)' },
  { id: 'node-delta-4', name: 'Node Delta-4 (Transformer 2)' },
];

export default function LiveMonitoringView() {
  const [data, setData] = useState(generateInitialData());
  const [isLive, setIsLive] = useState(true);
  const [activeSensor, setActiveSensor] = useState(SENSORS[0].id);
  const [activeMetrics, setActiveMetrics] = useState({ freq: true, volt: true, therm: true });
  
  // Reset data when sensor changes to simulate loading a new feed
  useEffect(() => {
    setData(generateInitialData());
  }, [activeSensor]);

  useEffect(() => {
    if (!isLive) return;
    
    const interval = setInterval(() => {
      setData(prev => {
        const last = prev[prev.length - 1];
        const next = {
          time: last.time + 1,
          freq: 50 + (Math.random() * 0.12 - 0.06),
          volt: 230 + (Math.random() * 2.5 - 1.25),
          therm: Math.max(30, Math.min(80, last.therm + (Math.random() * 2 - 1))),
        };
        return [...prev.slice(1), next];
      });
    }, 1000); // 1 tick per second
    
    return () => clearInterval(interval);
  }, [isLive]);

  const latest = data[data.length - 1];

  const toggleMetric = (key) => {
    setActiveMetrics(prev => ({...prev, [key]: !prev[key]}));
  };

  // SVG Chart builders
  const renderPath = (key, color, scaleMin, scaleMax) => {
    const min = scaleMin;
    const max = scaleMax;
    const range = max - min;
    const path = data.map((d, i) => {
      const x = (i / (data.length - 1)) * 100;
      const y = 100 - ((d[key] - min) / range) * 100;
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    }).join(" ");
    
    return (
      <path 
        d={path} 
        fill="none" 
        stroke={color} 
        strokeWidth="2" 
        vectorEffect="non-scaling-stroke"
        className="transition-all duration-300 ease-linear"
      />
    );
  };

  // Pre-generate topography statuses to avoid impure Math.random() in render
  const [topographyStatuses, setTopographyStatuses] = useState(Array(48).fill(0.5));
  useEffect(() => {
    if (!isLive) return;
    const interval = setInterval(() => {
      setTopographyStatuses(prev => 
        prev.map(status => {
          // slight chance to change status
          if (Math.random() > 0.85) return Math.random();
          return status;
        })
      );
    }, 1500);
    return () => clearInterval(interval);
  }, [isLive]);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-medium tracking-tight text-grid-title flex items-center gap-3">
            Live Telemetry
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-grid-success/10 text-grid-success text-xs font-semibold uppercase tracking-wider border border-grid-success/20">
              <span className="relative flex size-2">
                <span className={cn("absolute inline-flex h-full w-full rounded-full bg-grid-success opacity-75", isLive && "animate-ping")}></span>
                <span className="relative inline-flex rounded-full size-2 bg-grid-success"></span>
              </span>
              {isLive ? 'Receiving' : 'Paused'}
            </span>
          </h1>
          <p className="text-sm text-grid-muted mt-2 max-w-xl leading-relaxed">
            Real-time multisensor fusion. Monitoring grid stability, thermal load, and voltage harmonics across all active nodes.
          </p>
        </div>
      </div>

      {/* Primary Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Freq */}
        <div className={cn("bg-grid-surface/30 border rounded-xl p-5 relative overflow-hidden transition-all", activeMetrics.freq ? "border-grid-border/60 ring-1 ring-grid-border/30" : "border-grid-border/20 opacity-40")}>
          <div className="flex items-start justify-between">
            <div className="text-grid-muted flex items-center gap-2">
              <Activity className="size-4" />
              <span className="text-xs font-medium uppercase tracking-wider">Grid Frequency</span>
            </div>
            <span className={cn("text-xs font-mono", Math.abs(latest.freq - 50) > 0.04 ? "text-grid-warning" : "text-grid-success")}>
              {latest.freq > 50 ? "↑" : "↓"} {Math.abs(latest.freq - 50).toFixed(3)}
            </span>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <motion.span 
              key={latest.freq}
              initial={{ opacity: 0.8, y: -2 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-4xl font-semibold tracking-tight font-mono text-grid-title"
            >
              {latest.freq.toFixed(3)}
            </motion.span>
            <span className="text-grid-muted font-medium">Hz</span>
          </div>
          <div className="absolute bottom-0 left-0 w-full h-1 bg-grid-surface">
            <motion.div 
              className={cn("h-full", Math.abs(latest.freq - 50) > 0.04 ? "bg-grid-warning" : "bg-grid-success")}
              initial={{ width: '50%' }}
              animate={{ width: `${((latest.freq - 49.9) / 0.2) * 100}%` }}
              transition={{ type: "tween", duration: 1 }}
            />
          </div>
        </div>

        {/* Voltage */}
        <div className={cn("bg-grid-surface/30 border rounded-xl p-5 relative overflow-hidden transition-all", activeMetrics.volt ? "border-grid-border/60 ring-1 ring-grid-border/30" : "border-grid-border/20 opacity-40")}>
          <div className="flex items-start justify-between">
            <div className="text-grid-muted flex items-center gap-2">
              <Zap className="size-4" />
              <span className="text-xs font-medium uppercase tracking-wider">Feeder Voltage</span>
            </div>
            <span className="text-xs font-mono text-grid-muted">
              Nominal: 230kV
            </span>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <motion.span 
              key={latest.volt}
              initial={{ opacity: 0.8, y: -2 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-4xl font-semibold tracking-tight font-mono text-grid-title"
            >
              {latest.volt.toFixed(1)}
            </motion.span>
            <span className="text-grid-muted font-medium">kV</span>
          </div>
        </div>

        {/* Thermal */}
        <div className={cn("bg-grid-surface/30 border rounded-xl p-5 relative overflow-hidden transition-all", activeMetrics.therm ? "border-grid-border/60 ring-1 ring-grid-border/30" : "border-grid-border/20 opacity-40")}>
          <div className="flex items-start justify-between">
            <div className="text-grid-muted flex items-center gap-2">
              <Thermometer className="size-4" />
              <span className="text-xs font-medium uppercase tracking-wider">Avg Thermal Load</span>
            </div>
            <span className={cn("text-xs font-mono", latest.therm > 65 ? "text-grid-danger" : "text-grid-muted")}>
              Peak: 85°C
            </span>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <motion.span 
              key={latest.therm}
              initial={{ opacity: 0.8, y: -2 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn("text-4xl font-semibold tracking-tight font-mono", latest.therm > 65 ? "text-grid-danger" : "text-grid-title")}
            >
              {latest.therm.toFixed(1)}
            </motion.span>
            <span className="text-grid-muted font-medium">°C</span>
          </div>
        </div>
      </div>

      {/* Main Chart Area */}
      <div className="bg-grid-surface/20 border border-grid-border/40 rounded-xl p-5 flex flex-col gap-4 ring-1 ring-grid-border/30">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex flex-wrap gap-4 text-xs font-medium">
            <button 
              onClick={() => toggleMetric('freq')}
              className={cn("flex items-center gap-2 px-2 py-1 rounded-md transition-all", activeMetrics.freq ? "bg-grid-surface ring-1 ring-grid-border/50 shadow-sm" : "opacity-50 hover:opacity-80")}
            >
              <span className="size-2.5 rounded-sm bg-[#3b82f6]" /> 
              <span className={cn("text-grid-title", !activeMetrics.freq && "text-grid-muted")}>Frequency</span>
            </button>
            <button 
              onClick={() => toggleMetric('volt')}
              className={cn("flex items-center gap-2 px-2 py-1 rounded-md transition-all", activeMetrics.volt ? "bg-grid-surface ring-1 ring-grid-border/50 shadow-sm" : "opacity-50 hover:opacity-80")}
            >
              <span className="size-2.5 rounded-sm bg-[#8b5cf6]" /> 
              <span className={cn("text-grid-title", !activeMetrics.volt && "text-grid-muted")}>Voltage</span>
            </button>
            <button 
              onClick={() => toggleMetric('therm')}
              className={cn("flex items-center gap-2 px-2 py-1 rounded-md transition-all", activeMetrics.therm ? "bg-grid-surface ring-1 ring-grid-border/50 shadow-sm" : "opacity-50 hover:opacity-80")}
            >
              <span className="size-2.5 rounded-sm bg-[#ef4444]" /> 
              <span className={cn("text-grid-title", !activeMetrics.therm && "text-grid-muted")}>Thermal</span>
            </button>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="relative flex-1 sm:flex-none">
              <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-grid-muted" />
              <select 
                value={activeSensor}
                onChange={(e) => setActiveSensor(e.target.value)}
                className="w-full sm:w-auto appearance-none bg-grid-surface/80 border border-grid-border/60 text-grid-title text-[11px] font-medium tracking-wide rounded-md pl-8 pr-8 py-2 focus:outline-none focus:ring-1 focus:ring-grid-border cursor-pointer hover:bg-grid-surface"
              >
                {SENSORS.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                <option value="more">Load all 50+ sensors...</option>
              </select>
              <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-grid-muted text-[10px]">▼</div>
            </div>
            
            <button 
              onClick={() => setIsLive(!isLive)}
              className={cn(
                "text-[11px] font-bold uppercase tracking-widest px-4 py-2 rounded-md transition-all shadow-sm border whitespace-nowrap",
                isLive 
                  ? "bg-amber-500/10 text-amber-500 border-amber-500/30 hover:bg-amber-500/20 hover:border-amber-500/50" 
                  : "bg-emerald-500/10 text-emerald-500 border-emerald-500/30 hover:bg-emerald-500/20 hover:border-emerald-500/50"
              )}
            >
              {isLive ? 'Pause Feed' : 'Resume Feed'}
            </button>
          </div>
        </div>

        <div className="relative w-full h-72 bg-grid-page/40 rounded-lg border border-grid-border/30 overflow-hidden">
          {/* Grid lines */}
          <div className="absolute inset-0 flex flex-col justify-between py-4 opacity-10 pointer-events-none">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="w-full border-t border-grid-title/50 border-dashed" />
            ))}
          </div>

          <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 100">
            {/* Frequency (blueish) scaled 49.8 to 50.2 */}
            {activeMetrics.freq && renderPath('freq', '#3b82f6', 49.8, 50.2)}
            {/* Voltage (purple) scaled 225 to 235 */}
            {activeMetrics.volt && renderPath('volt', '#8b5cf6', 225, 235)}
            {/* Thermal (red) scaled 20 to 90 */}
            {activeMetrics.therm && renderPath('therm', '#ef4444', 20, 90)}
          </svg>
          
          {/* Scanning line effect hiding the right edge to look like it's sliding in */}
          {isLive && (
            <div className="absolute top-0 bottom-0 right-0 w-24 bg-gradient-to-r from-transparent to-grid-page z-10" />
          )}
        </div>
      </div>

      {/* Signal Status Topography and Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Node Map (Abstract) */}
        <div className="lg:col-span-2 bg-grid-surface/20 border border-grid-border/40 rounded-xl p-5 ring-1 ring-grid-border/30">
          <h3 className="text-sm font-semibold tracking-tight mb-4 flex items-center gap-2">
            <Radio className="size-4 text-grid-muted" /> Active Topography Status
          </h3>
          <div className="grid grid-cols-6 sm:grid-cols-12 gap-1.5 p-3 bg-grid-page/40 rounded-lg border border-grid-border/20">
            {topographyStatuses.map((status, i) => {
              let bg = "bg-grid-success/10 border-grid-success/20";
              let dot = "bg-grid-success/50";
              
              if (status > 0.95) {
                bg = "bg-grid-danger/20 border-grid-danger/30 animate-pulse";
                dot = "bg-grid-danger";
              } else if (status > 0.85) {
                bg = "bg-grid-warning/10 border-grid-warning/20";
                dot = "bg-grid-warning/80";
              }

              return (
                <div key={i} className={cn("aspect-square rounded-md border flex items-center justify-center p-1", bg)}>
                  <div className={cn("size-1.5 rounded-full", dot)} />
                </div>
              );
            })}
          </div>
        </div>

        {/* Live Event Stream */}
        <div className="bg-grid-surface/20 border border-grid-border/40 rounded-xl p-5 flex flex-col h-full ring-1 ring-grid-border/30">
          <h3 className="text-sm font-semibold tracking-tight mb-4 flex items-center gap-2">
            <Clock className="size-4 text-grid-muted" /> Stream Logs
          </h3>
          <div className="flex-1 overflow-hidden relative min-h-[140px]">
            <div className="absolute inset-0 bg-gradient-to-b from-grid-surface/20 via-transparent to-transparent z-10 h-4 pointer-events-none" />
            <div className="space-y-3 font-mono text-[10px] sm:text-xs">
              {[
                { time: 'now', msg: 'Syncing telemetry packet 0x4F', type: 'info' },
                { time: '-2s', msg: 'Thermal variance noted on TX-AT-022', type: 'warn' },
                { time: '-5s', msg: 'Frequency normalized at bus 4', type: 'success' },
                { time: '-12s', msg: 'Re-evaluating predictive model', type: 'info' },
                { time: '-18s', msg: 'Anomaly flagged: Voltage Sag', type: 'danger' },
              ].map((log, i) => (
                <motion.div 
                  key={i} 
                  initial={{ opacity: 0, x: -5 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="flex gap-3 items-start border-b border-grid-border/20 pb-2 last:border-0"
                >
                  <span className="text-grid-muted w-8 shrink-0">{log.time}</span>
                  <span className={cn(
                    "flex-1 leading-relaxed",
                    log.type === 'danger' ? "text-grid-danger" :
                    log.type === 'warn' ? "text-grid-warning" :
                    log.type === 'success' ? "text-grid-success" :
                    "text-grid-title/80"
                  )}>
                    {log.msg}
                  </span>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
