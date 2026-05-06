/**
 * Stage 1: Intent Extraction
 * Parse raw user prompt into structured intent object
 */
import { callLLM } from '../llm/geminiClient';
import { IntentSchema, intentToJsonSchema } from '../schemas';

const SYSTEM_PROMPT = `You are an expert software requirements analyst. Your job is to analyze a natural language description of a software application and extract a structured intent object.

RULES:
1. Identify ALL entities (data objects) mentioned or implied in the description
2. Extract ALL features explicitly mentioned AND commonly needed features for the app type
3. Identify ALL user roles (at minimum: admin, regular user)
4. Extract business rules — especially access control, gating, validation rules
5. For VAGUE or UNDERSPECIFIED inputs, make reasonable assumptions and document them
6. For AMBIGUOUS inputs, provide clarification questions with default choices
7. Be thorough — missing entities or features at this stage causes downstream failures
8. Always include an "id" and common fields (createdAt, updatedAt) as implied for each entity

CRITICAL: Every identified entity MUST have a clear name. Every feature MUST map to at least one entity. Every role MUST have a description of their access level.`;

export async function extractIntent(userPrompt, llmConfig) {
  const prompt = `Analyze the following application description and extract a complete structured intent.

USER'S APPLICATION DESCRIPTION:
"""
${userPrompt}
"""

Extract:
- appName: A suitable name for this application
- appType: The category (CRM, e-commerce, blog, project-management, etc.)
- description: Brief summary of the application
- entities: All data objects (users, products, orders, etc.) with descriptions
- features: All capabilities needed, with priority levels
- roles: All user roles with descriptions
- businessRules: Business logic, access control, validation rules
- assumptions: Things you assumed because the description was incomplete
- clarifications: Questions about ambiguous requirements (with default choices)

Be exhaustive. Missing items here will break downstream generation.`;

  const result = await callLLM({
    ...llmConfig,
    prompt,
    systemPrompt: SYSTEM_PROMPT,
    jsonSchema: intentToJsonSchema(),
    stageName: 'intent-extraction',
  });

  // Validate with Zod
  const validated = IntentSchema.safeParse(result.data);

  if (!validated.success) {
    return {
      data: result.data,
      metrics: result.metrics,
      validationErrors: validated.error.issues,
      isValid: false,
    };
  }

  return {
    data: validated.data,
    metrics: result.metrics,
    validationErrors: [],
    isValid: true,
  };
}
