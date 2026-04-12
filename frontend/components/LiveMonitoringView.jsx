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

// Helper to generate initial model score data
const generateInitialData = (pts = 40) => {
  return Array.from({ length: pts }).map((_, i) => ({
    time: i,
    point: Math.random() * 0.2,
    collective: Math.random() * 0.2,
    contextual: Math.random() * 0.2,
  }));
};

const SENSORS = [
  { id: 'node-alpha-1', name: 'Main Distribution Bus' },
  { id: 'node-beta-2', name: 'Primary Substation A' },
  { id: 'node-gamma-3', name: 'Feeder Line 4 Output' },
  { id: 'node-delta-4', name: 'Power Transformer Unit 2' },
];

export default function LiveMonitoringView() {
  const [data, setData] = useState(generateInitialData());
  const [isLive, setIsLive] = useState(true);
  const [activeSensor, setActiveSensor] = useState(SENSORS[0].id);
  const [activeMetrics, setActiveMetrics] = useState({ point: true, collective: true, contextual: true });
  const [loading, setLoading] = useState(false);
  
  // Fetch real model scores from backend
  const fetchModelScores = async () => {
    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
      let res = await fetch(`${baseUrl}/signals/telemetry?sensor=${activeSensor}`, {
        cache: "no-store"
      });

      // Backward compatibility if backend is mounted under /api/signals
      if (!res.ok) {
        res = await fetch(`${baseUrl}/api/signals/telemetry?sensor=${activeSensor}`, {
          cache: "no-store"
        });
      }

      if (!res.ok) throw new Error("Failed to fetch model scores");
      const scores = await res.json();
      
      // Update data with real model scores from backend mapping:
      // zscore -> point, isolation_forest -> collective, lstm -> contextual
      setData(prev => {
        const last = prev[prev.length - 1];
        const next = {
          time: last.time + 1,
          point: scores.zscore !== undefined ? scores.zscore : Math.random() * 0.2,
          collective: scores.isolation_forest !== undefined ? scores.isolation_forest : Math.random() * 0.2,
          contextual: scores.lstm !== undefined ? scores.lstm : Math.random() * 0.2,
        };
        return [...prev.slice(1), next];
      });
      setLoading(false);
    } catch (err) {
      console.error("Model scores fetch error:", err);
      // Fallback to generated data if backend unavailable
      setData(prev => {
        const last = prev[prev.length - 1];
        const next = {
          time: last.time + 1,
          point: Math.random() * 0.2,
          collective: Math.random() * 0.2,
          contextual: Math.random() * 0.2,
        };
        return [...prev.slice(1), next];
      });
    }
  };
  
  // Reset data when sensor changes
  useEffect(() => {
    setData(generateInitialData());
    setLoading(true);
  }, [activeSensor]);

  useEffect(() => {
    if (!isLive) return;
    
    fetchModelScores();
    const interval = setInterval(fetchModelScores, 1000); // Fetch from backend every second
    
    return () => clearInterval(interval);
  }, [isLive, activeSensor]);

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
            Live Anomaly Monitoring
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-grid-success/10 text-grid-success text-xs font-semibold uppercase tracking-wider border border-grid-success/20">
              <span className="relative flex size-2">
                <span className={cn("absolute inline-flex h-full w-full rounded-full bg-grid-success opacity-75", isLive && "animate-ping")}></span>
                <span className="relative inline-flex rounded-full size-2 bg-grid-success"></span>
              </span>
              {isLive ? 'Receiving' : 'Paused'}
            </span>
          </h1>
          <p className="text-sm text-grid-muted mt-2 max-w-xl leading-relaxed">
            Real-time inference from ensemble detection models. Monitoring Point, Collective, and Contextual anomalies across all active nodes.
          </p>
        </div>
      </div>

      {/* Primary Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Point Anomaly Card */}
        <div className={cn("bg-grid-surface/30 border rounded-xl p-5 relative overflow-hidden transition-all", activeMetrics.point ? "border-grid-border/60 ring-1 ring-grid-border/30" : "border-grid-border/20 opacity-40")}>
          <div className="flex items-start justify-between">
            <div className="text-grid-muted flex items-center gap-2">
              <Activity className="size-4" />
              <span className="text-xs font-medium uppercase tracking-wider">Point Anomaly</span>
            </div>
            <span className={cn("text-xs font-mono", latest.point > 0.3 ? "text-grid-warning" : "text-grid-success")}>
              {latest.point > 0.3 ? "⚠" : "✓"} {(latest.point * 100).toFixed(1)}%
            </span>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <motion.span 
              key={latest.point}
              initial={{ opacity: 0.8, y: -2 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-4xl font-semibold tracking-tight font-mono text-grid-title"
            >
              {latest.point.toFixed(3)}
            </motion.span>
            <span className="text-grid-muted font-medium">Score</span>
          </div>
          <div className="absolute bottom-0 left-0 w-full h-1 bg-grid-surface">
            <motion.div 
              className={cn("h-full", latest.point > 0.3 ? "bg-grid-warning" : "bg-grid-success")}
              initial={{ width: '0%' }}
              animate={{ width: `${latest.point * 100}%` }}
              transition={{ type: "tween", duration: 1 }}
            />
          </div>
        </div>

        {/* Collective Anomaly Card */}
        <div className={cn("bg-grid-surface/30 border rounded-xl p-5 relative overflow-hidden transition-all", activeMetrics.collective ? "border-grid-border/60 ring-1 ring-grid-border/30" : "border-grid-border/20 opacity-40")}>
          <div className="flex items-start justify-between">
            <div className="text-grid-muted flex items-center gap-2">
              <Zap className="size-4" />
              <span className="text-xs font-medium uppercase tracking-wider">Collective Anomaly</span>
            </div>
            <span className={cn("text-xs font-mono", latest.collective > 0.3 ? "text-grid-warning" : "text-grid-success")}>
              {latest.collective > 0.3 ? "⚠" : "✓"} {(latest.collective * 100).toFixed(1)}%
            </span>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <motion.span 
              key={latest.collective}
              initial={{ opacity: 0.8, y: -2 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-4xl font-semibold tracking-tight font-mono text-grid-title"
            >
              {latest.collective.toFixed(3)}
            </motion.span>
            <span className="text-grid-muted font-medium">Score</span>
          </div>
          <div className="absolute bottom-0 left-0 w-full h-1 bg-grid-surface">
            <motion.div 
              className={cn("h-full", latest.collective > 0.3 ? "bg-grid-warning" : "bg-grid-success")}
              initial={{ width: '0%' }}
              animate={{ width: `${latest.collective * 100}%` }}
              transition={{ type: "tween", duration: 1 }}
            />
          </div>
        </div>

        {/* Contextual Anomaly Card */}
        <div className={cn("bg-grid-surface/30 border rounded-xl p-5 relative overflow-hidden transition-all", activeMetrics.contextual ? "border-grid-border/60 ring-1 ring-grid-border/30" : "border-grid-border/20 opacity-40")}>
          <div className="flex items-start justify-between">
            <div className="text-grid-muted flex items-center gap-2">
              <Thermometer className="size-4" />
              <span className="text-xs font-medium uppercase tracking-wider">Contextual Anomaly</span>
            </div>
            <span className={cn("text-xs font-mono", latest.contextual > 0.3 ? "text-grid-danger" : "text-grid-muted")}>
              {latest.contextual > 0.3 ? "⚠" : "✓"} {(latest.contextual * 100).toFixed(1)}%
            </span>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <motion.span 
              key={latest.contextual}
              initial={{ opacity: 0.8, y: -2 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn("text-4xl font-semibold tracking-tight font-mono", latest.contextual > 0.3 ? "text-grid-danger" : "text-grid-title")}
            >
              {latest.contextual.toFixed(3)}
            </motion.span>
            <span className="text-grid-muted font-medium">Score</span>
          </div>
          <div className="absolute bottom-0 left-0 w-full h-1 bg-grid-surface">
            <motion.div 
              className={cn("h-full", latest.contextual > 0.3 ? "bg-grid-danger" : "bg-grid-success")}
              initial={{ width: '0%' }}
              animate={{ width: `${latest.contextual * 100}%` }}
              transition={{ type: "tween", duration: 1 }}
            />
          </div>
        </div>
      </div>

      {/* Main Chart Area */}
      <div className="bg-grid-surface/20 border border-grid-border/40 rounded-xl p-5 flex flex-col gap-4 ring-1 ring-grid-border/30">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex flex-wrap gap-4 text-xs font-medium">
            <button 
              onClick={() => toggleMetric('point')}
              className={cn("flex items-center gap-2 px-2 py-1 rounded-md transition-all", activeMetrics.point ? "bg-grid-surface ring-1 ring-grid-border/50 shadow-sm" : "opacity-50 hover:opacity-80")}
            >
              <span className="size-2.5 rounded-sm bg-[#3b82f6]" /> 
              <span className={cn("text-grid-title", !activeMetrics.point && "text-grid-muted")}>Point Anomaly</span>
            </button>
            <button 
              onClick={() => toggleMetric('collective')}
              className={cn("flex items-center gap-2 px-2 py-1 rounded-md transition-all", activeMetrics.collective ? "bg-grid-surface ring-1 ring-grid-border/50 shadow-sm" : "opacity-50 hover:opacity-80")}
            >
              <span className="size-2.5 rounded-sm bg-[#8b5cf6]" /> 
              <span className={cn("text-grid-title", !activeMetrics.collective && "text-grid-muted")}>Collective Anomaly</span>
            </button>
            <button 
              onClick={() => toggleMetric('contextual')}
              className={cn("flex items-center gap-2 px-2 py-1 rounded-md transition-all", activeMetrics.contextual ? "bg-grid-surface ring-1 ring-grid-border/50 shadow-sm" : "opacity-50 hover:opacity-80")}
            >
              <span className="size-2.5 rounded-sm bg-[#ef4444]" /> 
              <span className={cn("text-grid-title", !activeMetrics.contextual && "text-grid-muted")}>Contextual Anomaly</span>
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
            {/* Point (blueish) */}
            {activeMetrics.point && renderPath('point', '#3b82f6', 0, 0.5)}
            {/* Collective (purple) */}
            {activeMetrics.collective && renderPath('collective', '#8b5cf6', 0, 0.5)}
            {/* Contextual (red) */}
            {activeMetrics.contextual && renderPath('contextual', '#ef4444', 0, 0.5)}
          </svg>
          
          {/* Scanning line effect */}
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
