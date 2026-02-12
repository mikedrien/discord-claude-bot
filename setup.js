#!/usr/bin/env node

/**
 * Discord Claude Bot — Interactive Setup Wizard
 *
 * Guides the user step-by-step through the entire installation:
 *   1. Check / install Node.js (version check only — can't self-install)
 *   2. Check / install Claude Code CLI
 *   3. npm install (only when node_modules missing or outdated)
 *   4. Walk through Discord Developer Portal setup
 *   5. Collect DISCORD_TOKEN, channelId, allowedUserId
 *   6. Configure project aliases
 *   7. Write .env + config.json
 *   8. Verify everything and offer to start the bot
 */

const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');
const readline = require('readline');

// ── Helpers ──────────────────────────────────────────────────────────
const ROOT = path.resolve(__dirname);

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
  console.log('─'.repeat(56));
}

function heading(step, total, title) {
  console.log('');
  hr();
  console.log(`  Krok ${step}/${total}: ${title}`);
  hr();
  console.log('');
}

function ok(msg)   { console.log(`  ✓ ${msg}`); }
function info(msg) { console.log(`  ℹ ${msg}`); }
function warn(msg) { console.log(`  ⚠ ${msg}`); }
function err(msg)  { console.log(`  ✗ ${msg}`); }

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

function runCommand(cmd, opts = {}) {
  try {
    execSync(cmd, { cwd: ROOT, stdio: 'inherit', ...opts });
    return true;
  } catch { return false; }
}

const TOTAL_STEPS = 7;

