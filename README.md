# Claude DevStudio

AI-Powered Agile SDLC Desktop Application

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-lightgrey)
![Node](https://img.shields.io/badge/node-%3E%3D18-green)

## Overview

Claude DevStudio is an Electron-based desktop application that integrates AI agents into your software development lifecycle. It uses Claude Code CLI to provide specialized AI personas for development, testing, security, documentation, and more.

### Key Features

- **6 AI Agent Personas** - Developer, Product Owner, Tester, Security, DevOps, Documentation
- **Autonomous Task Execution** - AI works independently with configurable oversight levels
- **Project Analysis** - Automatic project structure detection and setup
- **Roadmap Planning** - Now/Next/Later prioritization with drag-and-drop
- **Sprint Management** - Kanban-style task boards
- **Multi-Agent Workflows** - Chain agents for complex tasks

## Quick Start

### Prerequisites

- **Node.js** 18 or higher
- **Claude Code CLI** installed and authenticated

```bash
# Verify Claude CLI is installed
claude --version
```

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/claude-devstudio.git
cd claude-devstudio

# Install dependencies
npm install

# Start development mode
npm run dev
```

### Build for Production

```bash
npm run build:mac    # macOS
npm run build:win    # Windows
npm run build:linux  # Linux
```

## Documentation

| Document | Description |
|----------|-------------|
| [Quick Start](docs/QUICK_START.md) | Get started in 5 minutes |
| [User Guide](docs/USER_GUIDE.md) | Complete feature documentation |
| [Architecture](docs/ARCHITECTURE.md) | Technical architecture |
| [Autonomy Features](docs/AUTONOMY_FEATURES.md) | Autonomy system details |
| [Product Roadmap](docs/PRODUCT_ROADMAP.md) | Vision and roadmap |
| [CLAUDE.md](CLAUDE.md) | Development guidelines |

## Project Structure

```
src/
├── main/           # Electron Main Process
│   ├── index.ts    # App entry, IPC handlers
│   └── services/   # Business logic (34 services)
├── preload/        # IPC Bridge
├── renderer/       # React UI
│   └── src/
│       ├── components/  # React components (23)
│       ├── stores/      # Zustand state
│       └── hooks/       # Custom hooks
└── shared/         # Shared types
```

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl + 1-8` | Navigate views |
| `Cmd/Ctrl + K` | Command palette |
| `?` | Tutorial |

## Testing

```bash
# Unit tests
npm run test:unit

# E2E tests
npm run test

# Coverage report
npm run test:coverage
```

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build all processes |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Type check TypeScript |
| `npm run test` | Run E2E tests |
| `npm run test:unit` | Run unit tests |

## Tech Stack

- **Electron** - Desktop application framework
- **React 18** - UI framework
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **Zustand** - State management
- **SQLite** - Local database
- **Vitest** - Unit testing
- **Playwright** - E2E testing

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests: `npm run test:unit && npm run lint`
5. Submit a pull request

## License

MIT License - see [LICENSE](LICENSE) for details.

---

*Claude DevStudio - Empowering developers with AI-assisted Agile workflows*
