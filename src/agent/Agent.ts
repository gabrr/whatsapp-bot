import { IntentExtractor } from "./IntentExtractor";
import { SalesPlugin } from "../features/sales/SalesPlugin";
import { ConversationContext } from "../features/sales/types";
import { logger } from "../utils/logger";
import { getSalespersonName } from "../utils/config";
import { prisma } from "../adapters/database/prisma";

export class Agent {
  private contextCache: Map<string, ConversationContext>;

  constructor(
    private intentExtractor: IntentExtractor,
    private salesPlugin: SalesPlugin
  ) {
    this.contextCache = new Map();
  }

  async processMessage(phoneNumber: string, message: string): Promise<string> {
    try {
      logger.info("Processing message", { phoneNumber, message });

      // 1. Get or load context
      const context = await this.getContext(phoneNumber);

      // 2. Check if pending action expired
      if (context.pendingExpiresAt && context.pendingExpiresAt < new Date()) {
        context.pendingAction = null;
        context.pendingConfirmation = false;
        context.pendingExpiresAt = null;
        await this.saveContext(context);
      }

      // 3. Check for simple greetings first (skip AI if just "oi")
      const simpleGreeting = this.checkSimpleGreeting(message);
      if (simpleGreeting) {
        return simpleGreeting;
      }

      // 4. Extract intent
      const intent = await this.intentExtractor.extract(message, context);

      // 5. Route based on intent
      let response: string;

      if (intent.action === "CONFIRM_ACTION" && context.pendingConfirmation) {
        const result = await this.salesPlugin.handleConfirm(context);
        response = result.message;
      } else if (
        intent.action === "CANCEL_ACTION" &&
        context.pendingConfirmation
      ) {
        context.pendingAction = null;
        context.pendingConfirmation = false;
        context.pendingExpiresAt = null;
        response = "Ok, cancelado! Posso ajudar com outra coisa?";
      } else if (intent.action === "UNKNOWN") {
        response = this.getHelpMessage(context.userName, message);
      } else {
        const result = await this.salesPlugin.handle(intent, context);
        response = result.message;
      }

      // 6. Update and save context
      context.lastMessageAt = new Date();
      await this.saveContext(context);

      logger.info("Message processed successfully", { phoneNumber });
      return response;
    } catch (error: any) {
      logger.error("Error processing message", error, { phoneNumber });
      return "Desculpe, ocorreu um erro. Por favor, tente novamente.";
    }
  }

  private async getContext(phoneNumber: string): Promise<ConversationContext> {
    // Check cache first
    if (this.contextCache.has(phoneNumber)) {
      return this.contextCache.get(phoneNumber)!;
    }

    // Load from database
    const dbContext = await prisma.conversationState.findUnique({
      where: { phoneNumber },
    });

    let context: ConversationContext;

    if (dbContext) {
      context = {
        phoneNumber: dbContext.phoneNumber,
        userName: dbContext.userName || getSalespersonName(phoneNumber),
        lastMessageAt: dbContext.lastMessageAt,
        pendingAction: dbContext.pendingAction
          ? JSON.parse(dbContext.pendingAction)
          : null,
        pendingConfirmation: dbContext.pendingConfirmation,
        pendingExpiresAt: dbContext.pendingExpiresAt,
        lastSaleNumber: dbContext.lastSaleNumber,
        lastCustomerName: dbContext.lastCustomerName,
      };
    } else {
      // Create new context
      context = {
        phoneNumber,
        userName: getSalespersonName(phoneNumber),
        lastMessageAt: new Date(),
        pendingAction: null,
        pendingConfirmation: false,
        pendingExpiresAt: null,
        lastSaleNumber: null,
        lastCustomerName: null,
      };
    }

    this.contextCache.set(phoneNumber, context);
    return context;
  }

  private async saveContext(context: ConversationContext): Promise<void> {
    // Update cache
    this.contextCache.set(context.phoneNumber, context);

    // Save to database
    await prisma.conversationState.upsert({
      where: { phoneNumber: context.phoneNumber },
      create: {
        phoneNumber: context.phoneNumber,
        userName: context.userName,
        lastMessageAt: context.lastMessageAt,
        pendingAction: context.pendingAction
          ? JSON.stringify(context.pendingAction)
          : null,
        pendingConfirmation: context.pendingConfirmation,
        pendingExpiresAt: context.pendingExpiresAt,
        lastSaleNumber: context.lastSaleNumber,
        lastCustomerName: context.lastCustomerName,
      },
      update: {
        userName: context.userName,
        lastMessageAt: context.lastMessageAt,
        pendingAction: context.pendingAction
          ? JSON.stringify(context.pendingAction)
          : null,
        pendingConfirmation: context.pendingConfirmation,
        pendingExpiresAt: context.pendingExpiresAt,
        lastSaleNumber: context.lastSaleNumber,
        lastCustomerName: context.lastCustomerName,
      },
    });
  }

  private checkSimpleGreeting(message: string): string | null {
    const normalized = message.toLowerCase().trim();
    const greetings = ["oi", "olá", "ola", "hi", "hello", "opa", "eae", "e aí"];

    // Check if it's JUST a greeting (no other content)
    if (
      greetings.includes(normalized) ||
      (normalized.length < 15 &&
        greetings.some((g) => normalized.startsWith(g)))
    ) {
      const responses = [
        `Oi! Tudo bem? 😊\n\nEstou aqui pra te ajudar com as vendas!`,
        `Olá! Que bom te ver por aqui! 👋\n\nPronta pra registrar vendas?`,
        `Opa! Como posso ajudar? ✨\n\nVamos lá!`,
        `E aí! Beleza? 🌟\n\nO que vamos fazer hoje?`,
      ];

      const response = responses[Math.floor(Math.random() * responses.length)];

      return (
        `${response}\n\n` +
        `Pode me dizer coisas como:\n` +
        `💰 Vendi X potes pra Y\n` +
        `📊 Minhas vendas\n` +
        `🔍 Vendas da semana`
      );
    }

    return null;
  }

  private getHelpMessage(userName?: string, originalMessage?: string): string {
    // Generate friendly, charismatic response
    const greetings = [
      `Oi ${userName || "amigo"}! 😊`,
      `Olá ${userName || "querida"}! 👋`,
      `Opa ${userName || ""}! ✨`,
    ];

    const reactions = [
      `Hmm, não entendi muito bem essa`,
      `Essa eu não peguei direito`,
      `Desculpa, fiquei confusa aqui`,
      `Ops, essa me deixou na dúvida`,
    ];

    const transitions = [
      `mas tô aqui pra te ajudar! 💪`,
      `mas vou te mostrar o que eu sei fazer! 🌟`,
      `mas é rapidinho te explicar! ✨`,
    ];

    // Random selection for variety
    const greeting = greetings[Math.floor(Math.random() * greetings.length)];
    const reaction = reactions[Math.floor(Math.random() * reactions.length)];
    const transition =
      transitions[Math.floor(Math.random() * transitions.length)];

    return (
      `${greeting}\n\n` +
      `${reaction} ${transition}\n\n` +
      `Eu posso:\n` +
      `📝 Registrar vendas → "Vendi 3 kits pra Juliana, 40 reais"\n` +
      `📊 Mostrar vendas → "Minhas vendas" ou "Vendas da semana"\n` +
      `✏️ Atualizar → "Remove venda 1" ou "Atualiza venda 1"\n\n` +
      `É só falar naturalmente! 😉`
    );
  }
}
