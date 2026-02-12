const { ChannelType } = require('discord.js');
const { channelId, allowedUserId, aliases } = require('./config');
const sessionManager = require('./sessionManager');
const { log } = require('./logger');
const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');

const CHUNK_SIZE = 1900;

const TOOL_LABELS = {
  Read: 'Cita subor',
  Edit: 'Edituje subor',
  Write: 'Zapisuje subor',
  Bash: 'Spusta prikaz',
  Glob: 'Hlada subory',
  Grep: 'Prehladava obsah',
  Task: 'Spusta agenta',
  WebFetch: 'Nacitava web',
  WebSearch: 'Vyh;adava na webe',
};

function formatDuration(ms) {
  if (ms < 1000) return `${ms}ms`;
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${s % 60}s`;
}

function formatCost(usd) {
  if (!usd) return '$0';
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(2)}`;
}

function splitMessage(text) {
  if (text.length <= CHUNK_SIZE) return [text];

  const chunks = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= CHUNK_SIZE) {
      chunks.push(remaining);
      break;
    }

    let splitIndex = remaining.lastIndexOf('\n', CHUNK_SIZE);
    if (splitIndex === -1 || splitIndex < CHUNK_SIZE * 0.5) {
      splitIndex = remaining.lastIndexOf(' ', CHUNK_SIZE);
    }
    if (splitIndex === -1 || splitIndex < CHUNK_SIZE * 0.5) {
      splitIndex = CHUNK_SIZE;
    }

    chunks.push(remaining.slice(0, splitIndex));
    remaining = remaining.slice(splitIndex).trimStart();
  }

  return chunks;
}

function isAllowed(userId) {
  return userId === allowedUserId;
}

function toolDescription(toolName, input) {
  const label = TOOL_LABELS[toolName] || toolName;
  let detail = '';

  if (toolName === 'Read' && input?.file_path) {
    detail = `: \`${input.file_path}\``;
  } else if (toolName === 'Edit' && input?.file_path) {
    detail = `: \`${input.file_path}\``;
  } else if (toolName === 'Write' && input?.file_path) {
    detail = `: \`${input.file_path}\``;
  } else if (toolName === 'Glob' && input?.pattern) {
    detail = `: \`${input.pattern}\``;
  } else if (toolName === 'Grep' && input?.pattern) {
    detail = `: \`${input.pattern}\``;
  } else if (toolName === 'Bash' && input?.command) {
    const cmd = input.command.length > 80 ? input.command.slice(0, 80) + '...' : input.command;
    detail = `: \`${cmd}\``;
  }

  return `${label}${detail}`;
}

function buildResultStats(stats) {
  const parts = [
    formatDuration(stats.durationMs),
    `${stats.outputTokens} tokens out`,
    formatCost(stats.costUsd),
  ];
  if (stats.numTurns > 1) {
    parts.push(`${stats.numTurns} turns`);
  }
  return `-# ${parts.join(' | ')}`;
}

function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    https.get(url, (response) => {
      response.pipe(file);
      file.on('finish', () => { file.close(); resolve(); });
    }).on('error', (err) => {
      fs.unlink(destPath, () => {});
      reject(err);
    });
  });
}

async function processAttachments(message) {
  if (message.attachments.size === 0) return '';

  const parts = [];

  for (const [, attachment] of message.attachments) {
    const ext = path.extname(attachment.name).toLowerCase();
    const isImage = ['.png', '.jpg', '.jpeg', '.gif', '.webp'].includes(ext);

    const tempDir = path.join(os.tmpdir(), 'discord-claude');
    fs.mkdirSync(tempDir, { recursive: true });
    const tempPath = path.join(tempDir, `${Date.now()}-${attachment.name}`);
    await downloadFile(attachment.url, tempPath);

    if (isImage) {
      parts.push(`[Attached image: ${tempPath}]`);
    } else {
      parts.push(`[Attached file saved to: ${tempPath}]`);
    }
  }

  return parts.join('\n');
}

async function handleMainChannel(message) {
  const alias = message.content.trim().toLowerCase();

  if (!aliases[alias]) {
    const available = Object.keys(aliases).map(a => `\`${a}\``).join(', ');
    await message.reply(`Neznamy alias **"${alias}"**. Dostupne: ${available}`);
    return;
  }

  const cwd = aliases[alias];
  const now = new Date();
  const timestamp = now.toISOString().slice(0, 16).replace('T', ' ');
  const threadName = `${alias} - ${timestamp}`;

  const thread = await message.startThread({
    name: threadName,
    autoArchiveDuration: 1440,
  });

  sessionManager.create(thread.id, alias, cwd);

  await thread.send(`Session vytvorena pre **${alias}** (\`${cwd}\`)\nPis sem svoje spravy pre Claude.\nPrikazy: \`!kill\` \`!cost\` \`!compact\``);

  if (_refreshAliasList) await _refreshAliasList();
}

