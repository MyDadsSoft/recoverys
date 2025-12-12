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

// Serve frontend folder
app.use(express.static('frontend'));
app.use(bodyParser.json());

// Use absolute path for orders.json
const ordersPath = path.join(process.cwd(), 'orders.json');

// Load orders
let orders = [];
if (fs.existsSync(ordersPath)) {
  try {
    orders = JSON.parse(fs.readFileSync(ordersPath));
  } catch {
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

// Discord bot code here (keep everything the same)
// ...

// API endpoints
app.post('/api/order', (req, res) => {
  const { name, email, discord, packageSelected, currency } = req.body;
  if (!name || !email || !discord || !packageSelected || !currency) {
    return res.status(400).json({ success: false, message: 'Missing required fields' });
  }
  const order = { id: Date.now(), name, email, discord, packageSelected, currency, replied: false };
  orders.push(order);
  saveOrders();
  res.json({ success: true, message: 'Order received!' });
});

app.get('/api/orders', (req, res) => res.json(orders));

// Start server
app.listen(PORT, HOST, () => console.log(`Server running at http://${HOST}:${PORT}`));
