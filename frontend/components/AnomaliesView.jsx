"use client";

import { useState, useEffect, useMemo } from "react";
import { 
  AlertTriangle, 
  CheckCircle2, 
  Search, 
  ShieldAlert, 
  Bot,
  Filter,
  Clock
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence, LayoutGroup } from "motion/react";

// Dummy data 
const initialAnomalies = [
  {
    id: "INC-1842",
    title: "Transformer thermal anomaly",
    severity: "Critical",
    asset: "TX-AT-022",
    status: "Investigating",
    timestamp: "09:14",
    hypothesis: "Insulation breakdown leading to localized overheating.",
    duration: "12m active"
  },
  {
    id: "INC-1838",
    title: "Voltage sag on feeder ring",
    severity: "Warning",
    asset: "FL-110-PL-003",
    status: "Open",
    timestamp: "09:12",
    hypothesis: "Upstream grid fluctuation or sudden heavy load connection.",
    duration: "14m active"
  },
  {
    id: "INC-1831",
    title: "Relay auto-reclose failed",
    severity: "Critical",
    asset: "RL-DE-099",
    status: "Open",
    timestamp: "09:10",
    hypothesis: "Mechanical failure in the recloser locking mechanism.",
    duration: "16m active"
  },
  {
    id: "INC-1824",
    title: "Frequency oscillation burst",
    severity: "Warning",
    asset: "GRID-EU-2",
    status: "Resolved",
    timestamp: "09:01",
    hypothesis: "Brief renewable generation drop matched with demand spike.",
    duration: "Resolved in 5m"
  },
  {
    id: "INC-1816",
    title: "Sensor drift on current probe",
    severity: "Info",
    asset: "SN-CZ-115",
    status: "Resolved",
    timestamp: "08:54",
    hypothesis: "Normal calibration drift over 6 months.",
    duration: "Resolved automatically"
  },
];

function SeverityIcon({ severity, className }) {
  if (severity === "Critical") return <ShieldAlert className={cn("text-grid-danger", className)} />;
  if (severity === "Warning") return <AlertTriangle className={cn("text-grid-warning", className)} />;
  return <CheckCircle2 className={cn("text-grid-success", className)} />;
}

