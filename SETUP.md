# 🚀 Setup Guide - WhatsApp Sales Bot

## Prerequisites

- Node.js 18+ installed
- WhatsApp Business API access
- OpenAI API key

## Step 1: Configure Environment Variables

Edit the `.env` file with your credentials:

```bash
# Required
OPENAI_API_KEY=sk-your-openai-key-here
ACCESS_TOKEN=your_whatsapp_business_access_token
VERIFY_TOKEN=your_custom_webhook_verify_token
PHONE_NUMBER_ID=your_whatsapp_phone_number_id
MY_PHONE_NUMBER=your_business_whatsapp_number

# Optional - Salespeople
GABRIEL_PHONE=5548991234567
MIRIAM_PHONE=5548997654321
LETICIA_PHONE=5548995555555
```

### Where to get credentials:

1. **OpenAI API Key**: https://platform.openai.com/api-keys
2. **WhatsApp Business API**: https://business.facebook.com/
   - Go to Meta Business Suite → WhatsApp → API Setup
   - Get your `ACCESS_TOKEN` and `PHONE_NUMBER_ID`
3. **VERIFY_TOKEN**: Create your own random string (e.g., "my_secret_verify_token_2024")

## Step 2: Start the Server

```bash
# Development mode (with hot reload)
npm run dev

# Production mode
npm run build
npm start
```

The server will start on http://localhost:3000

## Step 3: Setup Webhook

### For Local Development (using ngrok):

```bash
# Install ngrok
brew install ngrok  # macOS
# or download from https://ngrok.com/

# Start ngrok tunnel
ngrok http 3000
```

Copy the HTTPS URL (e.g., `https://abc123.ngrok.io`)

### Configure Webhook in Meta:

1. Go to https://developers.facebook.com/apps/
2. Select your app → WhatsApp → Configuration
3. Edit webhook:
   - Callback URL: `https://your-domain.com/` or `https://abc123.ngrok.io/`
   - Verify Token: (same as your `VERIFY_TOKEN` in .env)
   - Subscribe to: `messages`
4. Click "Verify and Save"

## Step 4: Test the Bot

Send a message to your WhatsApp Business number:

```
Vendi 3 kits pro mercado do fernando, 40 reais
```

The bot should respond asking for confirmation!

## Common Commands

### View Database
```bash
npm run db:studio
```

### Check Database
```bash
sqlite3 prisma/dev.db ".tables"
```

### Rebuild Database (CAUTION - deletes data)
```bash
rm prisma/dev.db
npm run db:migrate
```

## Troubleshooting

### Bot not responding?
1. Check server logs for errors
2. Verify webhook is receiving messages (check terminal)
3. Ensure OpenAI API key is valid
4. Check WhatsApp Business API token hasn't expired

### "Webhook verification failed"?
- Ensure `VERIFY_TOKEN` in `.env` matches the one in Meta dashboard

### TypeScript errors?
```bash
npm run build
```

### Database errors?
```bash
npx prisma generate
npx prisma migrate dev
```

## Production Deployment

### Deploy to a VPS or Cloud Platform:

1. **Environment Variables**: Set all required vars on your hosting platform
2. **Database**: Consider PostgreSQL instead of SQLite for production
3. **Process Manager**: Use PM2 or similar
   ```bash
   npm install -g pm2
   pm2 start dist/index.js --name whatsapp-bot
   ```
4. **HTTPS**: Ensure your webhook URL uses HTTPS (required by WhatsApp)

## Usage Examples

### Record a Sale
```
"Vendi 3 kits pro mercado do fernando, 40 reais"
"A Miriam vendeu 5 kits pra dona maria, 65 reais"
```

### List Sales
```
"Minhas vendas"
"Vendas dessa semana"
"Quanto a Letícia vendeu hoje?"
```

### Update Sale
```
"Na verdade não foi Fernando, foi Pedro"
```

### Delete Sale
```
"Remove venda 44"
"Apaga a última venda"
```

### Customer Info
```
"Qual endereço do mercado fernando?"
```

## Support

For issues or questions, check the logs:
```bash
# View real-time logs
npm run dev

# Or in production with PM2
pm2 logs whatsapp-bot
```

