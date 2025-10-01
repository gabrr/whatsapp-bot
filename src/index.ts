import express from "express";
import { config, validateConfig } from "./utils/config";
import { logger } from "./utils/logger";
import { prisma } from "./adapters/database/prisma";
import { WhatsAppProvider } from "./adapters/whatsapp/WhatsAppProvider";
import { Agent } from "./agent/Agent";
import { IntentExtractor } from "./agent/IntentExtractor";
import { ExtractorFactory } from "./agent/ExtractorFactory";
import { SalesPlugin } from "./features/sales/SalesPlugin";
import { SalesService } from "./features/sales/SalesService";
import { CustomerService } from "./features/sales/CustomerService";

// Validate environment
try {
  validateConfig();
  logger.info("Configuration validated");
} catch (error: any) {
  logger.error("Configuration error", error);
  process.exit(1);
}

// Initialize services
const customerService = new CustomerService(prisma);
const salesService = new SalesService(prisma, customerService);
const salesPlugin = new SalesPlugin(salesService, customerService);

// Use factory to create extractor (can switch via env var)
const intentExtractor = ExtractorFactory.create() as IntentExtractor;

const agent = new Agent(intentExtractor, salesPlugin);
const whatsapp = new WhatsAppProvider();

// Create Express app
const app = express();
app.use(express.json());

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Webhook verification (GET)
app.get("/", (req, res) => {
  const mode = req.query["hub.mode"] as string;
  const token = req.query["hub.verify_token"] as string;
  const challenge = req.query["hub.challenge"] as string;

  const result = whatsapp.verifyWebhook(mode, token, challenge);

  if (result.verified) {
    res.status(200).send(result.challenge);
  } else {
    res.status(403).end();
  }
});

// Webhook handler (POST)
app.post("/", async (req, res) => {
  const timestamp = new Date().toISOString().replace("T", " ").slice(0, 19);

  logger.info(`Webhook received ${timestamp}`);

  // Always respond 200 immediately to WhatsApp
  res.status(200).end();

  // Parse message
  const parsed = whatsapp.parseWebhookMessage(req.body);

  if (!parsed) {
    logger.debug("Webhook received but no user message found");
    return;
  }

  const { from, message, messageId } = parsed;

  // Ignore messages from self
  if (from === config.whatsapp.myPhoneNumber) {
    logger.debug("Ignoring message from myself");
    return;
  }

  logger.info(`Processing message from ${from}`, { message, messageId });

  try {
    // Process message with agent
    const response = await agent.processMessage(from, message);

    // Send response
    await whatsapp.sendMessage(from, response);

    logger.info("Response sent successfully", { from });
  } catch (error: any) {
    logger.error("Error processing webhook", error, { from, messageId });

    // Try to send error message to user
    try {
      await whatsapp.sendMessage(
        from,
        "Desculpe, ocorreu um erro. Por favor, tente novamente em alguns instantes."
      );
    } catch (sendError) {
      logger.error("Failed to send error message", sendError);
    }
  }
});

// Graceful shutdown
process.on("SIGINT", async () => {
  logger.info("Shutting down gracefully...");
  await prisma.$disconnect();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  logger.info("Shutting down gracefully...");
  await prisma.$disconnect();
  process.exit(0);
});

// Start server
const port = config.port;
app.listen(port, () => {
  logger.info(`🚀 WhatsApp Sales Bot is running!`);
  logger.info(`📍 Port: ${port}`);
  logger.info(`🌍 Environment: ${config.env}`);
  logger.info(
    `👥 Salespeople configured: ${Object.values(config.salespeople).join(", ")}`
  );
  logger.info(`\n✅ Ready to receive messages!\n`);
});
