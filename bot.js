import { Client, GatewayIntentBits, Partials } from 'discord.js';
import dotenv from 'dotenv';
dotenv.config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [Partials.Channel],
});

const ORDERS_CHANNEL_ID = 'YOUR_PRIVATE_CHANNEL_ID_HERE';
const PREFIX = '!reply';

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
  // Ignore bots & webhooks
  if (message.author.bot || message.webhookId) return;

  // Only allow specific channel
  if (message.channel.id !== ORDERS_CHANNEL_ID) return;

  // Must start with command
  if (!message.content.startsWith(PREFIX)) return;

  const parts = message.content.trim().split(/\s+/);

  // !reply <UserID> <message>
  if (parts.length < 3) {
    return message.reply('Usage: `!reply <UserID> <Your message>`');
  }

  const userId = parts[1];
  const replyMessage = parts.slice(2).join(' ');

  try {
    const user = await client.users.fetch(userId);

    await user.send(`📩 **Reply from MyDadsSoft Recoverys:**\n${replyMessage}`);

    await message.reply(`✅ Message sent to **${user.username}**`);
  } catch (err) {
    console.error(err);
    await message.reply('❌ Failed to send DM (user may have DMs disabled or ID is wrong).');
  }
});

client.login(process.env.BOT_TOKEN);
