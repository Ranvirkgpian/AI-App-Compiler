/**
 * Evaluation Runner
 * Runs test prompts through the pipeline and collects metrics
 */
import { runPipeline } from '../compiler/pipeline';

/**
 * Run a single test case through the pipeline
 */
export async function evaluateTestCase(testCase, llmConfig, onProgress) {
  const startTime = Date.now();

  try {
    const result = await runPipeline(testCase.prompt, llmConfig, (stage, status, message) => {
      onProgress?.({ testCaseId: testCase.id, stage, status, message });
    });

    const latency = Date.now() - startTime;

    return {
      id: testCase.id,
      name: testCase.name,
      prompt: testCase.prompt,
      success: result.isSuccess,
      latencyMs: latency,
      stages: result.stages?.map(s => ({
        name: s.name,
        status: s.status,
        latencyMs: s.latencyMs,
      })),
      validationErrors: result.validationErrors?.length || 0,
      repairCycles: result.repairCycles || 0,
      metrics: result.metrics,
      hasUI: result.finalConfig?.ui?.pages?.length > 0,
      hasAPI: result.finalConfig?.api?.endpoints?.length > 0,
      hasDB: result.finalConfig?.database?.tables?.length > 0,
      hasAuth: result.finalConfig?.auth?.roles?.length > 0,
      tableCount: result.finalConfig?.database?.tables?.length || 0,
      endpointCount: result.finalConfig?.api?.endpoints?.length || 0,
      pageCount: result.finalConfig?.ui?.pages?.length || 0,
      error: result.error || null,
    };
  } catch (error) {
    return {
      id: testCase.id,
      name: testCase.name,
      prompt: testCase.prompt,
      success: false,
      latencyMs: Date.now() - startTime,
      error: error.message,
      validationErrors: 0,
      repairCycles: 0,
    };
  }
}

/**
 * Compute aggregate metrics from evaluation results
 */
export function computeAggregateMetrics(results) {
  const total = results.length;
  const successes = results.filter(r => r.success);
  const failures = results.filter(r => !r.success);

  const avgLatency = results.reduce((sum, r) => sum + (r.latencyMs || 0), 0) / total;
  const totalRepairs = results.reduce((sum, r) => sum + (r.repairCycles || 0), 0);
  const totalErrors = results.reduce((sum, r) => sum + (r.validationErrors || 0), 0);

  // Failure type breakdown
  const failureTypes = {};
  for (const f of failures) {
    const type = categorizeFailure(f);
    failureTypes[type] = (failureTypes[type] || 0) + 1;
  }

  return {
    total,
    successCount: successes.length,
    failureCount: failures.length,
    successRate: ((successes.length / total) * 100).toFixed(1),
    avgLatencyMs: Math.round(avgLatency),
    avgLatencySeconds: (avgLatency / 1000).toFixed(1),
    totalRepairCycles: totalRepairs,
    avgRepairCycles: (totalRepairs / total).toFixed(1),
    totalValidationErrors: totalErrors,
    failureTypes,
    completenessScore: computeCompletenessScore(results),
  };
}

function categorizeFailure(result) {
  if (result.error?.includes('API error')) return 'api-failure';
  if (result.error?.includes('Authentication')) return 'auth-failure';
  if (result.error?.includes('parse')) return 'parse-failure';
  if (result.validationErrors > 5) return 'validation-failure';
  return 'unknown';
}

function computeCompletenessScore(results) {
  let totalScore = 0;
  let maxScore = 0;

  for (const r of results) {
    maxScore += 4; // 4 categories: UI, API, DB, Auth
    if (r.hasUI) totalScore++;
    if (r.hasAPI) totalScore++;
    if (r.hasDB) totalScore++;
    if (r.hasAuth) totalScore++;
  }

  return maxScore > 0 ? ((totalScore / maxScore) * 100).toFixed(1) : '0';
}
