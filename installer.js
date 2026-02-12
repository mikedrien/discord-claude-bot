#!/usr/bin/env node

/**
 * Discord Claude Bot — Self-Contained Installer
 *
 * This file is bundled into a single EXE by build-installer.js.
 * It contains all project source files embedded as base64.
 *
 * When run, it:
 *   1. Asks where to install the bot
 *   2. Extracts all project files
 *   3. Checks / installs Node.js, Claude CLI, npm deps
 *   4. Walks through Discord Developer Portal setup
 *   5. Collects token, channel ID, user ID, aliases
 *   6. Writes .env + config.json
 *   7. Creates start.bat / start.sh launchers
 *   8. Offers to start the bot
 */

const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');
const readline = require('readline');
const os = require('os');

// ── Embedded files (replaced at build time) ──────────────────────────
const EMBEDDED_FILES = '__EMBEDDED_FILES_PLACEHOLDER__';

// ── Helpers ──────────────────────────────────────────────────────────
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function ask(question) {
  return new Promise((resolve) => rl.question(question, (a) => resolve(a.trim())));
}

async function confirm(question) {
  const a = await ask(`${question} (a/n): `);
  return a.toLowerCase().startsWith('a') || a.toLowerCase().startsWith('y');
}

function hr() {
  console.log('\u2500'.repeat(56));
}

function heading(step, total, title) {
  console.log('');
  hr();
  console.log(`  Krok ${step}/${total}: ${title}`);
  hr();
  console.log('');
}

function ok(msg)   { console.log(`  \u2713 ${msg}`); }
function info(msg) { console.log(`  \u2139 ${msg}`); }
function warn(msg) { console.log(`  \u26A0 ${msg}`); }
function err(msg)  { console.log(`  \u2717 ${msg}`); }

function commandExists(cmd) {
  try {
    execSync(`${process.platform === 'win32' ? 'where' : 'which'} ${cmd}`, { stdio: 'ignore' });
    return true;
  } catch { return false; }
}

function getCommandVersion(cmd, flag = '--version') {
  try {
    return execSync(`${cmd} ${flag}`, { encoding: 'utf-8' }).trim().split('\n')[0];
  } catch { return null; }
}

function runCommand(cmd, cwd) {
  try {
    execSync(cmd, { cwd, stdio: 'inherit' });
    return true;
  } catch { return false; }
}

const TOTAL_STEPS = 8;

