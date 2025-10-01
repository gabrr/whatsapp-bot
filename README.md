# WhatsApp Sales Bot 🤖

A natural language WhatsApp bot for tracking sales in Portuguese. Built with TypeScript, Express, Prisma, and OpenAI GPT-4.

## Features ✨

- 📝 **Natural Language Sales Entry** - "Vendi 3 kits pro mercado fernando, 40 reais"
- ✅ **Always Confirms Before Saving** - Safety first!
- 🔢 **Human-Friendly Sale IDs** - #44, #245 (easy to speak)
- 👥 **Customer Management** - Auto-creates customers (Person/Business)
- 🔍 **Fuzzy Matching** - Prevents duplicate customers
- 📊 **Smart Queries** - "Quanto vendi essa semana?", "Vendas da Miriam"
- 👔 **Salesperson Tracking** - Gabriel, Miriam, Letícia
- 📅 **Portuguese Date Parsing** - "hoje", "ontem", "sexta passada"
- ✏️ **Easy Updates** - "na verdade era Pedro" updates last sale
- 🗑️ **Safe Deletion** - "remove venda 44" with confirmation

## Quick Start 🚀

### Option 1: Automatic Setup (Recommended)

```bash
./start-dev.sh
```

This script will:
- Check and install dependencies
- Setup database
- Start the development server

### Option 2: Manual Setup

#### 1. Install Dependencies

```bash
npm install
```

#### 2. Setup Environment

Copy `.env.example` to `.env` and fill in your credentials:

```bash
cp .env.example .env
```

Required variables:
- `OPENAI_API_KEY` - Your OpenAI API key
- `ACCESS_TOKEN` - WhatsApp Business API access token
- `VERIFY_TOKEN` - Your webhook verification token
- `PHONE_NUMBER_ID` - WhatsApp Business phone number ID

### 3. Setup Database

```bash
# Generate Prisma client
npm run db:generate

# Run migrations
npm run db:migrate
```

### 4. Start Development Server

```bash
npm run dev
```

The bot will start on `http://localhost:3000`

## Usage Examples 💬

### Create Sale
```
User: "Vendi 3 kits pro mercado do fernando, 40 reais"

Bot: "Quero confirmar os dados da venda:
📦 Produto: 3 kits
👤 Cliente: Mercado do Fernando
💰 Valor: R$ 40,00 (R$ 13,33 x 3)
📅 Data: hoje
👔 Vendedor: Miriam

Está tudo correto?"

User: "sim"

Bot: "✓ Venda #44 registrada com sucesso!"
```

### List Sales
```
User: "minhas vendas dessa semana"

Bot: "📊 Vendas 28/09 a 01/10 (5 vendas):
#45 - 01/10 - 3 kits
      Cliente: Mercado do Fernando
      Vendedor: Miriam
      R$ 40,00
..."
```

### Update Sale
```
User: "na verdade não foi fernando, foi pedro"

Bot: "Atualizar venda #45?
De: Mercado do Fernando
Para: Pedro
Confirma?"

User: "sim"

Bot: "✓ Venda #45 atualizada!"
```

### Delete Sale
```
User: "remove venda 44"

Bot: "⚠️ Confirma que quer APAGAR esta venda?
Venda #44
📦 3 kits
👤 Mercado do Fernando
💰 R$ 40,00

Responda 'sim' para confirmar"
```

## Architecture 🏗️

```
src/
├── index.ts                    # Express server & entry point
├── agent/
│   ├── Agent.ts                # Main orchestrator
│   └── IntentExtractor.ts      # GPT-4 intent extraction
├── features/sales/
│   ├── SalesPlugin.ts          # Business logic
│   ├── SalesService.ts         # Database operations
│   ├── CustomerService.ts      # Customer management
│   └── types.ts                # Types & schemas
├── adapters/
│   ├── whatsapp/
│   │   └── WhatsAppProvider.ts # WhatsApp messaging
│   └── database/
│       └── prisma.ts           # Prisma client
└── utils/
    ├── config.ts               # Configuration
    ├── logger.ts               # Logging
    ├── formatters.ts           # String/number formatting
    └── dateParser.ts           # Portuguese date parsing
```

## Database Schema 📊

### Customer
- Name, type (Person/Business), document (CPF/CNPJ), address
- Fuzzy matching with normalized names

### Sale
- Human-friendly sale number (#44)
- Product, quantity, price, date
- Links to customer and salesperson

### ConversationState
- Tracks user context
- Pending confirmations with timeout

## Scripts 📜

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm start            # Run production build
npm run db:generate  # Generate Prisma client
npm run db:migrate   # Run database migrations
npm run db:studio    # Open Prisma Studio
```

## Safety Features 🛡️

1. **Always confirms before saving** - No accidental data
2. **Data validation with Zod** - Prevents negative prices, future dates
3. **Fuzzy customer matching** - Avoids duplicates
4. **15-minute confirmation timeout** - Auto-expires pending actions
5. **Transaction-safe sale numbers** - No collisions

## Contributing 🤝

This is a private project, but suggestions are welcome!

## License 📄

Private - All Rights Reserved

