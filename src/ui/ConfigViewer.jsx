import React, { useState } from 'react';

/**
 * ConfigViewer — JSON tree viewer with syntax highlighting and tabs
 */
export function ConfigViewer({ config, validationErrors = [] }) {
  const [activeTab, setActiveTab] = useState('full');
  const [collapsed, setCollapsed] = useState(new Set());

  if (!config) {
    return (
      <div className="config-viewer-empty glass-card" style={{ padding: '32px', textAlign: 'center' }}>
        <p style={{ color: 'var(--text-secondary)' }}>No configuration generated yet</p>
      </div>
    );
  }

  const tabs = [
    { id: 'full', label: 'Full Config' },
    { id: 'ui', label: 'UI Schema' },
    { id: 'api', label: 'API Schema' },
    { id: 'database', label: 'DB Schema' },
    { id: 'auth', label: 'Auth Rules' },
  ];

  const getTabData = () => {
    switch (activeTab) {
      case 'ui': return config.ui || {};
      case 'api': return config.api || {};
      case 'database': return config.database || {};
      case 'auth': return config.auth || {};
      default: return config;
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard?.writeText(JSON.stringify(getTabData(), null, 2));
  };

  const errorCount = validationErrors.filter(e => e.severity === 'error').length;
  const warningCount = validationErrors.filter(e => e.severity === 'warning').length;

  return (
    <div className="config-viewer">
      <div className="config-header">
        <div className="tabs">
          {tabs.map(tab => (
            <button
              key={tab.id}
              className={`tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="config-actions">
          {errorCount > 0 && <span className="badge badge-danger">{errorCount} errors</span>}
          {warningCount > 0 && <span className="badge badge-warning">{warningCount} warnings</span>}
          <button className="btn btn-ghost btn-sm" onClick={copyToClipboard}>
            📋 Copy
          </button>
        </div>
      </div>

      <div className="json-viewer">
        <pre>
          <JsonRenderer data={getTabData()} />
        </pre>
      </div>

      {validationErrors.length > 0 && activeTab === 'full' && (
        <div className="validation-errors">
          <h4 style={{ marginBottom: '8px' }}>Validation Issues</h4>
          <div className="error-list">
            {validationErrors.slice(0, 20).map((err, i) => (
              <div key={i} className={`error-item error-${err.severity}`}>
                <span className="error-badge">
                  {err.severity === 'error' ? '❌' : '⚠️'} [{err.type}]
                </span>
                <span className="error-path text-mono text-xs">{err.path}</span>
                <span className="error-message text-sm">{err.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function JsonRenderer({ data, indent = 0 }) {
  if (data === null || data === undefined) {
    return <span className="json-null">null</span>;
  }

  if (typeof data === 'boolean') {
    return <span className="json-boolean">{String(data)}</span>;
  }

  if (typeof data === 'number') {
    return <span className="json-number">{data}</span>;
  }

  if (typeof data === 'string') {
    const truncated = data.length > 80 ? data.slice(0, 80) + '...' : data;
    return <span className="json-string">"{truncated}"</span>;
  }

  if (Array.isArray(data)) {
    if (data.length === 0) return <span className="json-bracket">[]</span>;

    const pad = '  '.repeat(indent);
    const innerPad = '  '.repeat(indent + 1);

    return (
      <>
        <span className="json-bracket">[</span>
        {'\n'}
        {data.map((item, i) => (
          <React.Fragment key={i}>
            {innerPad}
            <JsonRenderer data={item} indent={indent + 1} />
            {i < data.length - 1 && ','}
            {'\n'}
          </React.Fragment>
        ))}
        {pad}<span className="json-bracket">]</span>
      </>
    );
  }

  if (typeof data === 'object') {
    const keys = Object.keys(data);
    if (keys.length === 0) return <span className="json-bracket">{'{}'}</span>;

    const pad = '  '.repeat(indent);
    const innerPad = '  '.repeat(indent + 1);

    return (
      <>
        <span className="json-bracket">{'{'}</span>
        {'\n'}
        {keys.map((key, i) => (
          <React.Fragment key={key}>
            {innerPad}<span className="json-key">"{key}"</span>: <JsonRenderer data={data[key]} indent={indent + 1} />
            {i < keys.length - 1 && ','}
            {'\n'}
          </React.Fragment>
        ))}
        {pad}<span className="json-bracket">{'}'}</span>
      </>
    );
  }

  return <span>{String(data)}</span>;
}
