import { SalesService } from "./SalesService";
import { CustomerService } from "./CustomerService";
import { Intent, ConversationContext, PluginResponse, Sale } from "./types";
import { formatCurrency, formatDatePT } from "../../utils/formatters";
import { format } from "date-fns";
import { logger } from "../../utils/logger";

export class SalesPlugin {
  constructor(
    private salesService: SalesService,
    private customerService: CustomerService
  ) {}

  async handle(
    intent: Intent,
    context: ConversationContext
  ): Promise<PluginResponse> {
    try {
      switch (intent.action) {
        case "CREATE_SALE":
          return await this.handleCreate(intent, context);
        case "UPDATE_SALE":
          return await this.handleUpdate(intent, context);
        case "LIST_SALES":
          return await this.handleList(intent, context);
        case "DELETE_SALE":
          return await this.handleDelete(intent, context);
        case "VIEW_CUSTOMER":
          return await this.handleViewCustomer(intent, context);
        default:
          return {
            message: "Ação não reconhecida. Como posso ajudar?",
            success: false,
          };
      }
    } catch (error: any) {
      logger.error("Error in SalesPlugin", error);
      return {
        message: "Desculpe, ocorreu um erro. Tente novamente.",
        success: false,
      };
    }
  }

  private async handleCreate(
    intent: Intent,
    context: ConversationContext
  ): Promise<PluginResponse> {
    const { entities, missingFields } = intent;

    // Default salesperson to current user
    if (!entities.salesperson && context.userName) {
      entities.salesperson = context.userName;
    }

    // Check for missing fields
    const required = ["product", "customerName"];
    const missing = required.filter(
      (field) => !entities[field as keyof typeof entities]
    );

    // Also check for price
    if (!entities.totalPrice && !entities.pricePerUnit) {
      missing.push("preço");
    }

    if (missing.length > 0 || (missingFields && missingFields.length > 0)) {
      context.pendingAction = {
        type: "CREATE_SALE",
        data: entities,
      };
      context.pendingExpiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 min

      return {
        message: this.askForMissingInfo(
          missing.concat(missingFields || []),
          entities
        ),
        success: true,
      };
    }

    // All data present - ask for confirmation
    context.pendingAction = {
      type: "CREATE_SALE",
      data: entities,
    };
    context.pendingConfirmation = true;
    context.pendingExpiresAt = new Date(Date.now() + 15 * 60 * 1000);

    return {
      message: this.formatConfirmation(entities),
      success: true,
    };
  }

  async handleConfirm(context: ConversationContext): Promise<PluginResponse> {
    if (!context.pendingAction || !context.pendingConfirmation) {
      return {
        message: "Não há nada pendente para confirmar.",
        success: false,
      };
    }

    const pending = context.pendingAction;

    try {
      switch (pending.type) {
        case "CREATE_SALE":
          return await this.confirmCreate(pending.data, context);
        case "DELETE_SALE":
          return await this.confirmDelete(pending.data, context);
        default:
          return {
            message: "Ação desconhecida.",
            success: false,
          };
      }
    } catch (error: any) {
      logger.error("Error confirming action", error);
      return {
        message: "Erro ao confirmar. Tente novamente.",
        success: false,
      };
    }
  }

  private async confirmCreate(
    data: any,
    context: ConversationContext
  ): Promise<PluginResponse> {
    // Set defaults
    if (!data.saleDate) data.saleDate = new Date();
    if (!data.quantity) data.quantity = 1;
    if (!data.customerType) {
      // Auto-detect customer type
      const name = (data.customerName || "").toLowerCase();
      data.customerType = this.detectCustomerType(name);
    }

    const sale = await this.salesService.createSale({
      phoneNumber: context.phoneNumber,
      ...data,
    });

    // Clear pending
    context.pendingAction = null;
    context.pendingConfirmation = false;
    context.pendingExpiresAt = null;
    context.lastSaleNumber = sale.saleNumber;
    const saleWithCustomer = sale as Sale;
    if (saleWithCustomer.customer) {
      context.lastCustomerName = saleWithCustomer.customer.name;
    }

    return {
      message:
        `✓ Venda #${sale.saleNumber} registrada com sucesso!\n\n` +
        `Você pode:\n` +
        `• Atualizar: "atualiza venda ${sale.saleNumber}"\n` +
        `• Remover: "remove venda ${sale.saleNumber}"\n` +
        `• Ver vendas: "minhas vendas"`,
      success: true,
      data: sale,
    };
  }

