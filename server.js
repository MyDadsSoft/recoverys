import express from 'express';
import fs from 'fs';
import bodyParser from 'body-parser';
import cors from 'cors';
import { Client, GatewayIntentBits, Partials } from 'discord.js';
import dotenv from 'dotenv';
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const HOST = '0.0.0.0';

// CORS so Cloudflare Pages can call your API
app.use(cors());
app.use(bodyParser.json());

// Serve static frontend (optional if hosting frontend on Render)
app.use(express.static('frontend'));

// Orders file path on Render
const ordersPath = '/tmp/orders.json';

// Load orders
let orders = [];
if (fs.existsSync(ordersPath)) {
  try {
    orders = JSON.parse(fs.readFileSync(ordersPath));
  } catch {
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

if (process.env.BOT_TOKEN) {
  client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.DirectMessages,
      GatewayIntentBits.MessageContent,
    ],
    partials: [Partials.Channel],
  });

  client.login(process.env.BOT_TOKEN).catch((err) => console.error(err));

  client.once('ready', () => {
    console.log(`Bot logged in as ${client.user.tag}`);
    botReady = true;
  });

  const ORDERS_CHANNEL_ID = process.env.ORDERS_CHANNEL_ID || '';

  // Forward DMs to orders channel
  client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (message.guild) return;

    if (ORDERS_CHANNEL_ID) {
      try {
        const channel = await client.channels.fetch(ORDERS_CHANNEL_ID);
        if (channel) {
          await channel.send({
            embeds: [
              {
                title: 'New DM Received',
                color: 0x39ff14,
                fields: [
                  { name: 'From', value: `${message.author.tag} (${message.author.id})`, inline: true },
                  { name: 'Message', value: message.content || '*No text content*' },
                ],
                timestamp: new Date().toISOString(),
              },
            ],
          });
          await message.reply('Your message has been received! We will get back to you soon.');
        }
      } catch (err) {
        console.error('Failed to forward DM:', err.message);
      }
    }
  });

  // !reply command in orders channel
  client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (!message.guild) return;
    if (ORDERS_CHANNEL_ID && message.channel.id !== ORDERS_CHANNEL_ID) return;
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
  console.log('BOT_TOKEN not provided, Discord features disabled');
}

// API endpoints
app.post('/api/order', (req, res) => {
  const { name, email, discord, packageSelected, currency } = req.body;

  if (!name || !email || !discord || !packageSelected || !currency) {
    return res.status(400).json({ success: false, message: 'Missing fields.' });
  }

  const order = { id: Date.now(), name, email, discord, packageSelected, currency, replied: false };
  orders.push(order);
  saveOrders();

  res.json({ success: true, message: 'Order received!' });
});

app.get('/api/orders', (req, res) => res.json(orders));

app.post('/api/reply', async (req, res) => {
  if (!client || !botReady) return res.status(503).json({ success: false, message: 'Discord bot unavailable.' });

  const { orderId, message } = req.body;
  const order = orders.find((o) => o.id === orderId);
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
