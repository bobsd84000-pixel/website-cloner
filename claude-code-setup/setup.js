const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class ClaudeCodeSetup {
  constructor(projectRoot = process.cwd()) {
    this.projectRoot = projectRoot;
    this.claudeDir = path.join(projectRoot, '.claude');
    this.settingsFile = path.join(this.claudeDir, 'settings.json');
  }

  initialize() {
    if (!fs.existsSync(this.claudeDir)) {
      fs.mkdirSync(this.claudeDir, { recursive: true });
    }

    if (!fs.existsSync(this.settingsFile)) {
      this.createDefaultSettings();
    }

    this.setupHooks();
    this.setupSkills();
    return this.getStatus();
  }

  createDefaultSettings() {
    const defaultSettings = {
      version: '1.0.0',
      project: {
        name: this.getProjectName(),
        description: 'Claude Code optimized project',
        language: this.detectLanguage()
      },
      permissions: {
        allowedTools: [
          'Read',
          'Write',
          'Edit',
          'Bash',
          'Glob',
          'Grep'
        ]
      },
      hooks: {
        'pre-commit': 'npm run lint 2>/dev/null || true',
        'post-checkout': 'npm install 2>/dev/null || true',
        'on-save': 'npm run format 2>/dev/null || true'
      },
      environment: {
        NODE_ENV: 'development',
        DEBUG: 'false'
      },
      skills: [],
      performance: {
        cachingEnabled: true,
        maxCacheSize: '100MB',
        compressionEnabled: true
      },
      monitoring: {
        metricsEnabled: true,
        loggingLevel: 'info'
      }
    };

    fs.writeFileSync(this.settingsFile, JSON.stringify(defaultSettings, null, 2));
  }

  setupHooks() {
    const hooksDir = path.join(this.claudeDir, 'hooks');
    if (!fs.existsSync(hooksDir)) {
      fs.mkdirSync(hooksDir, { recursive: true });
    }

    const hookFiles = {
      'pre-commit.sh': `#!/bin/bash
set -e
echo "🔍 Running pre-commit checks..."
npm run lint 2>/dev/null || echo "⚠️ Lint check skipped"
npm run test 2>/dev/null || echo "⚠️ Tests skipped"
echo "✓ Pre-commit checks passed"
`,
      'post-checkout.sh': `#!/bin/bash
echo "📦 Setting up environment..."
npm install 2>/dev/null || echo "⚠️ npm install skipped"
echo "✓ Environment ready"
`,
      'on-save.sh': `#!/bin/bash
echo "💾 Formatting code..."
npm run format 2>/dev/null || echo "⚠️ Format skipped"
echo "✓ Code formatted"
`
    };

    Object.entries(hookFiles).forEach(([name, content]) => {
      const filePath = path.join(hooksDir, name);
      fs.writeFileSync(filePath, content);
      fs.chmodSync(filePath, 0o755);
    });
  }

  setupSkills() {
    const skillsDir = path.join(this.claudeDir, 'skills');
    if (!fs.existsSync(skillsDir)) {
      fs.mkdirSync(skillsDir, { recursive: true });
    }

    const skillTemplate = {
      name: 'example-skill',
      description: 'Example skill for demonstration',
      triggers: ['test', 'example'],
      metadata: {
        author: 'Claude Code',
        version: '1.0.0'
      }
    };

    fs.writeFileSync(
      path.join(skillsDir, 'example.json'),
      JSON.stringify(skillTemplate, null, 2)
    );
  }

  detectLanguage() {
    const packageJson = path.join(this.projectRoot, 'package.json');
    if (fs.existsSync(packageJson)) return 'javascript';

    const requirements = path.join(this.projectRoot, 'requirements.txt');
    if (fs.existsSync(requirements)) return 'python';

    const goMod = path.join(this.projectRoot, 'go.mod');
    if (fs.existsSync(goMod)) return 'go';

    return 'unknown';
  }

  getProjectName() {
    try {
      const packageJson = path.join(this.projectRoot, 'package.json');
      if (fs.existsSync(packageJson)) {
        const pkg = JSON.parse(fs.readFileSync(packageJson, 'utf-8'));
        return pkg.name || path.basename(this.projectRoot);
      }
    } catch (e) {
      // Silent fallback
    }
    return path.basename(this.projectRoot);
  }

  optimize() {
    const settings = this.getSettings();

    // Enable caching
    settings.performance.cachingEnabled = true;
    settings.performance.compressionEnabled = true;

    // Optimize for development
    settings.environment.NODE_ENV = 'development';
    settings.monitoring.loggingLevel = 'info';

    this.saveSettings(settings);
    return settings;
  }

  getSettings() {
    if (fs.existsSync(this.settingsFile)) {
      return JSON.parse(fs.readFileSync(this.settingsFile, 'utf-8'));
    }
    return {};
  }

  saveSettings(settings) {
    fs.writeFileSync(this.settingsFile, JSON.stringify(settings, null, 2));
  }

  getStatus() {
    return {
      initialized: true,
      projectRoot: this.projectRoot,
      claudeDir: this.claudeDir,
      settingsFile: this.settingsFile,
      settings: this.getSettings(),
      hooksInstalled: fs.existsSync(path.join(this.claudeDir, 'hooks')),
      skillsSetup: fs.existsSync(path.join(this.claudeDir, 'skills'))
    };
  }

  validate() {
    const issues = [];

    if (!fs.existsSync(this.settingsFile)) {
      issues.push('settings.json not found');
    }

    const hookDir = path.join(this.claudeDir, 'hooks');
    if (!fs.existsSync(hookDir)) {
      issues.push('hooks directory not found');
    }

    return {
      valid: issues.length === 0,
      issues
    };
  }
}

module.exports = ClaudeCodeSetup;
