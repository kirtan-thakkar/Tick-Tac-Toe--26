"use client";
import { useCompletion } from "@ai-sdk/react";
import { useState, useEffect } from "react";
import { Bot, Send } from "lucide-react";

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
  if (!isTableLine(trimmed)) {
    return false;
  }
  return trimmed
    .slice(1, -1)
    .split("|")
    .every((cell) => /^\s*:?-{3,}:?\s*$/.test(cell));
}

function parseMarkdownTable(lines) {
  if (lines.length < 2 || !isTableSeparator(lines[1])) {
    return null;
  }

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

  if (headers.length === 0 || rows.length === 0) {
    return null;
  }

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
  if (!isLoading) {
    return null;
  }

  const textLength = completion.length;
  const stepIndex = textLength < 50 ? 0 : textLength < 180 ? 1 : 2;
  const steps = ["Retrieving context", "Analyzing signal", "Formatting response"];

  return (
    <div className="mb-3 rounded-lg border border-grid-border bg-grid-page/60 p-3">
      <p className="text-[11px] font-semibold tracking-[0.08em] uppercase text-grid-muted">AI Pipeline</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {steps.map((step, index) => {
          const isDone = index < stepIndex;
          const isCurrent = index === stepIndex;
          return (
            <span
              key={step}
              className={`rounded-md px-2 py-1 text-[11px] border ${
                isCurrent
                  ? "border-grid-title text-grid-title bg-grid-surface"
                  : isDone
                    ? "border-grid-success/40 text-grid-pill-foreground bg-grid-success/10"
                    : "border-grid-border text-grid-muted bg-grid-page/50"
              }`}
            >
              {step}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function AIResponseView({ text, isLoading }) {
  const blocks = parseResponseBlocks(text);

  return (
    <div className="bg-grid-surface border border-grid-border text-grid-title px-5 py-3 rounded-2xl max-w-[92%] shadow-sm text-sm leading-relaxed">
      <StreamingState completion={text} isLoading={isLoading} />

      {blocks.length === 0 ? (
        <p className="whitespace-pre-wrap">{text}</p>
      ) : (
        <div className="space-y-3">
          {blocks.map((block, index) => {
            if (block.type === "heading") {
              return (
                <h4 key={`h-${index}`} className="text-sm font-semibold text-grid-title">
                  {block.value}
                </h4>
              );
            }

            if (block.type === "list") {
              return (
                <ul key={`l-${index}`} className="space-y-1.5">
                  {block.value.map((item, itemIndex) => (
                    <li key={`li-${itemIndex}`} className="flex gap-2">
                      <span className="mt-[7px] size-1.5 rounded-full bg-grid-title/70" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              );
            }

            if (block.type === "table") {
              return (
                <div key={`t-${index}`} className="overflow-x-auto rounded-lg border border-grid-border bg-grid-page/50">
                  <table className="min-w-full text-xs">
                    <thead className="bg-grid-page/80">
                      <tr>
                        {block.value.headers.map((header) => (
                          <th
                            key={header}
                            className="px-3 py-2 text-left font-semibold tracking-[0.05em] uppercase text-grid-muted border-b border-grid-border"
                          >
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {block.value.rows.map((row, rowIndex) => (
                        <tr key={`row-${rowIndex}`} className="odd:bg-grid-surface even:bg-grid-page/35">
                          {row.map((cell, cellIndex) => (
                            <td key={`cell-${rowIndex}-${cellIndex}`} className="px-3 py-2 align-top border-b border-grid-border/60">
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
              <p key={`p-${index}`} className="whitespace-pre-wrap text-grid-title">
                {block.value}
              </p>
            );
          })}
        </div>
      )}
    </div>
  );
}

const AIAgent = ({ contextAnomaly, onClearContext }) => {
  const [submittedPrompt, setSubmittedPrompt] = useState("");
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

  const onSubmit = (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    setSubmittedPrompt(input);
    setInput(""); 
    handleSubmit(e);
  };

  return (
    <div className="flex flex-col w-full h-[calc(100vh-140px)] border border-grid-border rounded-xl overflow-hidden bg-grid-surface shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-grid-border bg-grid-surface">
        <div className="flex items-center gap-2">
          <Bot className="size-5 text-grid-title" />
          <h2 className="text-lg font-semibold text-grid-title">SentinelIQ Assistant</h2>
        </div>
        {contextAnomaly && (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-grid-muted bg-grid-elevated px-2 py-1 rounded">
              Context: {contextAnomaly.id} - {contextAnomaly.title}
            </span>
            <button
              onClick={onClearContext}
              className="px-2 py-1 rounded bg-grid-page/50 text-grid-title hover:bg-grid-elevated border border-grid-border"
            >
              Clear
            </button>
          </div>
        )}
      </div>
      <div className="flex-1 p-6 overflow-y-auto space-y-6 bg-grid-page/30">
        {error && (
          <div className="flex justify-center">
            <div className="bg-grid-danger/15 text-grid-danger px-5 py-3 rounded-2xl text-sm leading-relaxed border border-grid-danger/30">
              {error.message}
            </div>
          </div>
        )}

        {submittedPrompt && (
          <div className="flex justify-end">
            <div className="bg-grid-title text-grid-surface px-5 py-3 rounded-2xl max-w-[85%] text-sm leading-relaxed whitespace-pre-wrap">
              {submittedPrompt}
            </div>
          </div>
        )}

        {completion && (
          <div className="flex justify-start">
            <AIResponseView text={completion} isLoading={isLoading} />
          </div>
        )}

        {isLoading && !completion && (
          <div className="flex justify-start">
            <div className="flex items-center space-x-2 bg-grid-surface border border-grid-border px-5 py-4 rounded-2xl shadow-sm">
              <div className="w-2 h-2 bg-grid-muted rounded-full" />
              <div className="w-2 h-2 bg-grid-muted rounded-full" />
              <div className="w-2 h-2 bg-grid-muted rounded-full" />
            </div>
          </div>
        )}

        {!submittedPrompt && !completion && !isLoading && !error && (
          <div className="h-full flex flex-col items-center justify-center text-grid-muted text-sm gap-3">
            <div className="size-12 rounded-full border border-grid-border bg-grid-page flex items-center justify-center">
              <Bot className="size-6 text-grid-muted" />
            </div>
            <p className="font-medium text-grid-title">Start a conversation</p>
            {contextAnomaly ? (
              <p className="text-xs text-center max-w-xs">
                Context is loaded for anomaly <span className="text-grid-title font-semibold">{contextAnomaly.id}</span>. Press Send to ask about it.
              </p>
            ) : (
              <p className="text-xs text-center max-w-xs">
                Click on an anomaly in the Overview tab to investigate it directly with the AI, or ask a general question below.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Input Area */}
      <form
        onSubmit={onSubmit}
        className="p-4 bg-grid-surface border-t border-grid-border"
      >
        <div className="relative flex items-center">
          <textarea
            className="w-full pl-4 pr-24 py-3 bg-grid-page/50 border border-grid-border rounded-xl focus:outline-none focus:ring-1 focus:ring-grid-title focus:border-transparent text-sm transition-all text-grid-title placeholder:text-grid-muted resize-none min-h-12 max-h-30"
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
              className="absolute right-2 px-3 py-1.5 bg-grid-danger/90 text-white text-xs font-medium rounded-lg hover:bg-grid-danger transition-all"
            >
              Stop
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim()}
              className="absolute right-2 px-3 py-1.5 bg-grid-title text-grid-surface text-xs font-medium rounded-lg hover:opacity-90 disabled:opacity-50 disabled:hover:opacity-50 transition-all flex items-center gap-1.5"
            >
              <Send className="size-3.5" />
              Send
            </button>
          )}
        </div>
      </form>
    </div>
  );
};

export default AIAgent;