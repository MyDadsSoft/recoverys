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

// ---------- DATA HANDLING ----------
const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);

const ordersPath = path.join(dataDir, 'orders.json');
const reviewsPath = path.join(dataDir, 'reviews.json');

let orders = [];
if (fs.existsSync(ordersPath)) {
  try {
    orders = JSON.parse(fs.readFileSync(ordersPath));
  } catch (err) {
    console.error('Failed to parse orders.json', err);
    orders = [];
  }
}

let reviews = [];
if (fs.existsSync(reviewsPath)) {
  try {
    reviews = JSON.parse(fs.readFileSync(reviewsPath));
  } catch (err) {
    console.error('Failed to parse reviews.json', err);
    reviews = [];
  }
}

function saveOrders() {
  try {
    fs.writeFileSync(ordersPath, JSON.stringify(orders, null, 2));
  } catch (err) {
    console.error('Failed to save orders.json', err);
  }
}

function saveReviews() {
  try {
    fs.writeFileSync(reviewsPath, JSON.stringify(reviews, null, 2));
  } catch (err) {
    console.error('Failed to save reviews.json', err);
  }
}

function sanitize(text, max) {
  if (typeof text !== 'string') return '';
  return text.trim().slice(0, max).replace(/[<>]/g, '');
}

// ---------- DISCORD BOT ----------
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
    partials: [Partials.Channel]
  });

  client.login(process.env.BOT_TOKEN).catch(err => console.error(err));
  client.once('ready', () => {
    console.log(`Bot logged in as ${client.user.tag}`);
    botReady = true;
  });

  const ORDERS_CHANNEL_ID = process.env.ORDERS_CHANNEL_ID || '';

  client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    // Forward DMs
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
      return;
    }

    // Handle !reply in orders channel
    if (message.guild && message.channel.id === ORDERS_CHANNEL_ID) {
      const [command, userId, ...msgParts] = message.content.trim().split(' ');
      if (command !== '!reply') return;
      const replyMessage = msgParts.join(' ');
      if (!userId || !replyMessage) return message.reply('Usage: !reply <UserID> Your message');

      try {
        const user = await client.users.fetch(userId).catch(() => null);
        if (!user) return message.reply('User not found.');

        await user.send(`Reply from MyDadsSoft Recoverys: ${replyMessage}`);

        const order = orders.find(o => o.discord === userId && !o.replied);
        if (order) {
          order.replied = true;
          saveOrders();
        }

        message.reply(`Message sent to ${user.tag}`);
      } catch (err) {
        console.error(err);
        message.reply('Failed to send message. User may not allow DMs.');
      }
    }
  });
} else {
  console.log('BOT_TOKEN not provided, Discord features disabled');
}

// ---------- PRICE LIST ----------
const pricesUSD = {
  'Modded Heists': 20,
  'RP Boost': 10,
  'All Unlocks': 25
};

const currencyRates = {
  USD: 1,
  EUR: 0.95,
  GBP: 0.82
};

// ---------- ORDERS API ----------
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

  if (client && botReady && process.env.ORDERS_CHANNEL_ID) {
    try {
      const channel = await client.channels.fetch(process.env.ORDERS_CHANNEL_ID);
      if (channel) {
        await channel.send({
          embeds: [{
            title: 'New Order Received',
            color: 0x39ff14,
            fields: [
              { name: 'Name', value: name, inline: true },
              { name: 'Email', value: email, inline: true },
              { name: 'Discord ID', value: discord, inline: true },
              { name: 'Package', value: packageSelected, inline: true },
              { name: 'Price', value: `${convertedPrice} ${currency}`, inline: true },
              { name: 'Order ID', value: `${order.id}`, inline: true }
            ],
            timestamp: new Date().toISOString()
          }]
        });
      }
    } catch (err) {
      console.error('Failed to send order to Discord channel:', err);
    }
  }

  res.json({ success: true, message: `Order received! Total: ${convertedPrice} ${currency}` });
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

// ---------- REVIEWS API ----------
app.get('/api/reviews', (_req, res) => {
  res.json([...reviews].reverse().slice(0, 50));
});

app.post('/api/reviews', (req, res) => {
  const name = sanitize(req.body.name, 40);
  const comment = sanitize(req.body.comment, 800);
  const rating = Number(req.body.rating);

  if (!name || !comment || !Number.isInteger(rating) || rating < 1 || rating > 5) {
    return res.status(400).json({ error: "Invalid review data" });
  }

  const review = {
    id: Date.now(),
    name,
    rating,
    comment,
    created_at: new Date().toISOString()
  };

  reviews.push(review);
  saveReviews();

  res.status(201).json({ ok: true });
});

// ---------- HEALTH CHECK ----------
app.get('/', (_req, res) => res.send('Recoverys API is running'));

// ---------- START SERVER ----------
app.listen(PORT, HOST, () => console.log(`Server running at http://${HOST}:${PORT}`));
