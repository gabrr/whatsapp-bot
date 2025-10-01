import OpenAI from "openai";
import { config } from "../utils/config";
import { logger } from "../utils/logger";
import { parsePortugueseDate, parseDateRange } from "../utils/dateParser";
import { Intent, ConversationContext, Sale } from "../features/sales/types";
import { getBusinessContextPrompt } from "../utils/businessContext";

/**
 * Multi-LLM Extractor System
 * Uses cheaper models (gpt-4o-mini) for most tasks
 * Each function has a specialized prompt for its specific task
 */
export class MultiLLMExtractor {
  private openai: OpenAI;
  private cheapModel = "gpt-4o-mini"; // $0.00015 per 1K tokens
  private expensiveModel = "gpt-4o"; // $0.005 per 1K tokens

  constructor() {
    this.openai = new OpenAI({
      apiKey: config.openai.apiKey,
    });
  }

  /**
   * MAIN EXTRACTION FUNCTION
   * Orchestrates the multi-step extraction process
   */
  async extract(
    message: string,
    context?: ConversationContext,
    recentSales?: Sale[]
  ): Promise<Intent> {
    try {
      // STEP 1: Determine intent (cheap model)
      const intent = await this.extractIntent(message, context);

      // STEP 2: Extract entities based on intent (cheap model)
      if (intent.action === "CREATE_SALE") {
        const entities = await this.extractSaleEntities(message, context);
        intent.entities = entities.entities;
        intent.missingFields = entities.missingFields;
      } else if (intent.action === "LIST_SALES") {
        const filters = await this.extractSalesFilters(message, recentSales);
        intent.entities = filters;
      } else if (intent.action === "UPDATE_SALE" || intent.action === "DELETE_SALE") {
        const saleRef = await this.extractSaleReference(message, context);
        intent.entities = saleRef;
      }

      logger.info("Multi-LLM extraction complete", {
        action: intent.action,
        confidence: intent.confidence,
      });

      return intent;
    } catch (error) {
      logger.error("Error in multi-LLM extraction", error);
      return {
        action: "UNKNOWN",
        confidence: 0,
        entities: {},
        originalMessage: message,
      };
    }
  }

