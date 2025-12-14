import express from 'express';
import fs from 'fs';
import path from 'path';
import bodyParser from 'body-parser';
import cors from 'cors';
import { Client, GatewayIntentBits, Partials } from 'discord.js';
import dotenv from 'dotenv';
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const HOST = '0.0.0.0';

// ---------- MIDDLEWARE ----------
app.use(bodyParser.json());
app.use(cors({ origin: '*' }));
app.use(express.static('frontend'));

// ---------- ORDERS HANDLING ----------
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

// Queue to store orders until bot is ready
let orderQueue = [];

// ---------- DISCORD BOT ----------
const BOT_TOKEN = process.env.BOT_TOKEN;
const ORDERS_CHANNEL_ID = process.env.ORDERS_CHANNEL_ID;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel]
});

let botReady = false;

if (BOT_TOKEN) {
  client.login(BOT_TOKEN).catch(err => console.error('Bot login failed:', err));

  client.once('ready', async () => {
    console.log(`Bot logged in as ${client.user.tag}`);
    botReady = true;

    // Send any queued orders
    while (orderQueue.length > 0) {
      const order = orderQueue.shift();
      await sendOrderToDiscord(order);
    }
  });

  // Forward DMs to orders channel
  client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    if (!message.guild && ORDERS_CHANNEL_ID) {
      try {
        const channel = await client.channels.fetch(ORDERS_CHANNEL_ID);
        if (channel) {
          await channel.send({
            embeds: [{
              title: 'New DM Received',
              color: 0x39ff14,
              fields: [
                { name: 'From', value: `${message.author.tag} (${message.author.id})`, inline: true },
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
} else {
  console.log('BOT_TOKEN not provided, Discord features disabled');
}

// ---------- PRICE LIST ----------
const pricesUSD = {
  'Modded Heists': 20, // same as frontend
  'RP Boost': 10,
  'All Unlocks': 40   // updated to match frontend
};


const currencyRates = {
  USD: 1,
  EUR: 0.95,
  GBP: 0.82
};

// ---------- HELPER TO SEND ORDER TO DISCORD ----------
async function sendOrderToDiscord(order) {
  if (!client || !ORDERS_CHANNEL_ID) return;

  try {
    const channel = await client.channels.fetch(ORDERS_CHANNEL_ID);
    if (!channel) throw new Error('Orders channel not found');

    await channel.send({
      embeds: [{
        title: 'New Order Received',
        color: 0x39ff14,
        fields: [
          { name: 'Name', value: order.name, inline: true },
          { name: 'Email', value: order.email, inline: true },
          { name: 'Discord ID', value: order.discord, inline: true },
          { name: 'Package', value: order.packageSelected, inline: true },
          { name: 'Price', value: `${order.price} ${order.currency}`, inline: true },
          { name: 'Order ID', value: `${order.id}`, inline: true }
        ],
        timestamp: new Date().toISOString()
      }]
    });

    console.log(`Order ${order.id} sent to Discord successfully`);
  } catch (err) {
    console.error('Failed to send order to Discord:', err);
  }
}

// ---------- API ENDPOINTS ----------
app.post('/api/order', async (req, res) => {
  const { name, email, discord, packageSelected, currency } = req.body;
  if (!name || !email || !discord || !packageSelected || !currency) {
    return res.status(400).json({ success: false, message: 'Missing fields in order.' });
  }

  const priceUSD = pricesUSD[packageSelected] || 0;
  const convertedPrice = (priceUSD * (currencyRates[currency] || 1)).toFixed(2);

  const order = {
    id: Date.now(),
    name,
    email,
    discord,
    packageSelected,
    currency,
    price: convertedPrice,
    replied: false
  };

  orders.push(order);
  saveOrders();

  console.log('Received order:', order);

  if (botReady) {
    await sendOrderToDiscord(order);
  } else {
    console.log('Bot not ready yet, queuing order');
    orderQueue.push(order);
  }

  res.json({ success: true, message: `Order received! Total: ${convertedPrice} ${currency}` });
});

app.get('/api/orders', (req, res) => res.json(orders));

app.post('/api/reply', async (req, res) => {
  const { orderId, message } = req.body;
  const order = orders.find(o => o.id === orderId);
  if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

  if (!client || !botReady) return res.status(503).json({ success: false, message: 'Discord bot unavailable.' });

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

// ---------- START SERVER ----------
app.listen(PORT, HOST, () => console.log(`Server running at http://${HOST}:${PORT}`));
