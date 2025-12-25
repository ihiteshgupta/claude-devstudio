# Contributing to Claude DevStudio

Thank you for your interest in contributing to Claude DevStudio! This document
provides guidelines for contributing to the project.

## Code of Conduct

By participating in this project, you agree to maintain a respectful and
inclusive environment for all contributors.

## Getting Started

### Prerequisites

- Node.js 20 or later
- Claude Code CLI installed and authenticated (`claude` command in PATH)
- Git

### Development Setup

1. Fork and clone the repository:
   ```bash
   git clone https://github.com/YOUR_USERNAME/claude-devstudio.git
   cd claude-devstudio
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Run tests:
   ```bash
   npm run test:unit    # Unit tests
   npm run test:e2e     # E2E tests (requires build first)
   npm run test:all     # Full test suite with coverage
   ```

## Development Workflow

### Branch Naming

- `feature/description` - New features
- `fix/description` - Bug fixes
- `docs/description` - Documentation changes
- `refactor/description` - Code refactoring
- `test/description` - Test additions or fixes

### Commit Messages

Follow conventional commit format:
```
type(scope): description

[optional body]

[optional footer]
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

Examples:
```
feat(chat): add file context panel
fix(database): handle concurrent writes
docs(readme): update installation instructions
```

## Pull Request Process

1. Create a feature branch from `main`
2. Make your changes following the coding standards
3. Ensure all tests pass:
   ```bash
   npm run lint
   npm run typecheck
   npm run test:coverage
   ```
4. Update documentation if needed
5. Submit a pull request with a clear description

### PR Requirements

- All CI checks must pass
- Code coverage must not decrease
- New features require tests
- Documentation updated for user-facing changes

## Testing Requirements

### Unit Tests

- All new services require unit tests in `*.test.ts` files
- All new React components require tests in `*.test.tsx` files
- Use Vitest for unit testing
- Mock external dependencies (Electron, Claude CLI)

### E2E Tests

- User-facing features require Playwright E2E tests
- Tests should be in the `e2e/` directory
- Use data-testid attributes for selectors

### Coverage

- Target: 100% line coverage for new code
- Coverage reports generated with `npm run test:coverage`

## Code Style

### TypeScript

- Use TypeScript for all code
- Enable strict mode
- Prefer explicit types over inference for function signatures
- Use interfaces for object shapes

### React

- Use functional components with hooks
- Use Zustand for state management
- Follow existing component patterns

### Formatting

- Run `npm run lint` before committing
- Configure your editor to use the project's ESLint config

## Architecture

### Process Structure

- **Main Process** (`src/main/`): Electron main process, Node.js APIs
- **Preload** (`src/preload/`): IPC bridge between main and renderer
- **Renderer** (`src/renderer/`): React UI, runs in browser context

### Adding IPC Channels

1. Add channel constant to `src/shared/types/index.ts`
2. Add handler in `src/main/index.ts`
3. Add preload API in `src/preload/index.ts`

### Adding Services

1. Create service in `src/main/services/`
2. Follow singleton pattern for shared state
3. Add corresponding tests
4. Register IPC handlers if needed

## Questions?

- Open an issue for bugs or feature requests
- Check existing issues before creating new ones
- Use discussions for general questions

## License

By contributing, you agree that your contributions will be licensed under the
MIT License. See the LICENSE file for details.
