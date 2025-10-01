# 🚀 Quick Deploy Guide

## What's Already Configured

✅ SQLite database (simple, no external DB needed)  
✅ Migrations run automatically on startup  
✅ Render.yaml blueprint ready  
✅ All you need: just push and deploy!  

## Deploy to Render

### Step 1: Push Your Code

```bash
git add .
git commit -m "Ready for deployment"
git push
```

### Step 2: Create Service on Render

**Option A: Using Blueprint (Easiest)**
1. Go to https://dashboard.render.com
2. Click "New +" → "Blueprint"
3. Connect your repository
4. Click "Apply"
5. Add your environment variables (see below)
6. Done! 🎉

**Option B: Manual Setup**
1. Go to https://dashboard.render.com
2. Click "New +" → "Web Service"
3. Connect repository
4. Settings:
   - Build: `npm install && npm run build`
   - Start: `npm start`
5. **Add Persistent Disk** (IMPORTANT):
   - Name: `whatsapp-bot-data`
   - Mount: `/opt/render/project/src/data`
   - Size: 1 GB
6. Add environment variables (see below)
7. Deploy!

### Step 3: Add Environment Variables

In Render dashboard, add these:

```
NODE_ENV=production
DATABASE_URL=file:/opt/render/project/src/data/prod.db
OPENAI_API_KEY=sk-your-key-here
ACCESS_TOKEN=your-whatsapp-access-token
VERIFY_TOKEN=your-verify-token
PHONE_NUMBER_ID=729388853599569
MY_PHONE_NUMBER=5555936196535
GABRIEL_PHONE=554891075278
MIRIAM_PHONE=5548997654321
LETICIA_PHONE=5548995555555
```

### Step 4: Configure WhatsApp Webhook

1. Get your Render URL: `https://your-app.onrender.com`
2. Go to https://developers.facebook.com/apps/
3. Your App → WhatsApp → Configuration
4. Edit Webhook:
   - URL: `https://your-app.onrender.com/`
   - Verify Token: (same as VERIFY_TOKEN above)
5. Subscribe to: `messages`
6. Save!

### Step 5: Test!

Send a WhatsApp message:
```
"Vendi 3 kits pro mercado fernando, 40 reais"
```

Check logs in Render dashboard!

## What Happens on Startup

```bash
npm start →
  1. Runs migrations (creates tables if needed)
  2. Starts the server
  3. ✅ Ready to receive messages!
```

## Troubleshooting

### Check Logs
Render Dashboard → Your Service → Logs

Look for:
- ✅ "Running database migrations..."
- ✅ "Migrations completed successfully!"
- ✅ "🚀 WhatsApp Sales Bot is running!"

### If Tables Don't Exist

The new start script should show detailed migration logs. Check them!

### Database Location

Your SQLite database is stored at:
```
/opt/render/project/src/data/prod.db
```

This is on the persistent disk, so it survives restarts!

## Cost

**Free Tier:**
- Web Service: Free (with spin-down after 15 min)
- Persistent Disk: Free (1GB included)
- Total: $0/month

**Paid (No Spin-down):**
- Web Service: $7/month
- Total: $7/month

## That's It!

Your bot will:
- ✅ Auto-deploy on every git push
- ✅ Run migrations automatically
- ✅ Work perfectly on free tier!

Need help? Check the logs first! 📊

