import {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder
} from 'discord.js';
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

// 🧠 SLASH COMMAND DEFINITION
const replyCommand = new SlashCommandBuilder()
  .setName('reply')
  .setDescription('Reply to a user via DM')
  .addUserOption(o =>
    o.setName('user').setDescription('User to DM').setRequired(true)
  )
  .addStringOption(o =>
    o.setName('message').setDescription('Message to send').setRequired(true)
  );

async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(process.env.BOT_TOKEN);

  console.log('🔁 Registering /reply command...');

  await rest.put(
    Routes.applicationGuildCommands(
      process.env.CLIENT_ID,
      process.env.GUILD_ID
    ),
    { body: [replyCommand.toJSON()] }
  );

  console.log('✅ /reply registered');
}

client.once('ready', async () => {
  console.log(`🤖 Logged in as ${client.user.tag}`);

  try {
    await registerCommands();
  } catch (err) {
    console.error('❌ COMMAND REGISTRATION FAILED');
    console.error(err);
  }
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName !== 'reply') return;

  // 🔒 ROLE CHECK
  const roles = interaction.member.roles.cache;
  const allowed = ALLOWED_ROLE_IDS.some(id => roles.has(id));

  if (!allowed) {
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
  } catch {
    await interaction.reply({
      content: '❌ Failed to send DM.',
      ephemeral: true,
    });
  }
});

client.login(process.env.BOT_TOKEN);


