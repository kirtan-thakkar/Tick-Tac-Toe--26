"use client";

import { useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  BarChart3,
  Battery,
  Building2,
  Cable,
  Calendar,
  ChevronRight,
  Clock3,
  Home,
  LineChart,
  Map,
  Menu,
  RefreshCw,
  Search,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Sun,
  Wind,
  X,
  Zap,
} from "lucide-react";

import { AnimatedList } from "@/components/ui/animated-list";
import { BentoGrid } from "@/components/ui/bento-grid";
import { Button } from "@/components/ui/button";
import { MorphingText } from "@/components/ui/morphing-text";
import { ProgressiveBlur } from "@/components/ui/progressive-blur";
import { cn } from "@/lib/utils";

const navSections = [
  {
    title: "Operations",
    items: [
      { label: "Overview", icon: Home, active: true },
      { label: "Live Grid Map", icon: Map },
      { label: "Substations", icon: Building2 },
      { label: "Feeders & Lines", icon: Cable },
      { label: "Transformers", icon: Zap },
      { label: "Incident Management", icon: ShieldAlert },
      { label: "Outage Planning", icon: Calendar },
    ],
  },
  {
    title: "Market & Balancing",
    items: [
      { label: "Load Balances", icon: BarChart3 },
      { label: "Generation Availability", icon: Battery },
      { label: "Forecasting", icon: LineChart },
    ],
  },
  {
    title: "Asset Management",
    items: [
      { label: "Maintenance Scheduling", icon: Calendar },
      { label: "Asset Condition (CBM)", icon: Activity },
      { label: "Inspections & Diagnostics", icon: Search },
      { label: "Failure Predictions", icon: AlertTriangle },
    ],
  },
  {
    title: "Administration",
    items: [{ label: "Admin Console", icon: Settings }],
  },
];

const overviewMetrics = [
  {
    label: "Grid Frequency",
    value: "50.03 Hz",
    delta: "+6.8%",
    trend: "up",
    note: "Normal: 49.8-50.2 Hz",
  },
  {
    label: "Total Load",
    value: "42,380 MW",
    delta: "+3.2%",
    trend: "up",
    note: "High-demand corridor",
  },
  {
    label: "Renewables Share",
    value: "57.4%",
    trend: "flat",
    note: "Generation mix",
    split: [
      { source: "Wind", value: "31%" },
      { source: "Solar", value: "22%" },
      { source: "Hydro", value: "4.4%" },
    ],
  },
  {
    label: "Interconnector Flows",
    value: "~1,280 MW",
    trend: "flat",
    note: "Net export",
  },
  {
    label: "Active Incidents",
    value: "4",
    delta: "-1",
    trend: "down",
    note: "Operationally isolated",
  },
  {
    label: "CO2 Intensity",
    value: "198 gCO2/kWh",
    delta: "-12 g",
    trend: "down",
    note: "Below baseline",
  },
];

const substationWarnings = [
  {
    id: "PL-HV-118",
    name: "Wroclaw South",
    kv: "400",
    loadMw: "1,980",
    loadPercent: "92%",
    state: "Warning",
    telemetry: "09:11",
  },
  {
    id: "AT-HV-022",
    name: "Linz-Ost",
    kv: "380",
    loadMw: "2,740",
    loadPercent: "101%",
    state: "Overloaded",
    telemetry: "09:10",
  },
  {
    id: "PL-MV-289",
    name: "Poznan-Kiekrz",
    kv: "110",
    loadMw: "512",
    loadPercent: "88%",
    state: "Warning",
    telemetry: "09:12",
  },
  {
    id: "DE-HV-099",
    name: "Hannover-Ost",
    kv: "380",
    loadMw: "2,670",
    loadPercent: "96%",
    state: "Warning",
    telemetry: "09:12",
  },
  {
    id: "CZ-HV-115",
    name: "Ostrava-Poruba",
    kv: "400",
    loadMw: "1,720",
    loadPercent: "103%",
    state: "Overloaded",
    telemetry: "09:10",
  },
];

const incidentCards = [
  {
    title: "Transformer Overload",
    description: "Load at 103%, winding temp 94degC",
    action: "Mitigation in process",
    asset: "Transformer T-380/220-AT-022 (Linz Ost)",
    cause: "Re-dispatch requested from APG",
    started: "09:04",
    tone: "danger",
  },
  {
    title: "Feeder Trip",
    description: "Crew dispatched",
    action: "Asset",
    asset: "Feeder FL-110-PL-Kiekrz-03",
    cause: "Auto-reclose failed (3 cycles)",
    started: "08:51",
    tone: "warning",
  },
  {
    title: "Voltage Sag Event",
    description: "dV: -7% below nominal for 600ms",
    action: "Monitoring",
    asset: "110 kV ring (Kassel Nord)",
    cause: "Auto-reclose failed (3 cycles)",
    started: "08:46",
    tone: "warning",
  },
];

