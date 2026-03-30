import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";

function App() {
  const [appReady, setAppReady] = useState(false);

  useEffect(() => {
    invoke("get_app_info").then(() => {
      setAppReady(true);
    }).catch(() => {
      setAppReady(true);
    });
  }, []);

  return (
    <div className="app">
      <header className="app-header">
        <h1>AimForge</h1>
        <p className="subtitle">FPS Aim Calibration & Training</p>
      </header>
      <main className="app-main">
        {appReady ? (
          <div className="status-card">
            <div className="status-indicator active" />
            <span>System Ready</span>
          </div>
        ) : (
          <div className="status-card">
            <div className="status-indicator" />
            <span>Initializing...</span>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
