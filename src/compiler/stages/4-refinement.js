/**
 * Stage 4: Refinement
 * Run validation, fix issues via targeted LLM repair, loop until clean or max retries
 */
import { callLLM } from '../llm/geminiClient';
import { AppConfigSchema, appConfigToJsonSchema } from '../schemas';
import { validateAppConfig } from '../validation/validator';
import { preRepairSanitize } from '../validation/repairEngine';

const SYSTEM_PROMPT = `You are an expert application configuration repair specialist. You are given an application config that has validation errors. Your job is to fix ONLY the specific issues listed while preserving all correct parts.

RULES:
1. Fix ONLY the listed errors — do not change anything that is already correct
2. Maintain cross-layer consistency after repairs
3. If adding missing fields, use sensible defaults
4. If fixing type mismatches, prefer the DB schema as source of truth
5. Preserve all existing component IDs, route paths, and table names unless they are the error
6. EVERY component MUST have a unique, non-null "id" field
7. Return the COMPLETE fixed configuration (not just the changed parts)`;

export async function refineConfig(config, llmConfig, maxCycles = 3) {
  let currentConfig = config;
  const repairLog = [];

  for (let cycle = 0; cycle < maxCycles; cycle++) {
    // Run validation
    const errors = validateAppConfig(currentConfig);

    if (errors.length === 0) {
      return {
        data: currentConfig,
        repairLog,
        repairCycles: cycle,
        isValid: true,
        validationErrors: [],
      };
    }

    console.log(`[Refinement] Cycle ${cycle + 1}: ${errors.length} errors found`);
    repairLog.push({
      cycle: cycle + 1,
      errorCount: errors.length,
      errors: errors.slice(0, 10), // Cap logged errors
    });

    // Classify errors by severity
    const criticalErrors = errors.filter(e => e.severity === 'error');
    const warnings = errors.filter(e => e.severity === 'warning');

    // If only warnings remain, accept the config
    if (criticalErrors.length === 0) {
      return {
        data: currentConfig,
        repairLog,
        repairCycles: cycle,
        isValid: true,
        validationErrors: warnings,
      };
    }

    // Build targeted repair prompt — include ALL errors (critical + warnings)
    // so the LLM can see the full picture and fix everything
    const allErrors = [...criticalErrors, ...warnings];
    const errorSummary = allErrors.slice(0, 25).map((e, i) =>
      `${i + 1}. [${e.severity.toUpperCase()}] [${e.type}] ${e.path}: ${e.message}${e.suggestedFix ? ` → Fix: ${e.suggestedFix}` : ''}`
    ).join('\n');

    const prompt = `Fix the following ${allErrors.length} validation errors in this application configuration.

ERRORS TO FIX (${criticalErrors.length} critical, ${warnings.length} warnings):
${errorSummary}

CRITICAL RULES FOR FIXING:
1. EVERY UI component MUST have a unique, non-null, non-empty "id" field (use format: "{pageName}-{type}-{index}")
2. All "required" boolean fields default to false if not specified
3. All "description" string fields default to "No description provided" if not specified
4. Auth roles MUST have numeric "level" and boolean "isDefault" fields
5. Column type must be one of: string, number, boolean, date, text, email, enum, id, currency, url, password
6. API field type must be one of: string, number, boolean, date, email, enum, id, array, currency, text, url

CURRENT CONFIGURATION:
${JSON.stringify(currentConfig, null, 2)}

Fix ALL listed errors and return the COMPLETE corrected configuration. Do not omit any parts of the config.`;

    try {
      const result = await callLLM({
        ...llmConfig,
        prompt,
        systemPrompt: SYSTEM_PROMPT,
        jsonSchema: appConfigToJsonSchema(),
        stageName: `refinement-cycle-${cycle + 1}`,
        temperature: 0.05,
      });

      // Pre-repair sanitize the LLM repair output
      let repairedData = result.data;
      const sanitized = preRepairSanitize(repairedData);
      repairedData = sanitized.config;
      if (sanitized.fixedCount > 0) {
        console.log(`[Refinement] Cycle ${cycle + 1}: Pre-repair sanitized ${sanitized.fixedCount} issues`);
      }

      // Validate structure with Zod
      const validated = AppConfigSchema.safeParse(repairedData);

      if (validated.success) {
        currentConfig = validated.data;
      } else {
        // If Zod validation fails, try using the sanitized data
        currentConfig = repairedData;
        console.warn(`[Refinement] Cycle ${cycle + 1}: Zod validation failed after repair, using sanitized data`);
      }
    } catch (error) {
      console.error(`[Refinement] Cycle ${cycle + 1} repair failed:`, error.message);
      repairLog.push({
        cycle: cycle + 1,
        error: error.message,
      });
    }
  }

  // Max cycles reached — return best effort
  const finalErrors = validateAppConfig(currentConfig);
  return {
    data: currentConfig,
    repairLog,
    repairCycles: maxCycles,
    isValid: finalErrors.filter(e => e.severity === 'error').length === 0,
    validationErrors: finalErrors,
  };
}
