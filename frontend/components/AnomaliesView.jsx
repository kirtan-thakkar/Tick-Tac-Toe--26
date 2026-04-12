"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Search,
  ShieldAlert,
  Bot,
  Filter,
  Clock,
  Activity,
  Zap,
  Thermometer
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence, LayoutGroup } from "motion/react";

function formatTimestamp(ts) {
  if (!ts) return "--:--";
  // Handle both unix int and HH:MM string from dummy data
  if (typeof ts === "number") {
    return new Date(ts * 1000).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  }
  return ts;
}

function SeverityIcon({ severity, className }) {
  if (severity === "Critical")
    return <ShieldAlert className={cn("text-grid-danger", className)} />;
  if (severity === "Warning")
    return <AlertTriangle className={cn("text-grid-warning", className)} />;
  return <CheckCircle2 className={cn("text-grid-success", className)} />;
}

// Map anomaly types to specific icons for extra context
function AnomalyTypeIcon({ type, className }) {
  if (type === "point") return <Activity className={cn("text-blue-400", className)} title="Point Anomaly" />;
  if (type === "collective") return <Zap className={cn("text-purple-400", className)} title="Collective Anomaly" />;
  if (type === "contextual") return <Thermometer className={cn("text-red-400", className)} title="Contextual Anomaly" />;
  return null;
}

const STATUS_STYLES = {
  Open: {
    wrapper: "bg-grid-danger/10 text-grid-danger",
    dot: "bg-grid-danger",
  },
  Investigating: {
    wrapper: "bg-grid-warning/10 text-grid-warning",
    dot: "bg-grid-warning",
  },
  Resolved: {
    wrapper: "bg-grid-success/10 text-grid-success",
    dot: "bg-grid-success",
  },
};

const FILTERS = ["All", "Critical", "Warning", "Info"];

const FALLBACK_DATA = [
  {
    id: "INC-1842",
    title: "Point anomaly detected",
    severity: "Critical",
    asset: "sensor_0",
    status: "Open",
    timestamp: Math.floor(Date.now() / 1000) - 360,
    hypothesis: "Extreme value deviation detected on main bus.",
    duration: "6m active",
    anomaly_score: 0.84,
    anomaly_type: "point"
  },
  {
    id: "INC-1838",
    title: "Collective anomaly detected",
    severity: "Warning",
    asset: "sensor_5",
    status: "Investigating",
    timestamp: Math.floor(Date.now() / 1000) - 720,
    hypothesis: "Unusual pattern in sensor correlation detected by Isolation Forest.",
    duration: "12m active",
    anomaly_score: 0.56,
    anomaly_type: "collective"
  },
  {
    id: "INC-1831",
    title: "Contextual anomaly detected",
    severity: "Critical",
    asset: "sensor_12",
    status: "Open",
    timestamp: Math.floor(Date.now() / 1000) - 1200,
    hypothesis: "Behavior deviates from historical patterns detected by LSTM.",
    duration: "20m active",
    anomaly_score: 0.91,
    anomaly_type: "contextual"
  }
];

