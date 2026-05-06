/**
 * Multi-Level Validation Engine
 * Checks: structural (Zod), referential (cross-layer), logical (consistency)
 */

/**
 * Validate the complete app configuration across all layers
 * @param {Object} config - The app config to validate
 * @returns {Array} Array of validation error objects
 */
export function validateAppConfig(config) {
  const errors = [];

  if (!config) {
    errors.push({ type: 'structural', severity: 'error', path: 'root', message: 'Config is null or undefined' });
    return errors;
  }

  // Level 1: Structural validation
  errors.push(...validateStructure(config));

  // Level 2: Referential integrity
  errors.push(...validateReferentialIntegrity(config));

  // Level 3: Logical consistency
  errors.push(...validateLogicalConsistency(config));

  return errors;
}

// ========================================
// Level 1: Structural Validation
// ========================================
function validateStructure(config) {
  const errors = [];

  // Check required top-level sections
  const requiredSections = ['metadata', 'database', 'api', 'ui', 'auth'];
  for (const section of requiredSections) {
    if (!config[section]) {
      errors.push({
        type: 'structural',
        severity: 'error',
        path: section,
        message: `Missing required section: ${section}`,
        suggestedFix: `Add the "${section}" section to the configuration`,
      });
    }
  }

  // Validate DB tables have required columns
  if (config.database?.tables) {
    for (const table of config.database.tables) {
      if (!table.columns || table.columns.length === 0) {
        errors.push({
          type: 'structural',
          severity: 'error',
          path: `database.tables.${table.name}`,
          message: `Table "${table.name}" has no columns`,
          suggestedFix: `Add columns to table "${table.name}"`,
        });
        continue;
      }

      const hasId = table.columns.some(c => c.name === 'id');
      if (!hasId) {
        errors.push({
          type: 'structural',
          severity: 'warning',
          path: `database.tables.${table.name}.columns`,
          message: `Table "${table.name}" missing "id" column`,
          suggestedFix: `Add column { name: "id", type: "id", required: true, primaryKey: true }`,
        });
      }
    }
  }

  // Validate API endpoints have methods
  if (config.api?.endpoints) {
    for (const endpoint of config.api.endpoints) {
      if (!endpoint.method) {
        errors.push({
          type: 'structural',
          severity: 'error',
          path: `api.endpoints.${endpoint.path}`,
          message: `Endpoint "${endpoint.path}" missing HTTP method`,
        });
      }
    }
  }

  // Validate UI pages have components
  if (config.ui?.pages) {
    for (const page of config.ui.pages) {
      if (!page.components || page.components.length === 0) {
        errors.push({
          type: 'structural',
          severity: 'warning',
          path: `ui.pages.${page.name}`,
          message: `Page "${page.name}" has no components`,
          suggestedFix: `Add at least one component to page "${page.name}"`,
        });
      }
    }
  }

  // Validate unique component IDs
  if (config.ui?.pages) {
    const allIds = new Set();
    for (const page of config.ui.pages) {
      for (const comp of (page.components || [])) {
        if (allIds.has(comp.id)) {
          errors.push({
            type: 'structural',
            severity: 'warning',
            path: `ui.pages.${page.name}.components.${comp.id}`,
            message: `Duplicate component ID "${comp.id}"`,
            suggestedFix: `Rename component ID to "${comp.id}-${page.name}"`,
          });
        }
        allIds.add(comp.id);
      }
    }
  }

  return errors;
}

