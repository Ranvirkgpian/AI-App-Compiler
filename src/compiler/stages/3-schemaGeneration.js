/**
 * Stage 3: Schema Generation
 * Convert system design → full app configuration (UI + API + DB + Auth)
 */
import { callLLM } from '../llm/geminiClient';
import { AppConfigSchema, appConfigToJsonSchema } from '../schemas';
import { preRepairSanitize } from '../validation/repairEngine';

const SYSTEM_PROMPT = `You are an expert full-stack application configuration generator. Given a system design, generate a complete, executable application configuration with UI, API, Database, and Auth schemas.

ABSOLUTELY CRITICAL — COMPONENT ID RULES:
- EVERY UI component MUST have a unique, lowercase alphanumeric id using kebab-case
- Format: "{pageName}-{componentType}-{index}" (e.g., "dashboard-stats-1", "contacts-table-1", "login-form-1")
- NEVER leave a component id as null, undefined, or empty string
- Component IDs MUST be unique across ALL pages in the entire application
- If two pages both have a table, their IDs must differ (e.g., "contacts-table-1" vs "orders-table-1")

CRITICAL CROSS-LAYER CONSISTENCY RULES:
1. EVERY API endpoint's requestFields and responseFields MUST match columns in the corresponding DB table
2. EVERY UI component's dataSource MUST reference a valid API endpoint path
3. EVERY UI component's submitTo MUST reference a valid API endpoint path
4. EVERY UI form field name MUST match a field in the corresponding API endpoint
5. EVERY UI table column key MUST match a field in the API response
6. EVERY auth rule route MUST match a page route
7. EVERY protected page's requiredRoles MUST match valid roles in auth.roles
8. DB table names MUST match API endpoint entity names

DATABASE RULES:
- Every table MUST have an "id" column (type: "id", primaryKey: true, required: true)
- User tables MUST have email, password, role columns
- Foreign keys MUST reference existing tables
- Use snake_case for table and column names
- Column type MUST be one of: string, number, boolean, date, text, email, enum, id, currency, url, password

API RULES:
- RESTful paths: /api/[entity] for list, /api/[entity]/:id for single
- CRUD endpoints for every entity: GET (list), GET/:id (read), POST (create), PUT/:id (update), DELETE/:id (delete)
- Auth endpoints: POST /api/auth/login, POST /api/auth/register
- requestFields for POST/PUT must match writable DB columns
- responseFields must match readable DB columns (never return password)
- Field type MUST be one of: string, number, boolean, date, email, enum, id, array, currency, text, url

UI RULES:
- Each page needs at least one component
- Dashboard pages should have stats cards and charts
- List pages should have a table component with all relevant columns
- Form pages should have form components matching API requestFields
- Auth pages should have login/register forms
- Navigation items must map to valid page routes
- Component IDs must be unique across the entire app (NEVER undefined or null)
- Form field type MUST be one of: text, number, email, password, date, select, checkbox, textarea, currency, hidden

AUTH RULES:
- Every page route must have a matching auth rule
- Login and register pages should NOT require auth (requiredRoles: [])
- Admin pages should only allow admin roles
- Every role MUST have a numeric "level" field and a boolean "isDefault" field`;

export async function generateSchemas(design, llmConfig) {
  const prompt = `Generate a COMPLETE, EXECUTABLE application configuration from this system design.

SYSTEM DESIGN:
${JSON.stringify(design, null, 2)}

Generate the full app config with:

1. DATABASE: Tables with columns matching entity fields. Include id, createdAt, updatedAt on every table. Add proper foreign key references.

2. API: RESTful endpoints for every entity (CRUD + list). Auth endpoints. Request/response fields matching DB columns.

3. UI: Pages with components. Each page must have:
   - Appropriate layout type
   - Component(s) with UNIQUE IDs in format "{pageName}-{type}-{index}" (e.g., "dashboard-stats-1")
   - CRITICAL: Every component MUST have a unique, non-null "id" field
   - Forms with fields matching API request schemas
   - Tables with columns matching API response schemas
   - Charts and stats for dashboard/analytics pages
   - Proper requiredRoles matching auth roles

4. AUTH: Role definitions with hierarchy levels (numeric "level" field). Route-based auth rules for every page. Login page route. Default redirect. Every role needs "isDefault" (boolean) and "level" (number).

METADATA: Set generatedAt to "${new Date().toISOString()}" and version to "1.0.0".

THIS IS CRITICAL: Every field reference must be consistent across ALL layers. If a DB table has a "name" column, the API endpoint must include "name" in request/response fields, and the UI form must have a "name" field.

REMINDER: ALL component IDs must be unique, non-null strings. Use the pattern: "{pageName}-{componentType}-{number}".`;

  const result = await callLLM({
    ...llmConfig,
    prompt,
    systemPrompt: SYSTEM_PROMPT,
    jsonSchema: appConfigToJsonSchema(),
    stageName: 'schema-generation',
    temperature: 0.05, // Very low for determinism
  });

  // Pre-repair sanitize: fix missing IDs, descriptions, type mismatches before Zod
  let dataToValidate = result.data;
  const sanitized = preRepairSanitize(dataToValidate);
  dataToValidate = sanitized.config;
  if (sanitized.fixedCount > 0) {
    console.log(`[Stage3] Pre-repair sanitized ${sanitized.fixedCount} issues before Zod validation`);
  }

  // Validate with Zod
  const validated = AppConfigSchema.safeParse(dataToValidate);

  if (!validated.success) {
    return {
      data: dataToValidate, // Return sanitized data even if Zod fails
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
