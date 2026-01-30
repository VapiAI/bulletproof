# Publishing @vapi/bulletproof to npm

This guide covers how to publish the `@vapi/bulletproof` package to npm as a **private** scoped package under the `@vapi` organization.

## Table of Contents

- [Prerequisites](#prerequisites)
- [One-Time Setup](#one-time-setup)
- [Publishing Steps](#publishing-steps)
- [Automated Publishing with GitHub Actions](#automated-publishing-with-github-actions)
- [Versioning](#versioning)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

Before you can publish, you need:

1. **npm account** with access to the `@vapi` organization
2. **npm CLI** installed (`npm --version` should work)
3. **Publish permissions** for the `@vapi` scope

### Check Your Access

```bash
# Verify you're logged in
npm whoami

# Check your org membership (requires npm 8+)
npm org ls vapi

# If not logged in:
npm login
```

---

## One-Time Setup

### 1. Configure package.json for Publishing

The `package.json` needs these settings for npm publishing:

```json
{
  "name": "@vapi/bulletproof",
  "version": "1.0.0",
  "private": false,
  "publishConfig": {
    "access": "restricted"
  }
}
```

**Key settings:**
- `"private": false` - Required to publish (currently set to `true`)
- `"publishConfig.access": "restricted"` - Makes it a private package (only `@vapi` org members can install)

### 2. Update package.json

Edit `package.json` to enable publishing:

```diff
{
  "name": "@vapi/bulletproof",
  "version": "1.0.0",
- "private": true,
+ "private": false,
  "description": "Pre-push guardian that uses Claude to run checks and auto-fix issues",
+ "publishConfig": {
+   "access": "restricted"
+ },
  ...
}
```

### 3. Verify Files to Publish

Check what files will be included in the package:

```bash
npm pack --dry-run
```

The `files` field in `package.json` controls this:
```json
{
  "files": [
    "dist",
    "bin"
  ]
}
```

---

## Publishing Steps

### Manual Publishing

1. **Ensure you're on the main branch with latest changes:**
   ```bash
   git checkout main
   git pull origin main
   ```

2. **Install dependencies and build:**
   ```bash
   npm install
   npm run build
   ```

3. **Run tests to verify everything works:**
   ```bash
   npm run typecheck
   npm run test
   ```

4. **Bump the version** (choose one):
   ```bash
   # Patch release (1.0.0 -> 1.0.1) - bug fixes
   npm version patch

   # Minor release (1.0.0 -> 1.1.0) - new features
   npm version minor

   # Major release (1.0.0 -> 2.0.0) - breaking changes
   npm version major
   ```

5. **Publish to npm:**
   ```bash
   npm publish
   ```

6. **Push the version tag:**
   ```bash
   git push origin main --tags
   ```

### First-Time Publishing

For the very first publish, you may need to specify access explicitly:

```bash
npm publish --access restricted
```

---

## Automated Publishing with GitHub Actions

Set up CI/CD to automatically publish on releases.

### 1. Create npm Access Token

1. Go to [npmjs.com](https://www.npmjs.com) → Account Settings → Access Tokens
2. Generate a new **Automation** token
3. Copy the token (starts with `npm_...`)

### 2. Add Token to GitHub Secrets

1. Go to the repo → Settings → Secrets and variables → Actions
2. Add a new secret:
   - Name: `NPM_TOKEN`
   - Value: Your npm token

### 3. Create GitHub Action Workflow

Create `.github/workflows/publish.yml`:

```yaml
name: Publish to npm

on:
  release:
    types: [published]

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          registry-url: 'https://registry.npmjs.org'

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build

      - name: Run tests
        run: |
          npm run typecheck
          npm run test

      - name: Publish
        run: npm publish
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

### 4. Publishing via GitHub Releases

1. Go to the repo → Releases → Create new release
2. Create a new tag (e.g., `v1.0.1`)
3. Fill in release notes
4. Click "Publish release"
5. The GitHub Action will automatically publish to npm

---

## Versioning

Follow [Semantic Versioning](https://semver.org/):

| Change Type | Version Bump | Example | When to Use |
|-------------|--------------|---------|-------------|
| Bug fixes | Patch | `1.0.0` → `1.0.1` | Backwards-compatible bug fixes |
| New features | Minor | `1.0.0` → `1.1.0` | Backwards-compatible new functionality |
| Breaking changes | Major | `1.0.0` → `2.0.0` | Incompatible API changes |

### Pre-release Versions

For testing before official release:

```bash
# Beta release
npm version prerelease --preid=beta
# 1.0.0 -> 1.0.1-beta.0

# Publish with beta tag
npm publish --tag beta
```

Users can install beta versions with:
```bash
npm install @vapi/bulletproof@beta
```

---

## Troubleshooting

### "You must sign up for private packages"

You need an npm paid plan for private scoped packages. The `@vapi` org should already have this.

### "npm ERR! 402 Payment Required"

The `@vapi` org needs a paid npm plan for private packages. Contact your npm org admin.

### "npm ERR! 403 Forbidden"

You don't have publish permissions. Ask an org admin to grant you the **Developer** or **Admin** role for the `@vapi` org.

```bash
# Admin can add you with:
npm team add vapi:developers <your-username>
```

### "Package name too similar to existing package"

This shouldn't happen with scoped packages, but if it does, ensure you're using `@vapi/bulletproof` exactly.

### "private: true" Error

```
npm ERR! This package has been marked as private
```

You forgot to set `"private": false` in `package.json`.

### Build Fails Before Publish

The `prepublishOnly` script runs automatically before `npm publish`:

```json
{
  "scripts": {
    "prepublishOnly": "npm run build"
  }
}
```

Make sure `npm run build` works locally first.

### Checking Published Package

After publishing, verify:

```bash
# View package info
npm view @vapi/bulletproof

# Check latest version
npm view @vapi/bulletproof version

# Install and test
npm install @vapi/bulletproof
npx bulletproof --help
```

---

## Installing the Private Package

For users to install `@vapi/bulletproof`:

### 1. Authenticate with npm

```bash
npm login
```

### 2. Ensure org membership

User must be a member of the `@vapi` npm organization.

### 3. Install

```bash
npm install @vapi/bulletproof
```

### For CI/CD Environments

Use an npm automation token:

```bash
# In CI, set the token
echo "//registry.npmjs.org/:_authToken=${NPM_TOKEN}" > .npmrc
npm install @vapi/bulletproof
```

---

## Quick Reference

| Command | Description |
|---------|-------------|
| `npm whoami` | Check logged-in user |
| `npm org ls vapi` | List org members |
| `npm pack --dry-run` | Preview package contents |
| `npm version patch` | Bump patch version |
| `npm publish` | Publish to npm |
| `npm view @vapi/bulletproof` | View published package |
| `npm deprecate @vapi/bulletproof@1.0.0 "msg"` | Deprecate a version |
| `npm unpublish @vapi/bulletproof@1.0.0` | Remove a version (within 72h) |

---

## Need Help?

- **npm docs**: https://docs.npmjs.com/cli/v10/commands/npm-publish
- **Scoped packages**: https://docs.npmjs.com/creating-and-publishing-scoped-public-packages
- **Private packages**: https://docs.npmjs.com/creating-and-publishing-private-packages
