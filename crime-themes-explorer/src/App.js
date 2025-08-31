import React, { useState, useEffect } from "react";
import "./App.css";
import DataBrowser from "./components/DataBrowser";
import ScriptRunner from "./components/ScriptRunner";
import P3Analysis from "./components/P3Analysis";

function App() {
  const [currentTab, setCurrentTab] = useState("data"); // data (combined), script, p3
  const [loading, setLoading] = useState(false);
  const [specificDataFile, setSpecificDataFile] = useState(null);

  // Handle custom event from ScriptRunner to switch to Data Browser
  useEffect(() => {
    const handleSwitchToDataBrowser = (event) => {
      setCurrentTab("data");
      if (event.detail && event.detail.filename) {
        setSpecificDataFile(event.detail.filename);
      }
    };

    const handleClearSpecificFile = () => {
      setSpecificDataFile(null);
    };

    window.addEventListener("switchToDataBrowser", handleSwitchToDataBrowser);
    window.addEventListener("clearSpecificFile", handleClearSpecificFile);

    return () => {
      window.removeEventListener(
        "switchToDataBrowser",
        handleSwitchToDataBrowser
      );
      window.removeEventListener("clearSpecificFile", handleClearSpecificFile);
    };
  }, []);

  const renderTabContent = () => {
    switch (currentTab) {
      case "data":
        return <DataBrowser specificFile={specificDataFile} />;

      case "script":
        return <ScriptRunner />;

      case "p3":
        return <P3Analysis />;

      default:
        return null;
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>🔍 Thematic Analysis Suite</h1>
        <p>Comprehensive crime data analysis and theme exploration platform</p>
      </header>

      {/* Navigation Tabs */}
      <nav className="nav-tabs">
        <button
          className={`nav-tab ${currentTab === "data" ? "active" : ""}`}
          onClick={() => setCurrentTab("data")}
        >
          📊 Data & Theme Explorer
        </button>
        <button
          className={`nav-tab ${currentTab === "script" ? "active" : ""}`}
          onClick={() => setCurrentTab("script")}
        >
          🐍 Initial Codes
        </button>
        <button
          className={`nav-tab ${currentTab === "p3" ? "active" : ""}`}
          onClick={() => setCurrentTab("p3")}
        >
          🎯 Themes
        </button>
      </nav>

      <main className="main-content">{renderTabContent()}</main>
    </div>
  );
}

export default App;
