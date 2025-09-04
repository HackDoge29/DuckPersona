// scripts/setup-telegram-webhook.js
const axios = require('axios');
const dotenv = require('dotenv');

dotenv.config();

async function setupWebhook() {
  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const WEBHOOK_URL = process.env.WEBHOOK_URL; // Your API Gateway URL + /webhook
  
  if (!BOT_TOKEN || !WEBHOOK_URL) {
    console.error('❌ TELEGRAM_BOT_TOKEN and WEBHOOK_URL must be set in .env');
    process.exit(1);
  }

  try {
    // Set webhook
    const response = await axios.post(
      `https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`,
      {
        url: WEBHOOK_URL,
        allowed_updates: ['message', 'callback_query']
      }
    );

    if (response.data.ok) {
      console.log('✅ Telegram webhook configured successfully!');
      console.log('📍 Webhook URL:', WEBHOOK_URL);
    } else {
      console.error('❌ Failed to set webhook:', response.data);
    }

    // Get webhook info
    const info = await axios.get(
      `https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo`
    );
    
    console.log('📋 Webhook Info:', JSON.stringify(info.data.result, null, 2));
  } catch (error) {
    console.error('❌ Error setting up webhook:', error.response?.data || error.message);
  }
}

setupWebhook();
