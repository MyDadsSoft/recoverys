import express from 'express';
import fs from 'fs';
import path from 'path';
import bodyParser from 'body-parser';
import { Client, GatewayIntentBits, Partials } from 'discord.js';
import dotenv from 'dotenv';
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const HOST = '0.0.0.0';

// Serve your frontend folder
app.use(express.static(path.join(process.cwd(), 'frontend')));
app.use(bodyParser.json());

// Orders JSON path
const ordersPath = path.join(process.cwd(), 'orders.json');

// Load orders
let orders = [];
if (fs.existsSync(ordersPath)) {
  try {
    orders = JSON.parse(fs.readFileSync(ordersPath));
  } catch (err) {
    console.error('Failed to parse orders.json', err);
    orders = [];
  }
}

// Save orders
function saveOrders() {
  try {
    fs.writeFileSync(ordersPath, JSON.stringify(orders, null, 2));
  } catch (err) {
    console.error('Failed to save orders.json', err);
  }
}

// Discord Bot
let client = null;
let botReady = false;

if (process.env.BOT_TOKEN && process.env.ORDERS_CHANNEL_ID) {
  client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.DirectMessages,
      GatewayIntentBits.MessageContent
    ],
    partials: [Partials.Channel]
  });

  client.once('ready', () => {
    console.log(`Bot logged in as ${client.user.tag}`);
    botReady = true;
  });

  client.login(process.env.BOT_TOKEN).catch(err => console.error('Discord login error:', err));

  const ORDERS_CHANNEL_ID = process.env.ORDERS_CHANNEL_ID;

  // Forward new orders to Discord channel
  async function sendOrderToDiscord(order) {
    if (!botReady) return;
    try {
      const channel = await client.channels.fetch(ORDERS_CHANNEL_ID);
      if (!channel) {
        console.error('Orders channel not found');
        return;
      }

      await channel.send({
        embeds: [
          {
            title: 'New Order Received',
            color: 0x39ff14,
            fields: [
              { name: 'Name', value: order.name, inline: true },
              { name: 'Email', value: order.email, inline: true },
              { name: 'Discord ID', value: order.discord, inline: true },
              { name: 'Package', value: order.packageSelected, inline: true },
              { name: 'Currency', value: order.currency, inline: true }
            ],
            timestamp: new Date().toISOString()
          }
        ]
      });
    } catch (err) {
      console.error('Failed to send order to Discord:', err);
    }
  }

  // Reply command
  client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (!message.guild) return;
    if (message.channel.id !== ORDERS_CHANNEL_ID) return;
    if (!message.content.startsWith('!reply')) return;

    const args = message.content.slice(7).trim().split(' ');
    const userId = args.shift();
    const replyMessage = args.join(' ');

    if (!userId || !replyMessage) return message.reply('Usage: !reply <UserID> Your message');

    try {
      const user = await client.users.fetch(userId).catch(() => null);
      if (!user) return message.reply('User not found.');
      await user.send(`Reply from MyDadsSoft Recoverys: ${replyMessage}`);
      message.reply(`Message sent to ${user.tag}`);
    } catch (err) {
      console.error(err);
      message.reply('Failed to send message. User may not allow DMs.');
    }
  });
} else {
  console.log('BOT_TOKEN or ORDERS_CHANNEL_ID missing, Discord features disabled');
}

// API endpoints
app.post('/api/order', async (req, res) => {
  const { name, email, discord, packageSelected, currency } = req.body;

  if (!name || !email || !discord || !packageSelected || !currency) {
    return res.status(400).json({ success: false, message: 'Missing required fields' });
  }

  const order = {
    id: Date.now(),
    name,
    email,
    discord,
    packageSelected,
    currency,
    replied: false
  };
  orders.push(order);
  saveOrders();

  // Send to Discord if possible
  if (client && botReady) {
    await sendOrderToDiscord(order);
  }

  res.json({ success: true, message: 'Order received!' });
});

app.get('/api/orders', (req, res) => res.json(orders));

app.post('/api/reply', async (req, res) => {
  if (!client || !botReady) return res.status(503).json({ success: false, message: 'Discord bot unavailable.' });

  const { orderId, message } = req.body;
  const order = orders.find(o => o.id === orderId);
  if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

  try {
    const user = await client.users.fetch(order.discord).catch(() => null);
    if (!user) return res.status(404).json({ success: false, message: 'Discord user not found' });

    await user.send(`Reply from MyDadsSoft Recoverys: ${message}`);
    order.replied = true;
    saveOrders();
    res.json({ success: true, message: 'Message sent!' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to send DM.' });
  }
});

// Start server
app.listen(PORT, HOST, () => console.log(`Server running at http://${HOST}:${PORT}`));
