# BULLETPROOF Setup Guide

Setting up BULLETPROOF is simple - just run the interactive wizard and you're done!

## Quick Setup (Recommended)

```bash
# Install
npm install -D @vapi/bulletproof

# Run the wizard - handles everything automatically
npx bulletproof init
```

That's it! The wizard will:
- Detect your project type (Next.js, NestJS, React, Node.js, etc.)
- Detect your package manager (npm, yarn, pnpm, bun)
- Install and configure Husky with the pre-push hook
- Generate `bulletproof.config.json` with smart defaults
- Help you set up your Anthropic API key

### Non-Interactive Setup (CI/Automation)

```bash
npx bulletproof init -y
```

This accepts all defaults without prompts. Set `ANTHROPIC_API_KEY` in your environment beforehand.

---

## Prerequisites

- **Node.js** >= 18.0.0
- **Git** repository initialized
- **Anthropic API key** ([console.anthropic.com](https://console.anthropic.com))

---

## What the Wizard Sets Up

| Component | What It Does |
|-----------|--------------|
| **Husky** | Installs husky and runs `husky init` |
| **Pre-push Hook** | Creates `.husky/pre-push` to run bulletproof before each push |
| **Config File** | Creates `bulletproof.config.json` with project-appropriate defaults |
| **API Key** | Optionally adds `ANTHROPIC_API_KEY` to `.env.local` |

---

## Verify Your Setup

After running the wizard, test it:

```bash
# Check installation
npx bulletproof --help

# Dry run (checks without pushing)
npx bulletproof run --verbose
```

---

## Advanced Configuration

The wizard creates sensible defaults, but you can customize `bulletproof.config.json`:

### Adjust Coverage Thresholds

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

### Disable Specific Checks

```json
{
  "checks": {
    "rules": true,
    "typecheck": true,
    "tests": true,
    "coverage": false
  }
}
```

### Custom Commands

```json
{
  "commands": {
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "testCoverage": "vitest run --coverage"
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

## Troubleshooting

### "ANTHROPIC_API_KEY is not set"

Set your API key:
```bash
export ANTHROPIC_API_KEY="sk-ant-..."
```

Or re-run the wizard to add it to `.env.local`:
```bash
npx bulletproof init
```

### Hook Doesn't Run

Check that the hook is executable:
```bash
chmod +x .husky/pre-push
```

### Re-run Setup

The wizard is idempotent - safe to run again:
```bash
npx bulletproof init
```

It will detect existing setup and offer to update or skip components.

---

## CLI Reference

| Command | Description |
|---------|-------------|
| `npx bulletproof init` | Interactive setup wizard |
| `npx bulletproof init -y` | Non-interactive setup (accept defaults) |
| `npx bulletproof run` | Run checks and push |
| `npx bulletproof run --verbose` | Detailed output |
| `npx bulletproof --help` | Show all options |

---

## Getting Help

- **Issues**: [GitHub Issues](https://github.com/VapiAI/bulletproof/issues)
- **Slack**: Ask in #engineering or #tasker channels
