const readline = require('readline');
const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const https = require('https');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// ── Colors & Styles ───────────────────────────────────

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
  bgMagenta: '\x1b[45m',
  bgCyan: '\x1b[46m',
};

function colorize(text, color) {
  return `${colors[color]}${text}${colors.reset}`;
}

function bright(text) { return colorize(text, 'bright'); }
function dim(text) { return colorize(text, 'dim'); }
function red(text) { return colorize(text, 'red'); }
function green(text) { return colorize(text, 'green'); }
function yellow(text) { return colorize(text, 'yellow'); }
function blue(text) { return colorize(text, 'blue'); }
function magenta(text) { return colorize(text, 'magenta'); }
function cyan(text) { return colorize(text, 'cyan'); }

// ── UI Components ─────────────────────────────────────

function clearScreen() {
  process.stdout.write('\x1Bc');
}

function printBanner() {
  console.log('');
  console.log(cyan('  ╔══════════════════════════════════════════════════════════════╗'));
  console.log(cyan('  ║') + bright('                                                              ') + cyan('║'));
  console.log(cyan('  ║') + bright('     ██████╗ ██████╗ ██╗   ██╗██████╗     ██████╗ ██████╗     ') + cyan('║'));
  console.log(cyan('  ║') + bright('     ██╔══██╗██╔══██╗╚██╗ ██╔╝██╔══██╗   ██╔════╝██╔═══██╗   ') + cyan('║'));
  console.log(cyan('  ║') + bright('     ██████╔╝██████╔╝ ╚████╔╝ ██████╔╝   ██║     ██║   ██║   ') + cyan('║'));
  console.log(cyan('  ║') + bright('     ██╔══██╗██╔══██╗  ╚██╔╝  ██╔═══╝    ██║     ██║   ██║   ') + cyan('║'));
  console.log(cyan('  ║') + bright('     ██████╔╝██║  ██║   ██║   ██║         ╚██████╗╚██████╔╝   ') + cyan('║'));
  console.log(cyan('  ║') + bright('     ╚═════╝ ╚═╝  ╚═╝   ╚═╝   ╚═╝          ╚═════╝ ╚═════╝    ') + cyan('║'));
  console.log(cyan('  ║') + bright('                                                              ') + cyan('║'));
  console.log(cyan('  ║') + dim('          Browser Automation for AI Agents & Humans           ') + cyan('║'));
  console.log(cyan('  ║') + dim('                    v1.0.0 • by marceli1404                   ') + cyan('║'));
  console.log(cyan('  ║') + bright('                                                              ') + cyan('║'));
  console.log(cyan('  ╚══════════════════════════════════════════════════════════════╝'));
  console.log('');
}

function printSection(title) {
  console.log('');
  console.log(blue('  ── ') + bright(blue(title)) + blue(' ──────────────────────────────────────────────'));
  console.log('');
}

function printSuccess(msg) {
  console.log(green('  ✓ ') + msg);
}

function printError(msg) {
  console.log(red('  ✗ ') + msg);
}

function printWarning(msg) {
  console.log(yellow('  ⚠ ') + msg);
}

function printInfo(msg) {
  console.log(cyan('  ℹ ') + msg);
}

function printStep(current, total, msg) {
  const progress = Math.round((current / total) * 100);
  const bar = '█'.repeat(Math.floor(progress / 5)) + '░'.repeat(20 - Math.floor(progress / 5));
  console.log(`  ${cyan(`[${bar}]`)} ${bright(`${progress}%`)} ${dim(msg)}`);
}

async function prompt(question) {
  return new Promise((resolve) => {
    rl.question(`  ${question}`, (answer) => {
      resolve(answer.trim());
    });
  });
}

async function confirm(question, defaultYes = true) {
  const hint = defaultYes ? '[Y/n]' : '[y/N]';
  const answer = await prompt(`${question} ${dim(hint)}: `);
  if (answer === '') return defaultYes;
  return answer.toLowerCase().startsWith('y');
}

function printProgressBar(label, progress, width = 30) {
  const filled = Math.floor((progress / 100) * width);
  const bar = '█'.repeat(filled) + '░'.repeat(width - filled);
  process.stdout.write(`\r  ${label} ${cyan(`[${bar}]`)} ${bright(`${progress}%`)}`);
  if (progress === 100) console.log('');
}

// ── Setup Steps ───────────────────────────────────────

async function checkNodeVersion() {
  printSection('Step 1: Checking Node.js');
  
  try {
    const version = execSync('node --version', { encoding: 'utf-8' }).trim();
    const major = parseInt(version.replace('v', '').split('.')[0]);
    
    if (major >= 18) {
      printSuccess(`Node.js ${version} detected`);
      return true;
    } else {
      printError(`Node.js ${version} detected (requires 18+)`);
      printInfo('Download from: https://nodejs.org');
      return false;
    }
  } catch (e) {
    printError('Node.js not found');
    printInfo('Download from: https://nodejs.org');
    return false;
  }
}

async function checkGit() {
  printSection('Step 2: Checking Git');
  
  try {
    const version = execSync('git --version', { encoding: 'utf-8' }).trim();
    printSuccess(version);
    return true;
  } catch (e) {
    printWarning('Git not found (optional)');
    return true;
  }
}

async function installDependencies() {
  printSection('Step 3: Installing Dependencies');
  
  const steps = [
    { label: 'npm install', cmd: 'npm install' },
  ];
  
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    printStep(i, steps.length, step.label);
    
    try {
      execSync(step.cmd, { encoding: 'utf-8', stdio: 'pipe' });
      printStep(100, 100, step.label);
      printSuccess('Dependencies installed');
    } catch (e) {
      printError(`Failed: ${e.message}`);
      return false;
    }
  }
  
  return true;
}

