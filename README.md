# Packaging Thematic Analysis as an AI Workflow for Legal Research

> **Paper:** Presented at JURIX 2025, Turin, Italy  
> **Author:** Vojtěch Pour (Faculty of Law, Charles University, Prague)  
> **Contact:** vojtech.pour@gmail.com

**🚀 [Try the Live Demo](https://theme-studio-hscnbub4a7c2bkhu.polandcentral-01.azurewebsites.net/)**

## Abstract

This work-in-progress paper introduces a reusable system that operationalizes thematic analysis for legal research as a reproducible, agentic workflow. Researchers upload a JSON corpus keyed by case identifiers; plain-language intent (scope, granularity, focus, presentation) is mapped to a fixed sequence of phases orchestrated from the frontend. A lightweight web UI streams intermediate outputs and offers optional checkpoints with reversible edits. The workflow is model-agnostic, multilingual, and stabilizes codebooks and candidate themes without ad-hoc prompt retuning on representative case-law datasets.

The system packages and exposes in a frontend the approach explored by Drápal, Westermann, and Šavelka. Overall, it lowers time-to-first-theme, improves refinement safety, and increases portability across jurisdictions and languages.

## Citation

```bibtex
@inproceedings{Pour_JURIX2025,
  author    = {Pour, Vojtěch},
  title     = {Packaging Thematic Analysis as an AI Workflow for Legal Research},
  booktitle = {Proceedings of JURIX 2025},
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
git clone https://github.com/vojtechpour/typical_crimes_jurix.git
cd typical_crimes_jurix

# Install dependencies
pnpm install

# Create environment file and add your API keys
echo "OPENAI_API_KEY=your-key-here" > .env
# Or use GEMINI_API_KEY or ANTHROPIC_API_KEY

# Start development server
pnpm dev
```

The frontend runs on `http://localhost:3005` and the API on `http://localhost:9000`.

## Workflow Phases

The frontend orchestrates thematic analysis phases P2→P3→P3b→P4 with lightweight checks, explicit checkpoints, and cross-document aggregation to stabilize codebooks and candidate themes.

```
Upload JSON → Data Explorer → P2 (Initial Codes) → P3 (Candidate Themes) → P3b (Final Themes) → P4 (Assign Themes)
```

### Modules

| Module                    | Phase      | Description                                                                                                                                                            |
| ------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Data & Theme Explorer** | Pre-flight | Upload JSON keyed by `case_id`; preview schema and per-case text; quality panel flags duplicates, missing fields, and token-length outliers                            |
| **Initial Codes**         | P2         | Per-case code pills with Regenerate/Add/Edit; optional user-supplied seed codes; adjustable code granularity; quick CSV/HTML exports and progress tracking             |
| **Candidate Themes**      | P3         | Cluster-and-label codes across cases; themes stream progressively with short descriptions and evidence snippets; automatic consolidation with optional user regrouping |
| **Final Themes**          | P3b        | Merge/split/rename/move operations with audit-tracked edits; finalize the theme set                                                                                    |
| **Assign Final Themes**   | P4         | Apply the final theme set across all cases with thresholds and summaries; export enriched JSON and compact reports                                                     |

### User Control Over AI Outputs

- **Model selector**: Choose from GPT-4o, Claude, and Gemini families
- **Quick instruction pills**: Pre-configured prompts for common adjustments
- **Free-form instruction box**: Custom instructions in Phase 2
- **Per-case dialogs**: Regenerate and "Add more codes" accept custom instructions
- **Theme Assistant panel**: Conversational requests with provider-dependent toggles for reasoning effort and verbosity

### Human-in-the-Loop Checkpoints

- After **P2**: Review and edit initial codes at case level
- After **P3**: Curate candidate themes before finalization
- After **P3b**: Final approval of theme set before assignment
- All edits are reversible with audit logging

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

Users may begin at any phase and may bring annotated or synthetic data for earlier steps (for example, jumping directly to P3 with an existing codebook).

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
2. Bring your own JSON corpus

If working with sensitive legal data, ensure compliance with applicable privacy regulations (e.g., GDPR for EU jurisdictions).

## Architecture

TypeScript monorepo using [Turborepo](https://turbo.build/):

```
├── apps/
│   ├── web/          # React frontend (Vite)
│   └── api/          # Express backend
├── packages/
│   ├── ai-analysis/  # AI provider integrations & analysis logic
│   ├── shared/       # Shared types and constants
│   └── tsconfig/     # Shared TypeScript configurations
```

## Tech Stack

- **Frontend:** React 18, Vite, TypeScript
- **Backend:** Express, Node.js 20+, TypeScript
- **AI Providers:** OpenAI GPT-4o, Google Gemini, Anthropic Claude
- **Monorepo:** Turborepo, pnpm
- **Deployment:** Azure Web Apps

## Environment Variables

| Variable            | Description                             | Required             |
| ------------------- | --------------------------------------- | -------------------- |
| `OPENAI_API_KEY`    | OpenAI API key                          | One of these         |
| `GEMINI_API_KEY`    | Google Gemini API key                   | is required          |
| `ANTHROPIC_API_KEY` | Anthropic Claude API key                |                      |
| `MODEL_PROVIDER`    | Default provider (openai/gemini/claude) | No (default: gemini) |
| `PORT`              | API server port                         | No (default: 9000)   |

## Reproducibility

Due to the stochastic nature of LLM outputs, exact reproduction of specific codes and themes may vary between runs. The workflow produces _stable and comparable_ results rather than identical outputs. For research reproducibility:

- Document the model and version used (e.g., `gpt-4o-2024-08-06`)
- Save intermediate outputs at each phase
- Use the audit log for provenance tracking

## References

1. Braun V, Clarke V. Using thematic analysis in psychology. _Qual Res Psychol_. 2006;3(2):77–101. doi:10.1191/1478088706qp063oa.

2. Drápal J, Westermann H, Šavelka J. Using large language models to support thematic analysis in empirical legal studies. arXiv:2310.18729; 2023. doi:10.48550/arXiv.2310.18729.

3. Bendová K, Knap T, Černý J, Pour V, Šavelka J, Kvapilíková I, et al. What Are the Facts? Automated Extraction of Court-Established Facts from Criminal-Court Opinions. In: Proceedings of the ASAIL 2025 Workshop at ICAIL. Northwestern Pritzker School of Law, Chicago (IL), USA; 2025.

4. Braun V, Clarke V. Reflecting on reflexive thematic analysis. _Qual Res Sport Exerc Health_. 2019;11(4):589–597. doi:10.1080/2159676X.2019.1628806.

5. Šavelka J, Ashley KD. Segmenting U.S. court decisions into functional and issue specific parts. In: Legal Knowledge and Information Systems – JURIX 2018. IOS Press; 2018. p. 111–120. doi:10.3233/978-1-61499-935-5-111.

6. Westermann H, Šavelka J, Walker VR, Ashley KD, Benyekhlef K. Sentence embeddings and high-speed similarity search for fast computer-assisted annotation of legal documents. In: Legal Knowledge and Information Systems – JURIX 2020. IOS Press; 2020. p. 164–173. doi:10.3233/FAIA200860.

7. Šavelka J, Ashley KD. The unreasonable effectiveness of large language models in zero-shot semantic annotation of legal texts. _Front Artif Intell_. 2023;6:1279794. doi:10.3389/frai.2023.1279794.

## License

MIT License — see [LICENSE](LICENSE) for details.

The accompanying paper is licensed under CC BY 4.0.
