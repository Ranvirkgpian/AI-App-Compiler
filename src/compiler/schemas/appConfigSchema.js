import { z } from 'zod';

/**
 * Schema for Stage 3+4: Final Application Configuration
 * The master schema — UI + API + DB + Auth fully specified
 */

// ---- DB Schema ----
const ColumnSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['string', 'number', 'boolean', 'date', 'text', 'email', 'enum', 'id', 'currency', 'url', 'password', 'array', 'object', 'timestamp', 'integer', 'float', 'uuid', 'json']),
  required: z.boolean().optional().default(false),
  unique: z.boolean().optional(),
  primaryKey: z.boolean().optional(),
  defaultValue: z.any().optional(),
  enumValues: z.array(z.string()).optional(),
  reference: z.object({
    table: z.string(),
    column: z.string(),
  }).optional(),
});

const TableSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional().default('No description provided'),
  columns: z.array(ColumnSchema).min(1),
});

const DBSchema = z.object({
  tables: z.array(TableSchema).min(1),
});

// ---- API Schema ----
const FieldValidation = z.object({
  name: z.string().min(1),
  type: z.enum(['string', 'number', 'boolean', 'date', 'email', 'enum', 'id', 'array', 'currency', 'text', 'url', 'password', 'object', 'timestamp', 'integer', 'float']),
  required: z.boolean().optional().default(false),
  enumValues: z.array(z.string()).optional(),
});

const EndpointSchema = z.object({
  path: z.string().min(1),
  method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']),
  description: z.string().optional().default('No description provided'),
  entity: z.string().min(1),
  action: z.enum(['create', 'read', 'update', 'delete', 'list', 'search', 'login', 'register', 'custom']),
  requestFields: z.array(FieldValidation).optional().default([]),
  responseFields: z.array(FieldValidation).optional().default([]),
  requiredRoles: z.array(z.string()).optional().default([]),
  requiresAuth: z.boolean().optional().default(false),
});

const APISchema = z.object({
  basePath: z.string().optional().default('/api'),
  endpoints: z.array(EndpointSchema).min(1),
});

// ---- UI Schema ----
const UIComponentSchema = z.object({
  id: z.string().min(1),
  type: z.enum(['table', 'form', 'chart', 'card', 'stats', 'list', 'modal', 'text', 'button', 'image', 'nav', 'hero', 'grid', 'sidebar', 'header', 'footer', 'section', 'container', 'tabs', 'accordion']),
  title: z.string().optional(),
  description: z.string().optional(),
  dataSource: z.string().optional().describe('API endpoint path this component reads from'),
  submitTo: z.string().optional().describe('API endpoint path this component writes to'),
  fields: z.array(z.object({
    name: z.string(),
    label: z.string(),
    type: z.enum(['text', 'number', 'email', 'password', 'date', 'select', 'checkbox', 'textarea', 'currency', 'hidden', 'url', 'file', 'radio', 'toggle', 'range', 'color', 'time', 'datetime']),
    required: z.boolean().optional().default(false),
    options: z.array(z.string()).optional(),
  })).optional(),
  columns: z.array(z.object({
    key: z.string(),
    label: z.string(),
    sortable: z.boolean().optional(),
  })).optional(),
  chartType: z.enum(['bar', 'line', 'pie', 'doughnut', 'area']).optional(),
  chartDataKey: z.string().optional(),
  chartLabelKey: z.string().optional(),
  actions: z.array(z.object({
    label: z.string(),
    type: z.enum(['edit', 'delete', 'view', 'custom', 'navigate', 'submit']),
    target: z.string().optional(),
  })).optional(),
  content: z.string().optional(),
  statsValue: z.string().optional(),
  statsLabel: z.string().optional(),
  icon: z.string().optional(),
});

