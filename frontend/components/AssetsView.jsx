"use client";

import { useEffect, useState } from "react";
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
  Filter
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

function HealthBadge({ health }) {
  if (health === "Critical") {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-grid-danger/15 px-2 py-1 text-xs font-semibold text-grid-danger">
        <ServerCrash className="size-3" />
        {health}
      </span>
    );
  }

  if (health === "Degraded" || health === "Warning") {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-grid-warning/15 px-2 py-1 text-xs font-semibold text-grid-title">
        <AlertTriangle className="size-3" />
        {health}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-grid-success/15 px-2 py-1 text-xs font-semibold text-grid-pill-foreground">
      <CheckCircle2 className="size-3" />
      Healthy
    </span>
  );
}

function getIconForType(type) {
  switch(type) {
    case "Transformer": return <Activity className="size-5 text-blue-500" />;
    case "Sensor": return <Thermometer className="size-5 text-green-500" />;
    case "Feeder": return <Cpu className="size-5 text-purple-500" />;
    case "Battery": return <BatteryWarning className="size-5 text-orange-500" />;
    default: return <Activity className="size-5 text-gray-500" />;
  }
}

export default function AssetsView({ onInvestigateAsset }) {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("All");

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
      setError("Using fallback data. Backend endpoint /api/assets not available.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssets();
  }, []);

  const filteredAssets = assets.filter(asset => {
    const matchesSearch = asset.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          asset.id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = filterType === "All" || asset.type === filterType;
    return matchesSearch && matchesType;
  });

  const assetTypes = ["All", ...Array.from(new Set(assets.map(a => a.type)))];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-semibold tracking-tight">Assets</h1>
          <p className="text-sm text-grid-muted mt-1">Unified equipment and sensor health view.</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchAssets} disabled={loading}>
          <RefreshCw className={cn("size-4 mr-2", loading && "animate-spin")} />
          Refresh Registry
        </Button>
      </div>

      {error && (
        <div className="bg-grid-warning/10 border border-grid-warning/20 text-grid-title p-3 rounded-lg text-sm flex items-center gap-2">
          <AlertTriangle className="size-4 text-grid-warning" />
          {error}
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-4 bg-grid-surface border border-grid-border p-4 rounded-xl">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-grid-muted" />
          <input
            type="text"
            placeholder="Search by asset ID or name..."
            className="w-full pl-9 pr-4 py-2 bg-grid-page/50 border border-grid-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-grid-title text-grid-title placeholder:text-grid-muted"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="size-4 text-grid-muted" />
          <div className="flex gap-2 overflow-x-auto pb-1 sm:pb-0">
            {assetTypes.map(type => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap border transition-colors",
                  filterType === type 
                    ? "bg-grid-title text-grid-surface border-grid-title" 
                    : "bg-grid-page/50 border-grid-border text-grid-muted hover:text-grid-title"
                )}
              >
                {type}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Asset Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {loading && assets.length === 0 ? (
          <div className="col-span-full py-12 flex justify-center">
            <div className="flex items-center gap-2 text-grid-muted">
              <RefreshCw className="size-5 animate-spin" />
              <span>Loading asset registry...</span>
            </div>
          </div>
        ) : filteredAssets.length > 0 ? (
          filteredAssets.map(asset => (
            <div 
              key={asset.id} 
              className="bg-grid-surface border border-grid-border rounded-xl p-5 hover:border-grid-muted/50 transition-colors flex flex-col group"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-grid-page rounded-lg border border-grid-border">
                    {getIconForType(asset.type)}
                  </div>
                  <div>
                    <h3 className="font-semibold text-grid-title text-sm truncate max-w-[150px]" title={asset.name}>
                      {asset.name}
                    </h3>
                    <p className="text-xs text-grid-muted font-mono mt-0.5">{asset.id}</p>
                  </div>
                </div>
                <HealthBadge health={asset.health} />
              </div>
              
              <div className="grid grid-cols-2 gap-3 mb-5 mt-auto">
                <div className="bg-grid-page/50 p-2.5 rounded-lg border border-grid-border/50">
                  <p className="text-[10px] text-grid-muted uppercase tracking-wider font-semibold mb-1">Location</p>
                  <p className="text-xs font-medium text-grid-title truncate" title={asset.location}>{asset.location}</p>
                </div>
                <div className="bg-grid-page/50 p-2.5 rounded-lg border border-grid-border/50">
                  <p className="text-[10px] text-grid-muted uppercase tracking-wider font-semibold mb-1">Type</p>
                  <p className="text-xs font-medium text-grid-title">{asset.type}</p>
                </div>
                <div className="bg-grid-page/50 p-2.5 rounded-lg border border-grid-border/50">
                  <p className="text-[10px] text-grid-muted uppercase tracking-wider font-semibold mb-1">Load / Usage</p>
                  <p className="text-xs font-medium text-grid-title">{asset.load}</p>
                </div>
                <div className="bg-grid-page/50 p-2.5 rounded-lg border border-grid-border/50">
                  <p className="text-[10px] text-grid-muted uppercase tracking-wider font-semibold mb-1">Last Maint.</p>
                  <p className="text-xs font-medium text-grid-title">{asset.lastMaintenance}</p>
                </div>
              </div>

              <div className="flex gap-2 mt-auto pt-4 border-t border-grid-border">
                <Button 
                  variant="outline" 
                  className="flex-1 text-xs h-8"
                  onClick={() => onInvestigateAsset(asset)}
                >
                  Ask AI About Asset
                </Button>
                <Button variant="ghost" className="flex-1 text-xs h-8 bg-grid-page/50">
                  View Details
                </Button>
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-full py-12 flex flex-col items-center justify-center text-grid-muted border border-dashed border-grid-border rounded-xl">
            <Search className="size-8 mb-3 opacity-20" />
            <p>No assets found matching your criteria.</p>
            <Button variant="link" size="sm" onClick={() => { setSearchQuery(""); setFilterType("All"); }} className="mt-2">
              Clear Filters
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}