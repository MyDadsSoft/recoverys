import { Client, GatewayIntentBits } from 'discord.js';
import dotenv from 'dotenv';
dotenv.config();

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

// 🔒 ALLOWED ROLES
const ALLOWED_ROLE_IDS = [
  '1449172692820557825',
  '1449172692820557824',
];

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName !== 'reply') return;

  // 🔒 ROLE CHECK
  const memberRoles = interaction.member.roles.cache;

  const hasPermission = ALLOWED_ROLE_IDS.some(roleId =>
    memberRoles.has(roleId)
  );

  if (!hasPermission) {
    return interaction.reply({
      content: '❌ You do not have permission to use this command.',
      ephemeral: true,
    });
  }

  const user = interaction.options.getUser('user');
  const message = interaction.options.getString('message');

  try {
    await user.send(`📩 **Reply from MyDadsSoft Recoverys:**\n${message}`);
    await interaction.reply({
      content: `✅ Message sent to **${user.username}**`,
      ephemeral: true,
    });
  } catch (err) {
    console.error(err);
    await interaction.reply({
      content: '❌ Failed to send DM (user may have DMs disabled).',
      ephemeral: true,
    });
  }
});

client.login(process.env.BOT_TOKEN);
