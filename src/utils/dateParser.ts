import {
  startOfDay,
  subDays,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  subWeeks,
  subMonths,
  parseISO,
  isValid,
  isFuture,
} from "date-fns";
import { logger } from "./logger";

export interface ParsedDate {
  date: Date;
  confidence: "high" | "medium" | "low";
  wasAmbiguous: boolean;
}

/**
 * Parse Portuguese date expressions
 * ALWAYS defaults to PAST dates for sales
 */
export function parsePortugueseDate(input: string): ParsedDate {
  const normalized = input.toLowerCase().trim();
  const today = startOfDay(new Date());

  // Exact matches (high confidence)
  if (["hoje", "hj"].includes(normalized)) {
    return { date: today, confidence: "high", wasAmbiguous: false };
  }

  if (["ontem"].includes(normalized)) {
    return { date: subDays(today, 1), confidence: "high", wasAmbiguous: false };
  }

  if (["anteontem"].includes(normalized)) {
    return { date: subDays(today, 2), confidence: "high", wasAmbiguous: false };
  }

  // Week references (default to LAST week)
  if (
    normalized.includes("essa semana") ||
    normalized.includes("esta semana")
  ) {
    return {
      date: startOfWeek(today, { weekStartsOn: 0 }),
      confidence: "high",
      wasAmbiguous: false,
    };
  }

  if (normalized.includes("semana passada")) {
    return {
      date: startOfWeek(subWeeks(today, 1), { weekStartsOn: 0 }),
      confidence: "high",
      wasAmbiguous: false,
    };
  }

  // Month references (default to start of month)
  if (normalized.includes("esse mes") || normalized.includes("este mês")) {
    return {
      date: startOfMonth(today),
      confidence: "high",
      wasAmbiguous: false,
    };
  }

  if (
    normalized.includes("mes passado") ||
    normalized.includes("mês passado")
  ) {
    return {
      date: startOfMonth(subMonths(today, 1)),
      confidence: "high",
      wasAmbiguous: false,
    };
  }

  // Weekday names (ambiguous - default to LAST occurrence)
  const weekdays: Record<string, number> = {
    domingo: 0,
    segunda: 1,
    terca: 2,
    terça: 2,
    quarta: 3,
    quinta: 4,
    sexta: 5,
    sabado: 6,
    sábado: 6,
  };

  for (const [day, dayNum] of Object.entries(weekdays)) {
    if (normalized.includes(day)) {
      const currentDayNum = today.getDay();
      let daysAgo = currentDayNum - dayNum;

      // If it's today or future, go back a week
      if (daysAgo <= 0) {
        daysAgo += 7;
      }

      return {
        date: subDays(today, daysAgo),
        confidence: "medium",
        wasAmbiguous: true,
      };
    }
  }

  // Try to parse as ISO date (YYYY-MM-DD)
  try {
    const parsed = parseISO(input);
    if (isValid(parsed)) {
      // Check if future date - should be past for sales
      if (isFuture(parsed)) {
        logger.warn("Future date detected, using today instead", {
          input,
          parsed,
        });
        return { date: today, confidence: "low", wasAmbiguous: true };
      }
      return { date: parsed, confidence: "high", wasAmbiguous: false };
    }
  } catch (e) {
    // Continue to default
  }

  // Default to today if can't parse
  logger.debug("Could not parse date, defaulting to today", { input });
  return { date: today, confidence: "low", wasAmbiguous: true };
}

/**
 * Get date range from filter expression
 */
export function parseDateRange(input: string): {
  startDate: Date;
  endDate: Date;
} {
  const normalized = input.toLowerCase().trim();
  const today = startOfDay(new Date());

  if (normalized.includes("hoje")) {
    return { startDate: today, endDate: today };
  }

  if (
    normalized.includes("essa semana") ||
    normalized.includes("esta semana")
  ) {
    return {
      startDate: startOfWeek(today, { weekStartsOn: 0 }),
      endDate: endOfWeek(today, { weekStartsOn: 0 }),
    };
  }

  if (normalized.includes("semana passada")) {
    const lastWeek = subWeeks(today, 1);
    return {
      startDate: startOfWeek(lastWeek, { weekStartsOn: 0 }),
      endDate: endOfWeek(lastWeek, { weekStartsOn: 0 }),
    };
  }

  if (normalized.includes("esse mes") || normalized.includes("este mês")) {
    return {
      startDate: startOfMonth(today),
      endDate: endOfMonth(today),
    };
  }

  if (
    normalized.includes("mes passado") ||
    normalized.includes("mês passado")
  ) {
    const lastMonth = subMonths(today, 1);
    return {
      startDate: startOfMonth(lastMonth),
      endDate: endOfMonth(lastMonth),
    };
  }

  // Default: last 30 days
  return {
    startDate: subDays(today, 30),
    endDate: today,
  };
}
