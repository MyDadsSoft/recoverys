import { Client, GatewayIntentBits, Partials } from 'discord.js';
import dotenv from 'dotenv';
dotenv.config();

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.DirectMessages, GatewayIntentBits.MessageContent],
  partials: [Partials.Channel],
});

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

// Example: listen to !reply command in Discord
// Command format: !reply User#1234 Your message here
const ORDERS_CHANNEL_ID = 'YOUR_PRIVATE_CHANNEL_ID_HERE';

client.on('messageCreate', async (message) => {
  if (message.channel.id !== ORDERS_CHANNEL_ID) return;
  if (!message.content.startsWith('!reply')) return;

  const args = message.content.slice(6).trim().split(' ');
  const userTag = args.shift();
  const replyMessage = args.join(' ');

  try {
    const user = client.users.cache.find(u => u.tag === userTag);
    if (!user) return message.reply(`User ${userTag} not found.`);
    await user.send(`Reply from MyDadsSoft's Recoverys: ${replyMessage}`);
    message.reply(`✅ Message sent to ${userTag}`);
  } catch (err) {
    console.error(err);
    message.reply('❌ Failed to send message. Make sure the user allows DMs.');
  }
});

client.login(process.env.BOT_TOKEN);