// ── Main ─────────────────────────────────────────────────────────────
async function main() {
  console.log('');
  console.log('========================================================');
  console.log('     Discord Claude Bot — Instalacny Wizard');
  console.log('========================================================');
  console.log('');
  console.log('  Tento wizard ta prevedie celou instalaciou krok za');
  console.log('  krokom. Na konci budes mat plne funkcny bot.');
  console.log('');

  // ── Step 1: Node.js ────────────────────────────────────────────────
  heading(1, TOTAL_STEPS, 'Kontrola Node.js');

  const nodeVersion = getCommandVersion('node');
  if (!nodeVersion) {
    err('Node.js nie je nainstalovany!');
    console.log('');
    console.log('  Stiahni a nainstaluj Node.js v18+ z:');
    console.log('  https://nodejs.org');
    console.log('');
    console.log('  Po instalacii spusti tento wizard znova.');
    rl.close();
    process.exit(1);
  }

  const majorVersion = parseInt(nodeVersion.replace('v', ''));
  if (majorVersion < 18) {
    err(`Najdeny Node.js ${nodeVersion} — potrebujes v18 alebo novsi.`);
    console.log('  Stiahni novu verziu z: https://nodejs.org');
    rl.close();
    process.exit(1);
  }

  ok(`Node.js ${nodeVersion}`);

  // ── Step 2: Claude CLI ─────────────────────────────────────────────
  heading(2, TOTAL_STEPS, 'Kontrola Claude Code CLI');

  if (commandExists('claude')) {
    const claudeVer = getCommandVersion('claude', '--version') || 'najdeny';
    ok(`Claude CLI: ${claudeVer}`);
  } else {
    warn('Claude CLI nie je nainstalovany.');
    console.log('');
    const install = await confirm('  Chces ho nainstalovat teraz?');
    if (install) {
      console.log('');
      info('Instalujem Claude CLI (moze to chvilu trvat)...');
      console.log('');
      if (!runCommand('npm install -g @anthropic-ai/claude-code')) {
        err('Instalacia zlyhala. Skus manualne: npm install -g @anthropic-ai/claude-code');
        rl.close();
        process.exit(1);
      }
      ok('Claude CLI nainstalovany.');
    } else {
      warn('Preskakujem. Bot nebude fungovat bez Claude CLI.');
      console.log('  Nainstaluj neskor: npm install -g @anthropic-ai/claude-code');
    }
  }

  // ── Step 3: npm install ────────────────────────────────────────────
  heading(3, TOTAL_STEPS, 'Instalacia npm zavislosti');

  const nodeModulesExists = fs.existsSync(path.join(ROOT, 'node_modules'));
  const lockExists = fs.existsSync(path.join(ROOT, 'package-lock.json'));

  if (nodeModulesExists && lockExists) {
    ok('node_modules uz existuje, preskakujem.');
  } else {
    info('Spustam npm install...');
    console.log('');
    if (!runCommand('npm install')) {
      err('npm install zlyhal. Skontroluj chybove hlasky vyssie.');
      rl.close();
      process.exit(1);
    }
    ok('Zavislosti nainstalovane.');
  }

  // ── Step 4: Discord Developer Portal guide ─────────────────────────
  heading(4, TOTAL_STEPS, 'Nastavenie Discord Bota');

  // Check if already configured
  const envPath = path.join(ROOT, '.env');
  const configPath = path.join(ROOT, 'config.json');
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

  let token, channelIdVal, userIdVal;

  if (existingToken) {
    ok(`Discord token uz je nastaveny (${existingToken.slice(0, 10)}...)`);
    const change = await confirm('  Chces ho zmenit?');
    if (change) {
      existingToken = null;
    }
  }

  if (!existingToken) {
    console.log('  Potrebujes Discord Bot token. Ak ho este nemas,');
    console.log('  nasleduj tieto kroky:');
    console.log('');
    console.log('  1. Otvor: https://discord.com/developers/applications');
    console.log('  2. Klikni "New Application" → zadaj meno → "Create"');
    console.log('  3. V lavom menu klikni "Bot"');
    console.log('  4. Klikni "Reset Token" → "Yes, do it!"');
    console.log('  5. SKOPIRUJ TOKEN (zobrazí sa len raz!)');
    console.log('');
    console.log('  ─── DOLEZITE: v casti "Privileged Gateway Intents" ───');
    console.log('  6. Zapni "MESSAGE CONTENT INTENT" (prepni na zeleno)');
    console.log('  7. Klikni "Save Changes"');
    console.log('');
    console.log('  ─── Pridanie bota na server ───');
    console.log('  8. V lavom menu klikni "OAuth2" → "URL Generator"');
    console.log('  9. Scopes: zaklikni "bot" a "applications.commands"');
    console.log('  10. Bot Permissions: zaklikni:');
    console.log('      • Send Messages');
    console.log('      • Create Public Threads');
    console.log('      • Manage Threads');
    console.log('      • Read Message History');
    console.log('      • Add Reactions');
    console.log('      • Use Slash Commands');
    console.log('  11. Skopiruj Generated URL dole na stranke');
    console.log('  12. Otvor tu URL v prehliadaci a pridaj bota na server');
    console.log('');

    await ask('  Stlac ENTER ked mas bota vytvoreneho a pridaneho na server...');
    console.log('');

    token = await ask('  Vloz DISCORD_TOKEN: ');
    while (!token || token.length < 20) {
      warn('Token vyzera nespravne (prilis kratky).');
      token = await ask('  Vloz DISCORD_TOKEN: ');
    }
  } else {
    token = existingToken;
  }

  // ── Step 5: Channel ID + User ID ──────────────────────────────────
  heading(5, TOTAL_STEPS, 'Discord IDs');

  console.log('  Teraz potrebujeme Channel ID a tvoje User ID.');
  console.log('');
  console.log('  Ako zapnut Developer Mode v Discorde:');
  console.log('  Settings → Advanced → Developer Mode → zapni');
  console.log('');
  console.log('  ─── Channel ID ───');
  console.log('  Prave tlacidlo na kanal kde chces pouzivat bota');
  console.log('  → "Copy Channel ID"');
  console.log('');
  console.log('  ─── User ID ───');
  console.log('  Prave tlacidlo na seba v liste clenov');
  console.log('  → "Copy User ID"');
  console.log('');

  const defaultChannelId = existingConfig?.channelId || '';
  const defaultUserId = existingConfig?.allowedUserId || '';

  const channelPrompt = defaultChannelId
    ? `  Channel ID [${defaultChannelId}]: `
    : '  Channel ID: ';
  channelIdVal = await ask(channelPrompt);
  if (!channelIdVal && defaultChannelId) channelIdVal = defaultChannelId;
  while (!channelIdVal || !/^\d+$/.test(channelIdVal)) {
    warn('Channel ID musi byt cislo (napr. 782271797542125571)');
    channelIdVal = await ask('  Channel ID: ');
  }

  console.log('');
  const userPrompt = defaultUserId
    ? `  User ID [${defaultUserId}]: `
    : '  User ID: ';
  userIdVal = await ask(userPrompt);
  if (!userIdVal && defaultUserId) userIdVal = defaultUserId;
  while (!userIdVal || !/^\d+$/.test(userIdVal)) {
    warn('User ID musi byt cislo (napr. 766052761858474025)');
    userIdVal = await ask('  User ID: ');
  }

  // ── Step 6: Aliases ────────────────────────────────────────────────
  heading(6, TOTAL_STEPS, 'Projektove aliasy');

  console.log('  Aliasy su skratky pre adresare projektov.');
  console.log('  Napr. alias "react" → "C:\\workspace\\project"');
  console.log('  V Discorde potom napisem "react" a bot otvori');
  console.log('  Claude session v tom adresari.');
  console.log('');

  const aliases = {};
  const existingAliases = existingConfig?.aliases || {};

  if (Object.keys(existingAliases).length > 0) {
    console.log('  Existujuce aliasy:');
    for (const [name, p] of Object.entries(existingAliases)) {
      console.log(`    ${name} → ${p}`);
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
    ok(`${aliasName} → ${aliasPath}`);
    console.log('');
  }

  if (Object.keys(aliases).length === 0) {
    warn('Ziadne aliasy nakonfigurovane. Mozes ich pridat neskor v config.json.');
  }

  // ── Step 7: Write config + verify ──────────────────────────────────
  heading(7, TOTAL_STEPS, 'Ukladanie konfiguracie');

  // Write .env
  const envContent = `DISCORD_TOKEN=${token}\n`;
  fs.writeFileSync(envPath, envContent, 'utf-8');
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

  // Final verify
  console.log('');
  hr();
  console.log('  Overenie:');
  hr();
  console.log('');

  ok(`Node.js: ${getCommandVersion('node')}`);
  ok(`Claude CLI: ${commandExists('claude') ? 'nainstalovany' : 'CHYBA — nemas claude!'}`);
  ok(`node_modules: ${fs.existsSync(path.join(ROOT, 'node_modules')) ? 'OK' : 'CHYBA'}`);
  ok(`.env: ${fs.existsSync(envPath) ? 'OK' : 'CHYBA'}`);
  ok(`config.json: ${fs.existsSync(configPath) ? 'OK' : 'CHYBA'}`);
  ok(`Aliasy: ${Object.keys(aliases).length} nakonfigurovanych`);

  console.log('');
  hr();
  console.log('  INSTALACIA DOKONCENA!');
  hr();
  console.log('');
  console.log('  Spusti bota prikazom:');
  console.log('');
  console.log('    npm start');
  console.log('');

  const startNow = await confirm('  Chces spustit bota teraz?');
  if (startNow) {
    console.log('');
    info('Spustam bota...');
    console.log('');
    rl.close();

    const bot = spawn('node', ['src/index.js'], {
      cwd: ROOT,
      stdio: 'inherit',
    });

    bot.on('exit', (code) => {
      process.exit(code || 0);
    });

    return; // don't close rl again
  }

  rl.close();
}

main().catch((e) => {
  console.error('Setup chyba:', e.message);
  rl.close();
  process.exit(1);
});
