import { Client, GatewayIntentBits, Partials } from 'discord.js';
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
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel],
});

const ORDERS_CHANNEL_ID = process.env.ORDERS_CHANNEL_ID;
const ADMIN_ROLE_IDS = (process.env.ADMIN_ROLE_IDS || '').split(',');

client.on('ready', () => {
  console.log(`Bot logged in as ${client.user.tag}`);
});

// ---------- MESSAGE HANDLER ----------
client.on('messageCreate', async (message) => {
  if (message.author.bot) return; // ignore bots
  if (!message.guild || message.channel.id !== ORDERS_CHANNEL_ID) return; // only orders channel

  // Only respond to !reply commands
  if (!message.content.toLowerCase().startsWith('!reply')) return;

  // Admin role check
  if (ADMIN_ROLE_IDS.length && !message.member.roles.cache.some(r => ADMIN_ROLE_IDS.includes(r.id))) {
    return message.reply('❌ You do not have permission to use this command.');
  }

  const args = message.content.trim().split(/\s+/);
  if (args.length < 3) return message.reply('Usage: !reply <UserID> Your message');

  const userId = args[1];
  const replyMessage = args.slice(2).join(' ');

  try {
    const user = await client.users.fetch(userId).catch(() => null);
    if (!user) return message.reply('User not found.');

    await user.send(`📩 **Reply from MyDadsSoft Recoverys:**\n${replyMessage}`);

    // Mark order as replied
    const order = orders.find(o => o.discord === userId && !o.replied);
    if (order) {
      order.replied = true;
      saveOrders();
    }

    message.reply(`✅ Message sent to ${user.tag}`);
  } catch (err) {
    console.error(err);
    message.reply('❌ Failed to send DM. User may not allow DMs.');
  }
});

client.login(process.env.BOT_TOKEN);
