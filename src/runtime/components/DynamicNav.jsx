import React from 'react';
import { useAuth } from '../auth/AuthSimulator';

/**
 * DynamicNav — sidebar navigation generated from page config
 * Filters items by user role
 */
export function DynamicNav({ navigation = [], activePage, onNavigate, appName }) {
  const { currentUser, isAuthenticated, logout, hasRole } = useAuth();

  const visibleItems = navigation.filter(item =>
    hasRole(item.requiredRoles)
  );

  const icons = {
    dashboard: '📊', home: '🏠', contacts: '📇', users: '👥',
    settings: '⚙️', analytics: '📈', products: '🏷️', orders: '📦',
    profile: '👤', login: '🔐', register: '📝', reports: '📋',
    tasks: '📋', projects: '📁', payments: '💳', billing: '💰',
    notifications: '🔔', messages: '💬', calendar: '📅', help: '❓',
  };

  return (
    <nav className="dynamic-nav">
      <div className="nav-header">
        <span className="nav-logo">⚡</span>
        <span className="nav-app-name">{appName || 'App'}</span>
      </div>

      <div className="nav-items">
        {visibleItems.map(item => {
          const iconKey = (item.icon || item.label || '').toLowerCase();
          const icon = icons[iconKey] || icons[Object.keys(icons).find(k => iconKey.includes(k))] || '📄';

          return (
            <button
              key={item.route}
              className={`nav-item ${activePage === item.route ? 'active' : ''}`}
              onClick={() => onNavigate(item.route)}
            >
              <span className="nav-icon">{icon}</span>
              <span className="nav-label">{item.label}</span>
            </button>
          );
        })}
      </div>

      {isAuthenticated && (
        <div className="nav-footer">
          <div className="nav-user">
            <div className="nav-user-avatar">
              {currentUser?.name?.charAt(0) || '?'}
            </div>
            <div className="nav-user-info">
              <span className="nav-user-name">{currentUser?.name}</span>
              <span className="nav-user-role badge badge-primary">{currentUser?.role}</span>
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={logout} style={{ width: '100%', marginTop: '8px' }}>
            Sign Out
          </button>
        </div>
      )}
    </nav>
  );
}