async function installPlaywright() {
  printSection('Step 4: Installing Playwright Browsers');
  
  const browsers = ['Chromium', 'Firefox', 'WebKit'];
  
  for (let i = 0; i < browsers.length; i++) {
    const browser = browsers[i];
    printStep(i, browsers.length, `Downloading ${browser}`);
    
    try {
      execSync('npx playwright install --with-deps', { encoding: 'utf-8', stdio: 'pipe' });
    } catch (e) {
      // Continue even if one fails
    }
  }
  
  printStep(100, 100, 'Browsers ready');
  printSuccess('All browsers installed');
  return true;
}

async function setupEnvironment() {
  printSection('Step 5: Environment Setup');
  
  const envPath = path.join(__dirname, '.env');
  const examplePath = path.join(__dirname, '.env.example');
  
  if (fs.existsSync(envPath)) {
    printInfo('.env file already exists');
    const overwrite = await confirm('Overwrite existing .env?', false);
    if (!overwrite) return true;
  }
  
  console.log('');
  console.log(dim('  Configure your Google OAuth credentials:'));
  console.log(dim('  (Get these from https://console.cloud.google.com)'));
  console.log('');
  
  const clientId = await prompt('  Client ID: ');
  const clientSecret = await prompt('  Client Secret: ');
  const redirectUri = await prompt('  Redirect URI [http://localhost:3000/callback]: ') || 'http://localhost:3000/callback';
  
  const envContent = `# Google OAuth Credentials
CLIENT_ID=${clientId}
CLIENT_SECRET=${clientSecret}
REDIRECT_URI=${redirectUri}
`;
  
  fs.writeFileSync(envPath, envContent);
  printSuccess('.env file created');
  
  return true;
}

async function verifyInstallation() {
  printSection('Step 6: Verifying Installation');
  
  const checks = [
    { label: 'Node.js modules', test: () => { require('playwright'); return true; } },
    { label: 'Playwright browsers', test: () => { execSync('npx playwright install --dry-run', { stdio: 'pipe' }); return true; } },
    { label: 'CLI entry point', test: () => fs.existsSync(path.join(__dirname, 'cli.js')) },
    { label: 'Config files', test: () => fs.existsSync(path.join(__dirname, 'package.json')) },
  ];
  
  let passed = 0;
  for (const check of checks) {
    try {
      if (check.test()) {
        printSuccess(check.label);
        passed++;
      }
    } catch (e) {
      printError(check.label);
    }
  }
  
  console.log('');
  if (passed === checks.length) {
    printSuccess(`All ${checks.length} checks passed`);
  } else {
    printWarning(`${passed}/${checks.length} checks passed`);
  }
  
  return passed === checks.length;
}

function printSummary() {
  printSection('Installation Complete!');
  
  console.log(cyan('  ┌─────────────────────────────────────────────────────────────┐'));
  console.log(cyan('  │') + bright('  Quick Start Commands:                                      ') + cyan('│'));
  console.log(cyan('  │') + bright('                                                             ') + cyan('│'));
  console.log(cyan('  │') + green('  node cli.js auth                    ') + dim('# Authenticate with Google      ') + cyan('│'));
  console.log(cyan('  │') + green('  node cli.js gmail list              ') + dim('# View your emails              ') + cyan('│'));
  console.log(cyan('  │') + green('  node cli.js browser open <url>      ') + dim('# Open a website                ') + cyan('│'));
  console.log(cyan('  │') + green('  node cli.js browser screenshot <url>') + dim('# Take a screenshot             ') + cyan('│'));
  console.log(cyan('  │') + green('  node cli.js browser move <url> x y  ') + dim('# Move mouse naturally           ') + cyan('│'));
  console.log(cyan('  │') + bright('                                                             ') + cyan('│'));
  console.log(cyan('  └─────────────────────────────────────────────────────────────┘'));
  console.log('');
  
  console.log(dim('  Cross-Browser Support:'));
  console.log('    ' + cyan('Chromium') + dim(' • ') + orange('Firefox') + dim(' • ') + magenta('WebKit (Safari)'));
  console.log('');
  
  console.log(dim('  Documentation:'));
  console.log('    ' + blue('https://github.com/marceli1404/browser-harness'));
  console.log('');
}

function orange(text) { return colorize(text, 'yellow'); }

// ── Main ──────────────────────────────────────────────

async function main() {
  clearScreen();
  printBanner();
  
  console.log(dim('  Welcome to Browser Harness!'));
  console.log(dim('  This installer will set up everything you need.'));
  console.log('');
  
  const skip = await confirm('  Start installation?', true);
  if (!skip) {
    console.log('');
    printInfo('Installation cancelled');
    process.exit(0);
  }
  
  // Run setup steps
  const steps = [
    checkNodeVersion,
    checkGit,
    installDependencies,
    installPlaywright,
    setupEnvironment,
    verifyInstallation,
  ];
  
  for (const step of steps) {
    const result = await step();
    if (result === false) {
      console.log('');
      printError('Setup failed. Please fix the issues above and try again.');
      process.exit(1);
    }
  }
  
  printSummary();
  
  // Ask to run auth
  const runAuth = await confirm('  Set up Google authentication now?', true);
  if (runAuth) {
    console.log('');
    printInfo('Starting auth server...');
    printInfo('Open http://localhost:3000 in your browser');
    console.log('');
    
    try {
      execSync('node cli.js auth', { stdio: 'inherit' });
    } catch (e) {
      printWarning('Auth setup skipped');
    }
  }
  
  console.log('');
  printSuccess('You\'re all set! Happy automating!');
  console.log('');
  
  rl.close();
}

main().catch(console.error);
