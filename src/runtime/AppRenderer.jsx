import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth, LoginScreen } from './auth/AuthSimulator';
import { DynamicNav } from './components/DynamicNav';
import { DynamicPage } from './components/DynamicPage';
import { dataStore } from './data/DataStore';

/**
 * AppRenderer — the runtime that executes generated app configs
 * This is what proves "execution awareness" — the config is directly usable
 */
function AppRendererInner({ config }) {
  const [activePage, setActivePage] = useState(null);
  const { isAuthenticated, hasRole, login } = useAuth();

  // Initialize data store from DB schema
  useEffect(() => {
    if (config?.database) {
      dataStore.initialize(config.database);
    }
  }, [config?.database]);

  // Set initial page
  useEffect(() => {
    if (config?.ui?.pages?.length > 0) {
      const defaultRedirect = config?.auth?.defaultRedirect;
      const initialPage = config.ui.pages.find(p => p.route === defaultRedirect) || config.ui.pages[0];
      setActivePage(initialPage.route);
    }
  }, [config]);

  if (!config) {
    return (
      <div className="app-renderer-empty">
        <div className="empty-icon">🚀</div>
        <h3>No Application Generated Yet</h3>
        <p>Enter a prompt and click Compile to generate an application</p>
      </div>
    );
  }

  // Show login screen if not authenticated and page requires auth
  const currentPageConfig = config.ui?.pages?.find(p => p.route === activePage);
  const needsAuth = currentPageConfig?.requiredRoles?.length > 0;

  if (needsAuth && !isAuthenticated) {
    return <LoginScreen authConfig={config.auth} onLogin={login} />;
  }

  // Check role access
  if (needsAuth && !hasRole(currentPageConfig?.requiredRoles)) {
    return (
      <div className="access-denied">
        <div className="denied-icon">🔒</div>
        <h3>Access Denied</h3>
        <p>Your role doesn't have access to this page</p>
      </div>
    );
  }

  return (
    <div className="app-renderer">
      <DynamicNav
        navigation={config.ui?.navigation || []}
        activePage={activePage}
        onNavigate={setActivePage}
        appName={config.ui?.appName || config.metadata?.appName}
      />
      <main className="app-main">
        {currentPageConfig ? (
          <DynamicPage
            key={activePage}
            pageConfig={currentPageConfig}
            appConfig={config}
          />
        ) : (
          <div className="empty-page">
            <p>Page not found: {activePage}</p>
          </div>
        )}
      </main>
    </div>
  );
}

/**
 * Wrapped with AuthProvider
 */
export function AppRenderer({ config }) {
  return (
    <AuthProvider authConfig={config?.auth}>
      <AppRendererInner config={config} />
    </AuthProvider>
  );
}