  private async handleUpdate(
    intent: Intent,
    context: ConversationContext
  ): Promise<PluginResponse> {
    const saleNumber = intent.entities.saleNumber || context.lastSaleNumber;

    if (!saleNumber) {
      return {
        message: 'Qual venda você quer atualizar? (ex: "atualiza venda 44")',
        success: false,
      };
    }

    // If updating customer name from "na verdade era..."
    if (intent.entities.customerName) {
      const sale = await this.salesService.getSaleByNumber(
        context.phoneNumber,
        saleNumber
      );
      if (!sale) {
        return {
          message: `Venda #${saleNumber} não encontrada.`,
          success: false,
        };
      }

      // Ask for confirmation
      context.pendingAction = {
        type: "UPDATE_SALE",
        data: {
          saleNumber,
          customerName: intent.entities.customerName,
        },
      };
      context.pendingConfirmation = true;
      context.pendingExpiresAt = new Date(Date.now() + 15 * 60 * 1000);

      const saleWithCustomer = sale as Sale;
      const customerName = saleWithCustomer.customer?.name || "N/A";

      return {
        message:
          `Atualizar venda #${saleNumber}?\n\n` +
          `De: ${customerName}\n` +
          `Para: ${intent.entities.customerName}\n\n` +
          `Confirma?`,
        success: true,
      };
    }

    return {
      message: "O que você quer atualizar na venda?",
      success: false,
    };
  }

  private async handleList(
    intent: Intent,
    context: ConversationContext
  ): Promise<PluginResponse> {
    const filters = {
      phoneNumber: context.phoneNumber,
      startDate:
        intent.entities.startDate ||
        new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      endDate: intent.entities.endDate || new Date(),
      customerName: intent.entities.customerName,
      salesperson: intent.entities.salesperson,
    };

    const sales = await this.salesService.listSales(filters);

    if (sales.length === 0) {
      return {
        message: "Nenhuma venda encontrada nesse período.",
        success: true,
      };
    }

    return {
      message: this.formatSalesList(sales, filters),
      success: true,
      data: sales,
    };
  }

  private async handleDelete(
    intent: Intent,
    context: ConversationContext
  ): Promise<PluginResponse> {
    const saleNumber = intent.entities.saleNumber || context.lastSaleNumber;

    if (!saleNumber) {
      return {
        message: 'Qual venda você quer remover? (ex: "remove venda 44")',
        success: false,
      };
    }

    const sale = await this.salesService.getSaleByNumber(
      context.phoneNumber,
      saleNumber
    );

    if (!sale) {
      return {
        message: `Venda #${saleNumber} não encontrada.`,
        success: false,
      };
    }

    // Ask for confirmation
    context.pendingAction = {
      type: "DELETE_SALE",
      data: { saleNumber },
    };
    context.pendingConfirmation = true;
    context.pendingExpiresAt = new Date(Date.now() + 5 * 60 * 1000);

    const saleWithCustomer = sale as Sale;
    const customerName = saleWithCustomer.customer?.name || "N/A";

    return {
      message:
        `⚠️ Confirma que quer APAGAR esta venda?\n\n` +
        `Venda #${sale.saleNumber}\n` +
        `📦 ${sale.product}\n` +
        `👤 ${customerName}\n` +
        `💰 ${formatCurrency(sale.totalPrice)}\n` +
        `📅 ${formatDatePT(sale.saleDate)}\n\n` +
        `Responda "sim" para confirmar`,
      success: true,
    };
  }

  private async confirmDelete(
    data: any,
    context: ConversationContext
  ): Promise<PluginResponse> {
    await this.salesService.deleteSale(context.phoneNumber, data.saleNumber);

    context.pendingAction = null;
    context.pendingConfirmation = false;
    context.pendingExpiresAt = null;

    return {
      message: `✓ Venda #${data.saleNumber} foi removida`,
      success: true,
    };
  }

