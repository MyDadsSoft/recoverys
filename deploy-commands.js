import { REST, Routes, SlashCommandBuilder } from 'discord.js';
import dotenv from 'dotenv';
dotenv.config();

const command = new SlashCommandBuilder()
  .setName('reply')
  .setDescription('Reply to a user via DM')
  .addUserOption(o =>
    o.setName('user').setDescription('User to DM').setRequired(true)
  )
  .addStringOption(o =>
    o.setName('message').setDescription('Message to send').setRequired(true)
  );

const rest = new REST({ version: '10' }).setToken(process.env.BOT_TOKEN);

(async () => {
  await rest.put(
    Routes.applicationGuildCommands(
      process.env.CLIENT_ID,
      process.env.GUILD_ID
    ),
    { body: [command.toJSON()] }
  );

  console.log('✅ /reply registered instantly');
})();
