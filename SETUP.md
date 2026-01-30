# BULLETPROOF Setup Guide

This guide walks you through setting up BULLETPROOF in your project to automatically run CI checks and auto-fix issues before pushing.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Step 1: Install BULLETPROOF](#step-1-install-bulletproof)
- [Step 2: Configure Your Project](#step-2-configure-your-project)
- [Step 3: Set Up Git Hooks](#step-3-set-up-git-hooks)
- [Step 4: Configure Your API Key](#step-4-configure-your-api-key)
- [Step 5: Test Your Setup](#step-5-test-your-setup)
- [Troubleshooting](#troubleshooting)
- [Advanced Configuration](#advanced-configuration)

---

## Prerequisites

Before you begin, ensure you have:

- **Node.js** >= 18.0.0
- **Git** installed and initialized in your project
- **Anthropic API key** (get one at [console.anthropic.com](https://console.anthropic.com))
- A project with npm scripts for testing, type-checking, etc.

---

## Step 1: Install BULLETPROOF

### Install from GitHub

```bash
npm install --save-dev git+https://github.com/VapiAI/bulletproof.git

pnpm add -D git+https://github.com/VapiAI/bulletproof.git
```

> **Note:** yarn support is coming soon.

---

## Step 2: Configure Your Project

### Initialize Configuration

Run the init command to create a configuration file:

```bash
npx bulletproof init
```

This creates `bulletproof.config.json` in your project root.

### Manual Configuration

Alternatively, create `bulletproof.config.json` manually:

```json
{
  "model": "claude-opus-4-5-20251101",
  "maxTurns": 50,
  "coverageThresholds": {
    "lines": 80,
    "statements": 80,
    "functions": 75,
    "branches": 70
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
    "testCoverage": "npm run test:coverage",
    "testRelated": "npm run test -- --findRelatedTests",
    "testCoverageRelated": "npm run test:coverage -- --findRelatedTests"
  },
  "rulesFile": ".cursorrules"
}
```

### Required npm Scripts

Ensure your `package.json` has these scripts (adjust commands for your test runner):

```json
{
  "scripts": {
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:coverage": "vitest run --coverage"
  }
}
```

#### For Jest users:

```json
{
  "scripts": {
    "typecheck": "tsc --noEmit",
    "test": "jest",
    "test:coverage": "jest --coverage",
    "test:related": "jest --findRelatedTests"
  }
}
```

#### For Vitest users:

```json
{
  "scripts": {
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:coverage": "vitest run --coverage",
    "test:related": "vitest related"
  }
}
```

---

## Step 3: Set Up Git Hooks

BULLETPROOF works best as a pre-push hook. Choose one of these methods:

### Option A: Using Husky (Recommended)

1. Install Husky:

```bash
npm install --save-dev husky
npx husky init
```

2. Create the pre-push hook:

```bash
echo 'npx bulletproof --hook' > .husky/pre-push
chmod +x .husky/pre-push
```

### Option B: Using lefthook

1. Install lefthook:

```bash
npm install --save-dev lefthook
```

2. Create `lefthook.yml`:

```yaml
pre-push:
  commands:
    bulletproof:
      run: npx bulletproof --hook
```

3. Install the hooks:

```bash
npx lefthook install
```

### Option C: Manual Git Hook

1. Create the hook file:

```bash
cat > .git/hooks/pre-push << 'EOF'
#!/bin/sh
npx bulletproof --hook
EOF
```

2. Make it executable:

```bash
chmod +x .git/hooks/pre-push
```

> **Note:** Manual hooks aren't version controlled. For team projects, use Husky or lefthook.

---

## Step 4: Configure Your API Key

BULLETPROOF requires an Anthropic API key to power its AI capabilities.

### Option A: Environment Variable (Recommended for Local Development)

Add to your shell profile (`~/.bashrc`, `~/.zshrc`, etc.):

```bash
export ANTHROPIC_API_KEY="sk-ant-..."
```

Then reload your shell:

```bash
source ~/.zshrc  # or ~/.bashrc
```

### Option B: `.env` File

Create a `.env` file in your project root:

```bash
ANTHROPIC_API_KEY=sk-ant-...
```

> **Important:** Add `.env` to your `.gitignore` to avoid committing secrets!

### Option C: CI/CD Secrets

For CI environments, configure the secret in your CI provider:

**GitHub Actions:**
```yaml
env:
  ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
```

**GitLab CI:**
```yaml
variables:
  ANTHROPIC_API_KEY: $ANTHROPIC_API_KEY
```

---

## Step 5: Test Your Setup

### Verify Installation

```bash
# Check that bulletproof is installed
npx bulletproof --help
```

### Run a Dry Test

```bash
# Run checks without pushing
npx bulletproof --no-push --verbose
```

### Test the Hook

Make a small change and try to push:

```bash
# Make a test change
echo "// test" >> src/index.ts

# Stage and commit
git add .
git commit -m "test: verify bulletproof setup"

# Push (this should trigger BULLETPROOF)
git push
```

You should see BULLETPROOF's animated banner and check results!

---

## Troubleshooting

### "ANTHROPIC_API_KEY is not set"

Ensure your API key is properly exported:

```bash
echo $ANTHROPIC_API_KEY
```

If empty, set it in your shell profile and restart your terminal.

### "Command not found: npx"

Ensure Node.js is installed and in your PATH:

```bash
node --version  # Should be >= 18.0.0
npm --version
```

### Hook Doesn't Run

1. Check hook permissions:
   ```bash
   ls -la .git/hooks/pre-push  # or .husky/pre-push
   ```

2. Ensure it's executable:
   ```bash
   chmod +x .husky/pre-push
   ```

3. Verify Husky is initialized:
   ```bash
   cat .husky/_/husky.sh  # Should exist
   ```

### Tests Failing Unexpectedly

1. Run tests manually first:
   ```bash
   npm run test
   ```

2. Check your `bulletproof.config.json` commands match your actual scripts.

### Coverage Threshold Failures

Adjust thresholds in your config to match your project's reality:

```json
{
  "coverageThresholds": {
    "lines": 70,
    "statements": 70,
    "functions": 65,
    "branches": 60
  }
}
```

### Claude Running Too Long

Reduce `maxTurns` in your config:

```json
{
  "maxTurns": 25
}
```

---

## Advanced Configuration

### Disable Specific Checks

```json
{
  "checks": {
    "rules": true,
    "typecheck": true,
    "tests": true,
    "coverage": false  // Disable coverage checks
  }
}
```

### Custom Rules File

Point to your project's coding standards:

```json
{
  "rulesFile": ".cursor/rules"
}
```

### Additional System Instructions

Add custom guidance for Claude:

```json
{
  "systemPrompt": "This is a React project using TanStack Query for data fetching.",
  "additionalInstructions": "When fixing tests, prefer using React Testing Library patterns."
}
```

### Scope Coverage to Specific Directories

```json
{
  "coverageScope": {
    "include": ["src/features/**/*.ts", "src/utils/**/*.ts"],
    "exclude": ["**/__mocks__/**", "**/*.stories.ts"]
  }
}
```

### Use a Different Claude Model

```json
{
  "model": "claude-sonnet-4-20250514"
}
```

---

## Example Configurations

### React/TypeScript Project

```json
{
  "model": "claude-opus-4-5-20251101",
  "maxTurns": 50,
  "coverageThresholds": {
    "lines": 80,
    "statements": 80,
    "functions": 75,
    "branches": 70
  },
  "coverageScope": {
    "include": ["src/**/*.ts", "src/**/*.tsx"],
    "exclude": ["**/*.test.tsx", "**/*.stories.tsx", "src/test/**"]
  },
  "checks": {
    "rules": true,
    "typecheck": true,
    "tests": true,
    "coverage": true
  },
  "commands": {
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "testCoverage": "vitest run --coverage"
  }
}
```

### Node.js Backend Project

```json
{
  "model": "claude-opus-4-5-20251101",
  "maxTurns": 40,
  "coverageThresholds": {
    "lines": 85,
    "statements": 85,
    "functions": 80,
    "branches": 75
  },
  "coverageScope": {
    "include": ["src/**/*.ts"],
    "exclude": ["src/**/*.spec.ts", "src/migrations/**"]
  },
  "checks": {
    "rules": true,
    "typecheck": true,
    "tests": true,
    "coverage": true
  },
  "commands": {
    "typecheck": "tsc --noEmit",
    "test": "jest",
    "testCoverage": "jest --coverage"
  }
}
```

### Monorepo with Turborepo

```json
{
  "model": "claude-opus-4-5-20251101",
  "maxTurns": 60,
  "coverageThresholds": {
    "lines": 75,
    "statements": 75,
    "functions": 70,
    "branches": 65
  },
  "checks": {
    "rules": true,
    "typecheck": true,
    "tests": true,
    "coverage": true
  },
  "commands": {
    "typecheck": "turbo typecheck",
    "test": "turbo test",
    "testCoverage": "turbo test:coverage"
  }
}
```

---

## Quick Reference

| Command | Description |
|---------|-------------|
| `npx bulletproof` | Run checks and push |
| `npx bulletproof --no-push` | Run checks only |
| `npx bulletproof --hook` | Minimal output (for git hooks) |
| `npx bulletproof --agent` | CI mode (no animations) |
| `npx bulletproof --verbose` | Detailed output |
| `npx bulletproof init` | Create config file |

---

## Getting Help

- **Documentation**: See [README.md](./README.md) for full API reference
- **Issues**: [GitHub Issues](https://github.com/VapiAI/bulletproof/issues)
- **Slack**: Ask in #engineering or #tasker channels

---

Happy coding! 🛡️
