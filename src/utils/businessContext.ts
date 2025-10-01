/**
 * Business-specific context and product information
 * This helps the AI understand the business better
 */

export const BUSINESS_CONTEXT = {
  // Product catalog
  products: {
    "Sal Temperado Mirtz": {
      name: "Sal Temperado Mirtz",
      aliases: ["sal temperado", "sal mirtz", "tempero mirtz", "sal"],
      unitType: "pote", // pot
      defaultQuantityPerKit: 20, // 1 kit = 20 potes
    },
  },

  // Product terminology
  terminology: {
    kit: {
      description: "1 kit = 20 potes de Sal Temperado Mirtz",
      equivalentPots: 20,
    },
    pote: {
      description: "Individual pot/jar of spice",
      singular: "pote",
      plural: "potes",
    },
  },

  // Business info
  businessName: "Toque da Terra",
  salespeople: ["Gabriel", "Miriam", "Letícia"],
};

/**
 * Get formatted business context for AI prompts
 */
export function getBusinessContextPrompt(): string {
  return `
BUSINESS CONTEXT - Toque da Terra (Spice Company):

PRODUCT INFORMATION:
- Main Product: Sal Temperado Mirtz (seasoned salt)
- Unit: "pote" (pot/jar)
- 1 kit = 20 potes of Sal Temperado Mirtz

TERMINOLOGY:
- "kit" always means 20 potes
- "pote" or "potes" means individual jars
- When someone says "vendi 3 kits" → quantity: 3, product: "Sal Temperado Mirtz", actual units: 60 potes
- When someone says "vendi 20 potes" → quantity: 20, product: "Sal Temperado Mirtz"

EXAMPLES:
- "vendi 1 kit" → 1 kit (20 potes) of Sal Temperado Mirtz
- "vendi 3 kits" → 3 kits (60 potes) of Sal Temperado Mirtz  
- "vendi 20 potes" → 20 potes of Sal Temperado Mirtz
- Just "temperos" or "sal temperado" → Sal Temperado Mirtz

IMPORTANT: Always normalize product name to "Sal Temperado Mirtz" in the output.
`;
}

/**
 * Normalize product name from user input
 */
export function normalizeProductName(input: string): string {
  const normalized = input.toLowerCase().trim();

  // Check all products and their aliases
  for (const [productName, product] of Object.entries(
    BUSINESS_CONTEXT.products
  )) {
    const allNames = [product.name.toLowerCase(), ...product.aliases];
    if (allNames.some((alias) => normalized.includes(alias))) {
      return product.name;
    }
  }

  // If contains "kit" or "pote", assume it's the main product
  if (normalized.includes("kit") || normalized.includes("pote")) {
    return "Sal Temperado Mirtz";
  }

  // Return as-is if no match
  return input;
}

/**
 * Parse quantity considering kits vs individual pots
 */
export function parseQuantity(
  quantity: number,
  productDescription: string
): {
  quantity: number;
  unit: string;
  equivalentPots: number;
} {
  const desc = productDescription.toLowerCase();

  if (desc.includes("kit")) {
    return {
      quantity,
      unit: "kit",
      equivalentPots:
        quantity * BUSINESS_CONTEXT.terminology.kit.equivalentPots,
    };
  }

  return {
    quantity,
    unit: "pote",
    equivalentPots: quantity,
  };
}
