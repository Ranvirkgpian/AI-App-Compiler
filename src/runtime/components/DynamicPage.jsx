import React, { useState, useCallback, useEffect } from 'react';
import { DynamicForm } from './DynamicForm';
import { DynamicTable } from './DynamicTable';
import { DynamicChart, DynamicCard, DynamicText, DynamicHero } from './DynamicChart';
import { dataStore } from '../data/DataStore';

/**
 * DynamicPage — renders a page from config by composing dynamic components
 */
export function DynamicPage({ pageConfig, appConfig }) {
  const [refreshKey, setRefreshKey] = useState(0);
  const [editingRecord, setEditingRecord] = useState(null);
  const [showModal, setShowModal] = useState(false);

  const refresh = useCallback(() => setRefreshKey(k => k + 1), []);

  const getEntityForEndpoint = (path) => {
    if (!path || !appConfig?.api?.endpoints) return null;
    const endpoint = appConfig.api.endpoints.find(e => e.path === path);
    return endpoint?.entity || null;
  };

  const getDataForComponent = (comp) => {
    const entity = getEntityForEndpoint(comp.dataSource);
    if (!entity) {
      // Try to guess from component context
      const tables = Object.keys(dataStore.tables);
      if (tables.length > 0) {
        // Match by component title or page entities
        const match = tables.find(t =>
          comp.title?.toLowerCase().includes(t.toLowerCase()) ||
          comp.id?.toLowerCase().includes(t.toLowerCase())
        );
        if (match) return dataStore.list(match);
      }
      return [];
    }
    return dataStore.list(entity);
  };

  const handleFormSubmit = (comp, formData) => {
    const entity = getEntityForEndpoint(comp.submitTo) || getEntityForEndpoint(comp.dataSource);
    if (!entity) return;

    if (editingRecord?.id) {
      dataStore.update(entity, editingRecord.id, formData);
    } else {
      dataStore.create(entity, formData);
    }
    setEditingRecord(null);
    setShowModal(false);
    refresh();
  };

  const handleDelete = (comp, id) => {
    const entity = getEntityForEndpoint(comp.dataSource);
    if (!entity) return;
    dataStore.delete(entity, id);
    refresh();
  };

  const handleEdit = (record) => {
    setEditingRecord(record);
    setShowModal(true);
  };

  const renderComponent = (comp) => {
    const data = getDataForComponent(comp);
    const stats = dataStore.getStats();

    switch (comp.type) {
      case 'form':
        return (
          <DynamicForm
            key={`${comp.id}-${editingRecord?.id || 'new'}`}
            component={comp}
            initialData={editingRecord || {}}
            onSubmit={(formData) => handleFormSubmit(comp, formData)}
          />
        );

      case 'table':
        return (
          <DynamicTable
            key={`${comp.id}-${refreshKey}`}
            component={comp}
            data={data}
            onEdit={handleEdit}
            onDelete={(id) => handleDelete(comp, id)}
            onView={(row) => console.log('View:', row)}
          />
        );

      case 'chart':
        return <DynamicChart key={comp.id} component={comp} data={data} />;

      case 'stats':
      case 'card': {
        // Auto-fill stats values from data store
        const filledComp = { ...comp };
        if (!filledComp.statsValue || filledComp.statsValue === '') {
          const entity = getEntityForEndpoint(comp.dataSource);
          if (entity) {
            filledComp.statsValue = String(dataStore.count(entity));
          } else {
            // Try to get count from matching table
            const label = (comp.statsLabel || comp.title || '').toLowerCase();
            const matchTable = Object.keys(stats).find(t => label.includes(t.toLowerCase()));
            filledComp.statsValue = matchTable ? String(stats[matchTable].count) : String(Math.floor(Math.random() * 100) + 10);
          }
        }
        return <DynamicCard key={comp.id} component={filledComp} />;
      }

      case 'text':
        return <DynamicText key={comp.id} component={comp} />;

      case 'hero':
        return <DynamicHero key={comp.id} component={comp} />;

      case 'grid': {
        return (
          <div key={comp.id} className="component-grid">
            {(comp.fields || []).map((field, i) => (
              <DynamicCard key={i} component={{
                id: `${comp.id}-item-${i}`,
                type: 'card',
                statsLabel: field.label || field.name,
                statsValue: String(Math.floor(Math.random() * 100) + 10),
              }} />
            ))}
          </div>
        );
      }

      default:
        return (
          <div key={comp.id} className="glass-card" style={{ padding: '16px' }}>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Component: {comp.type} ({comp.id})
            </p>
            {comp.title && <h4>{comp.title}</h4>}
            {comp.content && <p>{comp.content}</p>}
          </div>
        );
    }
  };

  const layout = pageConfig.layout || 'single-column';

  return (
    <div className={`dynamic-page layout-${layout} animate-fadeIn`}>
      <div className="page-header">
        <div>
          <h2 className="page-title">{pageConfig.title}</h2>
          {pageConfig.description && (
            <p className="page-description">{pageConfig.description}</p>
          )}
        </div>
        {(layout === 'list' || layout === 'dashboard') && (
          <button
            className="btn btn-primary btn-sm"
            onClick={() => { setEditingRecord(null); setShowModal(true); }}
          >
            + New
          </button>
        )}
      </div>

      <div className={`page-content layout-grid-${layout}`}>
        {(pageConfig.components || []).map((comp, idx) => {
          // Runtime safety: ensure every component has a valid ID
          const safeComp = {
            ...comp,
            id: (comp.id && comp.id !== 'undefined' && comp.id !== 'null')
              ? comp.id
              : `${(pageConfig.name || 'page').toLowerCase().replace(/[^a-z0-9]/g, '-')}-${comp.type || 'comp'}-${idx + 1}`,
          };
          return (
            <div key={safeComp.id} className={`component-wrapper component-${safeComp.type}`}>
              {renderComponent(safeComp)}
            </div>
          );
        })}
      </div>

      {/* Modal for editing */}
      {showModal && (
        <div className="modal-overlay" onClick={() => { setShowModal(false); setEditingRecord(null); }}>
          <div className="modal-content glass-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingRecord ? 'Edit Record' : 'New Record'}</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => { setShowModal(false); setEditingRecord(null); }}>✕</button>
            </div>
            {/* Find the form component on this page or create a simple one */}
            {(() => {
              const formComp = pageConfig.components?.find(c => c.type === 'form');
              const tableComp = pageConfig.components?.find(c => c.type === 'table');
              const fields = formComp?.fields || tableComp?.columns?.map(c => ({
                name: c.key,
                label: c.label,
                type: 'text',
                required: false,
              })) || [];

              return (
                <DynamicForm
                  component={{ ...formComp, fields, title: null }}
                  initialData={editingRecord || {}}
                  onSubmit={(formData) => {
                    const entity = getEntityForEndpoint(formComp?.submitTo || tableComp?.dataSource);
                    if (entity) {
                      if (editingRecord?.id) {
                        dataStore.update(entity, editingRecord.id, formData);
                      } else {
                        dataStore.create(entity, formData);
                      }
                    }
                    setShowModal(false);
                    setEditingRecord(null);
                    refresh();
                  }}
                />
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
