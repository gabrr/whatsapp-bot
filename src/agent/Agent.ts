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

      // 3. Extract intent
      const intent = await this.intentExtractor.extract(message, context);

      // 4. Route based on intent
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
        response = this.getHelpMessage(context.userName);
      } else {
        const result = await this.salesPlugin.handle(intent, context);
        response = result.message;
      }

      // 5. Update and save context
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

  private getHelpMessage(userName?: string): string {
    const greeting = userName ? `Oi ${userName}!` : "Olá!";

    return (
      `${greeting} Não entendi. Você pode:\n\n` +
      `📝 Registrar venda:\n` +
      `"Vendi 3 kits pro mercado fernando, 40 reais"\n\n` +
      `📊 Ver vendas:\n` +
      `"Minhas vendas dessa semana"\n` +
      `"Quanto a Miriam vendeu hoje?"\n\n` +
      `✏️ Atualizar/Remover:\n` +
      `"Atualiza venda 44"\n` +
      `"Remove venda 44"\n\n` +
      `👥 Info do cliente:\n` +
      `"Qual endereço do mercado fernando?"`
    );
  }
}