// ========================================
// Level 2: Referential Integrity
// ========================================
function validateReferentialIntegrity(config) {
  const errors = [];

  if (!config.database || !config.api || !config.ui || !config.auth) {
    return errors; // Can't check refs if sections missing
  }

  const tableNames = new Set((config.database.tables || []).map(t => t.name));
  const tableColumns = {};
  for (const table of (config.database.tables || [])) {
    tableColumns[table.name] = new Set((table.columns || []).map(c => c.name));
  }

  const endpointPaths = new Set((config.api.endpoints || []).map(e => e.path));
  const pageRoutes = new Set((config.ui.pages || []).map(p => p.route));
  const roleNames = new Set((config.auth.roles || []).map(r => r.name));

  // Check: API endpoint entities must match DB tables
  for (const endpoint of (config.api.endpoints || [])) {
    const entity = endpoint.entity;
    if (entity && !tableNames.has(entity) && entity !== 'auth') {
      errors.push({
        type: 'referential',
        severity: 'warning',
        path: `api.endpoints.${endpoint.path}.entity`,
        message: `API endpoint "${endpoint.path}" references entity "${entity}" but no matching DB table exists`,
        suggestedFix: `Add a DB table named "${entity}" or fix the entity reference`,
      });
    }
  }

  // Check: API request fields should match DB columns
  for (const endpoint of (config.api.endpoints || [])) {
    const entity = endpoint.entity;
    if (tableColumns[entity] && endpoint.requestFields) {
      for (const field of endpoint.requestFields) {
        if (!tableColumns[entity].has(field.name) && field.name !== 'id') {
          errors.push({
            type: 'referential',
            severity: 'warning',
            path: `api.endpoints.${endpoint.path}.requestFields.${field.name}`,
            message: `API field "${field.name}" not found in DB table "${entity}"`,
            suggestedFix: `Add column "${field.name}" to table "${entity}" or remove from requestFields`,
          });
        }
      }
    }
  }

  // Check: UI dataSources must reference valid API endpoints
  for (const page of (config.ui.pages || [])) {
    for (const comp of (page.components || [])) {
      if (comp.dataSource && !endpointPaths.has(comp.dataSource)) {
        errors.push({
          type: 'referential',
          severity: 'warning',
          path: `ui.pages.${page.name}.components.${comp.id}.dataSource`,
          message: `Component "${comp.id}" references API path "${comp.dataSource}" which doesn't exist`,
          suggestedFix: `Change dataSource to a valid API endpoint path`,
        });
      }
      if (comp.submitTo && !endpointPaths.has(comp.submitTo)) {
        errors.push({
          type: 'referential',
          severity: 'warning',
          path: `ui.pages.${page.name}.components.${comp.id}.submitTo`,
          message: `Component "${comp.id}" submitTo references API path "${comp.submitTo}" which doesn't exist`,
          suggestedFix: `Change submitTo to a valid API endpoint path`,
        });
      }
    }
  }

  // Check: Auth rules reference valid routes
  for (const rule of (config.auth.rules || [])) {
    if (!pageRoutes.has(rule.route) && rule.route !== '*') {
      errors.push({
        type: 'referential',
        severity: 'warning',
        path: `auth.rules.${rule.route}`,
        message: `Auth rule references route "${rule.route}" which doesn't match any page`,
        suggestedFix: `Change route to match a valid page route or add a page with route "${rule.route}"`,
      });
    }
  }

  // Check: Page requiredRoles reference valid roles
  for (const page of (config.ui.pages || [])) {
    for (const role of (page.requiredRoles || [])) {
      if (!roleNames.has(role)) {
        errors.push({
          type: 'referential',
          severity: 'warning',
          path: `ui.pages.${page.name}.requiredRoles`,
          message: `Page "${page.name}" requires role "${role}" which isn't defined in auth.roles`,
          suggestedFix: `Add role "${role}" to auth.roles or remove from requiredRoles`,
        });
      }
    }
  }

  // Check: Navigation items reference valid pages
  for (const navItem of (config.ui.navigation || [])) {
    if (!pageRoutes.has(navItem.route)) {
      errors.push({
        type: 'referential',
        severity: 'warning',
        path: `ui.navigation.${navItem.label}.route`,
        message: `Navigation item "${navItem.label}" references route "${navItem.route}" which doesn't match any page`,
        suggestedFix: `Change route to a valid page route`,
      });
    }
  }

  // Check: DB foreign keys reference valid tables
  for (const table of (config.database.tables || [])) {
    for (const col of (table.columns || [])) {
      if (col.reference) {
        if (!tableNames.has(col.reference.table)) {
          errors.push({
            type: 'referential',
            severity: 'error',
            path: `database.tables.${table.name}.columns.${col.name}.reference`,
            message: `Column "${col.name}" in table "${table.name}" references non-existent table "${col.reference.table}"`,
            suggestedFix: `Add table "${col.reference.table}" or fix the reference`,
          });
        }
      }
    }
  }

  return errors;
}

