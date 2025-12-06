# Contributing to Floorplan Card

We welcome contributions! This document describes how to set up your development environment and submit changes.

## Development Setup

### Prerequisites

- Node.js 18+
- npm 9+

### Setup Steps

1. Fork and clone the repository:
   ```bash
   git clone https://github.com/YOUR_USERNAME/home-assistant-floorplan-card.git
   cd home-assistant-floorplan-card
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start development server:
   ```bash
   npm run dev
   ```

## Development Workflow

### Making Changes

1. Create a feature branch:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. Make your changes in `src/`

3. Check your work:
   ```bash
   npm run type-check    # TypeScript type checking
   npm run lint          # ESLint validation
   npm run build         # Build the card
   ```

4. Commit with clear messages:
   ```bash
   git commit -m "feat: add feature description"
   ```

### Code Style

- **TypeScript**: Use strict mode, add type annotations
- **Formatting**: Run `npm run lint` to check code style
- **Comments**: Add JSDoc comments to public methods
- **Testing**: Test your changes thoroughly before submitting

### Building the Card

```bash
npm run build
```

This generates `dist/floorplan-card.js` which can be deployed to Home Assistant.

## Testing Your Changes

### Local Testing with Home Assistant

1. Build the card:
   ```bash
   npm run build
   ```

2. Copy to Home Assistant www folder:
   ```bash
   cp dist/floorplan-card.js /path/to/homeassistant/www/
   ```

3. Add to your dashboard YAML:
   ```yaml
   resources:
     - url: /local/floorplan-card.js
       type: module
   ```

4. Add a card to test:
   ```yaml
   type: custom:floorplan-card
   floor_id: ground_floor
   ```

## Pull Request Process

1. **Update documentation**: If adding features, update README.md
2. **Update changelog**: Add your changes to CHANGELOG.md under [Unreleased]
3. **Pass checks**: Ensure GitHub Actions workflows pass:
   - TypeScript type checking
   - ESLint linting
   - Build validation
4. **Add tests**: If applicable, include tests for new functionality
5. **Request review**: Submit your PR with a clear description

## CI/CD Pipeline

The project uses GitHub Actions for automated checks:

- **Build Workflow** (`build.yml`):
  - Runs on every push to main/develop and PRs
  - Lints code with ESLint
  - Type checks with TypeScript
  - Builds the card
  - Validates build output

- **Release Workflow** (`release.yml`):
  - Triggered by tags like `card-v1.0.0`
  - Builds the card
  - Creates a GitHub release with built artifacts

## Commit Message Conventions

Use conventional commits for clarity:

```
feat: add new feature
fix: fix a bug
docs: update documentation
chore: maintenance tasks
```

Example:
```
feat: add entity position overlay to floorplan

- Display static entities as icons
- Show entity names on hover
- Color-code by entity type
```

## Questions or Issues?

- Open an issue on GitHub
- Check existing issues for similar problems
- Join our discussions for feature ideas

Thank you for contributing to the Floorplan Card project!
