
const fs = require("fs");
const path = require("path");

const componentsDir = path.join(__dirname, "components");

// --- AIAgent.jsx ---
let aiAgent = fs.readFileSync(path.join(componentsDir, "AIAgent.jsx"), "utf8");
aiAgent = aiAgent.replace(
  `    setSubmittedPrompt(input);
    setInput(""); 
    handleSubmit(e);`,
  `    setSubmittedPrompt(input);
    setInput(""); 
    handleSubmit(e);

    // Feedback API
    fetch((process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000") + "/feedback/record", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: input })
    }).catch(e => console.error("Feedback record error:", e));`
);
fs.writeFileSync(path.join(componentsDir, "AIAgent.jsx"), aiAgent);

// --- dashboard.jsx ---
let dashboard = fs.readFileSync(path.join(componentsDir, "dashboard.jsx"), "utf8");

// Add retrain button and live score
dashboard = dashboard.replace(
  `const [activeTab, setActiveTab] = useState("Overview");
  const [activeAnomaly, setActiveAnomaly] = useState(null);`,
  `const [activeTab, setActiveTab] = useState("Overview");
  const [activeAnomaly, setActiveAnomaly] = useState(null);
  const [liveScore, setLiveScore] = useState(null);
  const [liveScoreError, setLiveScoreError] = useState("");
  const [retrainStatus, setRetrainStatus] = useState("");

  useEffect(() => {
    const fetchLiveScore = async () => {
      try {
        const res = await fetch((process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000") + "/anomalies/live");
        if (!res.ok) throw new Error("HTTP error");
        const data = await res.json();
        setLiveScore(data.current_ensemble_score);
      } catch (err) {
        setLiveScoreError("Live score sync failed");
      }
    };
    fetchLiveScore();
    const interval = setInterval(fetchLiveScore, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleRetrain = async () => {
    setRetrainStatus("Retraining...");
    try {
      const res = await fetch((process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000") + "/feedback/retrain", { method: "POST" });
      if (!res.ok) throw new Error("Failed");
      setRetrainStatus("Retrained");
      setTimeout(() => setRetrainStatus(""), 3000);
    } catch (err) {
      setRetrainStatus("Retrain Failed");
    }
  };`
);

dashboard = dashboard.replace(
  `              <span className="inline-flex items-center gap-1.5 rounded-md border border-grid-success/30 bg-grid-pill px-3 py-1 text-xs font-semibold text-grid-pill-foreground">
                <span className="size-1.5 rounded-full bg-grid-success" />
                Platform Status: Stable | 99.3% pipeline uptime
              </span>`,
  `              <span className="inline-flex items-center gap-1.5 rounded-md border border-grid-success/30 bg-grid-pill px-3 py-1 text-xs font-semibold text-grid-pill-foreground">
                <span className="size-1.5 rounded-full bg-grid-success" />
                Platform Status: Stable | 99.3% pipeline uptime
              </span>
              {liveScore !== null && (
                <span className="inline-flex items-center gap-1.5 rounded-md border border-grid-title/30 bg-grid-surface px-3 py-1 text-xs font-semibold text-grid-title">
                  Real-time Score: {liveScore.toFixed(2)}
                </span>
              )}
              {liveScoreError && <span className="text-xs text-grid-danger px-2">{liveScoreError}</span>}
              <Button onClick={handleRetrain} variant="outline" size="sm" className="h-7 text-xs bg-grid-surface/50 ml-2">
                {retrainStatus || "Retrain Model"}
              </Button>`
);
fs.writeFileSync(path.join(componentsDir, "dashboard.jsx"), dashboard);

// --- AssetsView.jsx ---
let assetsView = fs.readFileSync(path.join(componentsDir, "AssetsView.jsx"), "utf8");
assetsView = assetsView.replace(
  `    const baseUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:8000";
    const endpoint = \`\${baseUrl}/api/assets\`; // Replace with actual endpoint`,
  `    const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    const endpoint = \`\${baseUrl}/assets/assets\`;`
);
assetsView = assetsView.replace(
  `  useEffect(() => {
    fetchAssets();
  }, []);`,
  `  useEffect(() => {
    fetchAssets();
    const interval = setInterval(fetchAssets, 15000);
    return () => clearInterval(interval);
  }, []);`
);
fs.writeFileSync(path.join(componentsDir, "AssetsView.jsx"), assetsView);

// --- AnomaliesView.jsx ---
let anomaliesView = fs.readFileSync(path.join(componentsDir, "AnomaliesView.jsx"), "utf8");
anomaliesView = anomaliesView.replace(
  `  const [anomalies, setAnomalies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("All");

  useEffect(() => {
    const timer = setTimeout(() => {
      setAnomalies(initialAnomalies);
      setLoading(false);
    }, 600);
    return () => clearTimeout(timer);
  }, []);`,
  `  const [anomalies, setAnomalies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("All");
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);

  const fetchAnomalies = async () => {
    setLoading(true);
    setError("");
    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const params = new URLSearchParams({
        limit: 20,
        page: page,
        ...(searchQuery && { search: searchQuery }),
        ...(activeFilter !== "All" && { severity: activeFilter })
      });
      const res = await fetch(\`\${baseUrl}/anomalies/list?\${params}\`);
      if (!res.ok) throw new Error("HTTP error");
      const data = await res.json();
      setAnomalies(data.anomalies || data || initialAnomalies);
      
      // Also fetch incidents history in background
      fetch(\`\${baseUrl}/anomalies/incidents\`).catch(e => console.error(e));
    } catch (err) {
      console.error(err);
      setError("Failed to fetch anomalies");
      if (anomalies.length === 0) setAnomalies(initialAnomalies);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnomalies();
    const interval = setInterval(fetchAnomalies, 15000);
    return () => clearInterval(interval);
  }, [searchQuery, activeFilter, page]);`
);
fs.writeFileSync(path.join(componentsDir, "AnomaliesView.jsx"), anomaliesView);
console.log("Updated AIAgent.jsx, dashboard.jsx, AssetsView.jsx, AnomaliesView.jsx");

