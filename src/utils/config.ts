import dotenv from "dotenv";

dotenv.config();

export const config = {
  env: process.env.NODE_ENV || "development",
  port: parseInt(process.env.PORT || "3000", 10),

  whatsapp: {
    verifyToken: process.env.VERIFY_TOKEN!,
    accessToken: process.env.ACCESS_TOKEN!,
    phoneNumberId: process.env.PHONE_NUMBER_ID!,
    myPhoneNumber: process.env.MY_PHONE_NUMBER!,
  },

  openai: {
    apiKey: process.env.OPENAI_API_KEY!,
    model: process.env.OPENAI_MODEL || "gpt-4-turbo-preview",
  },

  database: {
    url: process.env.DATABASE_URL || "file:./dev.db",
  },

  // Salesperson phone mapping
  salespeople: {
    [process.env.GABRIEL_PHONE || ""]: "Gabriel",
    [process.env.MIRIAM_PHONE || ""]: "Miriam",
    [process.env.LETICIA_PHONE || ""]: "Letícia",
  } as Record<string, string>,
};

// Helper to get salesperson name from phone
export function getSalespersonName(phoneNumber: string): string {
  return config.salespeople[phoneNumber] || "Desconhecido";
}

// Validate required config
export function validateConfig() {
  const required = [
    "VERIFY_TOKEN",
    "ACCESS_TOKEN",
    "PHONE_NUMBER_ID",
    "OPENAI_API_KEY",
  ];

  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}`
    );
  }
}
