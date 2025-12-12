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
  console.log('Received order POST:', req.body); // << Add this
  const { name, email, discord, packageSelected, currency } = req.body;
  if (!name || !email || !discord || !packageSelected || !currency) {
    console.log('Missing fields in order:', req.body);
    return res.status(400).json({ success: false, message: 'Missing required fields' });
  }
  const order = { id: Date.now(), name, email, discord, packageSelected, currency, replied: false };
  orders.push(order);
  saveOrders();
  console.log('Order saved:', order);
  res.json({ success: true, message: 'Order received!' });
});


app.get('/api/orders', (req, res) => res.json(orders));

// Start server
app.listen(PORT, HOST, () => console.log(`Server running at http://${HOST}:${PORT}`));
