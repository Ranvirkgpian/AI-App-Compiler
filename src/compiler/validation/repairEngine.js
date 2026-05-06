/**
 * Repair Engine — Intelligent targeted repair (not brute retry)
 * Classifies errors, determines source of truth, applies targeted fixes
 */

/**
 * Pre-repair pass: fix common LLM omissions before validation even runs
 * This catches issues that Zod defaults can't handle (like generating IDs for components)
 * @param {Object} config - The app config to sanitize
 * @returns {Object} { config, fixedCount }
 */
export function preRepairSanitize(config) {
  let fixedCount = 0;
  const fixed = JSON.parse(JSON.stringify(config)); // Deep clone

  // Fix 1: Generate missing/undefined/null component IDs
  if (fixed.ui?.pages) {
    const allIds = new Set();
    for (const page of fixed.ui.pages) {
      const pageName = (page.name || page.route || 'page').toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/^-+|-+$/g, '');
      for (let i = 0; i < (page.components || []).length; i++) {
        const comp = page.components[i];
        if (!comp.id || comp.id === 'undefined' || comp.id === 'null' || comp.id.trim() === '') {
          comp.id = `${pageName}-${comp.type || 'component'}-${i + 1}`;
          fixedCount++;
        }
        // Deduplicate IDs
        while (allIds.has(comp.id)) {
          comp.id = `${comp.id}-${pageName}-${i + 1}`;
          fixedCount++;
        }
        allIds.add(comp.id);
      }
    }
  }

  // Fix 2: Ensure every DB table has a description
  if (fixed.database?.tables) {
    for (const table of fixed.database.tables) {
      if (!table.description || table.description.trim() === '') {
        table.description = `${table.name} table`;
        fixedCount++;
      }
    }
  }

  // Fix 3: Ensure every auth role has level and isDefault
  if (fixed.auth?.roles) {
    let hasDefault = fixed.auth.roles.some(r => r.isDefault === true);
    for (let i = 0; i < fixed.auth.roles.length; i++) {
      const role = fixed.auth.roles[i];
      if (role.level === undefined || role.level === null) {
        role.level = i;
        fixedCount++;
      }
      if (role.isDefault === undefined || role.isDefault === null) {
        role.isDefault = false;
        fixedCount++;
      }
    }
    // Set a default role if none exists
    if (!hasDefault && fixed.auth.roles.length > 0) {
      const userRole = fixed.auth.roles.find(r => r.name.toLowerCase() === 'user' || r.name.toLowerCase() === 'member');
      if (userRole) {
        userRole.isDefault = true;
      } else {
        fixed.auth.roles[0].isDefault = true;
      }
      fixedCount++;
    }
  }

  // Fix 4: Ensure every endpoint has requestFields and responseFields arrays
  if (fixed.api?.endpoints) {
    for (const endpoint of fixed.api.endpoints) {
      if (!endpoint.requestFields) {
        endpoint.requestFields = [];
        fixedCount++;
      }
      if (!endpoint.responseFields) {
        endpoint.responseFields = [];
        fixedCount++;
      }
      if (!endpoint.requiredRoles) {
        endpoint.requiredRoles = [];
        fixedCount++;
      }
      if (endpoint.requiresAuth === undefined) {
        endpoint.requiresAuth = false;
        fixedCount++;
      }
    }
  }

  // Fix 5: Ensure metadata has required fields
  if (fixed.metadata) {
    if (!fixed.metadata.version) { fixed.metadata.version = '1.0.0'; fixedCount++; }
    if (!fixed.metadata.description) { fixed.metadata.description = 'Generated application'; fixedCount++; }
    if (!fixed.metadata.generatedAt) { fixed.metadata.generatedAt = new Date().toISOString(); fixedCount++; }
  }

  // Fix 6: Ensure page fields have defaults
  if (fixed.ui?.pages) {
    for (const page of fixed.ui.pages) {
      if (!page.description) { page.description = `${page.title || page.name} page`; fixedCount++; }
      if (page.requiredRoles === undefined) { page.requiredRoles = []; fixedCount++; }
      if (page.showInNav === undefined) { page.showInNav = true; fixedCount++; }
    }
  }

  // Fix 7: Ensure navigation items have requiredRoles
  if (fixed.ui?.navigation) {
    for (const nav of fixed.ui.navigation) {
      if (!nav.requiredRoles) { nav.requiredRoles = []; fixedCount++; }
    }
  }

  // Fix 8: Ensure auth has loginPage and defaultRedirect
  if (fixed.auth) {
    if (!fixed.auth.loginPage) { fixed.auth.loginPage = '/login'; fixedCount++; }
    if (!fixed.auth.defaultRedirect) { fixed.auth.defaultRedirect = '/'; fixedCount++; }
    if (!fixed.auth.rules) { fixed.auth.rules = []; fixedCount++; }
  }

  // Fix 9: Normalize column types — map common LLM variations to valid enums
  const columnTypeMap = {
    'varchar': 'string', 'char': 'string', 'str': 'string',
    'int': 'number', 'bigint': 'number', 'smallint': 'number', 'decimal': 'number', 'double': 'number',
    'bool': 'boolean',
    'datetime': 'date', 'timestamp': 'date', 'time': 'date',
    'longtext': 'text', 'mediumtext': 'text', 'richtext': 'text',
    'uuid': 'id', 'serial': 'id', 'autoincrement': 'id',
    'money': 'currency', 'price': 'currency', 'amount': 'currency',
    'link': 'url', 'href': 'url', 'uri': 'url',
    'json': 'text', 'object': 'text', 'array': 'text',
    'integer': 'number', 'float': 'number',
  };
  if (fixed.database?.tables) {
    for (const table of fixed.database.tables) {
      for (const col of (table.columns || [])) {
        const mapped = columnTypeMap[col.type?.toLowerCase()];
        if (mapped) {
          col.type = mapped;
          fixedCount++;
        }
      }
    }
  }

  // Fix 10: Normalize API field types
  if (fixed.api?.endpoints) {
    for (const endpoint of fixed.api.endpoints) {
      for (const field of (endpoint.requestFields || [])) {
        const mapped = columnTypeMap[field.type?.toLowerCase()];
        if (mapped) { field.type = mapped; fixedCount++; }
      }
      for (const field of (endpoint.responseFields || [])) {
        const mapped = columnTypeMap[field.type?.toLowerCase()];
        if (mapped) { field.type = mapped; fixedCount++; }
      }
    }
  }

  return { config: fixed, fixedCount };
}

