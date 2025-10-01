import { PrismaClient } from "@prisma/client";
import { Customer, CustomerType } from "./types";
import { normalizeString, stringSimilarity } from "../../utils/formatters";
import { logger } from "../../utils/logger";
import { CreateCustomerDTO, CreateCustomerSchema } from "./types";

export class CustomerService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Find customer with fuzzy matching
   * Returns exact match or similar customers (>80% similarity)
   */
  async findSimilarCustomers(
    phoneNumber: string,
    name: string
  ): Promise<{ exact: Customer | null; similar: Customer[] }> {
    const normalized = normalizeString(name);

    // Try exact match first
    const exact = await this.prisma.customer.findUnique({
      where: {
        phoneNumber_nameNormalized: {
          phoneNumber,
          nameNormalized: normalized,
        },
      },
    });

    if (exact) {
      return { exact, similar: [] };
    }

    // Find similar customers (fuzzy matching)
    const allCustomers = await this.prisma.customer.findMany({
      where: { phoneNumber },
    });

    const similar = allCustomers
      .map((customer: Customer) => ({
        customer,
        similarity: stringSimilarity(name, customer.name),
      }))
      .filter(({ similarity }: { similarity: number }) => similarity > 0.8) // 80% similarity threshold
      .sort((a: any, b: any) => b.similarity - a.similarity)
      .slice(0, 3) // Top 3 matches
      .map(({ customer }: { customer: Customer }) => customer);

    return { exact: null, similar };
  }

  /**
   * Find or create customer with fuzzy matching
   * If similar customers found, returns them for user confirmation
   */
  async findOrCreateCustomer(
    phoneNumber: string,
    customerData: { name: string; type: CustomerType }
  ): Promise<{
    customer: Customer | null;
    needsConfirmation: boolean;
    similar: Customer[];
  }> {
    const { exact, similar } = await this.findSimilarCustomers(
      phoneNumber,
      customerData.name
    );

    if (exact) {
      logger.info("Found exact customer match", {
        customerId: exact.id,
        name: exact.name,
      });
      return { customer: exact, needsConfirmation: false, similar: [] };
    }

    if (similar.length > 0) {
      logger.info("Found similar customers", {
        searchName: customerData.name,
        similarCount: similar.length,
        similarNames: similar.map((c) => c.name),
      });
      return { customer: null, needsConfirmation: true, similar };
    }

    // No matches - create new customer
    const newCustomer = await this.createCustomer({
      phoneNumber,
      name: customerData.name,
      type: customerData.type,
    });

    logger.info("Created new customer", {
      customerId: newCustomer.id,
      name: newCustomer.name,
    });
    return { customer: newCustomer, needsConfirmation: false, similar: [] };
  }

  /**
   * Create new customer
   */
  async createCustomer(data: CreateCustomerDTO): Promise<Customer> {
    // Validate with Zod
    const validated = CreateCustomerSchema.parse(data);

    const customer = await this.prisma.customer.create({
      data: {
        ...validated,
        nameNormalized: normalizeString(validated.name),
      },
    });

    return customer;
  }

  /**
   * Get customer by exact name
   */
  async getCustomer(
    phoneNumber: string,
    name: string
  ): Promise<Customer | null> {
    const normalized = normalizeString(name);

    return this.prisma.customer.findUnique({
      where: {
        phoneNumber_nameNormalized: {
          phoneNumber,
          nameNormalized: normalized,
        },
      },
      include: {
        sales: {
          orderBy: { saleDate: "desc" },
          take: 10,
        },
      },
    });
  }

  /**
   * Update customer
   */
  async updateCustomer(
    phoneNumber: string,
    name: string,
    data: Partial<CreateCustomerDTO>
  ): Promise<Customer> {
    const normalized = normalizeString(name);

    return this.prisma.customer.update({
      where: {
        phoneNumber_nameNormalized: {
          phoneNumber,
          nameNormalized: normalized,
        },
      },
      data: {
        ...data,
        nameNormalized: data.name ? normalizeString(data.name) : undefined,
      },
    });
  }

  /**
   * List all customers for user
   */
  async listCustomers(phoneNumber: string): Promise<Customer[]> {
    return this.prisma.customer.findMany({
      where: { phoneNumber },
      orderBy: { name: "asc" },
    });
  }

  /**
   * Get customer statistics
   */
  async getCustomerStats(phoneNumber: string, customerName: string) {
    const customer = await this.getCustomer(phoneNumber, customerName);

    if (!customer) return null;

    const sales = await this.prisma.sale.findMany({
      where: { customerId: customer.id },
    });

    const totalSales = sales.length;
    const totalRevenue = sales.reduce(
      (sum: number, s: any) => sum + s.totalPrice,
      0
    );
    const avgSale = totalSales > 0 ? totalRevenue / totalSales : 0;
    const lastSale = sales[0];

    return {
      customer,
      totalSales,
      totalRevenue,
      avgSale,
      lastSale,
    };
  }
}