// ========================================
// Level 3: Logical Consistency
// ========================================
function validateLogicalConsistency(config) {
  const errors = [];

  if (!config.auth || !config.ui || !config.api) {
    return errors;
  }

  // Check: At least one default role
  const defaultRoles = (config.auth.roles || []).filter(r => r.isDefault);
  if (defaultRoles.length === 0) {
    errors.push({
      type: 'logical',
      severity: 'warning',
      path: 'auth.roles',
      message: 'No default role defined — new users won\'t have a role',
      suggestedFix: 'Set isDefault: true on one role (usually "user")',
    });
  }

  // Check: Login page exists and doesn't require auth
  if (config.auth.loginPage) {
    const loginPage = (config.ui.pages || []).find(p => p.route === config.auth.loginPage);
    if (!loginPage) {
      errors.push({
        type: 'logical',
        severity: 'warning',
        path: 'auth.loginPage',
        message: `Login page route "${config.auth.loginPage}" doesn't match any page`,
        suggestedFix: `Add a page with route "${config.auth.loginPage}"`,
      });
    } else if (loginPage.requiredRoles && loginPage.requiredRoles.length > 0) {
      errors.push({
        type: 'logical',
        severity: 'error',
        path: `ui.pages.${loginPage.name}.requiredRoles`,
        message: 'Login page should not require authentication (requiredRoles should be empty)',
        suggestedFix: 'Set requiredRoles to [] for the login page',
      });
    }
  }

  // Check: Protected pages have auth rules
  const authRuleRoutes = new Set((config.auth.rules || []).map(r => r.route));
  for (const page of (config.ui.pages || [])) {
    if (page.requiredRoles && page.requiredRoles.length > 0) {
      if (!authRuleRoutes.has(page.route) && !authRuleRoutes.has('*')) {
        errors.push({
          type: 'logical',
          severity: 'warning',
          path: `ui.pages.${page.name}`,
          message: `Page "${page.name}" requires roles but has no auth rule for route "${page.route}"`,
          suggestedFix: `Add auth rule: { route: "${page.route}", allowedRoles: ${JSON.stringify(page.requiredRoles)}, requiresAuth: true }`,
        });
      }
    }
  }

  // Check: Every entity has at least CRUD endpoints
  const entityEndpoints = {};
  for (const endpoint of (config.api.endpoints || [])) {
    if (!entityEndpoints[endpoint.entity]) {
      entityEndpoints[endpoint.entity] = new Set();
    }
    entityEndpoints[endpoint.entity].add(endpoint.action);
  }

  for (const table of (config.database?.tables || [])) {
    const actions = entityEndpoints[table.name];
    if (!actions) {
      errors.push({
        type: 'logical',
        severity: 'warning',
        path: `api.endpoints`,
        message: `No API endpoints for DB table "${table.name}"`,
        suggestedFix: `Add CRUD endpoints for entity "${table.name}"`,
      });
    }
  }

  // Check: Dashboard pages have stats or chart components
  for (const page of (config.ui.pages || [])) {
    if (page.layout === 'dashboard' || page.layout === 'analytics') {
      const hasDataViz = (page.components || []).some(c =>
        ['chart', 'stats', 'card'].includes(c.type)
      );
      if (!hasDataViz) {
        errors.push({
          type: 'logical',
          severity: 'warning',
          path: `ui.pages.${page.name}`,
          message: `${page.layout} page "${page.name}" has no stats/chart/card components`,
          suggestedFix: 'Add stats or chart components for data visualization',
        });
      }
    }
  }

  return errors;
}