const PageSchema = z.object({
  name: z.string().min(1),
  route: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional().default('No description provided'),
  layout: z.enum(['dashboard', 'form', 'list', 'detail', 'landing', 'auth', 'settings', 'analytics', 'single-column', 'two-column']),
  icon: z.string().optional(),
  requiredRoles: z.array(z.string()).optional().default([]),
  showInNav: z.boolean().optional().default(true),
  components: z.array(UIComponentSchema).min(1),
});

const NavigationItem = z.object({
  label: z.string().min(1),
  route: z.string().min(1),
  icon: z.string().optional(),
  requiredRoles: z.array(z.string()).optional().default([]),
});

const UISchema = z.object({
  appName: z.string().min(1),
  theme: z.object({
    primaryColor: z.string(),
    accentColor: z.string(),
    mode: z.enum(['dark', 'light']),
  }),
  navigation: z.array(NavigationItem).min(1),
  pages: z.array(PageSchema).min(1),
});

// ---- Auth Schema ----
const AuthRuleSchema = z.object({
  route: z.string().min(1),
  allowedRoles: z.array(z.string()).min(1),
  requiresAuth: z.boolean().optional().default(true),
});

const AuthSchema = z.object({
  roles: z.array(z.object({
    name: z.string().min(1),
    level: z.number().optional().default(0).describe('Hierarchy level, higher = more access'),
    isDefault: z.boolean().optional().default(false),
  })).min(1),
  rules: z.array(AuthRuleSchema).optional().default([]),
  loginPage: z.string().optional().default('/login'),
  defaultRedirect: z.string().optional().default('/'),
});

// ---- Master App Config Schema ----
export const AppConfigSchema = z.object({
  metadata: z.object({
    appName: z.string().min(1),
    version: z.string().optional().default('1.0.0'),
    description: z.string().optional().default('No description provided'),
    generatedAt: z.string().optional().default(() => new Date().toISOString()),
  }),
  database: DBSchema,
  api: APISchema,
  ui: UISchema,
  auth: AuthSchema,
});

