"use client";

import { useRef, useState } from "react";
import AIAgent from "./AIAgent";
import AssetsView from "./AssetsView";
import AnomaliesView from "./AnomaliesView";
import LiveMonitoringView from "./LiveMonitoringView";
import OverviewView from "./OverviewView";
import { AnimatePresence, motion } from "motion/react";
import {
  Activity,
  Bot,
  Building2,
  Home,
  Menu,
  Search,
  ShieldAlert,
  ShieldCheck,
  X,
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
  {
    label: "AI Assistant",
    icon: Bot,
    description: "RAG-powered investigation and mitigation",
  },
];

export default function Dashboard() {
  const rootRef = useRef(null);
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("Overview");
  const [activeAnomaly, setActiveAnomaly] = useState(null);

  return (
    <div ref={rootRef} className="min-h-screen bg-grid-page text-grid-title">
      <div className="mx-auto flex min-h-screen max-w-[1600px]">
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-40 w-72 border-r border-grid-border bg-grid-surface px-4 py-5 transition-transform duration-300",
            "lg:translate-x-0",
            isSidebarOpen ? "translate-x-0" : "-translate-x-full",
          )}
          aria-label="Primary navigation"
        >
          <div className="mb-5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex size-9 items-center justify-center rounded-full border border-grid-border bg-grid-page">
                <ShieldCheck className="size-4" />
              </div>
              <p className="text-xl font-bold tracking-tight">SENTINELIQ</p>
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

          <section className="space-y-2">
            <p className="px-3 text-[0.68rem] font-semibold tracking-[0.13em] text-grid-muted uppercase">
              Essential Navigation
            </p>

            {essentialTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = tab.label === activeTab;

              return (
                <Button
                  key={tab.label}
                  type="button"
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "h-auto w-full flex-col items-start gap-1 px-3 py-2.5",
                    "hover:bg-grid-elevated",
                    isActive && "bg-grid-elevated",
                  )}
                  onClick={() => {
                    setActiveTab(tab.label);
                    setSidebarOpen(false);
                  }}
                >
                  <motion.span
                    className="inline-flex items-center gap-2"
                    whileHover={{ x: 1.5 }}
                    transition={{ duration: 0.18, ease: "easeOut" }}
                  >
                    <motion.span whileHover={{ rotate: -7, scale: 1.06 }} transition={{ duration: 0.2 }}>
                      <Icon className="size-3.5 text-grid-muted" />
                    </motion.span>
                    <span className="text-[0.83rem] font-semibold text-grid-title">{tab.label}</span>
                  </motion.span>
                  <span className="pl-5 text-left text-[0.68rem] leading-snug text-grid-muted">
                    {tab.description}
                  </span>
                </Button>
              );
            })}
          </section>

          <div className="mt-6 border-t border-grid-border pt-3 text-xs text-grid-muted">
            <p>SentinelIQ v1.0</p>
            <p>Region: EU-Region-2</p>
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

              <span className="inline-flex items-center gap-1.5 rounded-md border border-grid-success/30 bg-grid-pill px-3 py-1 text-xs font-semibold text-grid-pill-foreground">
                <span className="size-1.5 rounded-full bg-grid-success" />
                Platform Status: Stable | 99.3% pipeline uptime
              </span>
            </div>
          </header>

          <main className="space-y-6 px-4 pb-8 pt-5 sm:px-6 lg:px-8">
            <AnimatePresence mode="wait" initial={false}>
              {activeTab === "AI Assistant" ? (
                <motion.div
                  key="tab-ai-assistant"
                  initial={{ opacity: 0, y: 12, filter: "blur(8px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  exit={{ opacity: 0, y: -8, filter: "blur(8px)" }}
                  transition={{ duration: 0.24, ease: "easeOut" }}
                >
                  <AIAgent
                    contextAnomaly={activeAnomaly}
                    onClearContext={() => setActiveAnomaly(null)}
                  />
                </motion.div>
              ) : activeTab === "Assets" ? (
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
                      setActiveTab("AI Assistant");
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
                      setActiveTab("AI Assistant");
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
                      setActiveTab("AI Assistant");
                    }}
                  />
                </motion.div>
              ) : null}
            </AnimatePresence>
          </main>
        </div>
      </div>
    </div>
  );
}
