/**
 * Pipeline Orchestrator
 * Runs all 4 stages sequentially, tracking metrics and errors
 * Supports stage-level repair and re-run
 * 
 * For Groq free tier: adds 5s delay between stages to stay under 12k TPM
 */
import { extractIntent } from './stages/1-intentExtraction';
import { designSystem } from './stages/2-systemDesign';
import { generateSchemas } from './stages/3-schemaGeneration';
import { refineConfig } from './stages/4-refinement';
import { autoRepair, classifyErrors, preRepairSanitize } from './validation/repairEngine';
import { validateAppConfig } from './validation/validator';
import { AppConfigSchema } from './schemas';
import { getMetrics, resetMetrics } from './llm/geminiClient';

/** Delay between stages to avoid Groq TPM limits */
const GROQ_INTER_STAGE_DELAY_MS = 15000;
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

const STAGE_NAMES = [
  'Intent Extraction',
  'System Design',
  'Schema Generation',
  'Refinement',
];

/**
 * Run the complete compilation pipeline
 * @param {string} userPrompt - Raw user input
 * @param {Object} llmConfig - { provider, apiKey }
 * @param {Function} onStageUpdate - Callback for stage progress updates
 * @returns {Object} Pipeline result with all stages' data and metrics
 */
export async function runPipeline(userPrompt, llmConfig, onStageUpdate = () => {}) {
  resetMetrics();

  const pipelineStart = Date.now();
  const result = {
    stages: [],
    finalConfig: null,
    isSuccess: false,
    totalLatencyMs: 0,
    validationErrors: [],
    repairCycles: 0,
    metrics: null,
  };

  try {
    // ========= STAGE 1: Intent Extraction =========
    onStageUpdate(0, 'running', 'Extracting intent from prompt...');
    const stage1Start = Date.now();

    let intentResult;
    try {
      intentResult = await extractIntent(userPrompt, llmConfig);
    } catch (error) {
      onStageUpdate(0, 'error', error.message);
      result.stages.push({
        name: STAGE_NAMES[0],
        status: 'error',
        error: error.message,
        latencyMs: Date.now() - stage1Start,
      });
      throw error;
    }

    const stage1Latency = Date.now() - stage1Start;
    result.stages.push({
      name: STAGE_NAMES[0],
      status: intentResult.isValid ? 'complete' : 'warning',
      data: intentResult.data,
      validationErrors: intentResult.validationErrors,
      latencyMs: stage1Latency,
      metrics: intentResult.metrics,
    });

    onStageUpdate(0, intentResult.isValid ? 'complete' : 'warning',
      `Extracted ${intentResult.data?.entities?.length || 0} entities, ${intentResult.data?.features?.length || 0} features`);

    // Inter-stage delay for Groq rate limits
    if (llmConfig.provider === 'groq') {
      onStageUpdate(1, 'pending', 'Waiting for rate limit cooldown...');
      await sleep(GROQ_INTER_STAGE_DELAY_MS);
    }

    // ========= STAGE 2: System Design =========
    onStageUpdate(1, 'running', 'Designing system architecture...');
    const stage2Start = Date.now();

    let designResult;
    try {
      designResult = await designSystem(intentResult.data, llmConfig);
    } catch (error) {
      onStageUpdate(1, 'error', error.message);
      result.stages.push({
        name: STAGE_NAMES[1],
        status: 'error',
        error: error.message,
        latencyMs: Date.now() - stage2Start,
      });
      throw error;
    }

    const stage2Latency = Date.now() - stage2Start;
    result.stages.push({
      name: STAGE_NAMES[1],
      status: designResult.isValid ? 'complete' : 'warning',
      data: designResult.data,
      validationErrors: designResult.validationErrors,
      latencyMs: stage2Latency,
      metrics: designResult.metrics,
    });

    onStageUpdate(1, designResult.isValid ? 'complete' : 'warning',
      `Designed ${designResult.data?.entities?.length || 0} entities, ${designResult.data?.pages?.length || 0} pages`);

    // Inter-stage delay for Groq rate limits
    if (llmConfig.provider === 'groq') {
      onStageUpdate(2, 'pending', 'Waiting for rate limit cooldown...');
      await sleep(GROQ_INTER_STAGE_DELAY_MS);
    }

    // ========= STAGE 3: Schema Generation =========
    onStageUpdate(2, 'running', 'Generating application schemas...');
    const stage3Start = Date.now();

    let schemaResult;
    try {
      schemaResult = await generateSchemas(designResult.data, llmConfig);
    } catch (error) {
      onStageUpdate(2, 'error', error.message);
      result.stages.push({
        name: STAGE_NAMES[2],
        status: 'error',
        error: error.message,
        latencyMs: Date.now() - stage3Start,
      });
      throw error;
    }

    const stage3Latency = Date.now() - stage3Start;
    result.stages.push({
      name: STAGE_NAMES[2],
      status: schemaResult.isValid ? 'complete' : 'warning',
      data: schemaResult.data,
      validationErrors: schemaResult.validationErrors,
      latencyMs: stage3Latency,
      metrics: schemaResult.metrics,
    });

    onStageUpdate(2, schemaResult.isValid ? 'complete' : 'warning',
      `Generated ${schemaResult.data?.database?.tables?.length || 0} tables, ${schemaResult.data?.api?.endpoints?.length || 0} endpoints, ${schemaResult.data?.ui?.pages?.length || 0} pages`);

    // ========= PRE-REPAIR SANITIZE =========
    // Fix common LLM omissions (undefined IDs, missing fields) before validation
    let configToRefine = schemaResult.data;
    const sanitized = preRepairSanitize(configToRefine);
    configToRefine = sanitized.config;
    if (sanitized.fixedCount > 0) {
      console.log(`[Pipeline] Pre-repair sanitized ${sanitized.fixedCount} issues`);
    }

    // Re-validate with Zod after sanitization (to apply defaults)
    try {
      const reValidated = AppConfigSchema.safeParse(configToRefine);
      if (reValidated.success) {
        configToRefine = reValidated.data;
        console.log('[Pipeline] Zod re-validation passed after sanitization');
      }
    } catch (e) {
      console.warn('[Pipeline] Zod re-validation failed, continuing with sanitized config');
    }

    // ========= AUTO-REPAIR PASS =========
    // Run auto-repair (deterministic, no LLM needed)
    const preValidation = validateAppConfig(configToRefine);
    if (preValidation.length > 0) {
      const classified = classifyErrors(preValidation);
      if (classified.autoFixableCount > 0) {
        const repaired = autoRepair(configToRefine, preValidation);
        configToRefine = repaired.config;
        console.log(`[Pipeline] Auto-repaired ${repaired.fixedCount} issues`);
      }
    }

    // Inter-stage delay for Groq rate limits
    if (llmConfig.provider === 'groq') {
      onStageUpdate(3, 'pending', 'Waiting for rate limit cooldown...');
      await sleep(GROQ_INTER_STAGE_DELAY_MS);
    }

    // ========= STAGE 4: Refinement =========
    onStageUpdate(3, 'running', 'Validating and refining...');
    const stage4Start = Date.now();

    let refinementResult;
    try {
      refinementResult = await refineConfig(configToRefine, llmConfig, 2);
    } catch (error) {
      // If refinement fails, use the auto-repaired config
      console.warn('[Pipeline] Refinement LLM failed, using auto-repaired config');
      refinementResult = {
        data: configToRefine,
        repairLog: [{ error: error.message }],
        repairCycles: 0,
        isValid: false,
        validationErrors: validateAppConfig(configToRefine),
      };
    }

    const stage4Latency = Date.now() - stage4Start;
    result.stages.push({
      name: STAGE_NAMES[3],
      status: refinementResult.isValid ? 'complete' : 'warning',
      data: refinementResult.data,
      validationErrors: refinementResult.validationErrors,
      repairLog: refinementResult.repairLog,
      repairCycles: refinementResult.repairCycles,
      latencyMs: stage4Latency,
    });

    onStageUpdate(3, refinementResult.isValid ? 'complete' : 'warning',
      `${refinementResult.repairCycles} repair cycles, ${refinementResult.validationErrors?.length || 0} remaining issues`);

    // ========= PIPELINE COMPLETE =========
    result.finalConfig = refinementResult.data;
    result.isSuccess = true;
    result.validationErrors = refinementResult.validationErrors || [];
    result.repairCycles = refinementResult.repairCycles;
    result.totalLatencyMs = Date.now() - pipelineStart;
    result.metrics = getMetrics();

  } catch (error) {
    result.isSuccess = false;
    result.error = error.message;
    result.totalLatencyMs = Date.now() - pipelineStart;
    result.metrics = getMetrics();
  }

  return result;
}

export { STAGE_NAMES };
