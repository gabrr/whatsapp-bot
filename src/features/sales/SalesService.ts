import { PrismaClient } from "@prisma/client";
import { logger } from "../../utils/logger";
import { CustomerService } from "./CustomerService";
import {
  CreateSaleDTO,
  CreateSaleSchema,
  SaleFilters,
  SaleFiltersSchema,
  Sale,
} from "./types";

export class SalesService {
  constructor(
    private prisma: PrismaClient,
    private customerService: CustomerService
  ) {}

  /**
   * Create sale with customer
   */
  async createSale(data: CreateSaleDTO): Promise<Sale> {
    // Validate with Zod
    const validated = CreateSaleSchema.parse(data);

    // Find or create customer
    const { customer, needsConfirmation, similar } =
      await this.customerService.findOrCreateCustomer(validated.phoneNumber, {
        name: validated.customerName,
        type: validated.customerType,
      });

    // If needs confirmation, throw error with similar customers
    if (needsConfirmation && !customer) {
      throw new Error(
        JSON.stringify({
          type: "CUSTOMER_DISAMBIGUATION",
          similar,
        })
      );
    }

    if (!customer) {
      throw new Error("Failed to create or find customer");
    }

    // Get next sale number (with transaction to prevent race conditions)
    const sale = await this.prisma.$transaction(async (tx: any) => {
      // Get last sale number
      const lastSale = await tx.sale.findFirst({
        where: { phoneNumber: validated.phoneNumber },
        orderBy: { saleNumber: "desc" },
      });

      const nextSaleNumber = (lastSale?.saleNumber || 0) + 1;

      // Create sale
      return tx.sale.create({
        data: {
          phoneNumber: validated.phoneNumber,
          saleNumber: nextSaleNumber,
          product: validated.product,
          quantity: validated.quantity,
          pricePerUnit: validated.pricePerUnit,
          totalPrice: validated.totalPrice,
          saleDate: validated.saleDate,
          salesperson: validated.salesperson,
          customerId: customer.id,
          notes: validated.notes,
        },
        include: {
          customer: true,
        },
      });
    });

    logger.info("Sale created", {
      saleNumber: sale.saleNumber,
      customer: customer.name,
      total: sale.totalPrice,
    });

    return sale;
  }

  /**
   * Get sale by number
   */
  async getSaleByNumber(
    phoneNumber: string,
    saleNumber: number
  ): Promise<Sale | null> {
    return this.prisma.sale.findUnique({
      where: {
        phoneNumber_saleNumber: {
          phoneNumber,
          saleNumber,
        },
      },
      include: {
        customer: true,
      },
    });
  }

  /**
   * Update sale
   */
  async updateSale(
    phoneNumber: string,
    saleNumber: number,
    data: Partial<CreateSaleDTO>
  ): Promise<Sale> {
    // Validate if provided
    if (Object.keys(data).length > 0) {
      CreateSaleSchema.partial().parse(data);
    }

    const sale = await this.prisma.sale.update({
      where: {
        phoneNumber_saleNumber: {
          phoneNumber,
          saleNumber,
        },
      },
      data,
      include: {
        customer: true,
      },
    });

    logger.info("Sale updated", { saleNumber, updates: Object.keys(data) });

    return sale;
  }

  /**
   * Delete sale
   */
  async deleteSale(phoneNumber: string, saleNumber: number): Promise<void> {
    await this.prisma.sale.delete({
      where: {
        phoneNumber_saleNumber: {
          phoneNumber,
          saleNumber,
        },
      },
    });

    logger.info("Sale deleted", { saleNumber });
  }

  /**
   * List sales with filters
   */
  async listSales(filters: SaleFilters): Promise<Sale[]> {
    // Validate filters
    const validated = SaleFiltersSchema.parse(filters);

    return this.prisma.sale.findMany({
      where: {
        phoneNumber: validated.phoneNumber,
        saleDate: {
          gte: validated.startDate,
          lte: validated.endDate,
        },
        salesperson: validated.salesperson || undefined,
        customer: validated.customerName
          ? {
              nameNormalized: {
                contains: normalizeString(validated.customerName),
              },
            }
          : undefined,
      },
      include: {
        customer: true,
      },
      orderBy: [{ saleDate: "desc" }, { saleNumber: "desc" }],
    });
  }

  /**
   * Get sales statistics by salesperson
   */
  async getSalespersonStats(
    phoneNumber: string,
    salesperson: string,
    startDate: Date,
    endDate: Date
  ) {
    const sales = await this.listSales({
      phoneNumber,
      salesperson,
      startDate,
      endDate,
    });

    const totalSales = sales.length;
    const totalRevenue = sales.reduce(
      (sum: number, s: any) => sum + s.totalPrice,
      0
    );
    const avgSale = totalSales > 0 ? totalRevenue / totalSales : 0;

    return {
      salesperson,
      totalSales,
      totalRevenue,
      avgSale,
      period: { startDate, endDate },
    };
  }
}

function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ");
}
