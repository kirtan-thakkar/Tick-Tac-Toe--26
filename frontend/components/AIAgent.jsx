"use client";

import { useCompletion } from "@ai-sdk/react";
import { useState, useEffect, useRef } from "react";
import { Bot, Send, Sparkles, Terminal, Activity, Zap, Info, ShieldAlert, Cpu } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "motion/react";

function cleanInlineMarkdown(text) {
  return String(text || "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/`(.*?)`/g, "$1")
    .trim();
}

function isTableLine(line) {
  return line.includes("|") && line.trim().startsWith("|") && line.trim().endsWith("|");
}

function isTableSeparator(line) {
  const trimmed = line.trim();
  if (!isTableLine(trimmed)) return false;
  return trimmed
    .slice(1, -1)
    .split("|")
    .every((cell) => /^\s*:?-{3,}:?\s*$/.test(cell));
}

function parseMarkdownTable(lines) {
  if (lines.length < 2 || !isTableSeparator(lines[1])) return null;

  const headers = lines[0]
    .slice(1, -1)
    .split("|")
    .map((cell) => cleanInlineMarkdown(cell));

  const rows = lines
    .slice(2)
    .map((line) =>
      line
        .slice(1, -1)
        .split("|")
        .map((cell) => cleanInlineMarkdown(cell)),
    )
    .filter((row) => row.length > 0 && row.some((cell) => cell.length > 0));

  if (headers.length === 0 || rows.length === 0) return null;

  return { headers, rows };
}

function parseResponseBlocks(text) {
  const lines = String(text || "").split("\n");
  const blocks = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      i += 1;
      continue;
    }

    if (isTableLine(trimmed)) {
      const tableLines = [];
      let j = i;
      while (j < lines.length && isTableLine(lines[j].trim())) {
        tableLines.push(lines[j].trim());
        j += 1;
      }

      const table = parseMarkdownTable(tableLines);
      if (table) {
        blocks.push({ type: "table", value: table });
      } else {
        blocks.push({ type: "paragraph", value: tableLines.join("\n") });
      }
      i = j;
      continue;
    }

    if (/^[-*]\s+/.test(trimmed)) {
      const items = [];
      let j = i;
      while (j < lines.length && /^[-*]\s+/.test(lines[j].trim())) {
        items.push(cleanInlineMarkdown(lines[j].trim().replace(/^[-*]\s+/, "")));
        j += 1;
      }
      blocks.push({ type: "list", value: items });
      i = j;
      continue;
    }

    if (/^\*\*.*\*\*$/.test(trimmed)) {
      blocks.push({ type: "heading", value: cleanInlineMarkdown(trimmed) });
      i += 1;
      continue;
    }

    const paragraphLines = [trimmed];
    let j = i + 1;
    while (j < lines.length) {
      const next = lines[j].trim();
      if (!next || isTableLine(next) || /^[-*]\s+/.test(next) || /^\*\*.*\*\*$/.test(next)) {
        break;
      }
      paragraphLines.push(next);
      j += 1;
    }
    blocks.push({ type: "paragraph", value: cleanInlineMarkdown(paragraphLines.join(" ")) });
    i = j;
  }

  return blocks;
}

