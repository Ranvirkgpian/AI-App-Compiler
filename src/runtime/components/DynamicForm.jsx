import React, { useState } from 'react';

/**
 * DynamicForm — renders a form from UI config fields
 * Handles validation and submission
 */
export function DynamicForm({ component, onSubmit, initialData = {} }) {
  const [formData, setFormData] = useState(initialData);
  const [errors, setErrors] = useState({});

  const fields = component.fields || [];

  const handleChange = (name, value) => {
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }));
    }
  };

  const validate = () => {
    const newErrors = {};
    for (const field of fields) {
      if (field.required && !formData[field.name]) {
        newErrors[field.name] = `${field.label} is required`;
      }
      if (field.type === 'email' && formData[field.name] && !/\S+@\S+\.\S+/.test(formData[field.name])) {
        newErrors[field.name] = 'Invalid email format';
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (validate()) {
      onSubmit?.(formData);
      if (!initialData.id) {
        setFormData({});
      }
    }
  };

  return (
    <div className="dynamic-form animate-fadeIn">
      {component.title && <h3 className="form-title">{component.title}</h3>}
      {component.description && <p className="form-description text-sm" style={{ color: 'var(--text-secondary)', marginBottom: '16px' }}>{component.description}</p>}
      <form onSubmit={handleSubmit}>
        <div className="form-grid">
          {fields.filter(f => f.type !== 'hidden').map(field => (
            <div key={field.name} className="form-group">
              <label className="form-label">
                {field.label}
                {field.required && <span style={{ color: 'var(--accent-danger)' }}> *</span>}
              </label>
              {renderField(field, formData[field.name] || '', (v) => handleChange(field.name, v))}
              {errors[field.name] && (
                <span className="form-error">{errors[field.name]}</span>
              )}
            </div>
          ))}
        </div>
        <div style={{ marginTop: '16px', display: 'flex', gap: '8px' }}>
          <button type="submit" className="btn btn-primary">
            {initialData.id ? 'Update' : 'Create'}
          </button>
        </div>
      </form>
    </div>
  );
}

function renderField(field, value, onChange) {
  const props = {
    className: 'input',
    value: value || '',
    onChange: (e) => onChange(e.target.value),
    placeholder: `Enter ${field.label.toLowerCase()}...`,
  };

  switch (field.type) {
    case 'textarea':
      return <textarea {...props} rows={3} />;

    case 'select':
      return (
        <select {...props} onChange={(e) => onChange(e.target.value)}>
          <option value="">Select {field.label}...</option>
          {(field.options || []).map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      );

    case 'checkbox':
      return (
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={!!value}
            onChange={(e) => onChange(e.target.checked)}
          />
          <span>{field.label}</span>
        </label>
      );

    case 'number':
    case 'currency':
      return <input type="number" step={field.type === 'currency' ? '0.01' : '1'} {...props} />;

    case 'date':
      return <input type="date" {...props} />;

    case 'email':
      return <input type="email" {...props} />;

    case 'password':
      return <input type="password" {...props} />;

    default:
      return <input type="text" {...props} />;
  }
}