export default function AnomaliesView({ onInvestigate }) {
  const [anomalies, setAnomalies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("All");

  useEffect(() => {
    const timer = setTimeout(() => {
      setAnomalies(initialAnomalies);
      setLoading(false);
    }, 600);
    return () => clearTimeout(timer);
  }, []);

  const counts = useMemo(() => ({
    All: anomalies.length,
    Critical: anomalies.filter(a => a.severity === "Critical").length,
    Warning: anomalies.filter(a => a.severity === "Warning").length,
    Info: anomalies.filter(a => a.severity === "Info").length,
  }), [anomalies]);

  const filteredAnomalies = useMemo(() => {
    return anomalies.filter(anomaly => {
      const matchesSearch = anomaly.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            anomaly.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            anomaly.asset.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesFilter = activeFilter === "All" || anomaly.severity === activeFilter;
      return matchesSearch && matchesFilter;
    });
  }, [anomalies, searchQuery, activeFilter]);

  const filters = [
    { id: "All", label: "All Events", count: counts.All },
    { id: "Critical", label: "Critical", count: counts.Critical, color: "text-grid-danger" },
    { id: "Warning", label: "Warning", count: counts.Warning, color: "text-grid-warning" },
    { id: "Info", label: "Resolved", count: counts.Info, color: "text-grid-success" },
  ];

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Header section with refined typography */}
      <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-medium tracking-tight text-grid-title">Anomalies</h1>
          <p className="text-sm text-grid-muted mt-2 max-w-md leading-relaxed">
            Monitor and investigate system irregularities. Real-time telemetry paired with AI-driven hypothesis generation.
          </p>
        </div>
      </div>

      {/* Minimalist Controls: Filter Tabs & Search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pb-2 border-b border-grid-border/40">
        <div className="flex items-center gap-1 w-full sm:w-auto bg-grid-surface/50 p-1 rounded-lg border border-grid-border/30">
          <LayoutGroup>
            {filters.map((filter) => {
              const isActive = activeFilter === filter.id;
              return (
                <button
                  key={filter.id}
                  onClick={() => setActiveFilter(filter.id)}
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
                    <span className={cn("relative z-10", isActive && filter.id !== "All" && filter.color)}>
                      {filter.label}
                    </span>
                    <span className="relative z-10 text-[10px] bg-grid-surface/80 px-1.5 py-0.5 rounded-full border border-grid-border/20">
                      {filter.count}
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
            placeholder="Search anomalies..."
            className="w-full pl-9 pr-4 py-2 bg-grid-surface/30 border border-grid-border/40 hover:border-grid-border/80 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-grid-title/30 text-grid-title placeholder:text-grid-muted transition-all"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Ultra-clean Table */}
      <div className="bg-grid-surface/20 rounded-xl overflow-hidden ring-1 ring-grid-border/30">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead className="bg-grid-surface/40 text-grid-muted">
              <tr>
                <th className="px-6 py-4 font-medium text-xs tracking-wider">ID</th>
                <th className="px-6 py-4 font-medium text-xs tracking-wider">Details</th>
                <th className="px-6 py-4 font-medium text-xs tracking-wider">Asset</th>
                <th className="px-6 py-4 font-medium text-xs tracking-wider">Status</th>
                <th className="px-6 py-4 font-medium text-xs tracking-wider text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-grid-border/20">
              <AnimatePresence mode="popLayout" initial={false}>
                {loading ? (
                  <motion.tr
                    key="loading"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <td colSpan={5} className="py-16 text-center text-grid-muted">
                      <motion.div 
                        animate={{ rotate: 360 }} 
                        transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                        className="inline-block mb-3"
                      >
                        <Clock className="size-5 opacity-50" />
                      </motion.div>
                      <p className="text-sm">Syncing telemetry...</p>
                    </td>
                  </motion.tr>
                ) : filteredAnomalies.length > 0 ? (
                  filteredAnomalies.map((anomaly, index) => (
                    <motion.tr
                      layout
                      key={anomaly.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.15 } }}
                      transition={{ 
                        type: "spring",
                        stiffness: 300,
                        damping: 25,
                        mass: 0.8,
                        delay: index * 0.04 
                      }}
                      className="group hover:bg-grid-surface/60 transition-colors"
                    >
                      <td className="px-6 py-4 align-top w-32">
                        <span className="font-mono text-[11px] text-grid-muted group-hover:text-grid-title/70 transition-colors">
                          {anomaly.id}
                        </span>
                        <div className="mt-1.5 flex items-center text-[10px] text-grid-muted/70 gap-1 font-mono">
                          <Clock className="size-3" /> {anomaly.timestamp}
                        </div>
                      </td>
                      
                      <td className="px-6 py-4 align-top max-w-md">
                        <div className="flex items-start gap-3">
                          <SeverityIcon severity={anomaly.severity} className="size-4 mt-0.5 shrink-0" />
                          <div>
                            <span className="font-medium text-grid-title block mb-1">{anomaly.title}</span>
                            <span className="text-xs text-grid-muted/90 leading-relaxed block pr-4">
                              {anomaly.hypothesis}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4 align-top w-32">
                        <span className="inline-flex font-mono text-xs text-grid-title/80">
                          {anomaly.asset}
                        </span>
                      </td>

                      <td className="px-6 py-4 align-top w-32">
                        <span className={cn(
                          "inline-flex items-center gap-1.5 rounded-full text-[10px] font-medium px-2 py-0.5",
                          anomaly.status === "Open" ? "bg-grid-danger/10 text-grid-danger" :
                          anomaly.status === "Investigating" ? "bg-grid-warning/10 text-grid-warning" :
                          "bg-grid-success/10 text-grid-success"
                        )}>
                          <span className={cn(
                            "size-1.5 rounded-full",
                            anomaly.status === "Open" ? "bg-grid-danger" :
                            anomaly.status === "Investigating" ? "bg-grid-warning" :
                            "bg-grid-success"
                          )} />
                          {anomaly.status}
                        </span>
                      </td>

                      <td className="px-6 py-4 align-top text-right w-32">
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => onInvestigate(anomaly)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-grid-title text-grid-surface rounded-md opacity-90 hover:opacity-100 transition-opacity"
                        >
                          <Bot className="size-3.5" />
                          Analyze
                        </motion.button>
                      </td>
                    </motion.tr>
                  ))
                ) : (
                  <motion.tr
                    key="empty"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <td colSpan={5} className="py-16 text-center text-grid-muted">
                      <Filter className="size-6 mx-auto mb-3 opacity-30" />
                      <p className="text-sm">No anomalies matching your criteria.</p>
                      <Button 
                        variant="link" 
                        onClick={() => {
                          setSearchQuery("");
                          setActiveFilter("All");
                        }}
                        className="text-xs mt-2 text-grid-title/70 hover:text-grid-title"
                      >
                        Clear filters
                      </Button>
                    </td>
                  </motion.tr>
                )}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}