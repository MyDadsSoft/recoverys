import {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder
} from 'discord.js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
dotenv.config();

// ---------- ORDERS DATA ----------
const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);

const ordersPath = path.join(dataDir, 'orders.json');
let orders = [];
if (fs.existsSync(ordersPath)) {
  try {
    orders = JSON.parse(fs.readFileSync(ordersPath));
  } catch (err) {
    console.error('Failed to parse orders.json', err);
    orders = [];
  }
}

function saveOrders() {
  try {
    fs.writeFileSync(ordersPath, JSON.stringify(orders, null, 2));
  } catch (err) {
    console.error('Failed to save orders.json', err);
  }
}

// ---------- DISCORD CLIENT ----------
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

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

// ---------- REGISTER SLASH COMMAND ----------
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

// ---------- BOT READY ----------
client.once('ready', async () => {
  console.log(`🤖 Logged in as ${client.user.tag}`);

  try {
    await registerCommands();
  } catch (err) {
    console.error('❌ COMMAND REGISTRATION FAILED');
    console.error(err);
  }
});

// ---------- INTERACTION HANDLER ----------
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
    
    // ✅ MARK ORDER AS REPLIED
    const order = orders.find(o => o.discord === user.id && !o.replied);
    if (order) {
      order.replied = true;
      saveOrders();
    }

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
