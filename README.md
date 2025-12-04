# Crime Themes Explorer

AI-assisted thematic analysis tool for qualitative research on crime data, implementing the Braun & Clarke methodology.

## Architecture

This is a TypeScript monorepo using [Turborepo](https://turbo.build/) with the following structure:

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

- **Frontend**: React 18, Vite, TypeScript
- **Backend**: Express, Node.js 20+, TypeScript
- **AI Providers**: OpenAI GPT-4o, Google Gemini, Anthropic Claude
- **Monorepo**: Turborepo, pnpm
- **Deployment**: Azure App Service

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 9+

### Installation

```bash
# Install dependencies
pnpm install

# Copy environment file and add your API keys
cp .env.example .env
```

### Development

```bash
# Start all services in development mode
pnpm dev

# Or start individually
pnpm --filter @crime-themes/api dev
pnpm --filter @crime-themes/web dev
```

The frontend runs on `http://localhost:3005` and the API on `http://localhost:9000`.

### Build

```bash
# Build all packages
pnpm build
```

### Production

```bash
# Start production server (serves frontend + API)
pnpm start
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `OPENAI_API_KEY` | OpenAI API key | One of these |
| `GEMINI_API_KEY` | Google Gemini API key | is required |
| `ANTHROPIC_API_KEY` | Anthropic Claude API key | |
| `MODEL_PROVIDER` | Default provider (openai/gemini/claude) | No (default: gemini) |
| `PORT` | API server port | No (default: 9000) |

## Analysis Phases

The tool implements the Braun & Clarke thematic analysis methodology:

1. **Phase 2**: Generate initial codes from case descriptions
2. **Phase 3**: Create candidate themes from initial codes
3. **Phase 3b**: Refine and finalize themes
4. **Phase 4**: Assign finalized themes to all cases

## Azure Deployment

The project includes a GitHub Actions workflow for automatic deployment to Azure App Service:

1. Create an Azure App Service (Node.js 20 LTS)
2. Configure WebSocket support in Azure
3. Add secrets to GitHub:
   - `AZURE_WEBAPP_NAME`: Your app name
   - `AZURE_WEBAPP_PUBLISH_PROFILE`: Download from Azure Portal
4. Push to `main` branch to trigger deployment

## License

MIT

