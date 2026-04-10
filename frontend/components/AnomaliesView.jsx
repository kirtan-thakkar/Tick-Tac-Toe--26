"use client";

import { useState, useEffect } from "react";
import { 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Search, 
  ShieldAlert, 
  Bot,
  Activity,
  Filter
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

// Dummy data mirroring the dashboard table, but enriched
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
    // Simulate fetching enriched anomalies from backend
    setTimeout(() => {
      setAnomalies(initialAnomalies);
      setLoading(false);
    }, 600);
  }, []);

  const counts = {
    All: anomalies.length,
    Critical: anomalies.filter(a => a.severity === "Critical").length,
    Warning: anomalies.filter(a => a.severity === "Warning").length,
    Info: anomalies.filter(a => a.severity === "Info").length,
  };

  const filteredAnomalies = anomalies.filter(anomaly => {
    const matchesSearch = anomaly.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          anomaly.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          anomaly.asset.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = activeFilter === "All" || anomaly.severity === activeFilter;
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-semibold tracking-tight">Anomalies</h1>
          <p className="text-sm text-grid-muted mt-1">Triage and investigate detected system irregularities.</p>
        </div>
      </div>

      {/* Severity Filter Badges */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <button
          onClick={() => setActiveFilter("All")}
          className={cn(
            "flex flex-col items-center justify-center p-4 rounded-xl border transition-all",
            activeFilter === "All" 
              ? "bg-grid-title text-grid-surface border-grid-title shadow-md scale-[1.02]" 
              : "bg-grid-surface border-grid-border text-grid-muted hover:bg-grid-elevated"
          )}
        >
          <Activity className="size-6 mb-2 opacity-80" />
          <span className="text-2xl font-bold">{counts.All}</span>
          <span className="text-xs uppercase tracking-wider font-semibold opacity-80 mt-1">All Events</span>
        </button>

        <button
          onClick={() => setActiveFilter("Critical")}
          className={cn(
            "flex flex-col items-center justify-center p-4 rounded-xl border transition-all",
            activeFilter === "Critical" 
              ? "bg-grid-danger/20 border-grid-danger text-grid-danger shadow-md scale-[1.02]" 
              : "bg-grid-surface border-grid-border text-grid-danger hover:bg-grid-danger/10"
          )}
        >
          <ShieldAlert className="size-6 mb-2 opacity-80" />
          <span className="text-2xl font-bold">{counts.Critical}</span>
          <span className="text-xs uppercase tracking-wider font-semibold opacity-80 mt-1">Critical</span>
        </button>

        <button
          onClick={() => setActiveFilter("Warning")}
          className={cn(
            "flex flex-col items-center justify-center p-4 rounded-xl border transition-all",
            activeFilter === "Warning" 
              ? "bg-grid-warning/20 border-grid-warning text-grid-warning shadow-md scale-[1.02]" 
              : "bg-grid-surface border-grid-border text-grid-warning hover:bg-grid-warning/10"
          )}
        >
          <AlertTriangle className="size-6 mb-2 opacity-80" />
          <span className="text-2xl font-bold">{counts.Warning}</span>
          <span className="text-xs uppercase tracking-wider font-semibold opacity-80 mt-1">Semi Risk / Warning</span>
        </button>

        <button
          onClick={() => setActiveFilter("Info")}
          className={cn(
            "flex flex-col items-center justify-center p-4 rounded-xl border transition-all",
            activeFilter === "Info" 
              ? "bg-grid-success/20 border-grid-success text-grid-success shadow-md scale-[1.02]" 
              : "bg-grid-surface border-grid-border text-grid-success hover:bg-grid-success/10"
          )}
        >
          <CheckCircle2 className="size-6 mb-2 opacity-80" />
          <span className="text-2xl font-bold">{counts.Info}</span>
          <span className="text-xs uppercase tracking-wider font-semibold opacity-80 mt-1">Info / Resolved</span>
        </button>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-4 bg-grid-surface border border-grid-border p-4 rounded-xl">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-grid-muted" />
          <input
            type="text"
            placeholder="Search by ID, title, or asset..."
            className="w-full pl-9 pr-4 py-2 bg-grid-page/50 border border-grid-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-grid-title text-grid-title placeholder:text-grid-muted"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Anomalies List */}
      <div className="space-y-3">
        {loading ? (
          <div className="py-12 flex justify-center text-grid-muted">
            <Activity className="size-6 animate-pulse" />
          </div>
        ) : filteredAnomalies.length > 0 ? (
          filteredAnomalies.map((anomaly) => (
            <div 
              key={anomaly.id} 
              className="bg-grid-surface border border-grid-border rounded-xl p-5 hover:border-grid-muted/30 transition-colors flex flex-col md:flex-row gap-6 md:items-center"
            >
              {/* Left Column: Icon & ID */}
              <div className="flex items-start gap-4 md:w-1/4">
                <div className={cn(
                  "p-3 rounded-xl border flex-shrink-0",
                  anomaly.severity === "Critical" ? "bg-grid-danger/10 border-grid-danger/30" :
                  anomaly.severity === "Warning" ? "bg-grid-warning/10 border-grid-warning/30" :
                  "bg-grid-success/10 border-grid-success/30"
                )}>
                  <SeverityIcon severity={anomaly.severity} className="size-6" />
                </div>
                <div>
                  <p className="text-xs font-mono text-grid-muted mb-1">{anomaly.id}</p>
                  <span className={cn(
                    "inline-flex items-center gap-1 rounded text-[10px] font-bold uppercase tracking-wider px-2 py-0.5",
                    anomaly.status === "Open" ? "bg-grid-danger/15 text-grid-danger" :
                    anomaly.status === "Investigating" ? "bg-grid-warning/15 text-grid-warning" :
                    "bg-grid-success/15 text-grid-success"
                  )}>
                    {anomaly.status}
                  </span>
                </div>
              </div>

              {/* Middle Column: Details */}
              <div className="flex-1 space-y-2">
                <div className="flex items-center justify-between gap-4">
                  <h3 className="font-semibold text-grid-title text-lg">{anomaly.title}</h3>
                  <span className="text-xs font-medium text-grid-muted flex items-center gap-1 bg-grid-page/50 px-2 py-1 rounded">
                    <Clock className="size-3" />
                    {anomaly.timestamp} ({anomaly.duration})
                  </span>
                </div>
                
                <div className="bg-grid-page/40 p-3 rounded-lg border border-grid-border/50 text-sm">
                  <p className="text-grid-muted mb-1"><span className="font-semibold text-grid-title">Asset:</span> {anomaly.asset}</p>
                  <p className="text-grid-muted leading-relaxed"><span className="font-semibold text-grid-title">Hypothesis:</span> {anomaly.hypothesis}</p>
                </div>
              </div>

              {/* Right Column: Actions */}
              <div className="flex flex-row md:flex-col gap-2 md:w-48">
                <Button 
                  className="flex-1 w-full bg-grid-title text-grid-surface hover:opacity-90"
                  onClick={() => onInvestigate(anomaly)}
                >
                  <Bot className="size-4 mr-2" />
                  Ask AI
                </Button>
                <Button variant="outline" className="flex-1 w-full text-xs">
                  Acknowledge
                </Button>
              </div>
            </div>
          ))
        ) : (
          <div className="py-12 flex flex-col items-center justify-center text-grid-muted border border-dashed border-grid-border rounded-xl">
            <Filter className="size-8 mb-3 opacity-20" />
            <p>No anomalies found matching your criteria.</p>
          </div>
        )}
      </div>
    </div>
  );
}