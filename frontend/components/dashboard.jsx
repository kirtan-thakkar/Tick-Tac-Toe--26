"use client";

import { useEffect, useState } from "react";
import AIAgent from "./AIAgent";
import {
  Activity,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Bot,
  Building2,
  CheckCircle2,
  Clock3,
  Home,
  Menu,
  RefreshCw,
  Search,
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
import { ProgressiveBlur } from "@/components/ui/progressive-blur";
import { cn } from "@/lib/utils";

const essentialTabs = [
  {
    label: "Overview",
    icon: Home,
    description: "KPIs, system health, and quick insights",
    active: true,
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
  {
    id: "INC-1824",
    title: "Frequency oscillation burst",
    severity: "Warning",
    asset: "GRID-EU-2",
    status: "Resolved",
    timestamp: "09:01",
  },
  {
    id: "INC-1816",
    title: "Sensor drift on current probe",
    severity: "Info",
    asset: "SN-CZ-115",
    status: "Resolved",
    timestamp: "08:54",
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

function normalizeChartPayload(payload) {
  const sourcePoints =
    payload?.points ?? payload?.data ?? payload?.series ?? payload?.chart ?? [];

  if (!Array.isArray(sourcePoints) || sourcePoints.length === 0) {
    return fallbackChartPoints;
  }

  const normalized = sourcePoints
    .map((point, index) => {
      const label =
        point?.label ??
        point?.time ??
        point?.timestamp ??
        point?.x ??
        String(index + 1);
      const rawValue = point?.value ?? point?.y ?? point?.count ?? 0;
      const value = Number(rawValue);

      if (Number.isNaN(value)) {
        return null;
      }

      return { label: String(label), value };
    })
    .filter(Boolean);

  return normalized.length > 1 ? normalized : fallbackChartPoints;
}

function buildLinePath(points, width, height, padding) {
  const values = points.map((point) => point.value);
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

  return (
    <span className={cn("rounded-md px-2 py-1 text-xs font-semibold", palette[status])}>
      {status}
    </span>
  );
}

function OverviewChart({ points, loading, error, onRefresh, lastUpdated }) {
  const chartWidth = 760;
  const chartHeight = 260;
  const chartPadding = 24;
  const path =
    points.length > 1
      ? buildLinePath(points, chartWidth, chartHeight, chartPadding)
      : "";

  return (
    <article className="rounded-xl border border-grid-border bg-grid-surface p-4">
      <div className="mb-3 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-[0.11em] text-grid-muted uppercase">
            Overview Chart (from chats.py)
          </p>
          <h3 className="mt-1 text-xl font-semibold">Anomaly Intensity Timeline</h3>
          <p className="text-xs text-grid-muted">
            Endpoint: {process.env.NEXT_PUBLIC_CHARTS_PATH || "/chats/chart"}
          </p>
        </div>

        <Button type="button" variant="outline" size="sm" onClick={onRefresh}>
          <RefreshCw className="size-3.5" />
          Refresh
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-grid-border bg-grid-page/55 p-3">
        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          className="h-[240px] w-full min-w-[640px]"
          role="img"
          aria-label="Anomaly intensity chart"
        >
          {[0.2, 0.4, 0.6, 0.8].map((step) => (
            <line
              key={step}
              x1={chartPadding}
              y1={chartPadding + (chartHeight - chartPadding * 2) * step}
              x2={chartWidth - chartPadding}
              y2={chartPadding + (chartHeight - chartPadding * 2) * step}
              stroke="currentColor"
              className="text-grid-border"
              strokeDasharray="3 5"
            />
          ))}

          {path ? (
            <>
              <path d={path} fill="none" stroke="currentColor" className="text-grid-title" strokeWidth="2.5" />
              {points.map((point, index) => {
                const values = points.map((entry) => entry.value);
                const min = Math.min(...values);
                const max = Math.max(...values);
                const range = Math.max(max - min, 1);
                const usableWidth = chartWidth - chartPadding * 2;
                const usableHeight = chartHeight - chartPadding * 2;
                const x = chartPadding + (index / (points.length - 1)) * usableWidth;
                const y = chartPadding + (1 - (point.value - min) / range) * usableHeight;

                return (
                  <g key={`${point.label}-${index}`}>
                    <circle cx={x} cy={y} r="3.5" className="fill-grid-surface stroke-grid-title" strokeWidth="1.5" />
                    {index % 2 === 0 ? (
                      <text x={x} y={chartHeight - 6} textAnchor="middle" className="fill-grid-muted text-[10px]">
                        {point.label}
                      </text>
                    ) : null}
                  </g>
                );
              })}
            </>
          ) : null}
        </svg>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-grid-muted">
        <span>{loading ? "Fetching chart data..." : "Chart data synced"}</span>
        <span>{error ? `Using fallback data (${error})` : `Last updated: ${lastUpdated}`}</span>
      </div>
    </article>
  );
}

export default function Dashboard() {
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [chartPoints, setChartPoints] = useState(fallbackChartPoints);
  const [chartLoading, setChartLoading] = useState(false);
  const [chartError, setChartError] = useState("");
  const [chartLastUpdated, setChartLastUpdated] = useState("never");

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

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const payload = await response.json();
      const normalizedPoints = normalizeChartPayload(payload);
      setChartPoints(normalizedPoints);
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

              return (
                <Button
                  key={tab.label}
                  type="button"
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "h-auto w-full flex-col items-start gap-1 px-3 py-2.5",
                    "hover:bg-grid-elevated",
                    tab.active && "bg-grid-elevated",
                  )}
                  onClick={() => setSidebarOpen(false)}
                >
                  <span className="inline-flex items-center gap-2">
                    <Icon className="size-3.5 text-grid-muted" />
                    <span className="text-[0.83rem] font-semibold text-grid-title">{tab.label}</span>
                  </span>
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
            <section className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-4xl font-semibold tracking-tight">Overview</h1>
              </div>

              <article className="rounded-xl border border-grid-border bg-grid-surface p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-2xl font-semibold">Live Incident Feed</h2>
                  <span className="inline-flex items-center gap-1 text-xs text-grid-muted">
                    <Clock3 className="size-3" />
                    High priority | Last 10m
                  </span>
                </div>

                <AnimatedList className="items-stretch gap-2.5" delay={1200}>
                  {liveFeedItems.map((item) => (
                    <article
                      key={item.id}
                      className="w-full rounded-lg border border-grid-border bg-grid-page/60 px-3 py-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-grid-title">{item.title}</p>
                          <p className="mt-1 text-xs text-grid-muted">{item.detail}</p>
                        </div>
                        <span className="text-xs font-semibold text-grid-muted">{item.time}</span>
                      </div>
                    </article>
                  ))}
                </AnimatedList>
              </article>

              <OverviewChart
                points={chartPoints}
                loading={chartLoading}
                error={chartError}
                onRefresh={fetchChartData}
                lastUpdated={chartLastUpdated}
              />

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
                        <p className="mt-2 text-[1.95rem] leading-none font-semibold">{metric.value}</p>
                      </div>
                      <Trend trend={metric.trend} delta={metric.delta} />
                    </div>

                    {metric.split ? (
                      <div className="space-y-1 text-xs text-grid-muted">
                        {metric.split.map((item) => (
                          <div key={item.source} className="flex items-center justify-between">
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
                            <span className="text-grid-title">{item.value}</span>
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
              <div className="border-b border-grid-border px-4 py-3">
                <h2 className="text-2xl font-semibold tracking-tight">Anomalies</h2>
                <p className="text-xs text-grid-muted">
                  Central queue with severity, asset impact, and current investigation status.
                </p>
              </div>

              <div className="overflow-x-auto px-4 py-3">
                <table className="min-w-full border-separate border-spacing-y-1 text-sm">
                  <thead>
                    <tr className="text-left text-xs font-semibold tracking-[0.08em] text-grid-muted uppercase">
                      <th className="px-2 py-2">Incident</th>
                      <th className="px-2 py-2">Title</th>
                      <th className="px-2 py-2">Severity</th>
                      <th className="px-2 py-2">Asset</th>
                      <th className="px-2 py-2">Status</th>
                      <th className="px-2 py-2">Time</th>
                    </tr>
                  </thead>

                  <tbody>
                    {anomaliesTableRows.map((row) => (
                      <tr key={row.id} className="rounded-lg text-grid-title odd:bg-grid-page/50">
                        <td className="px-2 py-2 font-semibold">{row.id}</td>
                        <td className="px-2 py-2">{row.title}</td>
                        <td className="px-2 py-2">
                          <SeverityBadge severity={row.severity} />
                        </td>
                        <td className="px-2 py-2">{row.asset}</td>
                        <td className="px-2 py-2">
                          <StatusBadge status={row.status} />
                        </td>
                        <td className="px-2 py-2">{row.timestamp}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </main>
        </div>
      </div>
    </div>
  );
}
