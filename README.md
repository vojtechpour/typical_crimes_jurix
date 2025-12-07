# Packaging Thematic Analysis as an AI Workflow for Legal Research

> **Paper:** Presented at the AI4A2J Workshop at JURIX 2025, December 9, 2025, Turin, Italy  
> **Author:** Vojtěch Pour (Faculty of Law, Charles University, Prague)

## Abstract

This work-in-progress paper introduces a system that operationalizes thematic analysis for legal research as a reproducible, agentic workflow. Focusing first on case law, researchers upload a JSON corpus keyed by case identifiers, and the system maps plain-language intent (scope, granularity, focus, presentation) onto a fixed sequence of analysis phases orchestrated from the frontend. A simple web interface streams intermediate outputs for review, while automation is balanced with optional human checkpoints and reversible edits. The workflow aims to be model-agnostic and supports multilingual legal texts. On representative case-law datasets, the prototype completes end-to-end runs that produce stable codebooks and candidate themes without ad-hoc prompt retuning, and it reduces manual stitching by automating cross-document aggregation. Two user-facing artifacts are generated: an enriched JSON with codes and themes, and a compact CSV or HTML report for rapid inspection and downstream use. Overall, the system lowers time to first theme, improves refinement safety, and increases portability across jurisdictions and languages, moving legal-domain thematic analysis from one-off prompting toward a reviewable, reusable practice with a clear path to statutes, regulations, and briefs.

## Citation

```bibtex
@inproceedings{Pour_JURIX2025_AI4A2J,
  author    = {Pour, Vojtěch},
  title     = {Packaging Thematic Analysis as an AI Workflow for Legal Research},
  booktitle = {Proceedings of the AI4A2J Workshop at JURIX 2025},
  year      = {2025},
  address   = {Turin, Italy}
}
```

## Quick Start

### Prerequisites

- Node.js 20+
- pnpm 9+
- At least one AI provider API key (OpenAI, Google Gemini, or Anthropic Claude)

### Installation

```bash
# Clone the repository
git clone https://github.com/your-username/typical-crimes.git
cd typical-crimes

# Install dependencies
pnpm install

# Copy environment file and add your API keys
cp .env.example .env
# Edit .env with your API key(s)

# Start development server
pnpm dev
```

The frontend runs on `http://localhost:3005` and the API on `http://localhost:9000`.

## Pipeline Phases

The system implements the Braun & Clarke thematic analysis methodology through four sequential phases:

```
Raw Data → P2 (Initial Codes) → P3 (Candidate Themes) → P3b (Finalize) → P4 (Assign Themes) → Themed Dataset
```

| Phase   | Name             | Description                                               |
| ------- | ---------------- | --------------------------------------------------------- |
| **P2**  | Initial Codes    | Generate initial codes from case descriptions (per case)  |
| **P3**  | Candidate Themes | Derive candidate themes by aggregating codes across cases |
| **P3b** | Finalize Themes  | Merge, split, and rename themes through human curation    |
| **P4**  | Assign Themes    | Apply the finalized theme set back to all cases           |

### Human-in-the-Loop Checkpoints

- After **P2**: Review and edit initial codes at case level
- After **P3b**: Curate themes (merge/split/rename) before final assignment
- All edits are reversible with audit logging

## Prompt Engineering & Methodological Mapping

This workflow implements a **Chain-of-Thought (CoT)** approach designed to mirror the reflexive phases of Thematic Analysis (Braun & Clarke, 2006). We decouple the LLM interactions to prevent context bleeding and hallucination:

- **Phase 2 (Initial Codes):** Uses `data/phase_2_prompt.txt`. Restricted to distinct code generation; prevents premature aggregation to preserve granularity.
- **Phase 3 (Candidate Themes):** Uses `data/phase_3_prompt.txt`. Operates on P2 outputs only; strict context window management reduces noise.
- **Phase 3b (Finalize Themes):** Recursive self-critique; merges/splits/renames themes against the original dataset.
- **Phase 4 (Assign Themes):** Uses `data/phase_4_prompt.txt`. Applies the finalized theme set back to all cases; ensures consistent labeling across the corpus.

