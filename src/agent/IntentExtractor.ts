import OpenAI from "openai";
import { config } from "../utils/config";
import { logger } from "../utils/logger";
import { parsePortugueseDate, parseDateRange } from "../utils/dateParser";
import { Intent, ConversationContext } from "../features/sales/types";
import { getBusinessContextPrompt } from "../utils/businessContext";

export class IntentExtractor {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: config.openai.apiKey,
    });
  }

  async extract(
    message: string,
    context?: ConversationContext
  ): Promise<Intent> {
    try {
      const systemPrompt = this.getSystemPrompt();
      const userPrompt = this.buildUserPrompt(message, context);

      logger.debug("Extracting intent", { message, hasContext: !!context });

      const response = await this.openai.chat.completions.create({
        model: config.openai.model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
      });

      const content = response.choices[0].message.content;
      if (!content) {
        throw new Error("Empty response from OpenAI");
      }

      const parsed = JSON.parse(content);
      const intent = this.processIntent(parsed, message);

      logger.info("Intent extracted", {
        action: intent.action,
        confidence: intent.confidence,
        hasEntities: Object.keys(intent.entities).length > 0,
      });

      return intent;
    } catch (error) {
      logger.error("Error extracting intent", error);
      return {
        action: "UNKNOWN",
        confidence: 0,
        entities: {},
        originalMessage: message,
      };
    }
  }

  private getSystemPrompt(): string {
    return `You are an AI assistant for a Brazilian small business that sells spices.
Your job is to extract structured information from Portuguese messages about sales.

CRITICAL: Be VERY flexible with natural language variations. Understand the INTENT, not just exact words.

${getBusinessContextPrompt()}

SALESPEOPLE: Gabriel, Miriam, Letícia

CUSTOMER TYPES:
- BUSINESS: Keywords like "mercado", "padaria", "restaurante", "loja", "bar"
- PERSON: Names like "dona", "sr.", "sra.", person names

INTENTS (with many variations):

1. CREATE_SALE: User wants to record a sale
   Examples: 
   - "vendi", "venda de", "registra venda"
   - "Miriam vendeu 20 potes para juliana"
   - "venda de X para Y"
   - ANY message mentioning a sale with product/customer/price
   
2. CONFIRM_ACTION: User confirms a pending action
   Examples: "sim", "confirmar", "confirmo", "yes", "ok", "isso mesmo", "correto", "está certo", "perfeito"
   
3. CANCEL_ACTION: User cancels a pending action
   Examples: "não", "cancela", "não quero", "esquece", "deixa pra lá"
   
4. UPDATE_SALE: User wants to update a sale
   Examples: 
   - "atualiza venda 44", "muda venda 245"
   - "na verdade era Pedro" (context-based update)
   - "na verdade não foi X, foi Y"
   
5. DELETE_SALE: User wants to delete a sale
   Examples: "remove venda 44", "apaga venda 245", "cancela a venda"
   
6. LIST_SALES: User wants to see sales
   Examples: 
   - "minhas vendas", "quanto vendi", "vendas dessa semana"
   - "quantas vendas", "quanto vendemos"
   - "vendas de hoje", "vendas do mês"
   - "quanto a Miriam vendeu"
   - "ver vendas", "listar vendas"
   - ANY question about seeing/listing/counting sales
   
7. VIEW_CUSTOMER: User wants customer info
   Examples: "qual endereço do mercado fernando", "info dona maria"
   
8. UPDATE_CUSTOMER: User wants to update customer
   Examples: "endereço do mercado fernando é rua x"

IMPORTANT RULES:
- If user just says "oi" or "olá" with no other context, return UNKNOWN
- Be AGGRESSIVE in recognizing sale creation - if they mention product + customer + price, it's CREATE_SALE
- For LIST_SALES: ANY question about sales, quantities, amounts is LIST_SALES
- When adding missing information (like just a price), keep it as CREATE_SALE intent

ENTITY EXTRACTION:
- product: Include quantity in description (e.g., "20 potes de Sal Temperado Mirtz", "3 kits de Sal Temperado Mirtz")
- quantity: CRITICAL - Extract from Portuguese numbers:
  * "um" or "uma" = 1
  * "dois" or "duas" = 2
  * "três" = 3
  * "quatro" = 4
  * "cinco" = 5
  * "vinte" = 20
  * OR numeric: 1, 2, 20, etc.
  * From phrases: "um pote" = 1, "dois kits" = 2, "vinte potes" = 20
- pricePerUnit or totalPrice: Extract BOTH if possible, calculate if needed
- customerName: Extract customer name (be flexible: "pro guilherme" = "Guilherme")
- customerType: PERSON or BUSINESS (auto-detect from name)
- saleDate: Parse date (hoje, ontem, sexta, etc.) - default "hoje" if not specified
- salesperson: Gabriel, Miriam, or Letícia if mentioned
- saleNumber: Numeric ID (44, 245, etc.)

CRITICAL QUANTITY EXTRACTION EXAMPLES:
- "um pote" → quantity: 1, product: "1 pote de Sal Temperado Mirtz"
- "20 potes" → quantity: 20, product: "20 potes de Sal Temperado Mirtz"
- "três kits" → quantity: 3, product: "3 kits de Sal Temperado Mirtz"
- "dois kits" → quantity: 2, product: "2 kits de Sal Temperado Mirtz"
- Just "kit" or "pote" → quantity: 1 (default)

CUSTOMER NAME EXTRACTION:
- "pro guilherme" → customerName: "Guilherme"
- "pra dona maria" → customerName: "Dona Maria"
- "para o mercado" → customerName: "Mercado"

MISSING FIELDS:
Only mark as missing if truly not inferable from context

RESPONSE FORMAT (JSON):
{
  "action": "CREATE_SALE",
  "confidence": 0.95,
  "entities": {
    "product": "kit 20 temperos",
    "quantity": 3,
    "totalPrice": 40,
    "pricePerUnit": 13.33,
    "customerName": "Mercado do Fernando",
    "customerType": "BUSINESS",
    "saleDate": "hoje",
    "salesperson": "Miriam"
  },
  "missingFields": []
}`;
  }

  private buildUserPrompt(
    message: string,
    context?: ConversationContext
  ): string {
    let prompt = `Extract intent and entities from this message:\n"${message}"\n\n`;

    // CRITICAL: Include pending sale data so AI can merge information
    if (context?.pendingAction?.type === "CREATE_SALE" && context.pendingAction.data) {
      prompt += `IMPORTANT - User is adding information to an incomplete sale:\n`;
      prompt += `Already collected:\n`;
      const data = context.pendingAction.data;
      if (data.product) prompt += `- Product: ${data.product}\n`;
      if (data.quantity) prompt += `- Quantity: ${data.quantity}\n`;
      if (data.customerName) prompt += `- Customer: ${data.customerName}\n`;
      if (data.totalPrice) prompt += `- Price: ${data.totalPrice}\n`;
      if (data.salesperson) prompt += `- Salesperson: ${data.salesperson}\n`;
      prompt += `\nThe current message is providing ADDITIONAL information. Extract what's new and mark action as CREATE_SALE.\n\n`;
    }

    if (context?.pendingConfirmation) {
      prompt += `Context: User has a pending confirmation.\n`;
      if (context.pendingAction) {
        prompt += `Pending action type: ${context.pendingAction.type}\n`;
      }
    }

    if (context?.lastSaleNumber) {
      prompt += `Last sale number: #${context.lastSaleNumber}\n`;
    }

    if (context?.lastCustomerName) {
      prompt += `Last customer: ${context.lastCustomerName}\n`;
    }

    prompt += `\nReturn JSON with: action, confidence, entities, missingFields.`;

    return prompt;
  }

  private processIntent(parsed: any, originalMessage: string): Intent {
    const intent: Intent = {
      action: parsed.action || "UNKNOWN",
      confidence: parsed.confidence || 0.5,
      entities: {},
      missingFields: parsed.missingFields || [],
      originalMessage,
    };

    // Process entities
    if (parsed.entities) {
      const entities = parsed.entities;

      // Copy simple fields
      intent.entities.product = entities.product;
      intent.entities.quantity = entities.quantity;
      intent.entities.notes = entities.notes;
      intent.entities.salesperson = entities.salesperson;
      intent.entities.customerName = entities.customerName;
      intent.entities.customerType = entities.customerType;
      intent.entities.customerDocument = entities.customerDocument;
      intent.entities.customerAddress = entities.customerAddress;
      intent.entities.saleNumber = entities.saleNumber;
      intent.entities.fieldToUpdate = entities.fieldToUpdate;
      intent.entities.newValue = entities.newValue;

      // Process prices
      if (entities.pricePerUnit !== undefined) {
        intent.entities.pricePerUnit = parseFloat(entities.pricePerUnit);
      }
      if (entities.totalPrice !== undefined) {
        intent.entities.totalPrice = parseFloat(entities.totalPrice);
      }

      // Calculate missing price if we have one
      if (
        intent.entities.totalPrice &&
        intent.entities.quantity &&
        !intent.entities.pricePerUnit
      ) {
        intent.entities.pricePerUnit =
          intent.entities.totalPrice / intent.entities.quantity;
      } else if (
        intent.entities.pricePerUnit &&
        intent.entities.quantity &&
        !intent.entities.totalPrice
      ) {
        intent.entities.totalPrice =
          intent.entities.pricePerUnit * intent.entities.quantity;
      }

      // Process dates
      if (entities.saleDate) {
        const parsed = parsePortugueseDate(entities.saleDate);
        intent.entities.saleDate = parsed.date;
      }

      // Process date ranges for LIST
      if (
        intent.action === "LIST_SALES" &&
        (entities.startDate || entities.endDate || originalMessage)
      ) {
        const range = parseDateRange(originalMessage);
        intent.entities.startDate = range.startDate;
        intent.entities.endDate = range.endDate;
      }
    }

    return intent;
  }
}
