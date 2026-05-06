import React, { useState, useMemo } from 'react';

/**
 * DynamicTable — renders a sortable, filterable data table from config
 */
export function DynamicTable({ component, data = [], onEdit, onDelete, onView }) {
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState('asc');
  const [searchTerm, setSearchTerm] = useState('');

  const columns = component.columns || [];
  const actions = component.actions || [];

  const filteredData = useMemo(() => {
    let result = [...data];

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(row =>
        Object.values(row).some(v => String(v).toLowerCase().includes(term))
      );
    }

    // Sort
    if (sortKey) {
      result.sort((a, b) => {
        const aVal = a[sortKey] ?? '';
        const bVal = b[sortKey] ?? '';
        const cmp = String(aVal).localeCompare(String(bVal), undefined, { numeric: true });
        return sortDir === 'asc' ? cmp : -cmp;
      });
    }

    return result;
  }, [data, searchTerm, sortKey, sortDir]);

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  return (
    <div className="dynamic-table animate-fadeIn">
      {component.title && <h3 className="table-title">{component.title}</h3>}

      <div className="table-controls">
        <input
          className="input"
          type="text"
          placeholder="Search..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ maxWidth: '280px' }}
        />
        <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          {filteredData.length} record{filteredData.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              {columns.map(col => (
                <th
                  key={col.key}
                  onClick={() => col.sortable !== false && handleSort(col.key)}
                  className={col.sortable !== false ? 'sortable' : ''}
                >
                  {col.label}
                  {sortKey === col.key && (
                    <span className="sort-indicator">{sortDir === 'asc' ? ' ↑' : ' ↓'}</span>
                  )}
                </th>
              ))}
              {actions.length > 0 && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {filteredData.length === 0 ? (
              <tr>
                <td colSpan={columns.length + (actions.length > 0 ? 1 : 0)} className="empty-state">
                  No data found
                </td>
              </tr>
            ) : (
              filteredData.map((row, i) => (
                <tr key={row.id || i}>
                  {columns.map(col => (
                    <td key={col.key}>
                      {formatCellValue(row[col.key], col)}
                    </td>
                  ))}
                  {actions.length > 0 && (
                    <td>
                      <div className="action-buttons">
                        {actions.map((action, j) => (
                          <button
                            key={j}
                            className={`btn btn-sm ${action.type === 'delete' ? 'btn-danger-ghost' : 'btn-ghost'}`}
                            onClick={() => {
                              if (action.type === 'edit') onEdit?.(row);
                              else if (action.type === 'delete') onDelete?.(row.id);
                              else if (action.type === 'view') onView?.(row);
                            }}
                          >
                            {action.label}
                          </button>
                        ))}
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function formatCellValue(value, col) {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') {
    return value ? '✅' : '❌';
  }
  if (col.key?.includes('password')) {
    return '••••••';
  }
  if (typeof value === 'number' && col.key?.includes('price') || col.key?.includes('amount') || col.key?.includes('cost')) {
    return `$${Number(value).toFixed(2)}`;
  }
  return String(value);
}