See `data/system_prompt.txt` for the base system prompt grounded in Braun & Clarke's checklist for good thematic analysis.

## Data Format

### Input Format

The system expects a JSON file keyed by case identifiers:

```json
{
  "case_001": {
    "id": "case_001",
    "plny_skutek_short": "Your case description text here..."
  },
  "case_002": {
    "id": "case_002",
    "plny_skutek_short": "Another case description..."
  }
}
```

### Sample Data

- **Schema example:** See [`data-templates/sample_data.json`](data-templates/sample_data.json)
- **Fictional test cases:** See [`data-templates/dummy_cases.json`](data-templates/dummy_cases.json) — 15 obviously fictional cases demonstrating the full schema progression (raw → codes → themes)

### Output Format

After processing, cases are enriched with analysis fields:

```json
{
  "case_001": {
    "id": "case_001",
    "plny_skutek_short": "...",
    "initial_code_0": ["code_a", "code_b", "code_c"],
    "candidate_theme": "Theme_Name",
    "theme": "Final_Theme_Name"
  }
}
```

### Data Policy

**No real data is included in this repository.** You can:

1. Use the in-app mockup data generator
2. Load the fictional test cases from `data-templates/dummy_cases.json`
3. Bring your own JSON corpus

If working with sensitive legal data, ensure compliance with applicable privacy regulations (e.g., GDPR for EU jurisdictions).

## Architecture

This is a TypeScript monorepo using [Turborepo](https://turbo.build/):

```
├── apps/
│   ├── web/          # React frontend (Vite)
│   └── api/          # Express backend
├── packages/
│   ├── ai-analysis/  # AI provider integrations & analysis logic
│   ├── shared/       # Shared types and constants
│   └── tsconfig/     # Shared TypeScript configurations
├── data/             # Prompt templates
└── data-templates/   # Sample data schemas
```

## Tech Stack

- **Frontend:** React 18, Vite, TypeScript
- **Backend:** Express, Node.js 20+, TypeScript
- **AI Providers:** OpenAI GPT-4o, Google Gemini, Anthropic Claude
- **Monorepo:** Turborepo, pnpm

## Environment Variables

| Variable            | Description                             | Required             |
| ------------------- | --------------------------------------- | -------------------- |
| `OPENAI_API_KEY`    | OpenAI API key                          | One of these         |
| `GEMINI_API_KEY`    | Google Gemini API key                   | is required          |
| `ANTHROPIC_API_KEY` | Anthropic Claude API key                |                      |
| `MODEL_PROVIDER`    | Default provider (openai/gemini/claude) | No (default: gemini) |
| `PORT`              | API server port                         | No (default: 9000)   |

## Reproducing Results

### Running the Full Pipeline

```bash
# 1. Start the application
pnpm dev

# 2. Upload your JSON data file via the web interface

# 3. Run each phase sequentially:
#    - Navigate to "Initial Codes (P2)" tab → Start analysis
#    - Navigate to "Themes (P3/P3b)" tab → Start theme generation
#    - Navigate to "Assign Themes (P4)" tab → Assign themes to all cases

# 4. Export results as CSV or HTML
```

### Note on Reproducibility

Due to the stochastic nature of LLM outputs, exact reproduction of specific codes and themes may vary between runs. The workflow is designed to produce _stable and comparable_ results rather than identical outputs. For research reproducibility:

- Document the model and version used (e.g., `gpt-4o-2024-08-06`)
- Save intermediate outputs at each phase
- Use the audit log for provenance tracking

## Related Work

This system builds on prior research in AI-assisted legal analysis:

- Drápal J, Westermann H, Šavelka J. [Using large language models to support thematic analysis in empirical legal studies](https://arxiv.org/abs/2310.18729). arXiv:2310.18729; 2023.
- Braun V, Clarke V. Using thematic analysis in psychology. _Qual Res Psychol_. 2006;3(2):77–101.
- Šavelka J, Ashley KD. The unreasonable effectiveness of large language models in zero-shot semantic annotation of legal texts. _Front Artif Intell_. 2023;6:1279794.

## License

MIT License — see [LICENSE](LICENSE) for details.

The accompanying paper is licensed under CC BY 4.0.
