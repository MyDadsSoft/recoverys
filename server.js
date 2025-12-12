// server.js
import express from 'express';
import fs from 'fs';
import bodyParser from 'body-parser';
import { Client, GatewayIntentBits, Partials } from 'discord.js';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const HOST = '0.0.0.0';

// Middleware
app.use(bodyParser.json());
app.use(express.static('public')); // Serve frontend from public/

// Load or initialize orders
let orders = [];
if (fs.existsSync('orders.json')) {
  try {
    orders = JSON.parse(fs.readFileSync('orders.json'));
  } catch (err) {
    console.error('Failed to read orders.json:', err);
    orders = [];
  }
}

// Save orders safely
function saveOrders() {
  try {
    fs.writeFileSync('orders.json', JSON.stringify(orders, null, 2));
  } catch (err) {
    console.error('Failed to save orders.json', err);
  }
}

// Discord bot setup
let client = null;
let botReady = false;

if (process.env.BOT_TOKEN) {
  client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.DirectMessages,
      GatewayIntentBits.MessageContent
    ],
    partials: [Partials.Channel],
  });

  client.on('error', (err) => {
    console.error('Discord bot error:', err.message);
    botReady = false;
  });

  client.login(process.env.BOT_TOKEN).catch(err => {
    console.error('Failed to login Discord bot:', err.message);
    console.log('Server will continue without Discord bot functionality');
  });

  client.once('ready', () => {
    console.log(`Discord bot logged in as ${client.user.tag}`);
    botReady = true;
  });

  const ORDERS_CHANNEL_ID = process.env.ORDERS_CHANNEL_ID || '';

  // Forward DMs to orders channel
  client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (message.guild) return; // Skip server messages

    if (ORDERS_CHANNEL_ID) {
      try {
        const ordersChannel = await client.channels.fetch(ORDERS_CHANNEL_ID);
        if (ordersChannel) {
          await ordersChannel.send({
            embeds: [{
              title: 'New DM Received',
              color: 0x39ff14,
              fields: [
                { name: 'From', value: `${message.author.username} (${message.author.id})`, inline: true },
                { name: 'Message', value: message.content || '*No text content*' }
              ],
              timestamp: new Date().toISOString()
            }]
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
    if (!message.guild) return; // Skip DMs
    if (ORDERS_CHANNEL_ID && message.channel.id !== ORDERS_CHANNEL_ID) return;
    if (!message.content.startsWith('!reply')) return;

    const args = message.content.slice(7).trim().split(' ');
    const userIdentifier = args.shift();
    const replyMessage = args.join(' ');

    if (!userIdentifier || !replyMessage) {
      return message.reply('Usage: !reply <@user or UserID> Your message here');
    }

    try {
      let user = null;

      // Mention: <@123456789>
      const mentionMatch = userIdentifier.match(/^<@!?(\d+)>$/);
      if (mentionMatch) {
        user = await client.users.fetch(mentionMatch[1]).catch(() => null);
      }
      // Raw ID
      else if (/^\d+$/.test(userIdentifier)) {
        user = await client.users.fetch(userIdentifier).catch(() => null);
      }
      // Try username
      else {
        user = client.users.cache.find(u => u.username.toLowerCase() === userIdentifier.toLowerCase());
      }

      if (!user) return message.reply('User not found. Use their User ID or @mention them.');

      await user.send(`Reply from MyDadsSoft's Recoverys: ${replyMessage}`);
      message.reply(`Message sent to ${user.username}`);
    } catch (err) {
      console.error(err);
      message.reply('Failed to send message. The user may not allow DMs.');
    }
  });
} else {
  console.log('BOT_TOKEN not provided - Discord bot features disabled');
}

// API: Place order
app.post('/api/order', (req, res) => {
  const { name, email, discord, packageSelected, currency } = req.body;
  const order = { id: Date.now(), name, email, discord, packageSelected, currency, replied: false };
  orders.push(order);
  saveOrders();
  res.json({ success: true, message: 'Order received!' });
});

// API: Get all orders
app.get('/api/orders', (req, res) => {
  res.json(orders);
});

// API: Reply to user via bot
app.post('/api/reply', async (req, res) => {
  if (!client || !botReady) {
    return res.status(503).json({ success: false, message: 'Discord bot not available. Check BOT_TOKEN.' });
  }

  const { orderId, message } = req.body;
  const order = orders.find(o => o.id === orderId);
  if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

  try {
    // Fetch user by ID (reliable)
    const user = await client.users.fetch(order.discord).catch(() => null);
    if (!user) return res.status(404).json({ success: false, message: 'Discord user not found' });

    await user.send(`Reply from MyDadsSoft's Recoverys: ${message}`);
    order.replied = true;
    saveOrders();
    res.json({ success: true, message: 'Message sent!' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to send DM. User may not allow DMs.' });
  }
});

// Start server
app.listen(PORT, HOST, () => console.log(`Server running at http://${HOST}:${PORT}`));