/**
 * Attempt automatic repair of common validation errors
 * These are deterministic fixes that don't need LLM
 * @param {Object} config - The app config to repair
 * @param {Array} errors - Validation errors
 * @returns {Object} { config, fixedCount, remainingErrors }
 */
export function autoRepair(config, errors) {
  let fixedCount = 0;
  const fixed = JSON.parse(JSON.stringify(config)); // Deep clone

  for (const error of errors) {
    const wasFixed = applyFix(fixed, error);
    if (wasFixed) fixedCount++;
  }

  return { config: fixed, fixedCount };
}

function applyFix(config, error) {
  try {
    switch (error.type) {
      case 'structural':
        return fixStructural(config, error);
      case 'referential':
        return fixReferential(config, error);
      case 'logical':
        return fixLogical(config, error);
      default:
        return false;
    }
  } catch (e) {
    console.warn(`[RepairEngine] Auto-fix failed for ${error.path}:`, e.message);
    return false;
  }
}

function fixStructural(config, error) {
  // Fix: Missing id column on table
  if (error.message.includes('missing "id" column')) {
    const matchParts = error.path.match(/database\.tables\.(.+?)\.columns/);
    if (!matchParts) return false;
    const name = matchParts[1];
    const table = config.database?.tables?.find(t => t.name === name);
    if (table && !table.columns.some(c => c.name === 'id')) {
      table.columns.unshift({
        name: 'id',
        type: 'id',
        required: true,
        primaryKey: true,
        unique: true,
      });
      return true;
    }
  }

  // Fix: Duplicate component IDs
  if (error.message.includes('Duplicate component ID')) {
    const match = error.message.match(/Duplicate component ID "(.+?)"/);
    if (match) {
      const dupId = match[1];
      let count = 0;
      for (const page of (config.ui?.pages || [])) {
        const pageName = (page.name || 'page').toLowerCase().replace(/[^a-z0-9]/g, '-');
        for (let i = 0; i < (page.components || []).length; i++) {
          const comp = page.components[i];
          if (comp.id === dupId) {
            count++;
            if (count > 1) {
              comp.id = `${pageName}-${comp.type || 'comp'}-${i + 1}`;
              return true;
            }
          }
        }
      }
    }
  }

  // Fix: Page has no components
  if (error.message.includes('has no components')) {
    const match = error.message.match(/Page "(.+?)"/);
    if (match) {
      const pageName = match[1];
      const page = config.ui?.pages?.find(p => p.name === pageName);
      if (page) {
        page.components = [{
          id: `${pageName.toLowerCase().replace(/[^a-z0-9]/g, '-')}-text-1`,
          type: 'text',
          title: page.title || pageName,
          content: page.description || `${pageName} page content`,
        }];
        return true;
      }
    }
  }

  return false;
}

