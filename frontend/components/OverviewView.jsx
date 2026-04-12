"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Clock3,
  ShieldCheck,
  ChevronRight,
  ShieldAlert,
  Server,
  Brain,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { AnimatedList } from "@/components/ui/animated-list";

// --- DATA ---
const initialOverviewMetrics = [
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
];

const initialLiveFeedItems = [
  {
    id: "feed-1",
    title: "Detection stream connected",
    detail: "Waiting for model updates",
    time: "--:--",
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

// --- UTILS ---
function computeTrend(current, previous, isPercentage = false) {
  if (typeof previous !== "number") return { trend: "flat", delta: null };

  const diff = current - previous;
  if (diff === 0) return { trend: "flat", delta: "0" };

  return {
    trend: diff > 0 ? "up" : "down",
    delta: `${diff > 0 ? "+" : ""}${isPercentage ? diff.toFixed(1) : Math.round(diff)}${isPercentage ? "%" : ""}`,
  };
}

function parseMetricValue(metrics, label) {
  const raw = metrics.find((metric) => metric.label === label)?.value ?? "0";
  return Number.parseFloat(String(raw).replace("%", "")) || 0;
}

function buildLiveFeed(modelScores, weightedMean, metrics) {
  const now = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const critical = parseMetricValue(metrics, "Critical");
  const warning = parseMetricValue(metrics, "Warning");
  const total = parseMetricValue(metrics, "Total Active Anomalies");

  const riskState = weightedMean >= 0.45 ? "High" : weightedMean >= 0.3 ? "Elevated" : "Nominal";
  const topModel = Object.entries(modelScores).sort((a, b) => b[1] - a[1])[0];

  return [
    {
      id: `feed-risk-${now}`,
      title: `Risk posture: ${riskState}`,
      detail: `Ensemble score ${weightedMean.toFixed(2)} with ${total} active anomalies.`,
      time: now,
    },
    {
      id: `feed-model-${now}`,
      title: `${topModel[0]} model leading detections`,
      detail: `Current score ${topModel[1].toFixed(2)} is highest among active detectors.`,
      time: now,
    },
    {
      id: `feed-critical-${now}`,
      title: critical > 0 ? "Critical queue requires action" : "No critical queue pressure",
      detail: critical > 0 ? `${critical} critical incidents awaiting triage.` : "Critical anomaly count is currently zero.",
      time: now,
    },
    {
      id: `feed-warning-${now}`,
      title: "Warning stream update",
      detail: `${warning} warning-level anomalies are being tracked in real time.`,
      time: now,
    },
  ];
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

export default function OverviewView({ onInvestigate }) {
  const [overviewMetrics, setOverviewMetrics] = useState(initialOverviewMetrics);
  const [metricsLoading, setMetricsLoading] = useState(true);
  const previousMetricsRef = useRef();
  const [liveFeedItems, setLiveFeedItems] = useState(initialLiveFeedItems);

  // Simulated Model Scores for Anomaly Detection
  const [modelScores, setModelScores] = useState({
    statistical: 0.15,
    isolationForest: 0.22,
    lstm: 0.18,
  });

  useEffect(() => {
    const fetchMetrics = async () => {
      setMetricsLoading(true);
      try {
        const baseUrl =
          process.env.NEXT_PUBLIC_BACKEND_URL ||
          process.env.NEXT_PUBLIC_API_URL ||
          "http://localhost:8000";
        const res = await fetch(`${baseUrl}/api/overview/metrics`, {
          cache: "no-store"
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const totals = {
          totalActiveAnomalies: Number(data.totalActiveAnomalies || 0),
          critical: Number(data.critical || 0),
          warning: Number(data.warning || 0),
          info: Number(data.info || 0),
          systemHealthPercent: Number(data.systemHealthPercent || 0),
        };
        const previous = previousMetricsRef.current;
        const totalTrend = computeTrend(totals.totalActiveAnomalies, previous?.totalActiveAnomalies);
        const criticalTrend = computeTrend(totals.critical, previous?.critical);
        const warningTrend = computeTrend(totals.warning, previous?.warning);
        const infoTrend = computeTrend(totals.info, previous?.info);
        const healthTrend = computeTrend(totals.systemHealthPercent, previous?.systemHealthPercent, true);
        
        setOverviewMetrics([
          { 
            label: "Total Active Anomalies", 
            value: String(totals.totalActiveAnomalies), 
            delta: totalTrend.delta,
            trend: totalTrend.trend,
            note: "Compared with previous sync" 
          },
          { 
            label: "Critical", 
            value: String(totals.critical), 
            delta: criticalTrend.delta,
            trend: criticalTrend.trend,
            note: "Requires immediate triage" 
          },
          { 
            label: "Warning", 
            value: String(totals.warning), 
            delta: warningTrend.delta,
            trend: warningTrend.trend,
            note: "Investigating in progress" 
          },
          { 
            label: "Info", 
            value: String(totals.info), 
            delta: infoTrend.delta,
            trend: infoTrend.trend,
            note: "Observed, no action required" 
          },
          {
            label: "System Health",
            value: `${totals.systemHealthPercent}%`,
            delta: healthTrend.delta,
            trend: healthTrend.trend,
            note: "Signal ingestion and model uptime",
          },
        ]);
        previousMetricsRef.current = totals;
        setMetricsLoading(false);
      } catch (err) {
        console.error("Failed to fetch overview metrics:", err);
        setMetricsLoading(false);
        // Keep showing initial data on error
      }
    };
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 10000);
    return () => clearInterval(interval);
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
  const criticalCount = parseMetricValue(overviewMetrics, "Critical");
  const warningCount = parseMetricValue(overviewMetrics, "Warning");
  const infoCount = parseMetricValue(overviewMetrics, "Info");
  const totalActiveCount = parseMetricValue(overviewMetrics, "Total Active Anomalies");
  const healthPercent = parseMetricValue(overviewMetrics, "System Health");
  const primaryCardLabels = [
    "Total Active Anomalies",
    "Critical",
    "Warning",
    "Info",
  ];
  const primaryCards = primaryCardLabels
    .map((label) => overviewMetrics.find((metric) => metric.label === label))
    .filter(Boolean);

  useEffect(() => {
    setLiveFeedItems(buildLiveFeed(modelScores, weightedMean, overviewMetrics));
  }, [modelScores, overviewMetrics, weightedMean]);

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
        {primaryCards.map((metric, i) => (
          <motion.div
            key={metric.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="bg-grid-surface/20 border border-grid-border/40 rounded-xl p-5 ring-1 ring-grid-border/30 hover:bg-grid-surface/40 transition-colors relative overflow-hidden"
          >
            {metricsLoading && i < 4 && (
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-grid-surface/20 to-transparent animate-pulse" />
            )}
            <div className="flex items-start justify-between gap-3 mb-4">
              <p className="text-xs font-semibold tracking-wider text-grid-muted uppercase">
                {metric.label}
              </p>
              {metric.delta && <Trend trend={metric.trend} delta={metric.delta} />}
            </div>
            <div className="flex items-baseline gap-2">
              <motion.span
                key={`${metric.label}-${metric.value}`}
                initial={{ opacity: 0.7, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className={cn(
                  "text-3xl font-semibold tracking-tight font-mono",
                  metric.label === "Critical" ? "text-grid-danger" :
                  metric.label === "Warning" ? "text-grid-warning" : "text-grid-title"
                )}
              >
                {metric.value}
              </motion.span>
            </div>
            <p className="text-[10px] text-grid-muted mt-2 uppercase tracking-wider">{metric.note}</p>
          </motion.div>
        ))}
      </div>

      {/* 3. Priority Action Queue */}
      <div className="grid grid-cols-1 gap-6">
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

      {/* 4. Live Feed & Detection Posture */}
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

        {/* Detection Posture */}
        <div className="bg-grid-surface/20 border border-grid-border/40 rounded-xl p-5 ring-1 ring-grid-border/30 flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-sm font-semibold tracking-tight flex items-center gap-2">
              <Brain className="size-4 text-grid-muted" />
              Detection Posture
            </h3>
            <span
              className={cn(
                "text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border",
                isAnomaly
                  ? "text-grid-danger border-grid-danger/30 bg-grid-danger/10"
                  : "text-grid-success border-grid-success/30 bg-grid-success/10"
              )}
            >
              {isAnomaly ? "Elevated" : "Stable"}
            </span>
          </div>
          
          <div className="mb-6 flex items-baseline justify-between">
            <p className="text-xs font-semibold text-grid-muted uppercase tracking-wider">Ensemble Score</p>
            <p className={cn("text-3xl font-medium tracking-tight", isAnomaly ? "text-grid-danger" : "text-grid-success")}>{weightedMean.toFixed(2)}</p>
          </div>

          <div className="space-y-4 flex-1">
            {[
              { label: "Critical", value: criticalCount, color: "bg-grid-danger" },
              { label: "Warning", value: warningCount, color: "bg-grid-warning" },
              { label: "Info", value: infoCount, color: "bg-grid-success" },
            ].map((item, idx) => (
              <div key={item.label} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-grid-title">{item.label}</span>
                  <span className="font-mono text-grid-muted">{item.value}</span>
                </div>
                <div className="h-1.5 w-full bg-grid-surface rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${totalActiveCount > 0 ? (item.value / totalActiveCount) * 100 : 0}%` }}
                    transition={{ duration: 1, delay: idx * 0.1 }}
                    className={cn("h-full rounded-full", item.color)}
                  />
                </div>
              </div>
            ))}

            <div className="mt-4 rounded-lg border border-grid-border/40 bg-grid-page/30 p-3 text-xs text-grid-muted space-y-1">
              <p>Total active anomalies: <span className="font-mono text-grid-title">{totalActiveCount}</span></p>
              <p>System health: <span className="font-mono text-grid-title">{healthPercent.toFixed(1)}%</span></p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
