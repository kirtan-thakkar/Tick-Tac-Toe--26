"use client";

import { useEffect, useState, useMemo } from "react";
import { 
  ServerCrash, 
  CheckCircle2, 
  AlertTriangle, 
  RefreshCw, 
  BatteryWarning, 
  Cpu, 
  Thermometer, 
  Activity,
  Search,
  Filter,
  Clock
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence, LayoutGroup } from "motion/react";

function HealthBadge({ health }) {
  if (health === "Critical") {
    return (
      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-grid-danger/15 px-2.5 py-1 text-xs font-semibold text-grid-danger border border-grid-danger/20">
        <ServerCrash className="size-3.5" />
        {health}
      </span>
    );
  }

  if (health === "Degraded" || health === "Warning") {
    return (
      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-grid-warning/15 px-2.5 py-1 text-xs font-semibold text-grid-warning border border-grid-warning/20">
        <AlertTriangle className="size-3.5" />
        {health}
      </span>
    );
  }

  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-grid-success/15 px-2.5 py-1 text-xs font-semibold text-grid-success border border-grid-success/20">
      <CheckCircle2 className="size-3.5" />
      Healthy
    </span>
  );
}

function getIconForType(type) {
  switch(type) {
    case "Transformer": return <Activity className="size-5 text-[#3b82f6]" />;
    case "Sensor": return <Thermometer className="size-5 text-[#10b981]" />;
    case "Feeder": return <Cpu className="size-5 text-[#8b5cf6]" />;
    case "Battery": return <BatteryWarning className="size-5 text-[#f59e0b]" />;
    default: return <Activity className="size-5 text-grid-muted" />;
  }
}

