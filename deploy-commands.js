import { REST, Routes, SlashCommandBuilder } from 'discord.js';
import dotenv from 'dotenv';
dotenv.config();

const command = new SlashCommandBuilder()
  .setName('reply')
  .setDescription('Reply to a user via DM')
  .addUserOption(option =>
    option
      .setName('user')
      .setDescription('User to DM')
      .setRequired(true)
  )
  .addStringOption(option =>
    option
      .setName('message')
      .setDescription('Message to send')
      .setRequired(true)
  );

const rest = new REST({ version: '10' }).setToken(process.env.BOT_TOKEN);

(async () => {
  try {
    console.log('Registering slash command...');
    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: [command.toJSON()] }
    );
    console.log('✅ Slash command registered');
  } catch (error) {
    console.error(error);
  }
})();
