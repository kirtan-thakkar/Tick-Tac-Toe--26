"use client";

import { useRef, useState, useEffect } from "react";
import AIAgent from "./AIAgent";
import AssetsView from "./AssetsView";
import AnomaliesView from "./AnomaliesView";
import LiveMonitoringView from "./LiveMonitoringView";
import OverviewView from "./OverviewView";
import { AnimatePresence, motion } from "motion/react";
import { signOut } from "next-auth/react";
import {
  Activity,
  Building2,
  MessageCircle,
  Home,
  Menu,
  Search,
  ShieldAlert,
  ShieldCheck,
  X,
  LogOut,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { ProgressiveBlur } from "@/components/ui/progressive-blur";
import { cn } from "@/lib/utils";

const essentialTabs = [
  {
    label: "Overview",
    icon: Home,
    description: "KPIs, system health, and quick insights",
  },
  {
    label: "Live Monitoring",
    icon: Activity,
    description: "Real-time multi-signal visualization",
  },
  {
    label: "Anomalies",
    icon: ShieldAlert,
    description: "Severity, root cause, and resolution status",
  },
  {
    label: "Assets",
    icon: Building2,
    description: "Unified equipment and sensor health view",
  },
];

export default function Dashboard() {
  const rootRef = useRef(null);
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("Overview");
  const [activeAnomaly, setActiveAnomaly] = useState(null);
  const [isAIAgentOpen, setIsAIAgentOpen] = useState(false);
  const [liveStatus, setLiveStatus] = useState("Stable");
  const [ensembleScore, setEnsembleScore] = useState(0);
  const [isRetraining, setIsRetraining] = useState(false);

  useEffect(() => {
    const fetchLive = async () => {
      try {
        const baseUrl =
          process.env.NEXT_PUBLIC_BACKEND_URL ||
          process.env.NEXT_PUBLIC_API_URL ||
          "http://localhost:8000";
        const res = await fetch(`${baseUrl}/anomalies/live`);
        if (!res.ok) throw new Error("HTTP Error");
        const data = await res.json();
        setLiveStatus(data.status || "Stable");
        setEnsembleScore(data.current_ensemble_score || 0);
      } catch (err) {
        console.error("Failed to fetch live status", err);
      }
    };
    fetchLive();
    const interval = setInterval(fetchLive, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleRetrain = async () => {
    setIsRetraining(true);
    try {
      const baseUrl =
        process.env.NEXT_PUBLIC_BACKEND_URL ||
        process.env.NEXT_PUBLIC_API_URL ||
        "http://localhost:8000";
      const res = await fetch(`${baseUrl}/feedback/retrain`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        alert(data.message || "Model retrained successfully");
      } else {
        alert("Failed to retrain model");
      }
    } catch (err) {
      alert("Error triggering retrain");
    } finally {
      setIsRetraining(false);
    }
  };


  return (
    <div ref={rootRef} className="min-h-screen bg-grid-page text-grid-title">
      <div className="mx-auto flex min-h-screen max-w-[1600px]">
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-grid-border bg-grid-surface transition-transform duration-300",
            "lg:translate-x-0",
            isSidebarOpen ? "translate-x-0" : "-translate-x-full",
          )}
          aria-label="Primary navigation"
        >
          {/* Header Area */}
          <div className="flex items-center justify-between border-b border-grid-border px-5 py-5">
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-lg border border-grid-border bg-grid-page/50 text-emerald-500 shadow-sm">
                <ShieldCheck className="size-5" />
              </div>
              <div className="flex flex-col">
                <span className="text-base font-bold tracking-tight text-grid-title">SENTINEL</span>
                <span className="text-[0.65rem] font-medium tracking-widest text-grid-muted uppercase">Intelligence</span>
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="lg:hidden"
              onClick={() => setSidebarOpen(false)}
              aria-label="Close navigation"
            >
              <X className="size-4" />
            </Button>
          </div>

          {/* Navigation Area */}
          <div className="flex-1 overflow-y-auto px-4 py-6">
            <nav className="space-y-6">
              <div>
                <p className="mb-3 px-2 text-xs font-semibold tracking-wider text-grid-muted uppercase">
                  Platform
                </p>
                <div className="space-y-1">
                  {essentialTabs.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = tab.label === activeTab;

                    return (
                      <button
                        key={tab.label}
                        type="button"
                        onClick={() => {
                          setActiveTab(tab.label);
                          setSidebarOpen(false);
                        }}
                        className={cn(
                          "group flex w-full flex-col gap-1 rounded-lg px-3 py-2.5 text-left transition-all",
                          isActive
                            ? "bg-grid-elevated ring-1 ring-grid-border shadow-sm"
                            : "hover:bg-grid-page/50"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "flex size-7 items-center justify-center rounded-md transition-colors",
                            isActive ? "bg-grid-page text-grid-title shadow-sm border border-grid-border" : "text-grid-muted group-hover:text-grid-title"
                          )}>
                            <Icon className="size-4" />
                          </div>
                          <span className={cn(
                            "text-sm font-medium transition-colors",
                            isActive ? "text-grid-title" : "text-grid-muted group-hover:text-grid-title"
                          )}>
                            {tab.label}
                          </span>
                        </div>
                        <p className="pl-10 text-[0.7rem] leading-relaxed text-grid-muted line-clamp-2">
                          {tab.description}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            </nav>
          </div>

          {/* Footer Area */}
          <div className="mt-auto border-t border-grid-border bg-grid-page/30 p-4">
            <div className="flex items-center justify-between rounded-lg border border-grid-border bg-grid-surface p-3 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="relative flex size-2.5 items-center justify-center">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75"></span>
                  <span className="relative inline-flex size-2 rounded-full bg-emerald-500"></span>
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-grid-title">All Systems Operational</span>
                  <span className="text-[0.65rem] text-grid-muted">Updated just now</span>
                </div>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between px-1 text-[0.65rem] text-grid-muted">
              <span>SentinelIQ v1.2.0</span>
              <span>EU-Central</span>
            </div>
          </div>
        </aside>

        {isSidebarOpen ? (
          <button
            type="button"
            className="fixed inset-0 z-30 bg-black/20 lg:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close navigation overlay"
          />
        ) : null}

        <div className="flex min-h-screen flex-1 flex-col lg:pl-72">
          <header className="relative sticky top-0 z-20 border-b border-grid-border bg-grid-page/95 px-4 py-3 backdrop-blur sm:px-6 lg:px-8">
            <ProgressiveBlur
              className="opacity-40"
              height="75%"
              position="bottom"
              blurLevels={[0.5, 1, 2, 4, 8, 12, 20, 28]}
            />

            <div className="relative z-10 flex flex-wrap items-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                className="lg:hidden"
                onClick={() => setSidebarOpen(true)}
                aria-label="Open navigation"
              >
                <Menu className="size-4" />
              </Button>

              <div className="flex min-w-[220px] flex-1 items-center gap-2 rounded-lg border border-grid-border bg-grid-surface px-3 py-2">
                <Search className="size-4 text-grid-muted" />
                <input
                  type="text"
                  placeholder="Search anomalies, assets, signals..."
                  className="w-full bg-transparent text-sm text-grid-title placeholder:text-grid-muted focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-3">
                <span className="inline-flex items-center gap-1.5 rounded-md border border-grid-success/30 bg-grid-pill px-3 py-1 text-xs font-semibold text-grid-pill-foreground">
                  <span className="size-1.5 rounded-full bg-grid-success animate-pulse" />
                  Status: {liveStatus} | Score: {ensembleScore.toFixed(2)}
                </span>
                <Button
                  onClick={handleRetrain}
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs bg-grid-surface/50 border-grid-border"
                  disabled={isRetraining}
                >
                  {isRetraining ? "Retraining..." : "Retrain Model"}
                </Button>
              </div>
              
              <div className="ml-auto flex items-center">
                <Button
                  onClick={() => signOut({ callbackUrl: "/" })}
                  variant="ghost"
                  size="sm"
                  className="text-grid-muted hover:text-grid-title"
                >
                  <LogOut className="mr-2 size-4" />
                  Sign Out
                </Button>
              </div>
            </div>
          </header>

          <main className="space-y-6 px-4 pb-8 pt-5 sm:px-6 lg:px-8">
            <AnimatePresence mode="wait" initial={false}>
              {activeTab === "Assets" ? (
                <motion.div
                  key="tab-assets"
                  initial={{ opacity: 0, y: 12, filter: "blur(8px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  exit={{ opacity: 0, y: -8, filter: "blur(8px)" }}
                  transition={{ duration: 0.24, ease: "easeOut" }}
                >
                  <AssetsView
                    onInvestigateAsset={(asset) => {
                      setActiveAnomaly({
                        id: asset.id,
                        title: `Asset: ${asset.name}`,
                        severity: asset.health === "Healthy" ? "Info" : asset.health === "Degraded" ? "Warning" : "Critical",
                        asset: asset.id,
                        status: "Open",
                        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                      });
                      setIsAIAgentOpen(true);
                    }}
                  />
                </motion.div>
              ) : activeTab === "Live Monitoring" ? (
                <motion.div
                  key="tab-live-monitoring"
                  initial={{ opacity: 0, y: 12, filter: "blur(8px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  exit={{ opacity: 0, y: -8, filter: "blur(8px)" }}
                  transition={{ duration: 0.24, ease: "easeOut" }}
                >
                  <LiveMonitoringView />
                </motion.div>
              ) : activeTab === "Anomalies" ? (
                <motion.div
                  key="tab-anomalies"
                  initial={{ opacity: 0, y: 12, filter: "blur(8px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  exit={{ opacity: 0, y: -8, filter: "blur(8px)" }}
                  transition={{ duration: 0.24, ease: "easeOut" }}
                >
                  <AnomaliesView
                    onInvestigate={(anomaly) => {
                      setActiveAnomaly(anomaly);
                      setIsAIAgentOpen(true);
                    }}
                  />
                </motion.div>
              ) : activeTab === "Overview" ? (
                <motion.div
                  key="tab-overview"
                  initial={{ opacity: 0, y: 12, filter: "blur(8px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  exit={{ opacity: 0, y: -8, filter: "blur(8px)" }}
                  transition={{ duration: 0.24, ease: "easeOut" }}
                >
                  <OverviewView
                    onInvestigate={(anomaly) => {
                      setActiveAnomaly(anomaly);
                      setIsAIAgentOpen(true);
                    }}
                  />
                </motion.div>
              ) : null}
            </AnimatePresence>
          </main>

          <div className="fixed bottom-5 right-5 z-50">
            <Button
              type="button"
              onClick={() => setIsAIAgentOpen((prev) => !prev)}
              className="h-12 w-12 rounded-full border border-grid-border bg-grid-surface text-grid-title shadow-lg hover:bg-grid-elevated"
              aria-label={isAIAgentOpen ? "Close AI assistant" : "Open AI assistant"}
            >
              {isAIAgentOpen ? <X className="size-5" /> : <MessageCircle className="size-5" />}
            </Button>
          </div>

          <AnimatePresence>
            {isAIAgentOpen ? (
              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.98 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="fixed bottom-20 right-5 z-50 h-[82vh] w-[min(920px,calc(100vw-2rem))]"
              >
                <AIAgent
                  embedded
                  contextAnomaly={activeAnomaly}
                  onClearContext={() => setActiveAnomaly(null)}
                />
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