function StreamingState({ completion, isLoading }) {
  if (!isLoading) return null;

  const textLength = completion?.length || 0;
  const stepIndex = textLength < 50 ? 0 : textLength < 180 ? 1 : 2;
  const steps = ["Retrieving context", "Analyzing telemetry", "Synthesizing response"];

  return (
    <motion.div 
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-6 rounded-xl border border-grid-border/60 bg-grid-surface/40 p-4 relative overflow-hidden shadow-sm"
    >
      <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500/50" />
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="size-4 text-emerald-500 animate-pulse" />
        <p className="text-[11px] font-semibold tracking-widest uppercase text-grid-muted">Active Pipeline</p>
      </div>
      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
        {steps.map((step, index) => {
          const isDone = index < stepIndex;
          const isCurrent = index === stepIndex;
          return (
            <div key={step} className="flex items-center gap-3 flex-1">
              <div className={cn(
                "flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] font-medium border transition-colors",
                isCurrent ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.2)]" :
                isDone ? "border-grid-border bg-grid-surface text-grid-muted" :
                "border-transparent bg-grid-page/50 text-grid-muted/50"
              )}>
                {isDone ? "✓" : index + 1}
              </div>
              <span className={cn(
                "text-xs font-medium tracking-wide transition-colors",
                isCurrent ? "text-grid-title" :
                isDone ? "text-grid-muted" : "text-grid-muted/50"
              )}>{step}</span>
              {index < steps.length - 1 && (
                <div className="hidden sm:block h-[1px] flex-1 bg-gradient-to-r from-grid-border/50 to-transparent ml-2" />
              )}
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

function AIResponseView({ text, isLoading }) {
  const blocks = parseResponseBlocks(text);

  return (
    <div className="flex w-full gap-4 max-w-4xl mx-auto">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/10 shadow-[0_0_15px_rgba(16,185,129,0.1)] mt-1">
        <Bot className="size-5 text-emerald-500" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="mb-2 flex items-center gap-2">
          <span className="text-sm font-semibold text-grid-title">Sentinel AI</span>
          <span className="text-[10px] text-emerald-500/80 font-mono bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">v2.1.0</span>
        </div>
        
        <StreamingState completion={text} isLoading={isLoading} />
        
        {(blocks.length > 0 || (!isLoading && text)) && (
          <div className="bg-grid-surface/60 border border-grid-border/80 rounded-2xl rounded-tl-sm p-5 text-sm leading-relaxed text-grid-title shadow-sm backdrop-blur-sm">
            {blocks.length === 0 ? (
              <p className="whitespace-pre-wrap">{text}</p>
            ) : (
              <div className="space-y-4">
                {blocks.map((block, index) => {
                  if (block.type === "heading") {
                    return (
                      <h4 key={`h-${index}`} className="text-sm font-bold text-grid-title flex items-center gap-2 mt-6 mb-3 border-b border-grid-border/40 pb-2">
                        <Terminal className="size-4 text-emerald-500/70" />
                        {block.value}
                      </h4>
                    );
                  }

                  if (block.type === "list") {
                    return (
                      <ul key={`l-${index}`} className="space-y-2.5 my-3">
                        {block.value.map((item, itemIndex) => (
                          <li key={`li-${itemIndex}`} className="flex gap-3 items-start">
                            <span className="mt-[6px] flex size-1.5 shrink-0 rounded-full bg-emerald-500/60 shadow-[0_0_5px_rgba(16,185,129,0.5)]" />
                            <span className="text-grid-title/90">{item}</span>
                          </li>
                        ))}
                      </ul>
                    );
                  }

                  if (block.type === "table") {
                    return (
                      <div key={`t-${index}`} className="overflow-x-auto rounded-xl border border-grid-border/80 bg-grid-page/50 my-5 shadow-inner">
                        <table className="min-w-full text-xs">
                          <thead className="bg-grid-surface/80">
                            <tr>
                              {block.value.headers.map((header, i) => (
                                <th
                                  key={i}
                                  className="px-4 py-3 text-left font-semibold tracking-wider uppercase text-grid-muted border-b border-grid-border/80"
                                >
                                  {header}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-grid-border/40">
                            {block.value.rows.map((row, rowIndex) => (
                              <tr key={`row-${rowIndex}`} className="hover:bg-grid-surface/50 transition-colors">
                                {row.map((cell, cellIndex) => (
                                  <td key={`cell-${rowIndex}-${cellIndex}`} className="px-4 py-2.5 align-top">
                                    {cell}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    );
                  }

                  return (
                    <p key={`p-${index}`} className="whitespace-pre-wrap text-grid-title/90 leading-7">
                      {block.value}
                    </p>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const AIAgent = ({ contextAnomaly, onClearContext }) => {
  const [submittedPrompt, setSubmittedPrompt] = useState("");
  const messagesEndRef = useRef(null);
  
  const {
    completion,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    error,
    stop,
    setInput,
  } = useCompletion({
    api: "/api/nexus",
  });

  useEffect(() => {
    if (contextAnomaly) {
      const promptText = `I need help investigating the following anomaly:
ID: ${contextAnomaly.id}
Title: ${contextAnomaly.title}
Severity: ${contextAnomaly.severity}
Asset: ${contextAnomaly.asset}
Status: ${contextAnomaly.status}
Time: ${contextAnomaly.timestamp}

Could you explain what might cause this issue, analyze its potential impact, and suggest steps to resolve it?`;
      setInput(promptText);
    }
  }, [contextAnomaly, setInput]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [submittedPrompt, completion, isLoading]);

  const onSubmit = (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    setSubmittedPrompt(input);
    setInput(""); 
    handleSubmit(e);
  };

  return (
    <div className="flex flex-col w-full h-[calc(100vh-120px)] border border-grid-border/80 rounded-2xl overflow-hidden bg-grid-page/40 shadow-xl ring-1 ring-grid-border/50 relative">
      {/* Background ambient effect */}
      <div className="absolute top-0 left-1/2 w-3/4 h-1/2 -translate-x-1/2 bg-emerald-500/5 blur-[120px] pointer-events-none rounded-full" />
      
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-grid-border/80 bg-grid-surface/90 backdrop-blur z-10">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Bot className="size-5 text-grid-title" />
            <span className="absolute -bottom-1 -right-1 size-2.5 rounded-full border-2 border-grid-surface bg-emerald-500" />
          </div>
          <div>
            <h2 className="text-base font-bold text-grid-title tracking-wide">SentinelIQ Assistant</h2>
            <p className="text-[11px] text-grid-muted font-medium">Predictive Diagnostic Engine</p>
          </div>
        </div>
        {contextAnomaly && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center gap-3 bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 rounded-lg shadow-sm"
          >
            <ShieldAlert className="size-3.5 text-amber-500" />
            <span className="text-xs font-medium text-amber-500/90 hidden sm:inline-block">
              Context: {contextAnomaly.id}
            </span>
            <div className="h-4 w-px bg-amber-500/20 mx-1" />
            <button
              onClick={onClearContext}
              className="text-[10px] uppercase tracking-wider font-bold text-amber-500 hover:text-amber-400 transition-colors"
            >
              Clear
            </button>
          </motion.div>
        )}
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 p-6 overflow-y-auto space-y-8 z-10 scroll-smooth">
        {error && (
          <div className="flex justify-center max-w-2xl mx-auto">
            <div className="bg-grid-danger/10 text-grid-danger px-5 py-4 rounded-xl text-sm leading-relaxed border border-grid-danger/20 flex items-start gap-3 w-full">
              <ShieldAlert className="size-5 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold mb-1">Diagnostic Error</p>
                <p className="opacity-90">{error.message}</p>
              </div>
            </div>
          </div>
        )}

        {!submittedPrompt && !completion && !isLoading && !error && (
          <div className="h-full flex flex-col items-center justify-center text-center max-w-lg mx-auto">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5, type: "spring" }}
              className="relative mb-6"
            >
              <div className="absolute inset-0 bg-emerald-500/20 blur-2xl rounded-full" />
              <div className="size-20 rounded-2xl border border-grid-border bg-grid-surface/80 flex items-center justify-center relative shadow-xl transform rotate-3">
                <Cpu className="size-10 text-emerald-500/80" />
              </div>
            </motion.div>
            
            <h3 className="text-xl font-bold text-grid-title mb-2">How can I assist your diagnostics?</h3>
            <p className="text-sm text-grid-muted leading-relaxed mb-8">
              I can analyze anomalies, cross-reference telemetry logs, and suggest mitigation strategies based on historical node data.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
              {[
                { icon: Zap, text: "Analyze the latest voltage sag on Feeder 4" },
                { icon: Activity, text: "Show frequency variations over the last hour" },
                { icon: Info, text: "What usually causes thermal spikes in Substation A?" },
                { icon: Terminal, text: "Generate a maintenance report for Node Beta-2" }
              ].map((suggestion, i) => (
                <button
                  key={i}
                  onClick={() => setInput(suggestion.text)}
                  className="flex items-start gap-3 p-3 rounded-xl border border-grid-border/50 bg-grid-surface/40 hover:bg-grid-surface hover:border-emerald-500/30 transition-all text-left group"
                >
                  <suggestion.icon className="size-4 text-grid-muted group-hover:text-emerald-500 mt-0.5 shrink-0 transition-colors" />
                  <span className="text-xs font-medium text-grid-title/80 group-hover:text-grid-title transition-colors">
                    {suggestion.text}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {submittedPrompt && (
          <div className="flex w-full gap-4 max-w-4xl mx-auto flex-row-reverse">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-grid-border bg-grid-surface shadow-sm mt-1">
              <span className="text-sm font-bold text-grid-title">US</span>
            </div>
            <div className="flex-1 min-w-0 flex flex-col items-end">
              <div className="mb-2 flex items-center gap-2">
                <span className="text-sm font-semibold text-grid-title">Operator</span>
              </div>
              <div className="bg-grid-title text-grid-surface px-5 py-3.5 rounded-2xl rounded-tr-sm text-sm leading-relaxed whitespace-pre-wrap shadow-md max-w-[90%]">
                {submittedPrompt}
              </div>
            </div>
          </div>
        )}

        {completion && (
          <div className="flex justify-start">
            <AIResponseView text={completion} isLoading={isLoading} />
          </div>
        )}

        {isLoading && !completion && (
          <div className="flex w-full gap-4 max-w-4xl mx-auto">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/10 shadow-[0_0_15px_rgba(16,185,129,0.1)] mt-1">
              <Bot className="size-5 text-emerald-500" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="mb-2 flex items-center gap-2">
                <span className="text-sm font-semibold text-grid-title">Sentinel AI</span>
                <span className="text-[10px] text-emerald-500/80 font-mono bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">v2.1.0</span>
              </div>
              <StreamingState completion="" isLoading={true} />
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <form
        onSubmit={onSubmit}
        className="p-5 bg-grid-surface/80 backdrop-blur border-t border-grid-border/80 z-10"
      >
        <div className="relative flex items-center max-w-4xl mx-auto bg-grid-page/50 border border-grid-border rounded-xl focus-within:border-emerald-500/50 focus-within:ring-1 focus-within:ring-emerald-500/50 transition-all shadow-sm">
          <textarea
            className="w-full pl-4 pr-24 py-3.5 bg-transparent border-none focus:outline-none focus:ring-0 text-sm transition-all text-grid-title placeholder:text-grid-muted resize-none min-h-[52px] max-h-32 rounded-xl leading-relaxed"
            placeholder="Ask about anomalies, root causes, or mitigation steps..."
            value={input}
            onChange={handleInputChange}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onSubmit(e);
              }
            }}
            rows={1}
          />
          {isLoading ? (
            <button
              type="button"
              onClick={stop}
              className="absolute right-2 px-4 py-2 bg-grid-danger/20 text-grid-danger border border-grid-danger/30 text-xs font-bold uppercase tracking-wider rounded-lg hover:bg-grid-danger/30 transition-all"
            >
              Stop
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim()}
              className="absolute right-2 px-4 py-2 bg-emerald-500/90 text-white text-xs font-bold uppercase tracking-wider rounded-lg hover:bg-emerald-500 disabled:opacity-50 disabled:hover:bg-emerald-500/90 transition-all flex items-center gap-2 shadow-sm"
            >
              <Send className="size-3.5" />
              Send
            </button>
          )}
        </div>
        <div className="text-center mt-3">
          <p className="text-[10px] text-grid-muted/80">AI models can make mistakes. Always verify telemetry data independently before applying mitigations.</p>
        </div>
      </form>
    </div>
  );
};

export default AIAgent;