export function appConfigToJsonSchema() {
  return {
    type: "object",
    properties: {
      metadata: {
        type: "object",
        properties: {
          appName: { type: "string" },
          version: { type: "string" },
          description: { type: "string" },
          generatedAt: { type: "string" }
        },
        required: ["appName", "version", "description", "generatedAt"]
      },
      database: {
        type: "object",
        properties: {
          tables: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                description: { type: "string" },
                columns: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      name: { type: "string" },
                      type: { type: "string", enum: ["string", "number", "boolean", "date", "text", "email", "enum", "id", "currency", "url", "password"] },
                      required: { type: "boolean" },
                      unique: { type: "boolean" },
                      primaryKey: { type: "boolean" },
                      defaultValue: { type: "string" },
                      enumValues: { type: "array", items: { type: "string" } },
                      reference: {
                        type: "object",
                        properties: {
                          table: { type: "string" },
                          column: { type: "string" }
                        },
                        required: ["table", "column"]
                      }
                    },
                    required: ["name", "type", "required"]
                  }
                }
              },
              required: ["name", "description", "columns"]
            }
          }
        },
        required: ["tables"]
      },
      api: {
        type: "object",
        properties: {
          basePath: { type: "string" },
          endpoints: {
            type: "array",
            items: {
              type: "object",
              properties: {
                path: { type: "string" },
                method: { type: "string", enum: ["GET", "POST", "PUT", "DELETE", "PATCH"] },
                description: { type: "string" },
                entity: { type: "string" },
                action: { type: "string", enum: ["create", "read", "update", "delete", "list", "search", "login", "register", "custom"] },
                requestFields: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      name: { type: "string" },
                      type: { type: "string", enum: ["string", "number", "boolean", "date", "email", "enum", "id", "array", "currency"] },
                      required: { type: "boolean" },
                      enumValues: { type: "array", items: { type: "string" } }
                    },
                    required: ["name", "type", "required"]
                  }
                },
                responseFields: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      name: { type: "string" },
                      type: { type: "string", enum: ["string", "number", "boolean", "date", "email", "enum", "id", "array", "currency"] },
                      required: { type: "boolean" }
                    },
                    required: ["name", "type", "required"]
                  }
                },
                requiredRoles: { type: "array", items: { type: "string" } },
                requiresAuth: { type: "boolean" }
              },
              required: ["path", "method", "description", "entity", "action", "requestFields", "responseFields", "requiredRoles", "requiresAuth"]
            }
          }
        },
        required: ["basePath", "endpoints"]
      },
      ui: {
        type: "object",
        properties: {
          appName: { type: "string" },
          theme: {
            type: "object",
            properties: {
              primaryColor: { type: "string" },
              accentColor: { type: "string" },
              mode: { type: "string", enum: ["dark", "light"] }
            },
            required: ["primaryColor", "accentColor", "mode"]
          },
          navigation: {
            type: "array",
            items: {
              type: "object",
              properties: {
                label: { type: "string" },
                route: { type: "string" },
                icon: { type: "string" },
                requiredRoles: { type: "array", items: { type: "string" } }
              },
              required: ["label", "route", "requiredRoles"]
            }
          },
          pages: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                route: { type: "string" },
                title: { type: "string" },
                description: { type: "string" },
                layout: { type: "string", enum: ["dashboard", "form", "list", "detail", "landing", "auth", "settings", "analytics", "single-column", "two-column"] },
                icon: { type: "string" },
                requiredRoles: { type: "array", items: { type: "string" } },
                showInNav: { type: "boolean" },
                components: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      id: { type: "string" },
                      type: { type: "string", enum: ["table", "form", "chart", "card", "stats", "list", "modal", "text", "button", "image", "nav", "hero", "grid"] },
                      title: { type: "string" },
                      description: { type: "string" },
                      dataSource: { type: "string" },
                      submitTo: { type: "string" },
                      fields: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            name: { type: "string" },
                            label: { type: "string" },
                            type: { type: "string", enum: ["text", "number", "email", "password", "date", "select", "checkbox", "textarea", "currency", "hidden"] },
                            required: { type: "boolean" },
                            options: { type: "array", items: { type: "string" } }
                          },
                          required: ["name", "label", "type"]
                        }
                      },
                      columns: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            key: { type: "string" },
                            label: { type: "string" },
                            sortable: { type: "boolean" }
                          },
                          required: ["key", "label"]
                        }
                      },
                      chartType: { type: "string", enum: ["bar", "line", "pie", "doughnut", "area"] },
                      chartDataKey: { type: "string" },
                      chartLabelKey: { type: "string" },
                      actions: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            label: { type: "string" },
                            type: { type: "string", enum: ["edit", "delete", "view", "custom", "navigate", "submit"] },
                            target: { type: "string" }
                          },
                          required: ["label", "type"]
                        }
                      },
                      content: { type: "string" },
                      statsValue: { type: "string" },
                      statsLabel: { type: "string" },
                      icon: { type: "string" }
                    },
                    required: ["id", "type"]
                  }
                }
              },
              required: ["name", "route", "title", "description", "layout", "requiredRoles", "showInNav", "components"]
            }
          }
        },
        required: ["appName", "theme", "navigation", "pages"]
      },
      auth: {
        type: "object",
        properties: {
          roles: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                level: { type: "number" },
                isDefault: { type: "boolean" }
              },
              required: ["name", "level", "isDefault"]
            }
          },
          rules: {
            type: "array",
            items: {
              type: "object",
              properties: {
                route: { type: "string" },
                allowedRoles: { type: "array", items: { type: "string" } },
                requiresAuth: { type: "boolean" }
              },
              required: ["route", "allowedRoles", "requiresAuth"]
            }
          },
          loginPage: { type: "string" },
          defaultRedirect: { type: "string" }
        },
        required: ["roles", "rules", "loginPage", "defaultRedirect"]
      }
    },
    required: ["metadata", "database", "api", "ui", "auth"]
  };
}
