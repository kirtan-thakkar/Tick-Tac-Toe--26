"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Activity,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Clock3,
  RefreshCw,
  Wind,
  Sun,
  Zap,
  ShieldCheck,
  ChevronRight,
  ShieldAlert,
  Server,
  ZapOff,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { AnimatedList } from "@/components/ui/animated-list";

// --- DATA ---
const overviewMetrics = [
  {
    label: "Total Active Anomalies",
    value: "28",
    delta: "-3",
    trend: "down",
    note: "Compared with previous 24h",
  },
  {
    label: "Critical",
    value: "4",
    delta: "+1",
    trend: "up",
    note: "Requires immediate triage",
  },
  {
    label: "Warning",
    value: "14",
    delta: "-2",
    trend: "down",
    note: "Investigating in progress",
  },
  {
    label: "Info",
    value: "10",
    trend: "flat",
    note: "Observed, no action required",
  },
  {
    label: "System Health",
    value: "97.8%",
    delta: "+0.6%",
    trend: "up",
    note: "Signal ingestion and model uptime",
  },
  {
    label: "Renewables Share",
    value: "57.4%",
    trend: "flat",
    split: [
      { source: "Wind", value: "31%" },
      { source: "Solar", value: "22%" },
      { source: "Hydro", value: "4.4%" },
    ],
  },
];

const liveFeedItems = [
  {
    id: "feed-1",
    title: "Dispatch acknowledged",
    detail: "Critical thermal anomaly moved to Investigating",
    time: "09:14",
  },
  {
    id: "feed-2",
    title: "Correlation spike detected",
    detail: "Feeder load and vibration trend diverged from baseline",
    time: "09:13",
  },
  {
    id: "feed-3",
    title: "AI Assistant recommendation",
    detail: "Suggest temporary load redistribution to TX-AT-019",
    time: "09:12",
  },
  {
    id: "feed-4",
    title: "Root-cause explanation updated",
    detail: "Likely insulation aging under peak thermal stress",
    time: "09:11",
  },
];

const anomaliesTableRows = [
  {
    id: "INC-1842",
    title: "Transformer thermal anomaly",
    severity: "Critical",
    asset: "TX-AT-022",
    status: "Investigating",
    timestamp: "09:14",
  },
  {
    id: "INC-1838",
    title: "Voltage sag on feeder ring",
    severity: "Warning",
    asset: "FL-110-PL-003",
    status: "Open",
    timestamp: "09:12",
  },
  {
    id: "INC-1831",
    title: "Relay auto-reclose failed",
    severity: "Critical",
    asset: "RL-DE-099",
    status: "Open",
    timestamp: "09:10",
  },
];

const fallbackChartPoints = [
  { label: "08:40", value: 42 },
  { label: "08:45", value: 48 },
  { label: "08:50", value: 45 },
  { label: "08:55", value: 57 },
  { label: "09:00", value: 63 },
  { label: "09:05", value: 59 },
  { label: "09:10", value: 68 },
  { label: "09:15", value: 65 },
];

// --- UTILS ---
function normalizeChartPayload(payload) {
  const sourcePoints = payload?.points ?? payload?.data ?? payload?.series ?? payload?.chart ?? [];
  if (!Array.isArray(sourcePoints) || sourcePoints.length === 0) return fallbackChartPoints;
  const normalized = sourcePoints
    .map((point, index) => {
      const label = point?.label ?? point?.time ?? point?.timestamp ?? point?.x ?? String(index + 1);
      const rawValue = point?.value ?? point?.y ?? point?.count ?? 0;
      const value = Number(rawValue);
      if (Number.isNaN(value)) return null;
      return { label: String(label), value };
    })
    .filter(Boolean);
  return normalized.length > 1 ? normalized : fallbackChartPoints;
}