export default function AnomaliesView({ onInvestigate }) {
  const [anomalies, setAnomalies] = useState(FALLBACK_DATA);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("All");
  const [toast, setToast] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const toastTimer = useRef(null);

  const showToast = useCallback((msg, type = "success") => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ msg, type });
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  }, []);

  const fetchAnomalies = useCallback(async () => {
    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
      const params = new URLSearchParams({
        limit: 20,
        page,
        ...(searchQuery && { search: searchQuery }),
        ...(activeFilter !== "All" && { severity: activeFilter }),
      });
      const res = await fetch(`${baseUrl}/anomalies/list?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      const items = data.items || [];
      if (items.length > 0) {
        setAnomalies(items);
        setTotalPages(data.pages || 1);
      } else if (page === 1 && !searchQuery && activeFilter === "All") {
         // Keep fallback if backend returns nothing on initial load
         setAnomalies(FALLBACK_DATA);
      } else {
         setAnomalies([]);
      }
    } catch (err) {
      console.error("fetchAnomalies failed:", err);
      if (anomalies === FALLBACK_DATA) setAnomalies(FALLBACK_DATA);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, activeFilter, page]);

  useEffect(() => {
    setLoading(true);
    fetchAnomalies();
    const interval = setInterval(fetchAnomalies, 10000); // Refresh every 10s
    return () => clearInterval(interval);
  }, [fetchAnomalies]);

  const recordFeedback = async (anomaly, verdict) => {
    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
      const res = await fetch(`${baseUrl}/feedback/record`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          timestamp: typeof anomaly.timestamp === "number" ? anomaly.timestamp : Math.floor(Date.now() / 1000),
          incident_id: anomaly.id,
          operator_id: "OP-001",
          verdict,
          severity_agree: true,
          notes: `Feedback for ${anomaly.id}`,
        }),
      });
      if (res.ok) {
        showToast(
          verdict === "true_positive" ? "Confirmed anomaly" : "Flagged as false positive",
          verdict === "true_positive" ? "success" : "warning"
        );
      } else {
        showToast("Feedback submission failed", "error");
      }
    } catch {
      showToast("Network error submitting feedback", "error");
    }
  };

  const counts = {
    All: anomalies.length,
    Critical: anomalies.filter((a) => a.severity === "Critical").length,
    Warning: anomalies.filter((a) => a.severity === "Warning").length,
    Info: anomalies.filter((a) => a.severity === "Info").length,
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            key="toast"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={cn(
              "fixed top-4 right-4 z-50 px-4 py-2.5 rounded-lg text-sm font-medium shadow-lg border",
              toast.type === "success" && "bg-grid-success/10 border-grid-success/30 text-grid-success",
              toast.type === "warning" && "bg-grid-warning/10 border-grid-warning/30 text-grid-warning",
              toast.type === "error" && "bg-grid-danger/10 border-grid-danger/30 text-grid-danger"
            )}
          >
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-medium tracking-tight text-grid-title">
            Anomaly History
          </h1>
          <p className="text-sm text-grid-muted mt-2 max-w-md leading-relaxed">
            Review the historical stream of Point, Collective, and Contextual anomalies identified by the SentinelIQ ensemble engine.
          </p>
        </div>
      </div>

      {/* Filter Tabs + Search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pb-2 border-b border-grid-border/40">
        <div className="flex items-center gap-1 w-full sm:w-auto bg-grid-surface/50 p-1 rounded-lg border border-grid-border/30">
          <LayoutGroup>
            {FILTERS.map((f) => {
              const isActive = activeFilter === f;
              const colorMap = {
                Critical: "text-grid-danger",
                Warning: "text-grid-warning",
                Info: "text-grid-success",
              };
              return (
                <button
                  key={f}
                  onClick={() => {
                    setActiveFilter(f);
                    setPage(1);
                  }}
                  className={cn(
                    "relative px-4 py-1.5 text-sm font-medium transition-colors rounded-md z-10",
                    isActive ? "text-grid-title" : "text-grid-muted hover:text-grid-title/80"
                  )}
                >
                  {isActive && (
                    <motion.div
                      layoutId="activeFilterBg"
                      className="absolute inset-0 bg-grid-page rounded-md shadow-sm border border-grid-border/40 z-[-1]"
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    />
                  )}
                  <div className="flex items-center gap-2">
                    <span className={cn("relative z-10", isActive && f !== "All" && colorMap[f])}>
                      {f === "Info" ? "Nominal" : f === "All" ? "All Detection" : f}
                    </span>
                    <span className="relative z-10 text-[10px] bg-grid-surface/80 px-1.5 py-0.5 rounded-full border border-grid-border/20">
                      {counts[f]}
                    </span>
                  </div>
                </button>
              );
            })}
          </LayoutGroup>
        </div>

        <div className="relative w-full sm:w-72 group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-grid-muted group-focus-within:text-grid-title transition-colors" />
          <input
            type="text"
            placeholder="Search events or assets..."
            className="w-full pl-9 pr-4 py-2 bg-grid-surface/30 border border-grid-border/40 hover:border-grid-border/80 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-grid-title/30 text-grid-title placeholder:text-grid-muted transition-all"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-grid-surface/20 rounded-xl overflow-hidden ring-1 ring-grid-border/30">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead className="bg-grid-surface/40 text-grid-muted">
              <tr>
                <th className="px-6 py-4 font-medium text-xs tracking-wider">TIME & ID</th>
                <th className="px-6 py-4 font-medium text-xs tracking-wider">DETECTION INSIGHT</th>
                <th className="px-6 py-4 font-medium text-xs tracking-wider">ASSET</th>
                <th className="px-6 py-4 font-medium text-xs tracking-wider">STATUS</th>
                <th className="px-6 py-4 font-medium text-xs tracking-wider">ENSEMBLE</th>
                <th className="px-6 py-4 font-medium text-xs tracking-wider text-right">FEEDBACK</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-grid-border/20">
              <AnimatePresence mode="popLayout" initial={false}>
                {loading ? (
                  <motion.tr key="loading-row">
                    <td colSpan={6} className="py-16 text-center text-grid-muted">
                      <Clock className="size-5 opacity-50 inline-block animate-spin mb-3" />
                      <p className="text-sm">Synchronizing historical data...</p>
                    </td>
                  </motion.tr>
                ) : anomalies.length > 0 ? (
                  anomalies.map((anomaly, index) => {
                    const statusStyle = STATUS_STYLES[anomaly.status] || STATUS_STYLES["Open"];
                    return (
                      <motion.tr
                        layout
                        key={`${anomaly.id}-${index}`}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.98 }}
                        transition={{ delay: index * 0.04 }}
                        className="group hover:bg-grid-surface/60 transition-colors"
                      >
                        <td className="px-6 py-4 align-top w-40">
                          <div className="flex items-center text-[11px] text-grid-title/90 gap-1.5 font-mono mb-1">
                            <Clock className="size-3 text-grid-muted" />
                            {formatTimestamp(anomaly.timestamp)}
                          </div>
                          <span className="font-mono text-[10px] text-grid-muted block">
                            {anomaly.id}
                          </span>
                        </td>

                        <td className="px-6 py-4 align-top max-w-md">
                          <div className="flex items-start gap-3">
                            <div className="mt-1 relative">
                              <SeverityIcon severity={anomaly.severity} className="size-4 shrink-0" />
                              <div className="absolute -top-1 -right-1">
                                <AnomalyTypeIcon type={anomaly.anomaly_type} className="size-2.5" />
                              </div>
                            </div>
                            <div>
                              <span className="font-medium text-grid-title block mb-1">
                                {anomaly.title}
                              </span>
                              <span className="text-xs text-grid-muted/90 leading-relaxed block pr-4">
                                {anomaly.hypothesis}
                              </span>
                            </div>
                          </div>
                        </td>

                        <td className="px-6 py-4 align-top w-32">
                          <span className="inline-flex font-mono text-xs text-grid-title/80 bg-grid-surface/50 px-2 py-0.5 rounded border border-grid-border/20">
                            {anomaly.asset}
                          </span>
                        </td>

                        <td className="px-6 py-4 align-top w-32">
                          <span className={cn("inline-flex items-center gap-1.5 rounded-full text-[10px] font-medium px-2 py-0.5", statusStyle.wrapper)}>
                            <span className={cn("size-1.5 rounded-full", statusStyle.dot)} />
                            {anomaly.status}
                          </span>
                        </td>

                        <td className="px-6 py-4 align-top w-24">
                          {anomaly.anomaly_score != null && (
                            <div className="flex flex-col gap-1.5">
                              <span className={cn(
                                "text-xs font-mono font-bold",
                                anomaly.anomaly_score > 0.7 ? "text-grid-danger" : 
                                anomaly.anomaly_score > 0.4 ? "text-grid-warning" : "text-grid-success"
                              )}>
                                {(anomaly.anomaly_score * 100).toFixed(0)}%
                              </span>
                              <div className="w-12 h-1 bg-grid-surface rounded-full overflow-hidden">
                                <motion.div 
                                  initial={{ width: 0 }}
                                  animate={{ width: `${anomaly.anomaly_score * 100}%` }}
                                  className={cn(
                                    "h-full rounded-full",
                                    anomaly.anomaly_score > 0.7 ? "bg-grid-danger" : 
                                    anomaly.anomaly_score > 0.4 ? "bg-grid-warning" : "bg-grid-success"
                                  )}
                                />
                              </div>
                            </div>
                          )}
                        </td>

                        <td className="px-6 py-4 align-top text-right">
                          <div className="flex items-center justify-end gap-2">
                             <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-grid-success hover:bg-grid-success/10"
                              onClick={() => recordFeedback(anomaly, "true_positive")}
                            >
                              <CheckCircle2 className="size-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-grid-danger hover:bg-grid-danger/10"
                              onClick={() => recordFeedback(anomaly, "false_positive")}
                            >
                              <AlertTriangle className="size-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 text-[11px] font-medium border-grid-border/40 hover:bg-grid-surface hover:text-grid-primary"
                              onClick={() => onInvestigate && onInvestigate(anomaly)}
                            >
                              Details
                            </Button>
                          </div>
                        </td>
                      </motion.tr>
                    );
                  })
                ) : (
                  <motion.tr key="empty-row">
                    <td colSpan={6} className="py-24 text-center text-grid-muted">
                      <Bot className="size-10 mx-auto mb-4 opacity-20" />
                      <p className="text-sm font-medium">No anomalies detected in this scope</p>
                      <p className="text-xs mt-1">SentinelIQ is monitoring for irregularities...</p>
                    </td>
                  </motion.tr>
                )}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
        
        {/* Pagination placeholder */}
        {totalPages > 1 && (
          <div className="px-6 py-3 bg-grid-surface/30 border-t border-grid-border/20 flex items-center justify-between">
            <span className="text-xs text-grid-muted">Page {page} of {totalPages}</span>
            <div className="flex gap-2">
               <Button 
                disabled={page === 1} 
                variant="outline" 
                size="sm" 
                className="h-7 text-[10px]"
                onClick={() => setPage(p => Math.max(1, p - 1))}
              >
                Prev
              </Button>
               <Button 
                disabled={page === totalPages} 
                variant="outline" 
                size="sm" 
                className="h-7 text-[10px]"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