// ── Main ─────────────────────────────────────────────────────────────
async function main() {
  console.log('');
  console.log('========================================================');
  console.log('     Discord Claude Bot \u2014 Installer');
  console.log('========================================================');
  console.log('');
  console.log('  Tento installer ta prevedie celou instalaciou krok za');
  console.log('  krokom. Na konci budes mat plne funkcny Discord bot');
  console.log('  prepojeny s Claude Code CLI.');
  console.log('');

  // ── Step 1: Choose install location ────────────────────────────────
  heading(1, TOTAL_STEPS, 'Umiestnenie instalacie');

  const defaultDir = path.join(os.homedir(), 'discord-claude-bot');
  console.log(`  Kam chces nainstalovat bota?`);
  console.log(`  (Prazdny = ${defaultDir})`);
  console.log('');

  let installDir = await ask(`  Adresar: `);
  if (!installDir) installDir = defaultDir;
  installDir = path.resolve(installDir);

  if (fs.existsSync(installDir) && fs.readdirSync(installDir).length > 0) {
    const existingSrc = fs.existsSync(path.join(installDir, 'src', 'index.js'));
    if (existingSrc) {
      info('Najdena existujuca instalacia.');
      const overwrite = await confirm('  Chces prepisat zdrojove subory? (konfiguracia sa zachova)');
      if (!overwrite) {
        info('Preskakujem extrakciu suborov, pokracujem s konfiguraciou...');
      } else {
        extractFiles(installDir);
      }
    } else {
      warn(`Adresar ${installDir} nie je prazdny a neobsahuje instalaci bota.`);
      const proceed = await confirm('  Pokracovat a zapisat sem subory?');
      if (!proceed) {
        console.log('  Zrusene. Spusti znova a zvolsi iny adresar.');
        rl.close();
        process.exit(0);
      }
      extractFiles(installDir);
    }
  } else {
    extractFiles(installDir);
  }

  // ── Step 2: Check Node.js ──────────────────────────────────────────
  heading(2, TOTAL_STEPS, 'Kontrola Node.js');

  const nodeVersion = getCommandVersion('node');
  if (!nodeVersion) {
    err('Node.js nie je nainstalovany!');
    console.log('');
    console.log('  Stiahni a nainstaluj Node.js v18+ z:');
    console.log('  https://nodejs.org');
    console.log('');
    console.log('  Po instalacii spusti tento installer znova.');
    console.log(`  Subory su uz extrahovane v: ${installDir}`);
    rl.close();
    process.exit(1);
  }

  const majorVersion = parseInt(nodeVersion.replace('v', ''));
  if (majorVersion < 18) {
    err(`Najdeny Node.js ${nodeVersion} \u2014 potrebujes v18 alebo novsi.`);
    console.log('  Stiahni novu verziu z: https://nodejs.org');
    rl.close();
    process.exit(1);
  }

  ok(`Node.js ${nodeVersion}`);

  // ── Step 3: Check Claude CLI ───────────────────────────────────────
  heading(3, TOTAL_STEPS, 'Kontrola Claude Code CLI');

  if (commandExists('claude')) {
    const claudeVer = getCommandVersion('claude', '--version') || 'najdeny';
    ok(`Claude CLI: ${claudeVer}`);
  } else {
    warn('Claude CLI nie je nainstalovany.');
    console.log('');
    console.log('  Claude Code CLI je potrebny na to, aby bot vedel');
    console.log('  komunikovat s Claude. Je to bezplatny CLI nastroj.');
    console.log('');
    const install = await confirm('  Chces ho nainstalovat teraz?');
    if (install) {
      console.log('');
      info('Instalujem Claude CLI (moze to chvilu trvat)...');
      console.log('');
      if (!runCommand('npm install -g @anthropic-ai/claude-code', installDir)) {
        err('Instalacia zlyhala.');
        console.log('  Skus manualne: npm install -g @anthropic-ai/claude-code');
      } else {
        ok('Claude CLI nainstalovany.');
        console.log('');
        info('DOLEZITE: Po instalacii musis spustit "claude" v terminali');
        info('a prihlasit sa (Anthropic ucet alebo API key).');
      }
    } else {
      warn('Preskakujem. Bot nebude fungovat bez Claude CLI.');
    }
  }

  // ── Step 4: npm install ────────────────────────────────────────────
  heading(4, TOTAL_STEPS, 'Instalacia npm zavislosti');

  const nodeModulesExists = fs.existsSync(path.join(installDir, 'node_modules'));
  const lockFile = path.join(installDir, 'package-lock.json');
  const lockExists = fs.existsSync(lockFile);

  if (nodeModulesExists && lockExists) {
    ok('node_modules uz existuje.');
    const refresh = await confirm('  Chces reinstalovat zavislosti?');
    if (refresh) {
      info('Spustam npm install...');
      console.log('');
      runCommand('npm install', installDir);
      ok('Zavislosti aktualizovane.');
    }
  } else {
    info('Spustam npm install...');
    console.log('');
    if (!runCommand('npm install', installDir)) {
      err('npm install zlyhal. Skontroluj chybove hlasky vyssie.');
      rl.close();
      process.exit(1);
    }
    ok('Zavislosti nainstalovane.');
  }

  // ── Step 5: Discord Developer Portal guide ─────────────────────────
  heading(5, TOTAL_STEPS, 'Vytvorenie Discord Bota');

  const envPath = path.join(installDir, '.env');
  const configPath = path.join(installDir, 'config.json');
  let existingToken = null;
  let existingConfig = null;

  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    const match = envContent.match(/DISCORD_TOKEN=(.+)/);
    if (match && match[1] && match[1] !== 'your-bot-token-here') {
      existingToken = match[1].trim();
    }
  }

  if (fs.existsSync(configPath)) {
    try {
      existingConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    } catch {}
  }

  let token;

  if (existingToken) {
    ok(`Discord token uz je nastaveny (${existingToken.slice(0, 10)}...)`);
    const change = await confirm('  Chces ho zmenit?');
    if (!change) {
      token = existingToken;
    } else {
      existingToken = null;
    }
  }

  if (!existingToken && !token) {
    console.log('  Teraz vytvorime Discord bota. Nasleduj tieto kroky:');
    console.log('');
    console.log('  \u250C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510');
    console.log('  \u2502  A) VYTVORENIE APLIKACIE                            \u2502');
    console.log('  \u2502                                                      \u2502');
    console.log('  \u2502  1. Otvor v prehliadaci:                             \u2502');
    console.log('  \u2502     https://discord.com/developers/applications      \u2502');
    console.log('  \u2502                                                      \u2502');
    console.log('  \u2502  2. Klikni "New Application"                         \u2502');
    console.log('  \u2502     Zadaj meno (napr. "Claude Bot") > Create         \u2502');
    console.log('  \u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518');
    await ask('  Stlac ENTER ked mas aplikaciu vytvorenu...');

    console.log('');
    console.log('  \u250C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510');
    console.log('  \u2502  B) ZISKANIE TOKENU                                  \u2502');
    console.log('  \u2502                                                      \u2502');
    console.log('  \u2502  3. V lavom menu klikni na "Bot"                     \u2502');
    console.log('  \u2502  4. Klikni "Reset Token" > "Yes, do it!"            \u2502');
    console.log('  \u2502  5. SKOPIRUJ TOKEN (zobrazí sa len raz!)            \u2502');
    console.log('  \u2502                                                      \u2502');
    console.log('  \u2502  \u26A0 DOLEZITE: Pod "Privileged Gateway Intents"     \u2502');
    console.log('  \u2502     zapni MESSAGE CONTENT INTENT (zeleno)            \u2502');
    console.log('  \u2502     a klikni "Save Changes"                          \u2502');
    console.log('  \u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518');
    await ask('  Stlac ENTER ked mas token skopirovany...');
    console.log('');

    token = await ask('  Vloz DISCORD_TOKEN: ');
    while (!token || token.length < 20) {
      warn('Token vyzera nespravne (prilis kratky).');
      token = await ask('  Vloz DISCORD_TOKEN: ');
    }

    console.log('');
    console.log('  \u250C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510');
    console.log('  \u2502  C) PRIDANIE BOTA NA SERVER                          \u2502');
    console.log('  \u2502                                                      \u2502');
    console.log('  \u2502  6. V lavom menu: "OAuth2" > "URL Generator"         \u2502');
    console.log('  \u2502                                                      \u2502');
    console.log('  \u2502  7. Scopes - zaklikni:                               \u2502');
    console.log('  \u2502     [x] bot                                          \u2502');
    console.log('  \u2502     [x] applications.commands                        \u2502');
    console.log('  \u2502                                                      \u2502');
    console.log('  \u2502  8. Bot Permissions - zaklikni:                       \u2502');
    console.log('  \u2502     [x] Send Messages                                \u2502');
    console.log('  \u2502     [x] Create Public Threads                        \u2502');
    console.log('  \u2502     [x] Manage Threads                               \u2502');
    console.log('  \u2502     [x] Read Message History                         \u2502');
    console.log('  \u2502     [x] Add Reactions                                \u2502');
    console.log('  \u2502     [x] Use Slash Commands                           \u2502');
    console.log('  \u2502                                                      \u2502');
    console.log('  \u2502  9. Skopiruj "Generated URL" na spodku stranky       \u2502');
    console.log('  \u2502  10. Otvor tu URL v prehliadaci                      \u2502');
    console.log('  \u2502  11. Vyber server a klikni "Authorize"               \u2502');
    console.log('  \u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518');
    await ask('  Stlac ENTER ked je bot pridany na server...');
  }

  // ── Step 6: Channel ID + User ID ──────────────────────────────────
  heading(6, TOTAL_STEPS, 'Discord IDs');

  console.log('  Teraz potrebujeme Channel ID a tvoje User ID.');
  console.log('');
  console.log('  \u250C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510');
  console.log('  \u2502  Ako zapnut Developer Mode v Discorde:               \u2502');
  console.log('  \u2502  Settings > Advanced > Developer Mode > zapni        \u2502');
  console.log('  \u2502                                                      \u2502');
  console.log('  \u2502  Channel ID:                                         \u2502');
  console.log('  \u2502  Prave tlacidlo na kanal > "Copy Channel ID"         \u2502');
  console.log('  \u2502                                                      \u2502');
  console.log('  \u2502  User ID:                                            \u2502');
  console.log('  \u2502  Prave tlacidlo na seba > "Copy User ID"             \u2502');
  console.log('  \u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518');
  console.log('');

  const defaultChannelId = existingConfig?.channelId || '';
  const defaultUserId = existingConfig?.allowedUserId || '';

  const channelPrompt = defaultChannelId
    ? `  Channel ID [${defaultChannelId}]: `
    : '  Channel ID: ';
  let channelIdVal = await ask(channelPrompt);
  if (!channelIdVal && defaultChannelId) channelIdVal = defaultChannelId;
  while (!channelIdVal || !/^\d+$/.test(channelIdVal)) {
    warn('Channel ID musi byt cislo (napr. 782271797542125571)');
    channelIdVal = await ask('  Channel ID: ');
  }

  console.log('');
  const userPrompt = defaultUserId
    ? `  User ID [${defaultUserId}]: `
    : '  User ID: ';
  let userIdVal = await ask(userPrompt);
  if (!userIdVal && defaultUserId) userIdVal = defaultUserId;
  while (!userIdVal || !/^\d+$/.test(userIdVal)) {
    warn('User ID musi byt cislo (napr. 766052761858474025)');
    userIdVal = await ask('  User ID: ');
  }

  // ── Step 7: Aliases ────────────────────────────────────────────────
  heading(7, TOTAL_STEPS, 'Projektove aliasy');

  console.log('  Aliasy su skratky pre adresare projektov.');
  console.log('  Napr. alias "react" \u2192 "C:\\workspace\\project"');
  console.log('  V Discorde potom napisem "react" alebo "/chat react"');
  console.log('  a bot otvori Claude session v tom adresari.');
  console.log('');

  const aliases = {};
  const existingAliases = existingConfig?.aliases || {};

  if (Object.keys(existingAliases).length > 0) {
    console.log('  Existujuce aliasy:');
    for (const [name, p] of Object.entries(existingAliases)) {
      console.log(`    ${name} \u2192 ${p}`);
    }
    console.log('');
    const keep = await confirm('  Chces ponechat existujuce aliasy?');
    if (keep) {
      Object.assign(aliases, existingAliases);
    }
  }

  console.log('');
  info('Pridaj nove aliasy (prazdny nazov = koniec):');
  console.log('');

  while (true) {
    const name = await ask('  Nazov aliasu (prazdny = hotovo): ');
    if (!name) break;

    const aliasName = name.toLowerCase().replace(/\s+/g, '-');
    const aliasPath = await ask(`  Cesta k projektu pre "${aliasName}": `);

    if (!aliasPath) {
      warn('Cesta je prazdna, preskakujem.');
      continue;
    }

    aliases[aliasName] = aliasPath;
    ok(`${aliasName} \u2192 ${aliasPath}`);
    console.log('');
  }

  if (Object.keys(aliases).length === 0) {
    warn('Ziadne aliasy. Mozes ich pridat neskor v config.json.');
  }

  // ── Step 8: Write config, launchers, verify ────────────────────────
  heading(8, TOTAL_STEPS, 'Ukladanie a overenie');

  // Write .env
  fs.writeFileSync(envPath, `DISCORD_TOKEN=${token}\n`, 'utf-8');
  ok('.env zapisany');

  // Write config.json
  const config = {
    channelId: channelIdVal,
    allowedUserId: userIdVal,
    sessionTimeoutMs: existingConfig?.sessionTimeoutMs || 86400000,
    aliases,
  };
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', 'utf-8');
  ok('config.json zapisany');

  // Create start.bat
  const startBat = `@echo off\nchcp 65001 >nul\ntitle Discord Claude Bot\ncd /d "${installDir}"\nnode src\\index.js\npause\n`;
  fs.writeFileSync(path.join(installDir, 'start.bat'), startBat, 'utf-8');
  ok('start.bat vytvoreny (dvojklik na spustenie bota)');

  // Create start.sh
  const startSh = `#!/usr/bin/env bash\ncd "${installDir}"\nnode src/index.js\n`;
  fs.writeFileSync(path.join(installDir, 'start.sh'), startSh, 'utf-8');
  ok('start.sh vytvoreny');

  // Verify
  console.log('');
  hr();
  console.log('  Overenie:');
  hr();
  console.log('');

  ok(`Node.js: ${getCommandVersion('node')}`);
  ok(`Claude CLI: ${commandExists('claude') ? 'nainstalovany' : 'CHYBA \u2014 nemas claude CLI!'}`);
  ok(`node_modules: ${fs.existsSync(path.join(installDir, 'node_modules')) ? 'OK' : 'CHYBA'}`);
  ok(`.env: OK`);
  ok(`config.json: OK`);
  ok(`Aliasy: ${Object.keys(aliases).length}`);
  ok(`Instalacia: ${installDir}`);

  console.log('');
  hr();
  console.log('  INSTALACIA DOKONCENA!');
  hr();
  console.log('');
  console.log('  Spusti bota:');
  console.log(`    - Dvojklik na:  ${path.join(installDir, 'start.bat')}`);
  console.log(`    - Alebo:        cd "${installDir}" && npm start`);
  console.log('');

  const startNow = await confirm('  Chces spustit bota teraz?');
  if (startNow) {
    console.log('');
    info('Spustam bota...');
    console.log('');
    rl.close();

    const bot = spawn('node', ['src/index.js'], {
      cwd: installDir,
      stdio: 'inherit',
    });

    bot.on('exit', (code) => {
      process.exit(code || 0);
    });
    return;
  }

  rl.close();
}

// ── File extraction ──────────────────────────────────────────────────
function extractFiles(installDir) {
  info(`Extrahujem subory do: ${installDir}`);
  console.log('');

  for (const [relativePath, base64Content] of Object.entries(EMBEDDED_FILES)) {
    const fullPath = path.join(installDir, relativePath);
    const dir = path.dirname(fullPath);

    fs.mkdirSync(dir, { recursive: true });
    const content = Buffer.from(base64Content, 'base64').toString('utf-8');
    fs.writeFileSync(fullPath, content, 'utf-8');
    ok(`${relativePath}`);
  }

  console.log('');
  ok(`${Object.keys(EMBEDDED_FILES).length} suborov extrahovanych.`);
}

// ── Run ──────────────────────────────────────────────────────────────
main().catch((e) => {
  console.error('Installer chyba:', e.message);
  rl.close();
  process.exit(1);
});
