import express from 'express';
import fs from 'fs';
import bodyParser from 'body-parser';
import { Client, GatewayIntentBits, Partials } from 'discord.js';
import dotenv from 'dotenv';
dotenv.config();

const app = express();
const PORT = 5000;
const HOST = '0.0.0.0';

app.use(bodyParser.json());
app.use(express.static('public'));

// Load orders or initialize empty array
let orders = [];
if (fs.existsSync('orders.json')) orders = JSON.parse(fs.readFileSync('orders.json'));

// Discord bot (optional - only connects if BOT_TOKEN is provided)
let client = null;
let botReady = false;
if (process.env.BOT_TOKEN) {
  client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.DirectMessages, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
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
    console.log(`Bot logged in as ${client.user.tag}`);
    botReady = true;
  });
  
  // Listen for DM replies from users
  const ORDERS_CHANNEL_ID = process.env.ORDERS_CHANNEL_ID || '';
  client.on('messageCreate', async (message) => {
    // Only handle DMs (not from bots)
    if (message.author.bot) return;
    if (message.guild) return; // Skip if it's in a server
    
    // This is a DM - forward it to the orders channel
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
          await message.reply('Your message has been received! We\'ll get back to you soon.');
        }
      } catch (err) {
        console.error('Failed to forward DM:', err.message);
      }
    }
  });
  
  // !reply command handler
  client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (!message.guild) return; // Skip DMs - handled above
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
      
      // Check if it's a mention like <@123456789>
      const mentionMatch = userIdentifier.match(/^<@!?(\d+)>$/);
      if (mentionMatch) {
        user = await client.users.fetch(mentionMatch[1]).catch(() => null);
      }
      // Check if it's a raw user ID (all digits)
      else if (/^\d+$/.test(userIdentifier)) {
        user = await client.users.fetch(userIdentifier).catch(() => null);
      }
      // Try to find by username (without #)
      else {
        user = client.users.cache.find(u => u.username.toLowerCase() === userIdentifier.toLowerCase());
      }
      
      if (!user) {
        return message.reply(`User not found. Try using their User ID or @mention them.`);
      }
      
      await user.send(`Reply from MyDadsSoft's Recoverys: ${replyMessage}`);
      message.reply(`Message sent to ${user.username}`);
    } catch (err) {
      console.error(err);
      message.reply('Failed to send message. Make sure the user allows DMs.');
    }
  });
} else {
  console.log('BOT_TOKEN not provided - Discord bot features disabled');
}

// Save orders to JSON
function saveOrders() {
  fs.writeFileSync('orders.json', JSON.stringify(orders, null, 2));
}

// API endpoint to place order
app.post('/api/order', (req, res) => {
  const { name, email, discord, packageSelected, currency } = req.body;
  const order = { id: Date.now(), name, email, discord, packageSelected, currency, replied: false };
  orders.push(order);
  saveOrders();
  res.json({ success: true, message: 'Order received!' });
});

// API endpoint to get orders
app.get('/api/orders', (req, res) => {
  res.json(orders);
});

// API endpoint to reply to user via bot
app.post('/api/reply', async (req, res) => {
  if (!client || !botReady) {
    return res.status(503).json({ success: false, message: 'Discord bot not available. Check BOT_TOKEN and bot configuration.' });
  }
  
  const { orderId, message } = req.body;
  const order = orders.find(o => o.id === orderId);
  if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

  try {
    const user = client.users.cache.find(u => u.tag === order.discord);
    if (!user) return res.status(404).json({ success: false, message: 'Discord user not found in cache.' });

    await user.send(`Reply from MyDadsSoft's Recoverys: ${message}`);
    order.replied = true;
    saveOrders();
    res.json({ success: true, message: 'Message sent!' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to send DM. User may not allow DMs.' });
  }
});

app.listen(PORT, HOST, () => console.log(`Server running at http://${HOST}:${PORT}`));