async function handleThread(message) {
  const threadId = message.channel.id;
  const channel = message.channel;

  if (message.content.trim() === '!kill') {
    const stats = sessionManager.getStats(threadId);
    const killed = sessionManager.kill(threadId);
    if (killed) {
      const summary = buildSessionSummary(stats);
      await channel.send(summary);
      await channel.setArchived(true);
      if (_refreshAliasList) await _refreshAliasList();
    }
    return;
  }

  if (message.content.trim() === '!cost') {
    const stats = sessionManager.getStats(threadId);
    if (stats) {
      const duration = formatDuration(Date.now() - stats.createdAt);
      await channel.send(
        `-# **Naklady:** ${formatCost(stats.totalCostUsd)} | **Tokeny:** ${stats.totalTokensIn.toLocaleString()} in / ${stats.totalTokensOut.toLocaleString()} out | **Sprav:** ${stats.totalMessages} | **Cas:** ${duration}`
      );
    }
    return;
  }

  if (message.content.trim() === '!compact') {
    if (!sessionManager.has(threadId)) return;

    await channel.sendTyping();
    const typingInterval = setInterval(() => {
      channel.sendTyping().catch(() => {});
    }, 8000);

    try {
      const result = await sessionManager.sendMessage(threadId, '/compact', {});
      clearInterval(typingInterval);
      await channel.send(result || 'Kontext kompaktovany.');
    } catch (err) {
      clearInterval(typingInterval);
      await channel.send(`Chyba pri kompaktovani: ${err.message}`);
    }
    return;
  }

  if (!sessionManager.has(threadId)) return;

  // Send queue - ensures messages arrive in order
  let sendQueue = Promise.resolve();
  function queueSend(content) {
    sendQueue = sendQueue.then(async () => {
      try {
        await channel.send(content);
      } catch (err) {
        log(`[MH] Send error: ${err.message}`);
      }
    });
  }

  let resultStats = null;
  let lastSentText = '';

  // Task 8: React with hourglass
  await message.react('\u23F3').catch(() => {});

  // Show typing
  await channel.sendTyping();
  const typingInterval = setInterval(() => {
    channel.sendTyping().catch(() => {});
  }, 8000);

  // Task 9: Long processing notification
  const LONG_PROCESSING_MS = 120000;
  const progressTimer = setTimeout(async () => {
    await channel.send('-# \u23F3 Stale pracujem... (> 2 min)').catch(() => {});
  }, LONG_PROCESSING_MS);

  try {
    const callbacks = {
      onToolUse: (toolName, input) => {
        const desc = toolDescription(toolName, input);
        queueSend(`-# > ${desc}`);
      },
      onText: (fullText) => {
        // Only send new text that wasn't sent yet
        if (fullText === lastSentText) return;

        // Find new content
        const newText = fullText.startsWith(lastSentText)
          ? fullText.slice(lastSentText.length).trimStart()
          : fullText;

        if (!newText) return;

        const chunks = splitMessage(newText);
        for (const chunk of chunks) {
          queueSend(chunk);
        }
        lastSentText = fullText;
      },
      onResult: (stats) => {
        resultStats = stats;
      },
    };

    // Task 10: Process attachments
    const attachmentText = await processAttachments(message);
    const fullText = attachmentText
      ? `${message.content}\n\n${attachmentText}`
      : message.content;

    const finalText = await sessionManager.sendMessage(threadId, fullText, callbacks);

    clearInterval(typingInterval);
    clearTimeout(progressTimer);

    // Wait for all queued messages to finish
    await sendQueue;

    // Send any remaining text that wasn't streamed
    if (finalText && finalText !== lastSentText) {
      const newText = finalText.startsWith(lastSentText)
        ? finalText.slice(lastSentText.length).trimStart()
        : finalText;

      if (newText) {
        const chunks = splitMessage(newText);
        for (const chunk of chunks) {
          await channel.send(chunk);
        }
      }
    }

    // Send stats
    if (resultStats) {
      await channel.send(buildResultStats(resultStats));
    }

    // Task 8: Success reactions
    await message.reactions.cache.get('\u23F3')?.users.remove(message.client.user.id).catch(() => {});
    await message.react('\u2705').catch(() => {});

    log(`[MH] Done, ${finalText?.length || 0} chars`);
  } catch (err) {
    clearInterval(typingInterval);
    clearTimeout(progressTimer);
    await sendQueue;
    log(`[MH] Error: ${err.message}`);
    await channel.send(`Chyba: ${err.message}`);

    // Task 8: Error reactions
    await message.reactions.cache.get('\u23F3')?.users.remove(message.client.user.id).catch(() => {});
    await message.react('\u274C').catch(() => {});
  }
}