const liveFeedItems = [
  {
    id: "feed-1",
    title: "Dispatch ack received",
    detail: "Linz-Ost overload isolation started",
    time: "09:14",
  },
  {
    id: "feed-2",
    title: "Protection relay reset",
    detail: "Kiekrz feeder lockout cleared",
    time: "09:13",
  },
  {
    id: "feed-3",
    title: "Forecast revision",
    detail: "Peak demand shifted +18 minutes",
    time: "09:12",
  },
  {
    id: "feed-4",
    title: "Telemetry sync",
    detail: "Substation bundle synced in 66ms",
    time: "09:12",
  },
];

function NavSection({ title, items, onNavigate }) {
  return (
    <section className="space-y-1.5">
      <p className="px-3 text-[0.68rem] font-semibold tracking-[0.13em] text-grid-muted uppercase">
        {title}
      </p>
      {items.map((item) => {
        const Icon = item.icon;

        return (
          <Button
            key={item.label}
            type="button"
            variant="ghost"
            size="sm"
            className={cn(
              "h-8 w-full justify-start gap-2.5 px-3 text-grid-title",
              "hover:bg-grid-elevated hover:text-grid-title",
              item.active && "bg-grid-elevated text-grid-title",
            )}
            onClick={onNavigate}
          >
            <Icon className="size-3.5 text-grid-muted" />
            <span className="text-[0.79rem] font-medium">{item.label}</span>
          </Button>
        );
      })}
    </section>
  );
}

function Trend({ trend, delta }) {
  if (!delta || trend === "flat") {
    return <span className="text-xs text-grid-muted">-</span>;
  }

  const isUp = trend === "up";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs font-semibold",
        isUp ? "text-grid-title" : "text-grid-muted",
      )}
    >
      {isUp ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />}
      {delta}
    </span>
  );
}

function WarningState({ state }) {
  const isOverloaded = state === "Overloaded";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 text-xs font-semibold",
        isOverloaded ? "text-grid-danger" : "text-grid-title",
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          isOverloaded ? "bg-grid-danger" : "bg-grid-warning",
        )}
      />
      {state}
    </span>
  );
}

function IncidentCard({ incident }) {
  const borderTone =
    incident.tone === "danger"
      ? "border-grid-danger/35"
      : "border-grid-warning/45";

  return (
    <article
      className={cn("rounded-xl border bg-grid-surface p-4", borderTone)}
    >
      <h3
        className={cn(
          "text-sm font-semibold",
          incident.tone === "danger" ? "text-grid-danger" : "text-grid-title",
        )}
      >
        {incident.title}
      </h3>
      <p className="mt-1 text-sm text-grid-title">{incident.description}</p>
      <p className="text-sm text-grid-muted">{incident.action}</p>

      <div className="mt-4 space-y-2 text-xs text-grid-title">
        <p>
          <span className="font-semibold text-grid-muted">ASSET</span>
          <br />
          {incident.asset}
        </p>
        <p>
          <span className="font-semibold text-grid-muted">CAUSE</span>
          <br />
          {incident.cause}
        </p>
        <p>
          <span className="font-semibold text-grid-muted">STARTED</span>
          <br />
          {incident.started}
        </p>
      </div>
    </article>
  );
}

