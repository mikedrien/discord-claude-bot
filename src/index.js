const { Client, GatewayIntentBits, Partials, REST, Routes } = require('discord.js');
const { discordToken, channelId, aliases } = require('./config');
const { handleMessage, handleInteraction, onSessionChange, buildSessionSummary } = require('./messageHandler');
const { buildCommands } = require('./commands');
const sessionManager = require('./sessionManager');
const { log } = require('./logger');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel],
});

// Track the alias list message so we can update it
let aliasMessageId = null;

function buildAliasEmbed() {
  const aliasList = Object.entries(aliases)
    .map(([name, path]) => `**${name}** → \`${path}\``)
    .join('\n');

  return {
    embeds: [{
      title: 'Claude Chat - Dostupne projekty',
      description: `Napis nazov projektu pre vytvorenie novej session:\n\n${aliasList}`,
      color: 0x7c3aed,
      footer: { text: `Aktivne sessions: ${sessionManager.getActiveSessions().length}` },
      timestamp: new Date().toISOString(),
    }],
  };
}

async function sendOrUpdateAliasList() {
  try {
    const channel = await client.channels.fetch(channelId);
    if (!channel) return;

    // Try to find and delete previous alias message from bot
    const messages = await channel.messages.fetch({ limit: 20 });
    const oldMsg = messages.find(m =>
      m.author.id === client.user.id &&
      m.embeds.length > 0 &&
      m.embeds[0].title === 'Claude Chat - Dostupne projekty'
    );

    if (oldMsg) {
      await oldMsg.delete().catch(() => {});
    }

    // Send fresh alias list
    const msg = await channel.send(buildAliasEmbed());
    aliasMessageId = msg.id;
    log(`[Index] Alias list sent to channel`);
  } catch (err) {
    log(`[Index] Failed to send alias list: ${err.message}`);
  }
}

// Handle session timeouts - notify thread and archive
sessionManager.onTimeout(async (threadId) => {
  try {
    const stats = sessionManager.getStats(threadId);
    const thread = await client.channels.fetch(threadId);
    if (thread) {
      const summary = buildSessionSummary(stats);
      await thread.send(summary);
      await thread.send('Session ukoncena po 24h neaktivity.');
      await thread.setArchived(true);
    }
    await sendOrUpdateAliasList();
  } catch (err) {
    log(`[Index] Failed to notify timeout for thread ${threadId}: ${err.message}`);
  }
});

client.on('messageCreate', handleMessage);
client.on('interactionCreate', handleInteraction);
onSessionChange(() => sendOrUpdateAliasList());

client.once('ready', async () => {
  log(`Bot prihlaseny ako ${client.user.tag}`);
  log(`Sledujem kanal: ${channelId}`);
  await sendOrUpdateAliasList();

  // Register slash commands
  const rest = new REST({ version: '10' }).setToken(discordToken);
  const commands = buildCommands(aliases);
  try {
    await rest.put(
      Routes.applicationGuildCommands(client.user.id, client.guilds.cache.first().id),
      { body: commands.map(c => c.toJSON()) }
    );
    log('[Index] Slash commands registered');
  } catch (err) {
    log(`[Index] Failed to register commands: ${err.message}`);
  }
});

// Connection error handling and reconnect logging
client.on('error', (err) => {
  log(`[Index] Client error: ${err.message}`);
});

client.on('warn', (msg) => {
  log(`[Index] Warning: ${msg}`);
});

client.on('shardDisconnect', (event, shardId) => {
  log(`[Index] Shard ${shardId} disconnected (code: ${event.code}). Auto-reconnect will attempt.`);
});

client.on('shardReconnecting', (shardId) => {
  log(`[Index] Shard ${shardId} reconnecting...`);
});

client.on('shardResume', (shardId, replayedEvents) => {
  log(`[Index] Shard ${shardId} resumed (${replayedEvents} events replayed)`);
});

client.on('shardError', (err, shardId) => {
  log(`[Index] Shard ${shardId} error: ${err.message}`);
});

client.on('invalidated', () => {
  log('[Index] Session invalidated. Restarting...');
  sessionManager.killAll();
  process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', () => {
  log('Ukoncujem sessions...');
  sessionManager.killAll();
  client.destroy();
  process.exit(0);
});

process.on('SIGTERM', () => {
  sessionManager.killAll();
  client.destroy();
  process.exit(0);
});

client.login(discordToken);