async function handleMessage(message) {
  if (message.author.bot) return;
  if (!isAllowed(message.author.id)) return;

  if (message.channel.id === channelId && message.channel.type === ChannelType.GuildText) {
    await handleMainChannel(message);
    return;
  }

  if (message.channel.isThread() && message.channel.parentId === channelId) {
    await handleThread(message);
    return;
  }
}

let _refreshAliasList = null;
function onSessionChange(callback) {
  _refreshAliasList = callback;
}

function buildSessionSummary(stats) {
  if (!stats) return 'Session ukoncena.';

  const duration = formatDuration(Date.now() - stats.createdAt);
  const lines = [
    `**Projekt:** ${stats.alias} (\`${stats.cwd}\`)`,
    `**Trvanie:** ${duration}`,
    `**Sprav:** ${stats.totalMessages}`,
    `**Tokeny:** ${stats.totalTokensIn.toLocaleString()} in / ${stats.totalTokensOut.toLocaleString()} out`,
    `**Naklady:** ${formatCost(stats.totalCostUsd)}`,
    `**Turns:** ${stats.totalTurns}`,
  ];

  return {
    embeds: [{
      title: 'Session ukoncena - Suhrn',
      description: lines.join('\n'),
      color: 0xef4444,
      timestamp: new Date().toISOString(),
    }],
  };
}

async function handleChatCommand(interaction, alias) {
  if (!aliases[alias]) {
    await interaction.reply({ content: `Neznamy alias **"${alias}"**.`, ephemeral: true });
    return;
  }

  const cwd = aliases[alias];
  const now = new Date();
  const timestamp = now.toISOString().slice(0, 16).replace('T', ' ');
  const threadName = `${alias} - ${timestamp}`;

  await interaction.deferReply();

  const channel = interaction.channel;
  const thread = await channel.threads.create({
    name: threadName,
    autoArchiveDuration: 1440,
  });

  sessionManager.create(thread.id, alias, cwd);

  await thread.send(`Session vytvorena pre **${alias}** (\`${cwd}\`)\nPis sem svoje spravy pre Claude.\nPrikazy: \`!kill\` \`!cost\` \`!compact\``);
  await interaction.editReply(`Session vytvorena: ${thread}`);

  if (_refreshAliasList) await _refreshAliasList();
}

async function handleSessionsCommand(interaction) {
  const sessions = sessionManager.getActiveSessions();

  if (sessions.length === 0) {
    await interaction.reply({ content: 'Ziadne aktivne sessions.', ephemeral: true });
    return;
  }

  const lines = sessions.map(s => {
    const stats = sessionManager.getStats(s.threadId);
    const age = formatDuration(Date.now() - s.createdAt);
    const cost = formatCost(stats?.totalCostUsd || 0);
    return `**${s.alias}** — ${age} — ${stats?.totalMessages || 0} sprav — ${cost} — <#${s.threadId}>`;
  });

  await interaction.reply({
    embeds: [{
      title: 'Aktivne sessions',
      description: lines.join('\n'),
      color: 0x7c3aed,
      footer: { text: `Celkom: ${sessions.length}` },
    }],
    ephemeral: true,
  });
}

async function handleKillCommand(interaction) {
  const threadId = interaction.channel.id;

  if (!interaction.channel.isThread()) {
    await interaction.reply({ content: 'Tento prikaz funguje len v session threade.', ephemeral: true });
    return;
  }

  const stats = sessionManager.getStats(threadId);
  const killed = sessionManager.kill(threadId);

  if (!killed) {
    await interaction.reply({ content: 'V tomto threade nie je aktivna session.', ephemeral: true });
    return;
  }

  const summary = buildSessionSummary(stats);
  await interaction.reply(summary);
  await interaction.channel.setArchived(true);
  if (_refreshAliasList) await _refreshAliasList();
}

async function handleInteraction(interaction) {
  if (!interaction.isChatInputCommand()) return;
  if (!isAllowed(interaction.user.id)) {
    await interaction.reply({ content: 'Nemas pristup.', ephemeral: true });
    return;
  }

  const { commandName } = interaction;

  if (commandName === 'chat') {
    const alias = interaction.options.getString('projekt');
    await handleChatCommand(interaction, alias);
  } else if (commandName === 'sessions') {
    await handleSessionsCommand(interaction);
  } else if (commandName === 'kill') {
    await handleKillCommand(interaction);
  }
}

module.exports = { handleMessage, handleInteraction, onSessionChange, buildSessionSummary };