  private async handleViewCustomer(
    intent: Intent,
    context: ConversationContext
  ): Promise<PluginResponse> {
    const customerName = intent.entities.customerName;

    if (!customerName) {
      return {
        message: "Qual cliente você quer ver?",
        success: false,
      };
    }

    const stats = await this.customerService.getCustomerStats(
      context.phoneNumber,
      customerName
    );

    if (!stats) {
      return {
        message: `Cliente "${customerName}" não encontrado.`,
        success: false,
      };
    }

    const { customer, totalSales, totalRevenue, avgSale, lastSale } = stats;

    let msg = `📋 ${customer.name} (${
      customer.type === "BUSINESS" ? "Empresa" : "Pessoa"
    })\n\n`;

    if (customer.address) {
      msg += `📍 Endereço: ${customer.address}\n`;
    }
    if (customer.document) {
      msg += `📄 Documento: ${customer.document}\n`;
    }

    msg += `\n📊 Histórico:\n`;
    msg += `• ${totalSales} vendas realizadas\n`;
    msg += `• Total: ${formatCurrency(totalRevenue)}\n`;
    msg += `• Média: ${formatCurrency(avgSale)} por venda\n`;

    if (lastSale) {
      msg += `• Última venda: #${lastSale.saleNumber} em ${formatDatePT(
        lastSale.saleDate
      )}`;
    }

    return {
      message: msg,
      success: true,
      data: stats,
    };
  }

  // Helper methods

  private askForMissingInfo(missing: string[], entities: any): string {
    let msg = "Entendi! Preciso de mais informações:\n\n";

    if (missing.includes("product")) {
      msg += "• Qual produto foi vendido?\n";
    }
    if (missing.includes("customerName") || missing.includes("customer")) {
      msg += "• Para qual cliente?\n";
    }
    if (missing.includes("preço") || missing.includes("price")) {
      msg += "• Qual foi o valor?\n";
    }
    if (missing.includes("quantity")) {
      msg += "• Qual quantidade?\n";
    }

    return msg;
  }

  private formatConfirmation(entities: any): string {
    const date = entities.saleDate ? formatDatePT(entities.saleDate) : "hoje";
    const salesperson = entities.salesperson || "você";
    const quantity = entities.quantity || 1;

    return (
      `Quero confirmar os dados da venda:\n\n` +
      `📦 Produto: ${entities.product}\n` +
      `👤 Cliente: ${entities.customerName}\n` +
      `💰 Valor: ${formatCurrency(entities.totalPrice)} ` +
      `(${formatCurrency(entities.pricePerUnit)} x ${quantity})\n` +
      `📅 Data: ${date}\n` +
      `👔 Vendedor: ${salesperson}\n\n` +
      `Está tudo correto?\n` +
      `(responda "sim" para salvar ou me diga o que precisa mudar)`
    );
  }

  private formatSalesList(sales: any[], filters?: any): string {
    const total = sales.reduce((sum: number, s: any) => sum + s.totalPrice, 0);
    const period =
      sales.length > 0
        ? `${format(sales[sales.length - 1].saleDate, "dd/MM")} a ${format(
            sales[0].saleDate,
            "dd/MM"
          )}`
        : "";

    const salesmanFilter = filters?.salesperson
      ? ` - ${filters.salesperson}`
      : "";

    let msg = `📊 Vendas ${period}${salesmanFilter} (${sales.length} vendas):\n\n`;

    sales.slice(0, 10).forEach((sale) => {
      const date = format(sale.saleDate, "dd/MM");
      msg += `#${sale.saleNumber} - ${date} - ${sale.product}\n`;
      msg += `      Cliente: ${sale.customer.name}\n`;
      msg += `      Vendedor: ${sale.salesperson}\n`;
      msg += `      ${formatCurrency(sale.totalPrice)}\n\n`;
    });

    if (sales.length > 10) {
      msg += `... e mais ${sales.length - 10} vendas\n\n`;
    }

    msg += `💰 Total: ${formatCurrency(total)}\n\n`;
    msg += `Para ver detalhes: "info venda X"\n`;
    msg += `Para atualizar ou remover: "atualiza venda X" ou "remove venda X"`;

    return msg;
  }

  private detectCustomerType(name: string): "PERSON" | "BUSINESS" {
    const businessKeywords = [
      "mercado",
      "padaria",
      "restaurante",
      "loja",
      "bar",
      "posto",
      "farmacia",
    ];
    const nameLower = name.toLowerCase();

    for (const keyword of businessKeywords) {
      if (nameLower.includes(keyword)) {
        return "BUSINESS";
      }
    }

    return "PERSON";
  }
}
