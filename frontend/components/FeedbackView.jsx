"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CheckCircle2, MessageSquare, RefreshCw, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

function formatTs(ts) {
  if (!ts) return "--";
  return new Date(ts * 1000).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function VerdictBadge({ verdict }) {
  if (verdict === "true_positive") {
    return (
      <span className="inline-flex items-center gap-1.5 bg-grid-success/10 border border-grid-success/20 text-grid-success rounded-full px-2.5 py-1 text-[11px] font-semibold">
        <CheckCircle2 className="size-3" />
        True Positive
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 bg-grid-danger/10 border border-grid-danger/20 text-grid-danger rounded-full px-2.5 py-1 text-[11px] font-semibold">
      <XCircle className="size-3" />
      False Positive
    </span>
  );
}

function StatCard({ label, value, valueClassName }) {
  return (
    <div className="bg-grid-surface/20 border border-grid-border/40 rounded-xl p-4 ring-1 ring-grid-border/20">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-grid-muted">{label}</p>
      <motion.p
        key={String(value)}
        initial={{ opacity: 0.5, y: -3 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn("text-2xl font-mono font-medium", valueClassName)}
      >
        {value}
      </motion.p>
    </div>
  );
}

export default function FeedbackView() {
  const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  const [feedbackLog, setFeedbackLog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [retrainStatus, setRetrainStatus] = useState(null);
  const [retrainMessage, setRetrainMessage] = useState("");
  const [activeFilter, setActiveFilter] = useState("All");
  const [expandedId, setExpandedId] = useState(null);
  const [toast, setToast] = useState({ msg: "", type: "success" });

  const toastTimerRef = useRef(null);
  const retrainClearTimerRef = useRef(null);

  const fetchFeedback = useCallback(async () => {
    try {
      const res = await fetch(`${BASE}/feedback/history`, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const entries = data.entries || [];

      const normalized = entries.map((e) => {
        const effectiveTs = e.timestamp || e.recorded_at || Math.floor(Date.now() / 1000);
        return {
          ...e,
          timestamp: effectiveTs,
          incident_id: e.incident_id || `TS-${effectiveTs}`,
        };
      });
      setFeedbackLog(normalized);
    } catch (err) {
      console.error("Feedback history fetch failed:", err);
      // Keep current state silently
    } finally {
      setLoading(false);
    }
  }, [BASE]);

  useEffect(() => {
    fetchFeedback();
    const intervalId = setInterval(fetchFeedback, 10000);
    return () => clearInterval(intervalId);
  }, [fetchFeedback]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    return () => {
      if (retrainClearTimerRef.current) {
        clearTimeout(retrainClearTimerRef.current);
      }
    };
  }, []);

  const clearRetrainStatusLater = useCallback(() => {
    if (retrainClearTimerRef.current) {
      clearTimeout(retrainClearTimerRef.current);
    }
    retrainClearTimerRef.current = setTimeout(() => {
      setRetrainStatus(null);
      setRetrainMessage("");
    }, 5000);
  }, []);

  const showToast = useCallback((msg, type) => {
    setToast({ msg, type });
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = setTimeout(() => {
      setToast({ msg: "", type: "success" });
    }, 5000);
  }, []);

  const triggerRetrain = useCallback(async () => {
    setRetrainStatus("loading");
    setRetrainMessage("");

    try {
      const response = await fetch(`${BASE}/feedback/retrain`, {
        method: "POST",
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.message || "Retrain failed");

      setRetrainStatus("success");
      setRetrainMessage(payload?.message || "Retraining triggered.");
      showToast(payload?.message || "Retraining triggered.", "success");
    } catch (error) {
      setRetrainStatus("error");
      const message = error instanceof Error ? error.message : "Failed to trigger retraining";
      setRetrainMessage(message);
      showToast(message, "error");
    } finally {
      clearRetrainStatusLater();
    }
  }, [BASE, clearRetrainStatusLater, showToast]);

  const falsePositiveCount = useMemo(
    () => feedbackLog.filter((entry) => entry.verdict === "false_positive").length,
    [feedbackLog]
  );

  const truePositiveCount = useMemo(
    () => feedbackLog.filter((entry) => entry.verdict === "true_positive").length,
    [feedbackLog]
  );

  const modelAccuracy = feedbackLog.length
    ? Math.round((truePositiveCount / feedbackLog.length) * 100)
    : 0;

  const filteredFeedback = useMemo(() => {
    if (activeFilter === "True Positive") {
      return feedbackLog.filter((entry) => entry.verdict === "true_positive");
    }
    if (activeFilter === "False Positive") {
      return feedbackLog.filter((entry) => entry.verdict === "false_positive");
    }
    return feedbackLog;
  }, [activeFilter, feedbackLog]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-medium tracking-tight text-grid-title">Operator Feedback</h1>
          <p className="text-sm text-grid-muted mt-2 max-w-2xl">
            Feedback from field operators feeds the adaptive retraining loop.
          </p>
        </div>

        <div className="flex flex-col items-start sm:items-end gap-2">
          <Button
            type="button"
            onClick={triggerRetrain}
            disabled={retrainStatus === "loading"}
            className="min-w-[170px]"
          >
            {retrainStatus === "loading" ? (
              <>
                <RefreshCw className="size-4 animate-spin" />
                Triggering...
              </>
            ) : (
              `Trigger Retrain (${falsePositiveCount} FP)`
            )}
          </Button>

          <AnimatePresence initial={false}>
            {retrainMessage ? (
              <motion.p
                key={retrainStatus || "message"}
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className={cn(
                  "text-xs",
                  retrainStatus === "success" ? "text-grid-success" : "text-grid-danger"
                )}
              >
                {retrainMessage}
              </motion.p>
            ) : null}
          </AnimatePresence>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Total Feedback" value={feedbackLog.length} valueClassName="text-grid-title" />
        <StatCard label="True Positives" value={truePositiveCount} valueClassName="text-grid-success" />
        <StatCard label="False Positives" value={falsePositiveCount} valueClassName="text-grid-danger" />
        <StatCard
          label="Model Accuracy"
          value={`${modelAccuracy}%`}
          valueClassName={modelAccuracy > 70 ? "text-grid-success" : "text-grid-warning"}
        />
      </div>

      <div className="flex items-center gap-2 pb-2 border-b border-grid-border/40">
        <div className="bg-grid-surface/50 p-1 rounded-lg border border-grid-border/30 flex items-center gap-1">
          {["All", "True Positive", "False Positive"].map((filter) => {
            const isActive = activeFilter === filter;
            return (
              <button
                key={filter}
                type="button"
                onClick={() => setActiveFilter(filter)}
                className={cn(
                  "px-3 py-1.5 text-xs rounded-md transition-colors",
                  isActive
                    ? "bg-grid-page text-grid-title shadow-sm border border-grid-border/40"
                    : "text-grid-muted hover:text-grid-title"
                )}
              >
                {filter}
              </button>
            );
          })}
        </div>
        <span className="ml-auto text-xs text-grid-muted">{filteredFeedback.length} records</span>
      </div>

      <div className="space-y-3">
        <AnimatePresence mode="popLayout" initial={false}>
          {filteredFeedback.map((entry, index) => {
            const rowId = `${entry.timestamp}-${entry.operator_id}-${index}`;
            const isExpanded = expandedId === rowId;
            const notesPreview = entry.notes ? String(entry.notes) : "No notes";

            return (
              <motion.div
                key={rowId}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ type: "spring", stiffness: 300, damping: 28, delay: index * 0.03 }}
                className={cn(
                  "bg-grid-surface/20 border rounded-xl overflow-hidden ring-1 ring-grid-border/20 transition-colors",
                  entry.verdict === "false_positive"
                    ? "border-grid-danger/20 hover:border-grid-danger/40"
                    : "border-grid-border/40 hover:border-grid-border/70"
                )}
              >
                <button
                  type="button"
                  className="w-full px-4 py-3 text-left"
                  onClick={() => setExpandedId(isExpanded ? null : rowId)}
                >
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-center gap-2 flex-wrap">
                      <VerdictBadge verdict={entry.verdict} />
                      <span className="font-mono text-xs text-grid-title">
                        {entry.incident_id || `TS-${entry.timestamp}`}
                      </span>
                      <span className="text-xs text-grid-muted">{entry.operator_id}</span>
                      {!entry.severity_agree ? (
                        <span className="text-[10px] px-1.5 py-0.5 rounded border border-grid-warning/30 bg-grid-warning/10 text-grid-warning font-semibold uppercase tracking-wider">
                          Severity Disputed
                        </span>
                      ) : null}
                    </div>
                    <span className="text-xs text-grid-muted font-mono">{formatTs(entry.timestamp)}</span>
                  </div>
                  <p className="text-xs text-grid-muted mt-2 truncate">{notesPreview}</p>
                </button>

                <AnimatePresence initial={false}>
                  {isExpanded ? (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2, ease: "easeInOut" }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 pb-4 pt-1 border-t border-grid-border/30">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-grid-muted">Operator</p>
                            <p className="text-sm text-grid-title font-mono mt-1">{entry.operator_id}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-grid-muted">Severity Agreement</p>
                            <p className="text-sm text-grid-title mt-1">{entry.severity_agree ? "Agreed" : "Disputed"}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-grid-muted">Timestamp</p>
                            <p className="text-sm text-grid-title font-mono mt-1">{formatTs(entry.timestamp)}</p>
                          </div>
                          <div className="md:col-span-3">
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-grid-muted">Notes</p>
                            <p className="text-sm text-grid-title mt-1">{entry.notes || "No operator notes provided."}</p>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {loading && feedbackLog.length === 0 ? (
          <div className="py-14 flex flex-col items-center justify-center text-grid-muted">
            <RefreshCw className="size-5 animate-spin" />
            <p className="text-sm mt-2">Loading feedback log...</p>
          </div>
        ) : null}

        {!loading && filteredFeedback.length === 0 ? (
          <div className="py-14 flex flex-col items-center justify-center text-grid-muted">
            <MessageSquare className="size-7 opacity-20" />
            <p className="text-sm mt-2">No feedback records for this filter</p>
          </div>
        ) : null}
      </div>

      <AnimatePresence>
        {toast.msg ? (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={cn(
              "fixed top-4 right-4 z-50 rounded-lg border px-4 py-2 text-sm shadow-lg backdrop-blur-sm",
              toast.type === "success" && "bg-grid-success/10 border-grid-success/30 text-grid-success",
              toast.type === "warning" && "bg-grid-warning/10 border-grid-warning/30 text-grid-warning",
              toast.type === "error" && "bg-grid-danger/10 border-grid-danger/30 text-grid-danger"
            )}
          >
            {toast.msg}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
