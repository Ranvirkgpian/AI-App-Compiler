import React from 'react';

/**
 * DynamicChart — renders simple charts from config
 * Uses pure CSS/SVG for zero-dependency charts
 */
export function DynamicChart({ component, data = [] }) {
  const chartType = component.chartType || 'bar';
  const dataKey = component.chartDataKey || 'value';
  const labelKey = component.chartLabelKey || 'label';

  // Generate chart data from entity data or use stats
  const chartData = data.length > 0
    ? data.slice(0, 8).map((item, i) => ({
        label: item[labelKey] || item.name || item.title || `Item ${i + 1}`,
        value: Number(item[dataKey]) || Math.floor(Math.random() * 100) + 10,
      }))
    : generateSampleChartData(component.title || 'Data');

  const maxValue = Math.max(...chartData.map(d => d.value), 1);

  const colors = [
    '#6c5ce7', '#a29bfe', '#fd79a8', '#00cec9',
    '#fdcb6e', '#74b9ff', '#55efc4', '#fab1a0',
  ];

  if (chartType === 'pie' || chartType === 'doughnut') {
    return (
      <div className="dynamic-chart animate-fadeIn">
        {component.title && <h3 className="chart-title">{component.title}</h3>}
        <div className="pie-chart-container">
          <PieChart data={chartData} colors={colors} isDoughnut={chartType === 'doughnut'} />
          <div className="chart-legend">
            {chartData.map((d, i) => (
              <div key={i} className="legend-item">
                <span className="legend-dot" style={{ background: colors[i % colors.length] }} />
                <span className="legend-label">{d.label}</span>
                <span className="legend-value">{d.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Bar chart
  return (
    <div className="dynamic-chart animate-fadeIn">
      {component.title && <h3 className="chart-title">{component.title}</h3>}
      <div className="bar-chart">
        {chartData.map((d, i) => (
          <div key={i} className="bar-group">
            <div className="bar-wrapper">
              <div
                className="bar"
                style={{
                  height: `${(d.value / maxValue) * 100}%`,
                  background: `linear-gradient(180deg, ${colors[i % colors.length]}, ${colors[i % colors.length]}88)`,
                  animationDelay: `${i * 100}ms`,
                }}
              >
                <span className="bar-value">{d.value}</span>
              </div>
            </div>
            <span className="bar-label">{d.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PieChart({ data, colors, isDoughnut }) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  let accumulated = 0;

  const slices = data.map((d, i) => {
    const percentage = (d.value / total) * 100;
    const startAngle = (accumulated / total) * 360;
    accumulated += d.value;
    const endAngle = (accumulated / total) * 360;

    return { ...d, percentage, startAngle, endAngle, color: colors[i % colors.length] };
  });

  // Build conic gradient
  const gradientStops = slices.map(s => `${s.color} ${s.startAngle}deg ${s.endAngle}deg`).join(', ');

  return (
    <div
      className="pie-chart"
      style={{
        background: `conic-gradient(${gradientStops})`,
        ...(isDoughnut ? {
          WebkitMask: 'radial-gradient(circle at center, transparent 40%, black 41%)',
          mask: 'radial-gradient(circle at center, transparent 40%, black 41%)',
        } : {}),
      }}
    />
  );
}

function generateSampleChartData(title) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
  return months.map(m => ({
    label: m,
    value: Math.floor(Math.random() * 80) + 20,
  }));
}

/**
 * DynamicCard — stat card for dashboards
 */
export function DynamicCard({ component }) {
  const icons = {
    users: '👥', contacts: '📇', orders: '📦', revenue: '💰',
    products: '🏷️', tasks: '📋', projects: '📁', analytics: '📊',
    settings: '⚙️', notifications: '🔔', messages: '💬', reports: '📈',
  };

  const iconKey = (component.icon || component.statsLabel || '').toLowerCase();
  const icon = icons[iconKey] || '📊';

  return (
    <div className="dynamic-card glass-card animate-fadeIn">
      <div className="card-icon">{icon}</div>
      <div className="card-content">
        <span className="card-value">{component.statsValue || '—'}</span>
        <span className="card-label">{component.statsLabel || component.title || 'Metric'}</span>
      </div>
    </div>
  );
}

/**
 * DynamicText — static text block
 */
export function DynamicText({ component }) {
  return (
    <div className="dynamic-text animate-fadeIn">
      {component.title && <h3>{component.title}</h3>}
      {component.content && <p style={{ color: 'var(--text-secondary)' }}>{component.content}</p>}
      {component.description && <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>{component.description}</p>}
    </div>
  );
}

/**
 * DynamicHero — hero section for landing pages
 */
export function DynamicHero({ component }) {
  return (
    <div className="dynamic-hero animate-fadeIn">
      <h1 className="text-gradient">{component.title || 'Welcome'}</h1>
      {component.content && <p className="hero-subtitle">{component.content}</p>}
      {component.description && <p className="hero-description">{component.description}</p>}
      {component.actions && component.actions.length > 0 && (
        <div className="hero-actions">
          {component.actions.map((a, i) => (
            <button key={i} className={`btn ${i === 0 ? 'btn-primary btn-lg' : 'btn-secondary btn-lg'}`}>
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