function fixReferential(config, error) {
  // Fix: Navigation route doesn't match any page
  if (error.message.includes('Navigation item') && error.message.includes('doesn\'t match any page')) {
    const match = error.message.match(/route "(.+?)"/);
    if (match) {
      const route = match[1];
      const navItem = config.ui?.navigation?.find(n => n.route === route);
      // Try to find a close match
      const pages = config.ui?.pages || [];
      const closestPage = pages.find(p => p.route.includes(route.replace('/', '')) || route.includes(p.route.replace('/', '')));
      if (closestPage && navItem) {
        navItem.route = closestPage.route;
        return true;
      }
    }
  }

  // Fix: Auth rule references non-existent route
  if (error.message.includes('Auth rule references route') && error.message.includes('doesn\'t match any page')) {
    const match = error.message.match(/route "(.+?)"/);
    if (match) {
      const route = match[1];
      const rule = config.auth?.rules?.find(r => r.route === route);
      const pages = config.ui?.pages || [];
      const closestPage = pages.find(p => p.route.includes(route.replace(/\//g, '').replace(/-/g, '')) || route.includes(p.name.toLowerCase()));
      if (closestPage && rule) {
        rule.route = closestPage.route;
        return true;
      }
    }
  }

  // Fix: API endpoint entity doesn't match any table — try case-insensitive match
  if (error.message.includes('no matching DB table exists')) {
    const entityMatch = error.message.match(/entity "(.+?)"/);
    if (entityMatch) {
      const entity = entityMatch[1];
      const table = config.database?.tables?.find(t => t.name.toLowerCase() === entity.toLowerCase());
      if (table) {
        // Fix the endpoint to use the correct table name
        const endpoint = config.api?.endpoints?.find(e => e.entity === entity);
        if (endpoint) {
          endpoint.entity = table.name;
          return true;
        }
      }
    }
  }

  return false;
}

function fixLogical(config, error) {
  // Fix: No default role
  if (error.message.includes('No default role')) {
    const roles = config.auth?.roles || [];
    const userRole = roles.find(r => r.name.toLowerCase() === 'user' || r.name.toLowerCase() === 'member');
    if (userRole) {
      userRole.isDefault = true;
      return true;
    } else if (roles.length > 0) {
      // Set the role with lowest level as default
      const sorted = [...roles].sort((a, b) => (a.level || 0) - (b.level || 0));
      sorted[0].isDefault = true;
      return true;
    }
  }

  // Fix: Login page requires auth
  if (error.message.includes('Login page should not require authentication')) {
    const loginRoute = config.auth?.loginPage;
    if (loginRoute) {
      const loginPage = config.ui?.pages?.find(p => p.route === loginRoute);
      if (loginPage) {
        loginPage.requiredRoles = [];
        return true;
      }
      // Also fix the auth rule
      const loginRule = config.auth?.rules?.find(r => r.route === loginRoute);
      if (loginRule) {
        loginRule.requiresAuth = false;
      }
    }
  }

  // Fix: Missing auth rule for protected page
  if (error.message.includes('requires roles but has no auth rule')) {
    const match = error.message.match(/route "(.+?)"/);
    if (match) {
      const route = match[1];
      const page = config.ui?.pages?.find(p => p.route === route);
      if (page && config.auth?.rules) {
        config.auth.rules.push({
          route: page.route,
          allowedRoles: page.requiredRoles,
          requiresAuth: true,
        });
        return true;
      }
    }
  }

  // Fix: No API endpoints for DB table
  if (error.message.includes('No API endpoints for DB table')) {
    const match = error.message.match(/table "(.+?)"/);
    if (match) {
      const tableName = match[1];
      if (config.api?.endpoints) {
        const basePath = config.api.basePath || '/api';
        config.api.endpoints.push(
          { path: `${basePath}/${tableName}`, method: 'GET', description: `List all ${tableName}`, entity: tableName, action: 'list', requestFields: [], responseFields: [], requiredRoles: [], requiresAuth: false },
          { path: `${basePath}/${tableName}/:id`, method: 'GET', description: `Get ${tableName} by ID`, entity: tableName, action: 'read', requestFields: [], responseFields: [], requiredRoles: [], requiresAuth: false },
          { path: `${basePath}/${tableName}`, method: 'POST', description: `Create ${tableName}`, entity: tableName, action: 'create', requestFields: [], responseFields: [], requiredRoles: [], requiresAuth: true },
          { path: `${basePath}/${tableName}/:id`, method: 'PUT', description: `Update ${tableName}`, entity: tableName, action: 'update', requestFields: [], responseFields: [], requiredRoles: [], requiresAuth: true },
          { path: `${basePath}/${tableName}/:id`, method: 'DELETE', description: `Delete ${tableName}`, entity: tableName, action: 'delete', requestFields: [], responseFields: [], requiredRoles: [], requiresAuth: true },
        );
        return true;
      }
    }
  }

  return false;
}

/**
 * Classify errors for repair strategy
 * @param {Array} errors - Validation errors
 * @returns {Object} Classified errors with repair strategy
 */
export function classifyErrors(errors) {
  const autoFixable = [];
  const needsLLM = [];

  for (const error of errors) {
    if (canAutoFix(error)) {
      autoFixable.push(error);
    } else {
      needsLLM.push(error);
    }
  }

  return {
    autoFixable,
    needsLLM,
    totalErrors: errors.length,
    autoFixableCount: autoFixable.length,
    needsLLMCount: needsLLM.length,
  };
}

function canAutoFix(error) {
  const autoFixPatterns = [
    'missing "id" column',
    'Duplicate component ID',
    'No default role',
    'Login page should not require authentication',
    'requires roles but has no auth rule',
    'has no components',
    'no matching DB table exists',
    'No API endpoints for DB table',
    'doesn\'t match any page',
  ];

  return autoFixPatterns.some(pattern => error.message.includes(pattern));
}
