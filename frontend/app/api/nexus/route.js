import { NextResponse } from "next/server";
import { streamText } from "ai";
import { groq } from "@ai-sdk/groq";

const KNOWLEDGE_BASE = [
  {
    id: "K1",
    title: "Transformer Thermal Anomaly",
    content:
      "Rapid transformer heating usually correlates with overload, degraded insulation, cooling fan failure, or harmonic distortion. Immediate actions include load redistribution, thermal imaging, and dissolved gas analysis.",
  },
  {
    id: "K2",
    title: "Voltage Sag on Feeder",
    content:
      "Voltage sag events are commonly caused by abrupt motor starts, feeder faults, capacitor bank switching, or conductor degradation. Mitigation includes staged motor startup, feeder balancing, and relay setting review.",
  },
  {
    id: "K3",
    title: "Relay Auto-Reclose Failure",
    content:
      "Auto-reclose failures often indicate relay misconfiguration, CT/PT mismatch, communication delay, or breaker mechanical wear. Validate protection settings, inspect breaker mechanism health, and replay event logs.",
  },
  {
    id: "K4",
    title: "Frequency Oscillation Burst",
    content:
      "Frequency oscillations can emerge from generation-load imbalance, weak grid coupling, control loop instability, or abrupt renewable intermittency. Use damping control, reserve activation, and ramp constraints.",
  },
  {
    id: "K5",
    title: "Sensor Drift Detection",
    content:
      "Sensor drift appears as a slow, persistent baseline shift. Validate with redundant channels, recalibrate probes, compare with reference instruments, and run anomaly model retraining if drift is systemic.",
  },
  {
    id: "K6",
    title: "Severity-Driven Triage",
    content:
      "Critical anomalies require containment in minutes, warning anomalies require diagnosis in hours, and informational anomalies should be observed and grouped for trend analysis. Include blast radius and business impact.",
  },
  {
    id: "K7",
    title: "Root-Cause Analysis Workflow",
    content:
      "A robust RCA workflow is: signal validation, timeline reconstruction, correlated telemetry review, hypothesis ranking, mitigation execution, and post-incident verification with rollback criteria.",
  },
  {
    id: "K8",
    title: "Mitigation Communication Format",
    content:
      "Operational responses are clearer when structured into: probable cause, immediate containment, medium-term remediation, confidence level, and explicit next checks with owners and deadlines.",
  },
];

const DEFAULT_SYSTEM_PROMPT =
  "You are SentinelIQ, an industrial reliability AI assistant. Be concise, direct, and factual. No emotional language, no fluff, no hedging.";

const RESPONSE_POLICY = `
Response policy (strict):
- Default style: short and to the point.
- Tone: brutally honest, neutral, technical.
- Do not use emotional language or motivational filler.
- If evidence is insufficient or unknown, respond exactly: I don't know.
- Do not fabricate values, logs, metrics, or incidents.
- Prefer bullet points for quick answers.
- If user asks to explain, compare, break down, analyze deeply, or requests a table, use a compact markdown table plus short bullets.
`;

function tokenize(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2);
}

function parseAnomalyBlock(prompt) {
  const lines = String(prompt || "").split("\n");
  const fields = ["ID", "Title", "Severity", "Asset", "Status", "Time"];
  const extracted = {};

  for (const line of lines) {
    for (const field of fields) {
      const prefix = `${field}:`;
      if (line.startsWith(prefix)) {
        extracted[field.toLowerCase()] = line.slice(prefix.length).trim();
      }
    }
  }

  return extracted;
}

function isExplainIntent(prompt) {
  const text = String(prompt || "").toLowerCase();
  return /(explain|detailed|detail|breakdown|compare|comparison|why|how|analy[sz]e|table|tabular)/.test(
    text,
  );
}

function scoreChunk(chunk, queryTokens) {
  const chunkTokens = tokenize(`${chunk.title} ${chunk.content}`);
  if (chunkTokens.length === 0 || queryTokens.length === 0) {
    return 0;
  }

  const tokenSet = new Set(chunkTokens);
  let overlap = 0;
  for (const token of queryTokens) {
    if (tokenSet.has(token)) {
      overlap += 1;
    }
  }

  const normalizedOverlap = overlap / Math.sqrt(tokenSet.size);
  return Number(normalizedOverlap.toFixed(4));
}

function retrieveContext(query, topK = 4) {
  const queryTokens = tokenize(query);
  const ranked = KNOWLEDGE_BASE.map((chunk) => ({
    ...chunk,
    score: scoreChunk(chunk, queryTokens),
  }))
    .filter((chunk) => chunk.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  return ranked;
}

function buildPromptWithRag(prompt) {
  const explainMode = isExplainIntent(prompt);
  const anomaly = parseAnomalyBlock(prompt);
  const retrieved = retrieveContext(prompt, 4);
  const contextBlock =
    retrieved.length > 0
      ? retrieved.map((doc) => `[${doc.id}] ${doc.title}: ${doc.content}`).join("\n")
      : "No relevant retrieved knowledge.";

  const anomalyContext = Object.keys(anomaly).length
    ? `Anomaly context:\n${Object.entries(anomaly)
        .map(([key, value]) => `- ${key}: ${value}`)
        .join("\n")}`
    : "Anomaly context: none provided";

  const sourceIds = retrieved.map((doc) => doc.id).join(", ");

  const responseFormat = explainMode
    ? `Format:
1) Give a compact markdown table with columns: Topic | Evidence | Impact | Action.
2) Add up to 4 concise bullets for operational next steps.
3) Keep it tight and technical.`
    : `Format:
1) Max 6 bullets.
2) Each bullet <= 18 words.
3) No intro/outro text.`;

  const unknownRule = retrieved.length === 0
    ? "Retrieved context is empty. If the user asks domain facts not present here, answer: I don't know."
    : "Use only retrieved evidence plus explicit user context. If still uncertain, answer: I don't know.";

  const ragPrompt = `User query:\n${prompt}\n\n${anomalyContext}\n\nRetrieved knowledge:\n${contextBlock}\n\n${unknownRule}\n\nResponse requirements:\n1) Explain likely causes based on evidence.\n2) Estimate impact severity and operational risk.\n3) Provide immediate and medium-term mitigation steps.\n4) Cite relevant retrieved sources as [Kx] where used.\n\n${responseFormat}`;

  return { ragPrompt, sourceIds, explainMode };
}

export async function POST(req) {
  try {
    const body = await req.json();
    const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";

    if (!prompt) {
      return NextResponse.json({ error: "Prompt is required." }, { status: 400 });
    }

    const { ragPrompt, sourceIds, explainMode } = buildPromptWithRag(prompt);
    const result = streamText({
      model: groq(process.env.AI_MODEL || "openai/gpt-oss-120b"),
      system: `${process.env.AI_SYSTEM_PROMPT || DEFAULT_SYSTEM_PROMPT}\n\n${RESPONSE_POLICY}`,
      prompt: ragPrompt,
      temperature: 0,
      maxOutputTokens: explainMode ? 520 : 220,
    });

    return result.toUIMessageStreamResponse({
      headers: {
        "x-rag-sources": sourceIds,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error?.message || "Sorry, something went wrong. Please try again.",
      },
      { status: 500 },
    );
  }
}