export default function Dashboard() {
  const [isSidebarOpen, setSidebarOpen] = useState(false);

  const headlineTexts = useMemo(
    () => ["LIVE 24h", "N-1 STABLE", "DISPATCH READY"],
    [],
  );

  return (
    <div className="min-h-screen bg-grid-page text-grid-title">
      <div className="mx-auto flex min-h-screen max-w-[1600px]">
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-40 w-72 border-r border-grid-border bg-grid-surface px-4 py-5 transition-transform duration-300",
            "lg:translate-x-0",
            isSidebarOpen ? "translate-x-0" : "-translate-x-full",
          )}
          aria-label="Primary navigation"
        >
          <div className="mb-4 flex items-center justify-between lg:mb-6">
            <div className="flex items-center gap-2">
              <div className="flex size-9 items-center justify-center rounded-full border border-grid-border bg-grid-page">
                <ShieldCheck className="size-4" />
              </div>
              <div>
                <p className="text-xl font-bold tracking-tight">SENTINELIQ</p>
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

          <div className="space-y-5 overflow-y-auto pb-8">
            {navSections.map((section) => (
              <NavSection
                key={section.title}
                title={section.title}
                items={section.items}
                onNavigate={() => setSidebarOpen(false)}
              />
            ))}
          </div>

          <div className="mt-auto border-t border-grid-border pt-3 text-xs text-grid-muted">
            <p>EnerGrid v4.12-stable</p>
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
                  placeholder="Search assets, feeder lines, tickets..."
                  className="w-full bg-transparent text-sm text-grid-title placeholder:text-grid-muted focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-md border border-grid-success/30 bg-grid-pill px-3 py-1 text-xs font-semibold text-grid-pill-foreground">
                  <span className="size-1.5 rounded-full bg-grid-success" />
                  SCADA Link Status: Nominal | 11,942 ms/go
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  aria-label="Refresh dashboard"
                >
                  <RefreshCw className="size-3.5" />
                </Button>
              </div>
            </div>
          </header>

          <main className="space-y-6 px-4 pb-8 pt-5 sm:px-6 lg:px-8">
            <section className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-4xl font-semibold tracking-tight">
                  Overview
                </h1>
                
              </div>

              <BentoGrid className="auto-rows-auto grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {overviewMetrics.map((metric) => (
                  <article
                    key={metric.label}
                    className="col-span-1 rounded-xl border border-grid-border bg-grid-surface p-4"
                  >
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold tracking-[0.11em] text-grid-muted uppercase">
                          {metric.label}
                        </p>
                        <p className="mt-2 text-[1.95rem] leading-none font-semibold">
                          {metric.value}
                        </p>
                      </div>
                      <Trend trend={metric.trend} delta={metric.delta} />
                    </div>

                    {metric.split ? (
                      <div className="space-y-1 text-xs text-grid-muted">
                        {metric.split.map((item) => (
                          <div
                            key={item.source}
                            className="flex items-center justify-between"
                          >
                            <span className="inline-flex items-center gap-1.5 uppercase">
                              {item.source === "Wind" ? (
                                <Wind className="size-3" />
                              ) : item.source === "Solar" ? (
                                <Sun className="size-3" />
                              ) : (
                                <Zap className="size-3" />
                              )}
                              {item.source}
                            </span>
                            <span className="text-grid-title">
                              {item.value}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-grid-muted">{metric.note}</p>
                    )}
                  </article>
                ))}
              </BentoGrid>
            </section>

            <section className="rounded-xl border border-grid-border bg-grid-surface">
              <div className="flex items-center justify-between border-b border-grid-border px-4 py-3">
                <h2 className="text-[2rem] leading-none font-semibold tracking-tight">
                  Substation Warnings
                </h2>
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  aria-label="Open warnings detail"
                >
                  <ChevronRight className="size-4" />
                </Button>
              </div>

              <div className="overflow-x-auto px-4 py-3">
                <table className="min-w-full border-separate border-spacing-y-1 text-sm">
                  <thead>
                    <tr className="text-left text-xs font-semibold tracking-[0.08em] text-grid-muted uppercase">
                      <th className="px-2 py-2">Substation ID</th>
                      <th className="px-2 py-2">Name</th>
                      <th className="px-2 py-2">kV</th>
                      <th className="px-2 py-2">Load (MW)</th>
                      <th className="px-2 py-2">Load %</th>
                      <th className="px-2 py-2">State</th>
                      <th className="px-2 py-2">Last Telemetry</th>
                    </tr>
                  </thead>

                  <tbody>
                    {substationWarnings.map((row) => (
                      <tr
                        key={row.id}
                        className="rounded-lg text-grid-title odd:bg-grid-page/50"
                      >
                        <td className="px-2 py-2 font-medium">{row.id}</td>
                        <td className="px-2 py-2">{row.name}</td>
                        <td className="px-2 py-2">{row.kv}</td>
                        <td className="px-2 py-2">{row.loadMw}</td>
                        <td className="px-2 py-2">{row.loadPercent}</td>
                        <td className="px-2 py-2">
                          <WarningState state={row.state} />
                        </td>
                        <td className="px-2 py-2">{row.telemetry}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <h2 className="text-[2rem] leading-none font-semibold tracking-tight">
                  Incident Panel
                </h2>
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  aria-label="Open incident detail"
                >
                  <ChevronRight className="size-4" />
                </Button>
              </div>

              <div className="grid gap-3 xl:grid-cols-[1.65fr_0.9fr]">
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {incidentCards.map((incident) => (
                    <IncidentCard key={incident.title} incident={incident} />
                  ))}
                </div>

                <aside className="rounded-xl border border-grid-border bg-grid-surface p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-sm font-semibold tracking-wide">
                      Live Incident Feed
                    </h3>
                    <span className="inline-flex items-center gap-1 text-xs text-grid-muted">
                      <Clock3 className="size-3" />
                      Last 10m
                    </span>
                  </div>

                  <AnimatedList className="items-stretch gap-2" delay={1200}>
                    {liveFeedItems.map((item) => (
                      <article
                        key={item.id}
                        className="w-full rounded-lg border border-grid-border bg-grid-page/60 px-3 py-2"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-xs font-semibold text-grid-title">
                              {item.title}
                            </p>
                            <p className="mt-1 text-xs text-grid-muted">
                              {item.detail}
                            </p>
                          </div>
                          <span className="text-[0.65rem] font-semibold text-grid-muted">
                            {item.time}
                          </span>
                        </div>
                      </article>
                    ))}
                  </AnimatedList>
                </aside>
              </div>
            </section>
          </main>
        </div>
      </div>
    </div>
  );
}
