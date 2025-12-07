import React, { useState } from "react";
import "./Starting.css";

/**
 * Starting component - App guide and overview
 * Explains the thematic analysis workflow and each module of the application
 */
export default function Starting() {
  const [showResearch, setShowResearch] = useState(false);

  return (
    <div className="starting-container">
      {/* Hero Section */}
      <section className="starting-hero">
        <h1>Welcome to Crime Themes Explorer</h1>
        <p className="starting-subtitle">
          An LLM-powered tool for thematic analysis of legal texts
        </p>
        <p className="starting-description">
          Discover patterns and themes in your data through AI-assisted coding
          and classification.
        </p>
      </section>

      {/* Quick Start Workflow */}
      <section className="starting-section">
        <h2>How It Works</h2>
        <p>
          This tool guides you through the thematic analysis process, from raw
          data to classified themes:
        </p>
        <div className="workflow-pipeline">
          <div className="pipeline-step">
            <span className="pipeline-num">1</span>
            <span className="pipeline-label">Upload Data</span>
          </div>
          <div className="pipeline-arrow">→</div>
          <div className="pipeline-step">
            <span className="pipeline-num">2</span>
            <span className="pipeline-label">Initial Codes (P2)</span>
          </div>
          <div className="pipeline-arrow">→</div>
          <div className="pipeline-step">
            <span className="pipeline-num">3</span>
            <span className="pipeline-label">Candidate Themes (P3)</span>
          </div>
          <div className="pipeline-arrow">→</div>
          <div className="pipeline-step">
            <span className="pipeline-num">4</span>
            <span className="pipeline-label">Final Themes (P3b)</span>
          </div>
          <div className="pipeline-arrow">→</div>
          <div className="pipeline-step">
            <span className="pipeline-num">5</span>
            <span className="pipeline-label">Assign Themes (P4)</span>
          </div>
        </div>
      </section>

      {/* App Modules Guide */}
      <section className="starting-section">
        <h2>App Modules</h2>
        <p>
          Each module in the sidebar corresponds to a step in the analysis
          process:
        </p>

        <div className="modules-grid">
          {/* Data & Theme Explorer */}
          <div className="module-card">
            <div className="module-header">
              <h3>Data & Theme Explorer</h3>
            </div>
            <p className="module-description">
              Your central hub for managing data files and organizing themes.
            </p>
            <div className="module-features">
              <h4>What you can do:</h4>
              <ul>
                <li>
                  <strong>Browse files</strong> — View all uploaded data files
                  and their statistics
                </li>
                <li>
                  <strong>View cases</strong> — Read individual case
                  descriptions and their assigned codes/themes
                </li>
                <li>
                  <strong>Organize themes</strong> — Use drag-and-drop to
                  reorganize theme hierarchies
                </li>
                <li>
                  <strong>Upload data</strong> — Import new JSON data files for
                  analysis
                </li>
                <li>
                  <strong>Export results</strong> — Download processed data with
                  themes
                </li>
              </ul>
            </div>
            <div className="module-tip">
              <strong>Tip:</strong> Start here to upload your data before
              running the analysis pipeline.
            </div>
          </div>

          {/* Create Mockup Data */}
          <div className="module-card">
            <div className="module-header">
              <h3>Create Mockup Data</h3>
            </div>
            <p className="module-description">
              Generate synthetic test data using AI for experimentation.
            </p>
            <div className="module-features">
              <h4>What you can do:</h4>
              <ul>
                <li>
                  <strong>Describe your data</strong> — Write a prompt
                  describing the type of cases to generate
                </li>
                <li>
                  <strong>Choose quantity</strong> — Specify how many cases to
                  create
                </li>
                <li>
                  <strong>Select model</strong> — Pick which LLM to use for
                  generation
                </li>
                <li>
                  <strong>Preview & save</strong> — Review generated cases
                  before saving
                </li>
              </ul>
            </div>
            <div className="module-tip">
              <strong>Tip:</strong> Perfect for testing the workflow without
              real data, or for training purposes.
            </div>
          </div>

          {/* Initial Codes (P2) */}
          <div className="module-card phase-card">
            <div className="module-header">
              <h3>Initial Codes (P2)</h3>
              <span className="phase-badge">Phase 2</span>
            </div>
            <p className="module-description">
              Generate initial codes that describe each case in your dataset.
            </p>
            <div className="module-features">
              <h4>What you can do:</h4>
              <ul>
                <li>
                  <strong>Select data file</strong> — Choose which dataset to
                  analyze
                </li>
                <li>
                  <strong>Configure model</strong> — Select the LLM and adjust
                  parameters
                </li>
                <li>
                  <strong>Add instructions</strong> — Provide custom guidance to
                  focus the coding
                </li>
                <li>
                  <strong>Monitor progress</strong> — Watch real-time processing
                  with live updates
                </li>
                <li>
                  <strong>Review codes</strong> — See generated codes for each
                  case
                </li>
                <li>
                  <strong>Regenerate</strong> — Re-run coding for specific cases
                  if needed
                </li>
              </ul>
            </div>
            <div className="module-prereq">
              <strong>Prerequisite:</strong> Upload data via Data Explorer
              first.
            </div>
          </div>

          {/* Candidate Themes (P3) */}
          <div className="module-card phase-card">
            <div className="module-header">
              <h3>Candidate Themes (P3)</h3>
              <span className="phase-badge">Phase 3</span>
            </div>
            <p className="module-description">
              Collate initial codes into candidate themes — patterns that emerge
              from your data.
            </p>
            <div className="module-features">
              <h4>What you can do:</h4>
              <ul>
                <li>
                  <strong>Run theme generation</strong> — LLM analyzes codes to
                  identify themes
                </li>
                <li>
                  <strong>View themes</strong> — See discovered candidate themes
                  and their codes
                </li>
                <li>
                  <strong>Organize themes</strong> — Drag-and-drop to merge or
                  reorganize
                </li>
                <li>
                  <strong>Track progress</strong> — Monitor batch processing in
                  real-time
                </li>
              </ul>
            </div>
            <div className="module-prereq">
              <strong>Prerequisite:</strong> Complete Initial Codes (P2) first.
            </div>
          </div>

          {/* Final Themes (P3b) */}
          <div className="module-card phase-card">
            <div className="module-header">
              <h3>Final Themes (P3b)</h3>
              <span className="phase-badge">Phase 3b</span>
            </div>
            <p className="module-description">
              Consolidate candidate themes into a final set of high-level
              themes.
            </p>
            <div className="module-features">
              <h4>What you can do:</h4>
              <ul>
                <li>
                  <strong>Run consolidation</strong> — LLM suggests how to group
                  candidate themes
                </li>
                <li>
                  <strong>Review suggestions</strong> — See proposed theme
                  hierarchy
                </li>
                <li>
                  <strong>Refine themes</strong> — Edit, merge, or split themes
                  as needed
                </li>
                <li>
                  <strong>Approve final set</strong> — Confirm the themes for
                  classification
                </li>
              </ul>
            </div>
            <div className="module-prereq">
              <strong>Prerequisite:</strong> Complete Candidate Themes (P3)
              first.
            </div>
          </div>

          {/* Assign Final Themes (P4) */}
          <div className="module-card phase-card">
            <div className="module-header">
              <h3>Assign Final Themes (P4)</h3>
              <span className="phase-badge">Phase 4</span>
            </div>
            <p className="module-description">
              Classify each case in your dataset with the final themes.
            </p>
            <div className="module-features">
              <h4>What you can do:</h4>
              <ul>
                <li>
                  <strong>Run classification</strong> — LLM assigns themes to
                  each case
                </li>
                <li>
                  <strong>View assignments</strong> — See which theme each case
                  received
                </li>
                <li>
                  <strong>Review edge cases</strong> — Check low-confidence
                  assignments
                </li>
                <li>
                  <strong>Export results</strong> — Download the classified
                  dataset
                </li>
              </ul>
            </div>
            <div className="module-prereq">
              <strong>Prerequisite:</strong> Complete Final Themes (P3b) first.
            </div>
          </div>
        </div>
      </section>

      {/* Thematic Analysis Overview */}
      <section className="starting-section">
        <h2>Understanding Thematic Analysis</h2>
        <p>
          Thematic analysis is a qualitative method for identifying patterns
          (themes) in data. This tool implements an LLM-assisted version of the
          six-phase framework:
        </p>

        <div className="phases-compact">
          <div className="phase-item">
            <span className="phase-num">1</span>
            <div className="phase-content">
              <strong>Familiarization</strong>
              <span className="phase-desc">
                Reading data to understand content
              </span>
            </div>
          </div>
          <div className="phase-item phase-supported">
            <span className="phase-num">2</span>
            <div className="phase-content">
              <strong>Initial Coding</strong>
              <span className="phase-desc">
                Generating codes systematically
              </span>
              <span className="phase-tag">LLM Assisted</span>
            </div>
          </div>
          <div className="phase-item phase-supported">
            <span className="phase-num">3</span>
            <div className="phase-content">
              <strong>Searching for Themes</strong>
              <span className="phase-desc">Collating codes into themes</span>
              <span className="phase-tag">LLM Assisted</span>
            </div>
          </div>
          <div className="phase-item phase-supported">
            <span className="phase-num">4</span>
            <div className="phase-content">
              <strong>Reviewing Themes</strong>
              <span className="phase-desc">Checking themes against data</span>
              <span className="phase-tag">LLM Assisted</span>
            </div>
          </div>
          <div className="phase-item">
            <span className="phase-num">5</span>
            <div className="phase-content">
              <strong>Defining Themes</strong>
              <span className="phase-desc">Refining theme specifics</span>
            </div>
          </div>
          <div className="phase-item">
            <span className="phase-num">6</span>
            <div className="phase-content">
              <strong>Producing Report</strong>
              <span className="phase-desc">Final analysis and write-up</span>
            </div>
          </div>
        </div>
      </section>

      {/* Research Foundation (Collapsible) */}
      <section className="starting-section research-section">
        <button
          className="research-toggle"
          onClick={() => setShowResearch(!showResearch)}
          aria-expanded={showResearch}
        >
          <h2>Research Foundation</h2>
          <span className="toggle-icon">{showResearch ? "−" : "+"}</span>
        </button>

        {showResearch && (
          <div className="research-content">
            <p>
              This tool is based on research into LLM-assisted thematic
              analysis:
            </p>
            <div className="citation-compact">
              <div className="citation-badge">arXiv:2310.18729v1</div>
              <p className="citation-title">
                <strong>
                  Using Large Language Models to Support Thematic Analysis in
                  Empirical Legal Studies
                </strong>
              </p>
              <p className="citation-authors">
                J. Drápal, H. Westermann, J. Savelka (2023)
              </p>
              <p className="citation-summary">
                The research demonstrated that LLMs can generate reasonable
                initial codes (72.6% quality, improving to 88.8% with expert
                feedback) and successfully discover themes that map well to
                expert-identified patterns.
              </p>
              <a
                href="https://arxiv.org/abs/2310.18729"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-link"
              >
                Read the paper on arXiv →
              </a>
            </div>
          </div>
        )}
      </section>

      {/* Footer */}
      <footer className="starting-footer">
        <p>
          For best results, review LLM-generated codes and themes with domain
          expertise. This tool assists the analysis process but expert judgment
          remains essential.
        </p>
      </footer>
    </div>
  );
}
