import { IntentExtractor } from "./IntentExtractor";
import { MultiLLMExtractor } from "./MultiLLMExtractor";

/**
 * Factory to switch between extractors
 * Set USE_MULTI_LLM=true in .env to use the cheaper multi-LLM approach
 */
export class ExtractorFactory {
  static create(): IntentExtractor | MultiLLMExtractor {
    const useMultiLLM = process.env.USE_MULTI_LLM === "true";

    if (useMultiLLM) {
      console.log("🔀 Using Multi-LLM Extractor (Cost-Optimized)");
      return new MultiLLMExtractor();
    } else {
      console.log("🔀 Using Single LLM Extractor (GPT-4o)");
      return new IntentExtractor();
    }
  }
}

/**
 * HOW TO SWITCH:
 * 
 * Option 1: Single GPT-4o (Current - Simple)
 * - Set USE_MULTI_LLM=false (or leave unset)
 * - All calls use GPT-4o
 * - Cost: ~$0.01 per message
 * - Best for: Low volume, simplicity
 * 
 * Option 2: Multi-LLM (Cost-Optimized)
 * - Set USE_MULTI_LLM=true
 * - Uses gpt-4o-mini for most tasks
 * - Cost: ~$0.001 per message (90% savings!)
 * - Best for: High volume, cost savings
 * 
 * TO SWITCH:
 * Just add to .env:
 * USE_MULTI_LLM=true
 * 
 * Then restart server!
 */

