import { z } from 'zod';

/**
 * Schema for Stage 1: Intent Extraction output
 * Parses raw user prompt into structured intent
 */
export const IntentSchema = z.object({
  appName: z.string().min(1).describe('Name of the application'),
  appType: z.string().min(1).describe('Category: CRM, e-commerce, blog, etc.'),
  description: z.string().min(1).describe('Brief description of the application purpose'),

  entities: z.array(z.object({
    name: z.string().min(1),
    description: z.string().optional().default('No description provided'),
    isCore: z.boolean().optional().default(false).describe('Whether this is a core entity'),
  })).min(1).describe('Data entities identified in the prompt'),

  features: z.array(z.object({
    name: z.string().min(1),
    description: z.string().optional().default('No description provided'),
    priority: z.enum(['must-have', 'nice-to-have']).optional().default('must-have'),
    relatedEntities: z.array(z.string()).optional().default([]),
  })).min(1).describe('Features/capabilities requested'),

  roles: z.array(z.object({
    name: z.string().min(1),
    description: z.string().optional().default('No description provided'),
    isDefault: z.boolean().optional().default(false).describe('Whether this is the default role for new users'),
  })).min(1).describe('User roles identified'),

  businessRules: z.array(z.object({
    name: z.string().min(1),
    description: z.string().optional().default('No description provided'),
    type: z.enum(['access-control', 'data-validation', 'workflow', 'billing', 'notification', 'other']).optional().default('other'),
    involvedRoles: z.array(z.string()).optional().default([]),
    involvedEntities: z.array(z.string()).optional().default([]),
  })).optional().default([]).describe('Business logic rules extracted'),

  assumptions: z.array(z.object({
    assumption: z.string().min(1),
    reason: z.string().optional().default('Implied from context'),
  })).optional().default([]).describe('Assumptions made for underspecified parts'),

  clarifications: z.array(z.object({
    question: z.string().min(1),
    impact: z.string().optional().default('Minor impact'),
    defaultChoice: z.string().optional().default('Use default'),
  })).optional().default([]).describe('Questions for ambiguous requirements'),
});

/**
 * Convert Zod schema to JSON Schema for LLM structured output
 */
export function intentToJsonSchema() {
  return {
    type: "object",
    properties: {
      appName: { type: "string" },
      appType: { type: "string" },
      description: { type: "string" },
      entities: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            description: { type: "string" },
            isCore: { type: "boolean" }
          },
          required: ["name", "description", "isCore"]
        }
      },
      features: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            description: { type: "string" },
            priority: { type: "string", enum: ["must-have", "nice-to-have"] },
            relatedEntities: { type: "array", items: { type: "string" } }
          },
          required: ["name", "description", "priority", "relatedEntities"]
        }
      },
      roles: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            description: { type: "string" },
            isDefault: { type: "boolean" }
          },
          required: ["name", "description", "isDefault"]
        }
      },
      businessRules: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            description: { type: "string" },
            type: { type: "string", enum: ["access-control", "data-validation", "workflow", "billing", "notification", "other"] },
            involvedRoles: { type: "array", items: { type: "string" } },
            involvedEntities: { type: "array", items: { type: "string" } }
          },
          required: ["name", "description", "type", "involvedRoles", "involvedEntities"]
        }
      },
      assumptions: {
        type: "array",
        items: {
          type: "object",
          properties: {
            assumption: { type: "string" },
            reason: { type: "string" }
          },
          required: ["assumption", "reason"]
        }
      },
      clarifications: {
        type: "array",
        items: {
          type: "object",
          properties: {
            question: { type: "string" },
            impact: { type: "string" },
            defaultChoice: { type: "string" }
          },
          required: ["question", "impact", "defaultChoice"]
        }
      }
    },
    required: ["appName", "appType", "description", "entities", "features", "roles", "businessRules", "assumptions", "clarifications"]
  };
}
