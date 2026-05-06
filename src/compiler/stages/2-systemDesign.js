/**
 * Stage 2: System Design
 * Convert extracted intent → app architecture (entities, flows, roles, pages)
 */
import { callLLM } from '../llm/geminiClient';
import { DesignSchema, designToJsonSchema } from '../schemas';

const SYSTEM_PROMPT = `You are an expert software architect. Given a structured intent for an application, design a complete system architecture.

RULES:
1. Every entity MUST have an "id" field (type: "id", required: true, unique: true)
2. Every entity MUST have "createdAt" and "updatedAt" fields (type: "date")
3. User-type entities MUST have "email" (type: "email", unique: true) and "password" (type: "password") fields
4. Define ALL relations between entities with proper foreign keys
5. Design realistic user flows that cover the main use cases
6. Every role MUST have specific CRUD permissions for every entity
7. Design pages that cover ALL features — dashboard, CRUD pages, auth pages
8. Routes must be unique and use kebab-case (e.g., /contacts, /admin/analytics)
9. Each page must list the UI components it will contain (table, form, chart, stats, card)
10. Required roles array on pages controls access — empty array means public

FIELD TYPE RULES:
- Use "string" for names, titles
- Use "email" for email addresses
- Use "password" for passwords  
- Use "text" for long text/descriptions
- Use "number" for quantities, counts, amounts
- Use "currency" for money/prices
- Use "boolean" for flags/toggles
- Use "date" for timestamps
- Use "enum" for fixed choice fields (must include enumValues)
- Use "id" for identifiers and foreign keys
- Use "url" for URLs`;

export async function designSystem(intent, llmConfig) {
  const prompt = `Design a complete system architecture for the following application intent.

APPLICATION INTENT:
${JSON.stringify(intent, null, 2)}

Design the system with:
1. ENTITIES: Full field definitions with types, required flags, relations. Every entity needs id, createdAt, updatedAt.
2. FLOWS: User journeys (registration flow, main workflow, admin operations)
3. ROLES: Detailed CRUD permission matrix for every entity
4. PAGES: All UI pages with routes, layouts, component types, and access control

Make this comprehensive. Every feature from the intent must map to at least one page and one entity.`;

  const result = await callLLM({
    ...llmConfig,
    prompt,
    systemPrompt: SYSTEM_PROMPT,
    jsonSchema: designToJsonSchema(),
    stageName: 'system-design',
  });

  // Validate with Zod
  const validated = DesignSchema.safeParse(result.data);

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
