"use client";
import { useCompletion } from "@ai-sdk/react";
import { useState, useEffect } from "react";
import { Bot, Send } from "lucide-react";

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
    api: "/api/stream",
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
              className="px-2 py-1 rounded bg-grid-page/50 text-grid-title hover:bg-grid-elevated border border-grid-border transition-colors"
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
            <div className="bg-grid-surface border border-grid-border text-grid-title px-5 py-3 rounded-2xl max-w-[85%] shadow-sm text-sm leading-relaxed whitespace-pre-wrap">
              {completion}
            </div>
          </div>
        )}

        {isLoading && !completion && (
          <div className="flex justify-start">
            <div className="flex items-center space-x-2 bg-grid-surface border border-grid-border px-5 py-4 rounded-2xl shadow-sm">
              <div className="w-2 h-2 bg-grid-muted rounded-full animate-bounce" />
              <div
                className="w-2 h-2 bg-grid-muted rounded-full animate-bounce"
                style={{ animationDelay: "150ms" }}
              />
              <div
                className="w-2 h-2 bg-grid-muted rounded-full animate-bounce"
                style={{ animationDelay: "300ms" }}
              />
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
            className="w-full pl-4 pr-24 py-3 bg-grid-page/50 border border-grid-border rounded-xl focus:outline-none focus:ring-1 focus:ring-grid-title focus:border-transparent text-sm transition-all text-grid-title placeholder:text-grid-muted resize-none min-h-[48px] max-h-[120px]"
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