export default function AssetsView({ onInvestigateAsset }) {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("All");

  const fetchAssets = async () => {
    setLoading(true);
    setError("");
    
    const baseUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:8000";
    const endpoint = `${baseUrl}/api/assets`; // Replace with actual endpoint

    try {
      const response = await fetch(endpoint, {
        headers: { Accept: "application/json" },
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setAssets(data.assets || data);
    } catch (e) {
      console.error("Failed to fetch assets:", e);
      // Fallback dummy data if backend is not yet implemented
      setAssets([
        { id: "TX-AT-022", name: "Alpha Transformer Hub", type: "Transformer", health: "Critical", location: "Substation A", lastMaintenance: "2023-11-12", uptime: "98.2%", load: "89%" },
        { id: "FL-110-PL-003", name: "Primary Feeder Line 3", type: "Feeder", health: "Warning", location: "Sector 4", lastMaintenance: "2024-01-05", uptime: "99.1%", load: "75%" },
        { id: "SN-CZ-115", name: "Thermal Probe Array", type: "Sensor", health: "Healthy", location: "Substation A", lastMaintenance: "2024-02-20", uptime: "99.9%", load: "N/A" },
        { id: "BATT-ST-09", name: "Backup Storage Unit 9", type: "Battery", health: "Healthy", location: "Sector 2", lastMaintenance: "2023-08-15", uptime: "100%", load: "42%" },
        { id: "RL-DE-099", name: "Auto-Recloser Relay", type: "Transformer", health: "Critical", location: "Substation C", lastMaintenance: "2023-10-01", uptime: "85.4%", load: "100%" },
        { id: "SN-TH-042", name: "Vibration Sensor Core", type: "Sensor", health: "Warning", location: "Turbine Alpha", lastMaintenance: "2024-01-18", uptime: "96.5%", load: "N/A" },
      ]);
      // Silently use fallback data to avoid UI noise
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssets();
  }, []);

  // Compute counts for the new health-based filter
  const counts = useMemo(() => {
    return {
      All: assets.length,
      Critical: assets.filter(a => a.health === "Critical").length,
      Warning: assets.filter(a => a.health === "Warning" || a.health === "Degraded").length,
      Healthy: assets.filter(a => a.health === "Healthy").length,
    };
  }, [assets]);

  const filteredAssets = useMemo(() => {
    return assets.filter(asset => {
      const matchesSearch = asset.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            asset.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            asset.type.toLowerCase().includes(searchQuery.toLowerCase());
      
      let matchesFilter = true;
      if (activeFilter === "Critical") matchesFilter = asset.health === "Critical";
      if (activeFilter === "Warning") matchesFilter = asset.health === "Warning" || asset.health === "Degraded";
      if (activeFilter === "Healthy") matchesFilter = asset.health === "Healthy";
      
      return matchesSearch && matchesFilter;
    });
  }, [assets, searchQuery, activeFilter]);

  const filters = [
    { id: "All", label: "All Assets", count: counts.All },
    { id: "Critical", label: "Critical", count: counts.Critical, color: "text-grid-danger" },
    { id: "Warning", label: "Degraded", count: counts.Warning, color: "text-grid-warning" },
    { id: "Healthy", label: "Healthy", count: counts.Healthy, color: "text-grid-success" },
  ];

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-medium tracking-tight text-grid-title">Asset Registry</h1>
          <p className="text-sm text-grid-muted mt-2 max-w-md leading-relaxed">
            Unified equipment and sensor health view. Monitor lifecycle, load, and maintenance schedules.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchAssets} disabled={loading} className="text-grid-muted hover:text-grid-title bg-grid-surface/50">
          <RefreshCw className={cn("size-4 mr-2", loading && "animate-spin")} />
          Sync Registry
        </Button>
      </div>

      {/* Minimalist Controls: Filter Tabs & Search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pb-2 border-b border-grid-border/40">
        <div className="flex items-center gap-1 w-full sm:w-auto bg-grid-surface/50 p-1 rounded-lg border border-grid-border/30 overflow-x-auto">
          <LayoutGroup>
            {filters.map((filter) => {
              const isActive = activeFilter === filter.id;
              return (
                <button
                  key={filter.id}
                  onClick={() => setActiveFilter(filter.id)}
                  className={cn(
                    "relative px-4 py-1.5 text-sm font-medium transition-colors rounded-md z-10 whitespace-nowrap",
                    isActive ? "text-grid-title" : "text-grid-muted hover:text-grid-title/80"
                  )}
                >
                  {isActive && (
                    <motion.div
                      layoutId="activeAssetFilterBg"
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

        <div className="relative w-full sm:w-72 group shrink-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-grid-muted group-focus-within:text-grid-title transition-colors" />
          <input
            type="text"
            placeholder="Search assets..."
            className="w-full pl-9 pr-4 py-2 bg-grid-surface/30 border border-grid-border/40 hover:border-grid-border/80 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-grid-title/30 text-grid-title placeholder:text-grid-muted transition-all"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Asset Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        <AnimatePresence mode="popLayout">
          {loading && assets.length === 0 ? (
            <motion.div 
              key="loading"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="col-span-full py-20 flex flex-col items-center justify-center text-grid-muted"
            >
              <RefreshCw className="size-6 animate-spin mb-4 opacity-50" />
              <p className="text-sm">Synchronizing asset registry...</p>
            </motion.div>
          ) : filteredAssets.length > 0 ? (
            filteredAssets.map((asset, index) => (
              <motion.div 
                layout
                key={asset.id}
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.15 } }}
                transition={{ 
                  type: "spring",
                  stiffness: 300,
                  damping: 25,
                  delay: index * 0.03
                }}
                className="bg-grid-surface/30 border border-grid-border/40 rounded-2xl p-5 hover:bg-grid-surface/60 transition-colors flex flex-col group ring-1 ring-grid-border/20"
              >
                <div className="flex justify-between items-start mb-5">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-grid-page/50 rounded-xl border border-grid-border/40 shadow-sm">
                      {getIconForType(asset.type)}
                    </div>
                    <div>
                      <h3 className="font-semibold text-grid-title text-sm truncate max-w-[150px] sm:max-w-[180px]" title={asset.name}>
                        {asset.name}
                      </h3>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="text-[11px] text-grid-muted font-mono bg-grid-page/50 px-1.5 py-0.5 rounded border border-grid-border/30">
                          {asset.id}
                        </span>
                        <span className="size-1 rounded-full bg-grid-border" />
                        <span className="text-[11px] text-grid-muted truncate max-w-[80px]" title={asset.location}>
                          {asset.location}
                        </span>
                      </div>
                    </div>
                  </div>
                  <HealthBadge health={asset.health} />
                </div>
                
                <div className="grid grid-cols-2 gap-3 mb-6 mt-auto">
                  <div className="bg-grid-surface/40 p-3 rounded-xl border border-grid-border/40 shadow-sm">
                    <p className="text-[10px] text-grid-muted uppercase tracking-wider font-semibold mb-1">Type</p>
                    <p className="text-xs font-medium text-grid-title">{asset.type}</p>
                  </div>
                  <div className="bg-grid-surface/40 p-3 rounded-xl border border-grid-border/40 shadow-sm">
                    <p className="text-[10px] text-grid-muted uppercase tracking-wider font-semibold mb-1">Load / Usage</p>
                    <p className="text-xs font-medium text-grid-title">{asset.load}</p>
                  </div>
                  <div className="bg-grid-surface/40 p-3 rounded-xl border border-grid-border/40 shadow-sm">
                    <p className="text-[10px] text-grid-muted uppercase tracking-wider font-semibold mb-1">Uptime</p>
                    <p className="text-xs font-medium text-grid-title">{asset.uptime}</p>
                  </div>
                  <div className="bg-grid-surface/40 p-3 rounded-xl border border-grid-border/40 shadow-sm flex flex-col justify-center">
                    <p className="text-[10px] text-grid-muted uppercase tracking-wider font-semibold mb-1">Last Maint.</p>
                    <p className="text-[11px] font-mono text-grid-title">{asset.lastMaintenance}</p>
                  </div>
                </div>

                <div className="flex gap-3 mt-auto pt-4 border-t border-grid-border/40">
                  <Button 
                    className="flex-1 text-xs h-9 bg-grid-title text-grid-surface hover:opacity-90 transition-opacity rounded-lg font-medium"
                    onClick={() => onInvestigateAsset(asset)}
                  >
                    Analyze with AI
                  </Button>
                  <Button variant="outline" className="flex-1 text-xs h-9 rounded-lg border-grid-border/60 hover:bg-grid-page/50 font-medium">
                    View Details
                  </Button>
                </div>
              </motion.div>
            ))
          ) : (
            <motion.div 
              key="empty"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="col-span-full py-20 flex flex-col items-center justify-center text-grid-muted"
            >
              <Filter className="size-8 mb-4 opacity-20" />
              <p className="text-sm">No assets matching your criteria.</p>
              <Button variant="link" size="sm" onClick={() => { setSearchQuery(""); setActiveFilter("All"); }} className="mt-2 text-grid-title/70 hover:text-grid-title">
                Clear Filters
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}