import React from 'react';

/**
 * MetricsPanel — shows real-time compilation metrics
 */
export function MetricsPanel({ pipelineResult }) {
  if (!pipelineResult) return null;

  const { stages = [], totalLatencyMs = 0, metrics, repairCycles = 0, validationErrors = [] } = pipelineResult;

  const errorCount = validationErrors.filter(e => e.severity === 'error').length;
  const warningCount = validationErrors.filter(e => e.severity === 'warning').length;

  // Estimate cost (Gemini Flash free tier)
  const totalTokens = (metrics?.totalTokensIn || 0) + (metrics?.totalTokensOut || 0);
  const estimatedCost = totalTokens * 0.00000015; // ~$0.15 per 1M tokens

  const metricCards = [
    {
      label: 'Total Time',
      value: `${(totalLatencyMs / 1000).toFixed(1)}s`,
      icon: '⏱️',
      color: 'var(--accent-info)',
    },
    {
      label: 'LLM Calls',
      value: metrics?.totalCalls || 0,
      icon: '🤖',
      color: 'var(--accent-primary)',
    },
    {
      label: 'Tokens Used',
      value: totalTokens > 1000 ? `${(totalTokens / 1000).toFixed(1)}k` : totalTokens,
      icon: '🔤',
      color: 'var(--accent-secondary)',
    },
    {
      label: 'Est. Cost',
      value: estimatedCost > 0.01 ? `$${estimatedCost.toFixed(3)}` : 'Free',
      icon: '💰',
      color: 'var(--accent-success)',
    },
    {
      label: 'Repair Cycles',
      value: repairCycles,
      icon: '🔧',
      color: repairCycles > 0 ? 'var(--accent-warning)' : 'var(--accent-success)',
    },
    {
      label: 'Validation',
      value: errorCount === 0 ? '✓ Pass' : `${errorCount} err`,
      icon: errorCount === 0 ? '✅' : '❌',
      color: errorCount === 0 ? 'var(--accent-success)' : 'var(--accent-danger)',
    },
  ];

  return (
    <div className="metrics-panel animate-fadeIn">
      <div className="metrics-grid">
        {metricCards.map((metric, i) => (
          <div key={i} className="metric-card glass-card">
            <span className="metric-icon">{metric.icon}</span>
            <div className="metric-info">
              <span className="metric-value" style={{ color: metric.color }}>{metric.value}</span>
              <span className="metric-label">{metric.label}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Per-stage breakdown */}
      <div className="stage-breakdown">
        <h4 style={{ marginBottom: '8px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Stage Breakdown</h4>
        <div className="stage-bars">
          {stages.map((stage, i) => {
            const pct = totalLatencyMs > 0 ? (stage.latencyMs / totalLatencyMs) * 100 : 0;
            return (
              <div key={i} className="stage-bar-row">
                <span className="stage-bar-label text-xs">{stage.name}</span>
                <div className="stage-bar-track">
                  <div
                    className="stage-bar-fill"
                    style={{
                      width: `${pct}%`,
                      background: `hsl(${260 - i * 30}, 70%, 60%)`,
                    }}
                  />
                </div>
                <span className="stage-bar-time text-xs">
                  {stage.latencyMs ? `${(stage.latencyMs / 1000).toFixed(1)}s` : '—'}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
