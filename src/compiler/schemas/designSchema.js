import { z } from 'zod';

/**
 * Schema for Stage 2: System Design output
 * Converts intent into app architecture
 */

const FieldSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['string', 'number', 'boolean', 'date', 'email', 'password', 'text', 'enum', 'id', 'url', 'currency']),
  required: z.boolean().optional().default(false),
  unique: z.boolean().optional(),
  defaultValue: z.any().optional(),
  enumValues: z.array(z.string()).optional(),
  description: z.string().optional(),
});

const RelationSchema = z.object({
  targetEntity: z.string().min(1),
  type: z.enum(['one-to-one', 'one-to-many', 'many-to-many']),
  foreignKey: z.string().optional(),
  description: z.string().optional().default('No description provided'),
});

const EntityDesignSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional().default('No description provided'),
  fields: z.array(FieldSchema).min(1),
  relations: z.array(RelationSchema).optional().default([]),
  isUserEntity: z.boolean().optional(),
});

const FlowStepSchema = z.object({
  step: z.number(),
  action: z.string().min(1),
  page: z.string().optional(),
  description: z.string().optional().default('No description provided'),
});

const FlowSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional().default('No description provided'),
  actor: z.string().min(1),
  steps: z.array(FlowStepSchema).min(1),
});

const PermissionSchema = z.object({
  entity: z.string().min(1),
  actions: z.array(z.enum(['create', 'read', 'update', 'delete', 'list', 'manage'])),
});

const RoleDesignSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional().default('No description provided'),
  permissions: z.array(PermissionSchema).min(1),
  isDefault: z.boolean().optional().default(false),
});

const PageDesignSchema = z.object({
  name: z.string().min(1),
  route: z.string().min(1),
  description: z.string().optional().default('No description provided'),
  layout: z.enum(['dashboard', 'form', 'list', 'detail', 'landing', 'auth', 'settings', 'analytics']),
  components: z.array(z.string()).min(1),
  requiredRoles: z.array(z.string()).optional().default([]),
  relatedEntities: z.array(z.string()).optional().default([]),
});

export const DesignSchema = z.object({
  appName: z.string().min(1),
  appDescription: z.string().optional().default('No description provided'),
  entities: z.array(EntityDesignSchema).min(1),
  flows: z.array(FlowSchema).optional().default([]),
  roles: z.array(RoleDesignSchema).min(1),
  pages: z.array(PageDesignSchema).min(1),
});

export function designToJsonSchema() {
  return {
    type: "object",
    properties: {
      appName: { type: "string" },
      appDescription: { type: "string" },
      entities: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            description: { type: "string" },
            fields: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  type: { type: "string", enum: ["string", "number", "boolean", "date", "email", "password", "text", "enum", "id", "url", "currency"] },
                  required: { type: "boolean" },
                  unique: { type: "boolean" },
                  defaultValue: { type: "string" },
                  enumValues: { type: "array", items: { type: "string" } },
                  description: { type: "string" }
                },
                required: ["name", "type", "required"]
              }
            },
            relations: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  targetEntity: { type: "string" },
                  type: { type: "string", enum: ["one-to-one", "one-to-many", "many-to-many"] },
                  foreignKey: { type: "string" },
                  description: { type: "string" }
                },
                required: ["targetEntity", "type"]
              }
            },
            isUserEntity: { type: "boolean" }
          },
          required: ["name", "description", "fields", "relations"]
        }
      },
      flows: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            description: { type: "string" },
            actor: { type: "string" },
            steps: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  step: { type: "number" },
                  action: { type: "string" },
                  page: { type: "string" },
                  description: { type: "string" }
                },
                required: ["step", "action", "description"]
              }
            }
          },
          required: ["name", "description", "actor", "steps"]
        }
      },
      roles: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            description: { type: "string" },
            permissions: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  entity: { type: "string" },
                  actions: { type: "array", items: { type: "string", enum: ["create", "read", "update", "delete", "list", "manage"] } }
                },
                required: ["entity", "actions"]
              }
            },
            isDefault: { type: "boolean" }
          },
          required: ["name", "description", "permissions", "isDefault"]
        }
      },
      pages: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            route: { type: "string" },
            description: { type: "string" },
            layout: { type: "string", enum: ["dashboard", "form", "list", "detail", "landing", "auth", "settings", "analytics"] },
            components: { type: "array", items: { type: "string" } },
            requiredRoles: { type: "array", items: { type: "string" } },
            relatedEntities: { type: "array", items: { type: "string" } }
          },
          required: ["name", "route", "description", "layout", "components", "requiredRoles", "relatedEntities"]
        }
      }
    },
    required: ["appName", "appDescription", "entities", "flows", "roles", "pages"]
  };
}
