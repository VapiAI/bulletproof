# @vapi/bulletproof

```
██████╗ ██╗   ██╗██╗     ██╗     ███████╗████████╗██████╗ ██████╗  ██████╗  ██████╗ ███████╗
██╔══██╗██║   ██║██║     ██║     ██╔════╝╚══██╔══╝██╔══██╗██╔══██╗██╔═══██╗██╔═══██╗██╔════╝
██████╔╝██║   ██║██║     ██║     █████╗     ██║   ██████╔╝██████╔╝██║   ██║██║   ██║█████╗
██╔══██╗██║   ██║██║     ██║     ██╔══╝     ██║   ██╔═══╝ ██╔══██╗██║   ██║██║   ██║██╔══╝
██████╔╝╚██████╔╝███████╗███████╗███████╗   ██║   ██║     ██║  ██║╚██████╔╝╚██████╔╝██║
╚═════╝  ╚═════╝ ╚══════╝╚══════╝╚══════╝   ╚═╝   ╚═╝     ╚═╝  ╚═╝ ╚═════╝  ╚═════╝ ╚═╝
```

**Pre-push guardian that uses Claude to run checks and auto-fix issues.**

> 📚 **New to BULLETPROOF?** Check out the **[Setup Guide](./SETUP.md)** for step-by-step installation instructions.
>
> 📦 **Maintainers:** See the **[Publishing Guide](./PUBLISHING.md)** for npm release instructions.

BULLETPROOF is an AI-powered pre-push guardian that uses Claude (via the Claude Agent SDK) to:

- Run TypeScript type checking
- Execute test suites
- Verify coverage thresholds
- Check code against project conventions
- **Automatically fix issues** it finds
- Commit fixes and push to remote

## Features

- **Intelligent Diff Analysis**: Analyzes git diff to determine which checks to run
- **Smart Test Selection**: Runs only related tests for small changes
- **Auto-Fix**: Claude automatically fixes type errors, test failures, and convention violations
- **Beautiful Terminal UI**: Animated logos, gradient colors, progress indicators
- **Agent Mode**: Clean output for CI/CD and non-interactive environments
- **Configurable**: Customize thresholds, commands, and behavior

## Quick Start

**One command to set everything up:**

```bash
npx @vapi/bulletproof init
```

This interactive setup wizard will:
- Detect your project type (Next.js, NestJS, React, Express, etc.)
- Detect your package manager (npm, yarn, pnpm, bun)
- Install and configure Husky with a pre-push hook
- Generate a smart `bulletproof.config.json` based on your project
- Help you set up your Anthropic API key

That's it! BULLETPROOF is now configured and will run automatically on every push.

### Non-Interactive Mode

For CI environments or scripted setups:

```bash
npx @vapi/bulletproof init -y
```

## Installation

If you prefer manual installation:

```bash
# Using npm
npm install @vapi/bulletproof

# Using yarn
yarn add @vapi/bulletproof

# Using pnpm
pnpm add @vapi/bulletproof
```

## CLI Usage

```bash
# Run checks and push (default behavior)
npx bulletproof

# Run checks without pushing
npx bulletproof --no-push

# Run in git hook mode (minimal output)
npx bulletproof --hook

# Run in agent/CI mode (no animations)
npx bulletproof --agent

# Show verbose output
npx bulletproof --verbose
```

### Programmatic Usage

```typescript
import { runGuardian, GuardianRunner } from '@vapi/bulletproof'

// Simple usage
const result = await runGuardian({
  skipPush: true,
  verbose: true,
})

if (result.success) {
  console.log('All checks passed!')
} else {
  console.log('Checks failed:', result.error)
}

// Advanced usage
const guardian = new GuardianRunner({
  hookMode: true,
  cwd: '/path/to/project',
})

const result = await guardian.run()
console.log('Elapsed:', result.elapsed)
console.log('Analysis:', result.analysis.reason)
```

## Configuration

BULLETPROOF looks for configuration in the following locations (in order):

1. `bulletproof.config.json`
2. `bulletproof.config.js`
3. `.bulletproofrc`
4. `.bulletproofrc.json`
5. `bulletproof` key in `package.json`

### Configuration Options

