import { z } from "zod";
import { Customer as PrismaCustomer, Sale as PrismaSale } from "@prisma/client";

// ===== ZOD VALIDATION SCHEMAS =====

export const CustomerTypeSchema = z.enum(["PERSON", "BUSINESS"]);
export type CustomerType = z.infer<typeof CustomerTypeSchema>;

export const CreateCustomerSchema = z.object({
  phoneNumber: z.string().min(10),
  name: z.string().min(2).max(100),
  type: CustomerTypeSchema,
  document: z.string().optional(),
  address: z.string().max(500).optional(),
  notes: z.string().max(1000).optional(),
});

export const CreateSaleSchema = z.object({
  phoneNumber: z.string().min(10),
  product: z.string().min(1).max(200),
  quantity: z.number().positive().max(10000), // Must be > 0
  pricePerUnit: z.number().nonnegative().max(1000000), // Can't be negative
  totalPrice: z.number().positive().max(1000000), // Must be > 0
  saleDate: z.date().refine((date) => date <= new Date(), {
    message: "Sale date cannot be in the future",
  }),
  salesperson: z.string().min(2).max(50),
  customerName: z.string().min(2).max(100),
  customerType: CustomerTypeSchema,
  notes: z.string().max(1000).optional(),
});

export const SaleFiltersSchema = z.object({
  phoneNumber: z.string(),
  startDate: z.date(),
  endDate: z.date(),
  customerName: z.string().optional(),
  salesperson: z.string().optional(),
});

// ===== TYPESCRIPT TYPES =====

export type Customer = PrismaCustomer;
export type Sale = PrismaSale & {
  customer?: Customer;
};

export type CreateCustomerDTO = z.infer<typeof CreateCustomerSchema>;
export type CreateSaleDTO = z.infer<typeof CreateSaleSchema>;
export type SaleFilters = z.infer<typeof SaleFiltersSchema>;

// ===== INTENT TYPES =====

export type IntentAction =
  | "CREATE_SALE"
  | "CONFIRM_ACTION"
  | "CANCEL_ACTION"
  | "UPDATE_SALE"
  | "LIST_SALES"
  | "DELETE_SALE"
  | "VIEW_CUSTOMER"
  | "UPDATE_CUSTOMER"
  | "UNKNOWN";

export interface Intent {
  action: IntentAction;
  confidence: number;
  entities: {
    // Sale entities
    product?: string;
    quantity?: number;
    pricePerUnit?: number;
    totalPrice?: number;
    saleDate?: Date;
    salesperson?: string;
    notes?: string;

    // Customer entities
    customerName?: string;
    customerType?: CustomerType;
    customerDocument?: string;
    customerAddress?: string;

    // References
    saleNumber?: number;
    fieldToUpdate?: string;
    newValue?: any;

    // Filters
    startDate?: Date;
    endDate?: Date;
  };
  missingFields?: string[];
  originalMessage: string;
}

// ===== CONVERSATION STATE =====

export interface ConversationContext {
  phoneNumber: string;
  userName?: string;
  lastMessageAt: Date;
  pendingAction: PendingAction | null;
  pendingConfirmation: boolean;
  pendingExpiresAt: Date | null;
  lastSaleNumber: number | null;
  lastCustomerName: string | null;
}

export interface PendingAction {
  type: string;
  data: any;
}

// ===== RESPONSE TYPES =====

export interface PluginResponse {
  message: string;
  success: boolean;
  data?: any;
}