function buildLinePath(points, width, height, padding) {
  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(max - min, 1);
  const usableWidth = width - padding * 2;
  const usableHeight = height - padding * 2;

  return points
    .map((point, index) => {
      const x = padding + (index / (points.length - 1)) * usableWidth;
      const y = padding + (1 - (point.value - min) / range) * usableHeight;
      return `${index === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
}

function buildAreaPath(points, width, height, padding) {
  const line = buildLinePath(points, width, height, padding);
  if (!line) return "";
  const firstX = padding;
  const lastX = width - padding;
  const bottomY = height - padding;
  return `${line} L${lastX.toFixed(2)},${bottomY} L${firstX},${bottomY} Z`;
}

function Trend({ trend, delta }) {
  if (!delta || trend === "flat") return <span className="text-xs text-grid-muted">-</span>;
  const isUp = trend === "up";
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-semibold", isUp ? "text-grid-title" : "text-grid-muted")}>
      {isUp ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />}
      {delta}
    </span>
  );
}

function SeverityBadge({ severity }) {
  if (severity === "Critical") {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-grid-danger/15 px-2 py-1 text-xs font-semibold text-grid-danger">
        <AlertTriangle className="size-3" />
        {severity}
      </span>
    );
  }
  if (severity === "Warning") {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-grid-warning/15 px-2 py-1 text-xs font-semibold text-grid-title">
        <AlertTriangle className="size-3" />
        {severity}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-grid-success/15 px-2 py-1 text-xs font-semibold text-grid-pill-foreground">
      <CheckCircle2 className="size-3" />
      {severity}
    </span>
  );
}

function StatusBadge({ status }) {
  const palette = {
    Open: "bg-grid-danger/15 text-grid-danger",
    Investigating: "bg-grid-warning/15 text-grid-title",
    Resolved: "bg-grid-success/15 text-grid-pill-foreground",
  };
  return <span className={cn("rounded-md px-2 py-1 text-xs font-semibold", palette[status])}>{status}</span>;
}

// --- COMPONENTS ---
function OverviewChart({ points, loading, error, onRefresh, lastUpdated }) {
  const chartWidth = 760;
  const chartHeight = 240;
  const chartPadding = 24;
  const path = points.length > 1 ? buildLinePath(points, chartWidth, chartHeight, chartPadding) : "";
  const areaPath = points.length > 1 ? buildAreaPath(points, chartWidth, chartHeight, chartPadding) : "";

  return (
    <div className="flex flex-col h-full bg-grid-surface/20 border border-grid-border/40 rounded-xl p-5 ring-1 ring-grid-border/30 relative overflow-hidden">
      <div className="flex items-start justify-between z-10 mb-4">
        <div>
          <h3 className="text-sm font-semibold tracking-tight flex items-center gap-2">
            <Activity className="size-4 text-grid-muted" />
            Anomaly Intensity Timeline
          </h3>
          <p className="text-xs text-grid-muted mt-1">24h rolled average</p>
        </div>
        <Button variant="outline" size="sm" onClick={onRefresh} className="h-7 px-2.5 text-xs text-grid-muted hover:text-grid-title bg-grid-surface/50">
          <RefreshCw className={cn("size-3 mr-1.5", loading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      <div className="flex-1 relative min-h-[180px] w-full mt-2">
        <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
          <defs>
            <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="currentColor" stopOpacity="0.15" className="text-grid-title" />
              <stop offset="100%" stopColor="currentColor" stopOpacity="0" className="text-grid-title" />
            </linearGradient>
          </defs>
          
          {/* Grid lines */}
          {[0.2, 0.4, 0.6, 0.8].map((step) => (
            <line
              key={step}
              x1={chartPadding}
              y1={chartPadding + (chartHeight - chartPadding * 2) * step}
              x2={chartWidth - chartPadding}
              y2={chartPadding + (chartHeight - chartPadding * 2) * step}
              stroke="currentColor"
              className="text-grid-border/50"
              strokeDasharray="4 4"
            />
          ))}

          {path && (
            <g className="text-grid-title">
              <path d={areaPath} fill="url(#chartGradient)" />
              <motion.path 
                d={path} 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2.5" 
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 1.5, ease: "easeOut" }}
              />
              {points.map((point, index) => {
                const values = points.map((e) => e.value);
                const min = Math.min(...values);
                const max = Math.max(...values);
                const range = Math.max(max - min, 1);
                const x = chartPadding + (index / (points.length - 1)) * (chartWidth - chartPadding * 2);
                const y = chartPadding + (1 - (point.value - min) / range) * (chartHeight - chartPadding * 2);
                return (
                  <g key={`${point.label}-${index}`}>
                    <motion.circle 
                      cx={x} cy={y} r="3.5" 
                      className="fill-grid-surface stroke-grid-title" 
                      strokeWidth="1.5"
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ delay: 0.8 + (index * 0.05) }}
                    />
                    {index % 2 === 0 && (
                      <text x={x} y={chartHeight - 2} textAnchor="middle" className="fill-grid-muted text-[10px]">
                        {point.label}
                      </text>
                    )}
                  </g>
                );
              })}
            </g>
          )}
        </svg>
      </div>
      
      <div className="mt-3 flex justify-between text-[10px] text-grid-muted z-10">
        <span>{loading ? "Syncing data..." : "Up to date"}</span>
        <span>{error ? `Fallback loaded` : lastUpdated}</span>
      </div>
    </div>
  );
}

export default function OverviewView({ onInvestigate }) {
  const [chartPoints, setChartPoints] = useState(fallbackChartPoints);
  const [chartLoading, setChartLoading] = useState(false);
  const [chartError, setChartError] = useState("");
  const [chartLastUpdated, setChartLastUpdated] = useState("never");

  // Simulated Model Scores for Anomaly Detection
  const [modelScores, setModelScores] = useState({
    statistical: 0.15,
    isolationForest: 0.22,
    lstm: 0.18,
  });

  const fetchChartData = async () => {
    setChartLoading(true);
    setChartError("");
    const baseUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:8000";
    const chartPath = process.env.NEXT_PUBLIC_CHARTS_PATH || "/chats/chart";

    try {
      const response = await fetch(`${baseUrl}${chartPath}`, {
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      setChartPoints(normalizeChartPayload(payload));
      setChartLastUpdated(new Date().toLocaleTimeString());
    } catch (error) {
      setChartError(error instanceof Error ? error.message : "Request failed");
      setChartPoints(fallbackChartPoints);
      setChartLastUpdated(new Date().toLocaleTimeString());
    } finally {
      setChartLoading(false);
    }
  };

  useEffect(() => {
    fetchChartData();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setModelScores({
        statistical: Math.random() * 0.4, // 0 to 0.4
        isolationForest: Math.random() * 0.5, // 0 to 0.5
        lstm: Math.random() * 0.6, // 0 to 0.6
      });
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const weights = { statistical: 0.2, isolationForest: 0.3, lstm: 0.5 };
  const weightedMean = 
    (modelScores.statistical * weights.statistical) +
    (modelScores.isolationForest * weights.isolationForest) +
    (modelScores.lstm * weights.lstm);
  
  const isAnomaly = weightedMean > 0.4;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-8">
      {/* 1. Hero / Executive Status */}
      <motion.div 
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl bg-grid-surface/40 border border-grid-border/40 ring-1 ring-grid-border/30 p-6 sm:p-8"
      >
        <div className="absolute top-0 right-0 p-8 opacity-20 pointer-events-none">
          {isAnomaly ? <ShieldAlert className="size-48 text-grid-danger" strokeWidth={1} /> : <ShieldCheck className="size-48 text-grid-success" strokeWidth={1} />}
        </div>
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="space-y-2">
            <h1 className="text-3xl font-medium tracking-tight text-grid-title flex items-center gap-3">
              System Overview
              <span className={cn("flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wider border", isAnomaly ? "bg-grid-danger/10 text-grid-danger border-grid-danger/20" : "bg-grid-success/10 text-grid-success border-grid-success/20")}>
                <span className={cn("size-1.5 rounded-full animate-pulse", isAnomaly ? "bg-grid-danger" : "bg-grid-success")} />
                {isAnomaly ? "Anomaly Detected" : "Nominal"}
              </span>
            </h1>
            <p className="text-sm text-grid-muted max-w-lg leading-relaxed">
              Global infrastructure is actively monitored. Real-time ensemble AI models calculate live anomaly scores across 1,248 telemetry signals.
            </p>
          </div>
          <div className="flex gap-4 items-center bg-grid-surface/80 border border-grid-border/50 rounded-xl p-4 shadow-sm backdrop-blur-sm">
            <div className="flex flex-col gap-2.5 border-r border-grid-border/50 pr-5">
              <div className="flex items-center justify-between gap-6 text-[11px] font-mono">
                <span className="text-grid-muted uppercase tracking-wider">Statistical <span className="opacity-50">(w:0.2)</span></span>
                <span className={cn("font-medium", modelScores.statistical > 0.4 ? "text-grid-warning" : "text-grid-title")}>{modelScores.statistical.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between gap-6 text-[11px] font-mono">
                <span className="text-grid-muted uppercase tracking-wider">Isolation Forest <span className="opacity-50">(w:0.3)</span></span>
                <span className={cn("font-medium", modelScores.isolationForest > 0.4 ? "text-grid-warning" : "text-grid-title")}>{modelScores.isolationForest.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between gap-6 text-[11px] font-mono">
                <span className="text-grid-muted uppercase tracking-wider">LSTM Encoder <span className="opacity-50">(w:0.5)</span></span>
                <span className={cn("font-medium", modelScores.lstm > 0.4 ? "text-grid-warning" : "text-grid-title")}>{modelScores.lstm.toFixed(2)}</span>
              </div>
            </div>
            <div className="text-center pl-3 pr-2 min-w-[100px]">
              <p className="text-[10px] text-grid-muted uppercase tracking-wider font-semibold mb-1">Ensemble Score</p>
              <p className={cn("text-4xl font-mono tracking-tight transition-colors", isAnomaly ? "text-grid-danger" : "text-grid-success")}>
                {weightedMean.toFixed(2)}
              </p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* 2. KPI Bento Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {overviewMetrics.slice(0, 4).map((metric, i) => (
          <motion.div
            key={metric.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="bg-grid-surface/20 border border-grid-border/40 rounded-xl p-5 ring-1 ring-grid-border/30 hover:bg-grid-surface/40 transition-colors"
          >
            <div className="flex items-start justify-between gap-3 mb-4">
              <p className="text-xs font-semibold tracking-wider text-grid-muted uppercase">
                {metric.label}
              </p>
              <Trend trend={metric.trend} delta={metric.delta} />
            </div>
            <div className="flex items-baseline gap-2">
              <p className={cn(
                "text-3xl font-semibold tracking-tight",
                metric.label === "Critical" ? "text-grid-danger" :
                metric.label === "Warning" ? "text-grid-warning" : "text-grid-title"
              )}>{metric.value}</p>
            </div>
            <p className="text-[10px] text-grid-muted mt-2 uppercase tracking-wider">{metric.note}</p>
          </motion.div>
        ))}
      </div>

      {/* 3. Main Split Area: Chart & Action Items */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Timeline Chart (Takes 2 columns) */}
        <div className="lg:col-span-2">
          <OverviewChart
            points={chartPoints}
            loading={chartLoading}
            error={chartError}
            onRefresh={fetchChartData}
            lastUpdated={chartLastUpdated}
          />
        </div>

        {/* Priority Action Queue */}
        <div className="flex flex-col gap-4">
          <div className="bg-grid-surface/20 border border-grid-border/40 rounded-xl p-5 ring-1 ring-grid-border/30 flex flex-col h-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold tracking-tight flex items-center gap-2">
                <ShieldAlert className="size-4 text-grid-danger" />
                Priority Queue
              </h3>
              <span className="text-[10px] bg-grid-danger/10 text-grid-danger px-2 py-0.5 rounded-full font-medium uppercase tracking-wider border border-grid-danger/20">
                Action Req
              </span>
            </div>

            <div className="flex-1 flex flex-col gap-3">
              {anomaliesTableRows.slice(0,3).map((anomaly) => (
                <div 
                  key={anomaly.id} 
                  className="group relative bg-grid-surface/30 rounded-lg p-3 border border-grid-border/50 hover:border-grid-border transition-colors cursor-pointer"
                  onClick={() => onInvestigate(anomaly)}
                >
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <span className="font-mono text-[10px] text-grid-muted">{anomaly.id}</span>
                    <span className="text-[10px] text-grid-muted flex items-center gap-1">
                      <Clock3 className="size-3" /> {anomaly.timestamp}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-grid-title leading-tight mb-2 group-hover:text-grid-title/80 transition-colors">
                    {anomaly.title}
                  </p>
                  <div className="flex items-center justify-between">
                    <SeverityBadge severity={anomaly.severity} />
                    <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2 opacity-0 group-hover:opacity-100 transition-opacity text-grid-title bg-grid-surface/80 border border-grid-border">
                      Investigate <ChevronRight className="size-3 ml-1" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 4. Live Feed & Renewables */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Live Feed */}
        <div className="lg:col-span-2 bg-grid-surface/20 border border-grid-border/40 rounded-xl p-5 ring-1 ring-grid-border/30">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold tracking-tight flex items-center gap-2">
              <Server className="size-4 text-grid-muted" />
              Live Incident Feed
            </h3>
          </div>
          <AnimatedList className="gap-2" delay={1200}>
            {liveFeedItems.map((item) => (
              <div
                key={item.id}
                className="w-full flex items-center gap-4 rounded-lg border border-grid-border/30 bg-grid-page/40 px-4 py-3"
              >
                <div className="size-2 rounded-full bg-grid-title animate-pulse shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-grid-title truncate">{item.title}</p>
                  <p className="text-xs text-grid-muted truncate">{item.detail}</p>
                </div>
                <span className="text-[10px] font-mono text-grid-muted shrink-0">{item.time}</span>
              </div>
            ))}
          </AnimatedList>
        </div>

        {/* Renewables Share */}
        <div className="bg-grid-surface/20 border border-grid-border/40 rounded-xl p-5 ring-1 ring-grid-border/30 flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-sm font-semibold tracking-tight flex items-center gap-2">
              <ZapOff className="size-4 text-grid-muted" />
              Energy Mix
            </h3>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-grid-muted">Current</span>
          </div>
          
          <div className="mb-6 flex items-baseline justify-between">
            <p className="text-xs font-semibold text-grid-muted uppercase tracking-wider">Renewables</p>
            <p className="text-3xl font-medium tracking-tight text-grid-success">{overviewMetrics[5].value}</p>
          </div>

          <div className="space-y-4 flex-1">
            {overviewMetrics[5].split.map((item, idx) => (
              <div key={item.source} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="inline-flex items-center gap-1.5 font-medium text-grid-title">
                    {item.source === "Wind" ? <Wind className="size-3 text-[#3b82f6]" /> : 
                     item.source === "Solar" ? <Sun className="size-3 text-[#eab308]" /> : 
                     <Zap className="size-3 text-[#8b5cf6]" />}
                    {item.source}
                  </span>
                  <span className="font-mono text-grid-muted">{item.value}</span>
                </div>
                <div className="h-1.5 w-full bg-grid-surface rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: item.value }}
                    transition={{ duration: 1, delay: idx * 0.1 }}
                    className={cn(
                      "h-full rounded-full",
                      item.source === "Wind" ? "bg-[#3b82f6]" : 
                      item.source === "Solar" ? "bg-[#eab308]" : "bg-[#8b5cf6]"
                    )}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}