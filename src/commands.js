const { SlashCommandBuilder } = require('discord.js');

function buildCommands(aliases) {
  const aliasChoices = Object.keys(aliases).map(a => ({ name: a, value: a }));

  const chat = new SlashCommandBuilder()
    .setName('chat')
    .setDescription('Vytvor novu Claude session')
    .addStringOption(opt =>
      opt.setName('projekt')
        .setDescription('Alias projektu')
        .setRequired(true)
        .addChoices(...aliasChoices)
    );

  const sessions = new SlashCommandBuilder()
    .setName('sessions')
    .setDescription('Zobraz aktivne sessions');

  const kill = new SlashCommandBuilder()
    .setName('kill')
    .setDescription('Ukonci session v tomto threade');

  return [chat, sessions, kill];
}

module.exports = { buildCommands };
