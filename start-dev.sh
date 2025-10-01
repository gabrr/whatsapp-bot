#!/bin/bash

# WhatsApp Sales Bot - Development Startup Script

echo "🤖 Starting WhatsApp Sales Bot..."
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "⚠️  .env file not found!"
    echo "Creating .env from template..."
    cp .env.example .env
    echo ""
    echo "⚠️  IMPORTANT: Edit .env file with your credentials:"
    echo "   - OPENAI_API_KEY"
    echo "   - ACCESS_TOKEN"
    echo "   - PHONE_NUMBER_ID"
    echo ""
    exit 1
fi

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    echo ""
fi

# Check if database exists
if [ ! -f "prisma/dev.db" ]; then
    echo "🗄️  Creating database..."
    npx prisma generate
    npx prisma migrate dev --name init
    echo ""
fi

# Start the development server
echo "✅ Starting development server..."
echo "📍 Server will run on http://localhost:3000"
echo ""
echo "💡 To test locally with WhatsApp:"
echo "   1. In another terminal, run: ngrok http 3000"
echo "   2. Copy the HTTPS URL from ngrok"
echo "   3. Set it as your webhook in Meta Business Suite"
echo ""
npm run dev