  /**
   * FUNCTION 1: Extract Intent (Cheap Model)
   * Purpose: Determine what user wants to do
   * Cost: ~$0.0001 per call
   */
  private async extractIntent(
    message: string,
    context?: ConversationContext
  ): Promise<Intent> {
    const prompt = `You are analyzing a Portuguese message to determine user intent.

CONTEXT:
${context?.pendingConfirmation ? "User has a pending confirmation waiting." : ""}
${context?.pendingAction ? `Pending action: ${context.pendingAction.type}` : ""}

MESSAGE: "${message}"

INTENTS:
- CONFIRM_ACTION: "sim", "ok", "confirmo", "correto", "isso mesmo"
- CANCEL_ACTION: "não", "cancela", "esquece"
- CREATE_SALE: Mentions selling something (vendeu, vendi, venda)
- LIST_SALES: Asking about sales (minhas vendas, quantas vendas, quanto vendi)
- UPDATE_SALE: Updating a sale (atualiza venda X, na verdade era Y)
- DELETE_SALE: Deleting a sale (remove venda X, apaga venda X)
- VIEW_CUSTOMER: Info about customer (endereço do cliente X)
- UNKNOWN: Greetings only, unclear messages

Return JSON:
{
  "action": "CREATE_SALE",
  "confidence": 0.9
}`;

    const response = await this.openai.chat.completions.create({
      model: this.cheapModel,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      max_tokens: 50,
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");

    return {
      action: result.action || "UNKNOWN",
      confidence: result.confidence || 0.5,
      entities: {},
      originalMessage: message,
    };
  }

  /**
   * FUNCTION 2: Extract Sale Entities (Cheap Model)
   * Purpose: Extract product, quantity, price, customer from message
   * Cost: ~$0.0002 per call
   */
  private async extractSaleEntities(
    message: string,
    context?: ConversationContext
  ): Promise<{ entities: any; missingFields: string[] }> {
    // Build context from pending data
    let existingData = "";
    if (context?.pendingAction?.type === "CREATE_SALE" && context.pendingAction.data) {
      existingData = `
EXISTING DATA (already collected):
${JSON.stringify(context.pendingAction.data, null, 2)}

IMPORTANT: The user is providing ADDITIONAL information. Extract ONLY new data from current message.
`;
    }

    const prompt = `Extract sale information from this Portuguese message.

${getBusinessContextPrompt()}

${existingData}

MESSAGE: "${message}"

EXTRACTION RULES:
1. quantity: Extract Portuguese numbers
   - "um"/"uma" = 1
   - "dois"/"duas" = 2  
   - "três" = 3
   - "vinte" = 20
   - Numeric: 1, 2, 20, 100, etc.
   - From context: "um pote" = 1, "dois kits" = 2

2. product: Always include quantity + "de Sal Temperado Mirtz"
   - "um pote" → "1 pote de Sal Temperado Mirtz"
   - "20 potes" → "20 potes de Sal Temperado Mirtz"
   - "3 kits" → "3 kits de Sal Temperado Mirtz"

3. totalPrice: Extract from:
   - "20 reais" → 20
   - "R$ 40" → 40
   - Just "40" → 40

4. customerName: Extract name
   - "pro guilherme" → "Guilherme"
   - "pra dona maria" → "Dona Maria"
   - "para juliana" → "Juliana"

5. customerType: Auto-detect
   - Has "mercado", "padaria", "loja" → "BUSINESS"
   - Person names → "PERSON"

6. salesperson: Gabriel, Miriam, or Letícia if mentioned
   - "Miriam vendeu" → "Miriam"
   - "a Letícia vendeu" → "Letícia"

7. saleDate: Extract date reference
   - "hoje" → "hoje"
   - "ontem" → "ontem"
   - If not mentioned → "hoje"

REQUIRED FIELDS: product, customerName, totalPrice (or pricePerUnit), quantity

Return JSON:
{
  "entities": {
    "product": "1 pote de Sal Temperado Mirtz",
    "quantity": 1,
    "totalPrice": 20,
    "pricePerUnit": 20,
    "customerName": "Guilherme",
    "customerType": "PERSON",
    "saleDate": "hoje",
    "salesperson": "Gabriel"
  },
  "missingFields": []
}

If any required field is missing, add to missingFields array.`;

    const response = await this.openai.chat.completions.create({
      model: this.cheapModel,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      max_tokens: 300,
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");

    // Process dates
    if (result.entities?.saleDate) {
      const parsed = parsePortugueseDate(result.entities.saleDate);
      result.entities.saleDate = parsed.date;
    }

    // Calculate missing price field
    if (result.entities?.totalPrice && result.entities?.quantity && !result.entities?.pricePerUnit) {
      result.entities.pricePerUnit = result.entities.totalPrice / result.entities.quantity;
    } else if (result.entities?.pricePerUnit && result.entities?.quantity && !result.entities?.totalPrice) {
      result.entities.totalPrice = result.entities.pricePerUnit * result.entities.quantity;
    }

    return {
      entities: result.entities || {},
      missingFields: result.missingFields || [],
    };
  }

  /**
   * FUNCTION 3: Format Question for Missing Info (Cheap Model)
   * Purpose: Generate natural question to ask for missing data
   * Cost: ~$0.0001 per call
   */
  async formatMissingInfoQuestion(
    missingFields: string[],
    existingData: any
  ): Promise<string> {
    const prompt = `Generate a friendly Portuguese question asking for missing information.

EXISTING DATA:
${JSON.stringify(existingData, null, 2)}

MISSING FIELDS: ${missingFields.join(", ")}

Generate a natural, friendly question in Portuguese asking for the missing information.
Be brief and clear. Use emojis.

Examples:
- Missing "price" → "Qual foi o valor total? 💰"
- Missing "customer" → "Pra qual cliente você vendeu? 👤"
- Missing "quantity" → "Quantos potes? (ex: 1 pote, 20 potes) 📦"

Return JSON:
{
  "question": "Your friendly question here"
}`;

    const response = await this.openai.chat.completions.create({
      model: this.cheapModel,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      max_tokens: 100,
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");
    return result.question || "Preciso de mais informações.";
  }

  /**
   * FUNCTION 4: Extract Sales Query Filters (Cheap Model)
   * Purpose: Extract date range and filters for listing sales
   * Cost: ~$0.0001 per call
   */
  private async extractSalesFilters(
    message: string,
    recentSales?: Sale[]
  ): Promise<any> {
    let salesContext = "";
    if (recentSales && recentSales.length > 0) {
      salesContext = `
RECENT SALES (for context):
${recentSales.slice(0, 10).map(s => `#${s.saleNumber} - ${s.product} - ${s.customer?.name || 'N/A'} - ${s.salesperson} - R$ ${s.totalPrice}`).join("\n")}

Total sales in system: ${recentSales.length}
`;
    }

    const prompt = `Extract sales query filters from this Portuguese message.

MESSAGE: "${message}"

${salesContext}

EXTRACT:
- startDate: Date expression (hoje, essa semana, mês passado, etc.)
- endDate: Date expression (default: hoje)
- salesperson: Gabriel, Miriam, or Letícia if mentioned
- customerName: If asking about specific customer

DATE EXPRESSIONS:
- "hoje" → startDate: "hoje", endDate: "hoje"
- "essa semana" → startDate: "essa semana", endDate: "hoje"
- "minhas vendas" (no date) → default to last year

Return JSON:
{
  "startDate": "essa semana",
  "endDate": "hoje",
  "salesperson": "Miriam",
  "customerName": null
}`;

    const response = await this.openai.chat.completions.create({
      model: this.cheapModel,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      max_tokens: 150,
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");

    // Process dates
    if (result.startDate || result.endDate) {
      const range = parseDateRange(message);
      result.startDate = range.startDate;
      result.endDate = range.endDate;
    }

    return result;
  }

  /**
   * FUNCTION 5: Extract Sale Reference (Cheap Model)
   * Purpose: Extract which sale to update/delete
   * Cost: ~$0.0001 per call
   */
  private async extractSaleReference(
    message: string,
    context?: ConversationContext
  ): Promise<any> {
    const prompt = `Extract sale reference from Portuguese message.

MESSAGE: "${message}"

CONTEXT:
- Last sale number: ${context?.lastSaleNumber || "none"}
- Last customer: ${context?.lastCustomerName || "none"}

EXTRACT:
- saleNumber: Numeric ID if mentioned (44, 245, etc.)
- If not mentioned but says "última venda" or "na verdade" → use last sale from context
- fieldToUpdate: What field to update (customer, price, product, etc.)
- newValue: New value for the field

EXAMPLES:
- "remove venda 44" → saleNumber: 44
- "na verdade era Pedro" → saleNumber: (from context), fieldToUpdate: "customer", newValue: "Pedro"
- "atualiza venda 1" → saleNumber: 1

Return JSON:
{
  "saleNumber": 44,
  "fieldToUpdate": "customer",
  "customerName": "Pedro"
}`;

    const response = await this.openai.chat.completions.create({
      model: this.cheapModel,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      max_tokens: 100,
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");
    return result;
  }

  /**
   * FUNCTION 6: Generate Sales Summary with Context (Cheap Model)
   * Purpose: Format sales list as natural language for AI context
   * Cost: ~$0.0002 per call
   */
  async generateSalesContext(sales: Sale[]): Promise<string> {
    if (sales.length === 0) return "No sales found.";

    const salesList = sales.map(
      (s) =>
        `#${s.saleNumber}: ${s.product} - ${s.customer?.name || "N/A"} - ${s.salesperson} - R$ ${s.totalPrice} - ${s.saleDate.toISOString().split("T")[0]}`
    );

    return `Recent sales (last ${sales.length}):\n${salesList.join("\n")}`;
  }

  /**
   * FUNCTION 7: Smart Response Generator (Expensive Model - Only When Needed)
   * Purpose: Generate intelligent responses for complex scenarios
   * Cost: ~$0.01 per call - Use sparingly!
   */
  async generateSmartResponse(
    scenario: string,
    data: any,
    recentSales?: Sale[]
  ): Promise<string> {
    const salesContext =
      recentSales && recentSales.length > 0
        ? await this.generateSalesContext(recentSales)
        : "";

    const prompt = `You are a helpful assistant for a Brazilian spice business.

${getBusinessContextPrompt()}

SCENARIO: ${scenario}

DATA: ${JSON.stringify(data, null, 2)}

${salesContext ? `RECENT SALES:\n${salesContext}` : ""}

Generate a natural, friendly Portuguese response.
Be brief, use emojis, be helpful.

Return JSON:
{
  "response": "Your natural Portuguese response here"
}`;

    const response = await this.openai.chat.completions.create({
      model: this.expensiveModel, // Use GPT-4o for quality
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      max_tokens: 200,
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");
    return result.response || "Desculpe, ocorreu um erro.";
  }

  /**
   * FUNCTION 8: Validate and Format Confirmation (Cheap Model)
   * Purpose: Create confirmation message for user
   * Cost: ~$0.0001 per call
   */
  async formatConfirmationMessage(saleData: any): Promise<string> {
    const prompt = `Create a confirmation message in Portuguese for this sale.

SALE DATA:
${JSON.stringify(saleData, null, 2)}

Format it nicely with emojis:
📦 Produto
👤 Cliente  
💰 Valor
📅 Data
👔 Vendedor

End with: "Está tudo correto? (responda 'sim' para salvar)"

Return JSON:
{
  "message": "Your formatted confirmation message"
}`;

    const response = await this.openai.chat.completions.create({
      model: this.cheapModel,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      max_tokens: 200,
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");
    return result.message || "Confirma os dados?";
  }

  /**
   * COST TRACKING: Log which model was used
   */
  private logModelUsage(model: string, task: string, tokens?: number) {
    const cost =
      model === this.cheapModel
        ? (tokens || 100) * 0.00000015
        : (tokens || 100) * 0.000005;

    logger.debug("LLM call", {
      model,
      task,
      estimatedCost: `$${cost.toFixed(6)}`,
    });
  }
}

/**
 * COMPARISON TABLE
 * 
 * Task                    | Old (GPT-4o)  | New (Multi-LLM) | Savings
 * ----------------------- | ------------- | --------------- | -------
 * Intent detection        | $0.005        | $0.0001         | 98%
 * Entity extraction       | $0.005        | $0.0002         | 96%
 * Format questions        | $0.005        | $0.0001         | 98%
 * Sales filters           | $0.005        | $0.0001         | 98%
 * Complex responses       | $0.005        | $0.005          | 0% (still needed)
 * 
 * AVERAGE PER MESSAGE:
 * Old: $0.005-0.015 (1-3 calls to GPT-4o)
 * New: $0.0005-0.0010 (mostly cheap models)
 * 
 * SAVINGS: ~90% reduction in AI costs! 💰
 */

