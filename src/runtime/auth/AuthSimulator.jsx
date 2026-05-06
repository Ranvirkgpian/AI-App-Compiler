/**
 * Auth Simulator — simulates role-based access control
 * Provides login/logout, session management, route protection
 */
import React, { createContext, useContext, useState, useCallback } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ authConfig, children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const roles = authConfig?.roles || [];
  const rules = authConfig?.rules || [];

  const login = useCallback((role) => {
    const roleConfig = roles.find(r => r.name === role) || roles[0];
    setCurrentUser({
      id: '1',
      name: `Demo ${role.charAt(0).toUpperCase() + role.slice(1)}`,
      email: `${role}@demo.app`,
      role: roleConfig?.name || 'user',
      roleLevel: roleConfig?.level || 0,
    });
    setIsAuthenticated(true);
  }, [roles]);

  const logout = useCallback(() => {
    setCurrentUser(null);
    setIsAuthenticated(false);
  }, []);

  const hasAccess = useCallback((route) => {
    if (!isAuthenticated) {
      // Check if route requires auth
      const rule = rules.find(r => r.route === route);
      return rule ? !rule.requiresAuth : true;
    }

    const rule = rules.find(r => r.route === route);
    if (!rule) return true; // No rule = public

    if (!rule.requiresAuth) return true;
    if (rule.allowedRoles.length === 0) return true;

    return rule.allowedRoles.includes(currentUser?.role);
  }, [isAuthenticated, currentUser, rules]);

  const hasRole = useCallback((requiredRoles) => {
    if (!requiredRoles || requiredRoles.length === 0) return true;
    if (!isAuthenticated || !currentUser) return false;
    return requiredRoles.includes(currentUser.role);
  }, [isAuthenticated, currentUser]);

  return (
    <AuthContext.Provider value={{
      currentUser,
      isAuthenticated,
      roles,
      login,
      logout,
      hasAccess,
      hasRole,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    return {
      currentUser: null,
      isAuthenticated: false,
      roles: [],
      login: () => {},
      logout: () => {},
      hasAccess: () => true,
      hasRole: () => true,
    };
  }
  return ctx;
}

/**
 * Login Screen component
 */
export function LoginScreen({ authConfig, onLogin }) {
  const roles = authConfig?.roles || [{ name: 'admin' }, { name: 'user' }];

  return (
    <div className="login-screen">
      <div className="login-card glass-card">
        <div className="login-icon">🔐</div>
        <h2>Sign In</h2>
        <p className="text-secondary" style={{ marginBottom: '24px' }}>
          Select a role to preview the application
        </p>
        <div className="role-buttons">
          {roles.map(role => (
            <button
              key={role.name}
              className="btn btn-primary"
              onClick={() => onLogin(role.name)}
              style={{ width: '100%', marginBottom: '8px' }}
            >
              Sign in as {role.name.charAt(0).toUpperCase() + role.name.slice(1)}
              {role.isDefault && <span className="badge badge-info" style={{ marginLeft: '8px' }}>default</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