```json
{
  "model": "claude-opus-4-5-20251101",
  "maxTurns": 50,
  "coverageThresholds": {
    "lines": 90,
    "statements": 90,
    "functions": 78,
    "branches": 80
  },
  "coverageScope": {
    "include": ["src/**/*.ts", "src/**/*.tsx"],
    "exclude": [
      "src/test/**",
      "**/*.test.ts",
      "**/*.spec.ts",
      "**/types/**",
      "**/*.d.ts"
    ]
  },
  "checks": {
    "rules": true,
    "typecheck": true,
    "tests": true,
    "coverage": true
  },
  "commands": {
    "typecheck": "npm run typecheck",
    "test": "npm run test",
    "testCoverage": "npm run test:coverage:ci",
    "testRelated": "npm run test:related",
    "testCoverageRelated": "npm run test:coverage:related"
  },
  "rulesFile": ".cursorrules",
  "systemPrompt": "Additional system prompt instructions...",
  "additionalInstructions": "Additional task instructions..."
}
```

### Configuration Reference

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `model` | string | `claude-opus-4-5-20251101` | Claude model to use |
| `maxTurns` | number | `50` | Maximum Claude agent turns |
| `coverageThresholds` | object | See below | Coverage percentage thresholds |
| `coverageScope` | object | See below | Patterns for coverage scope |
| `checks` | object | All true | Which checks to run |
| `commands` | object | See below | NPM scripts for each check |
| `rulesFile` | string | `.cursorrules` | Path to project rules file |
| `systemPrompt` | string | - | Additional system prompt |
| `additionalInstructions` | string | - | Additional task instructions |

## Git Hook Integration

The `npx bulletproof init` command automatically sets up Husky with a pre-push hook. If you need to set it up manually:

### Using Husky (Recommended)

```bash
# Install husky
npm install -D husky
npx husky init

# Add pre-push hook
echo 'npx bulletproof --hook' > .husky/pre-push
```

### Manual Git Hook

Create `.git/hooks/pre-push`:

```bash
#!/bin/sh
npx bulletproof --hook
```

Make it executable:

```bash
chmod +x .git/hooks/pre-push
```

## CI/CD Integration

BULLETPROOF automatically detects CI environments and runs in agent mode.

### GitHub Actions

```yaml
name: BULLETPROOF
on: [push, pull_request]

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npx bulletproof --no-push
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
```

## How It Works

### 1. Diff Analysis

BULLETPROOF analyzes your git diff to intelligently select which checks to run:

- **Docs only**: Skip all checks except rules compliance
- **Config only**: Skip tests and coverage
- **Scripts only**: Skip coverage
- **Small diff**: Run related tests only
- **Large diff**: Run full test suite

### 2. Check Execution

Claude runs the following checks in order:

1. **Rules Compliance**: Reviews changed files against `.cursorrules`
2. **TypeScript**: Runs `npm run typecheck`
3. **Tests**: Runs test suite (full or related)
4. **Coverage**: Verifies coverage thresholds

### 3. Auto-Fix

When issues are found, Claude:

1. Analyzes the error
2. Reads relevant files
3. Makes minimal fixes
4. Re-runs the check
5. Iterates until fixed or max turns reached

### 4. Commit & Push

After all checks pass:

1. Commits any auto-fix changes
2. Pushes to remote (unless `--no-push`)

## API Reference

### `runGuardian(options)`

Main function to run the guardian.

```typescript
interface GuardianOptions {
  skipPush?: boolean    // Skip pushing to remote
  hookMode?: boolean    // Mini logo, quick banners
  agentMode?: boolean   // Non-interactive mode
  verbose?: boolean     // Show detailed output
  cwd?: string          // Working directory
}

interface GuardianResult {
  success: boolean
  elapsed: string
  analysis: DiffAnalysis
  fixesCommitted: boolean
  pushed: boolean
  error?: string
}
```

### `GuardianRunner`

Class-based API for more control.

```typescript
const guardian = new GuardianRunner(options)
const config = guardian.getConfig()
const result = await guardian.run()
```

### `analyzeDiff(config, cwd)`

Analyze git diff and determine which checks to run.

```typescript
const analysis = analyzeDiff(config, process.cwd())
console.log(analysis.reason)
console.log(analysis.checks)
console.log(analysis.useRelatedTests)
```

### `loadConfig(cwd)`

Load and merge configuration.

```typescript
const config = loadConfig('/path/to/project')
console.log(config.model)
console.log(config.coverageThresholds)
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `ANTHROPIC_API_KEY` | API key for Claude (required) |
| `CI` | Set to `true` for agent mode |
| `AGENT_MODE` | Set to `true` for agent mode |

## Requirements

- Node.js >= 18.0.0
- Git
- Anthropic API key (for Claude)

## License

MIT

## Contributing

Contributions are welcome! Please read our contributing guidelines before submitting a PR.
