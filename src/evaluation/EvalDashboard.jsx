import React, { useState, useCallback } from 'react';
import { allTestCases, realProductPrompts, edgeCasePrompts } from './testCases';
import { evaluateTestCase, computeAggregateMetrics } from './evaluator';

/**
 * EvalDashboard — run evaluation suite and view results
 */
export function EvalDashboard({ llmConfig }) {
  const [results, setResults] = useState([]);
  const [isRunning, setIsRunning] = useState(false);
  const [currentTest, setCurrentTest] = useState(null);
  const [aggregateMetrics, setAggregateMetrics] = useState(null);
  const [filter, setFilter] = useState('all'); // all, real, edge

  const getFilteredCases = () => {
    switch (filter) {
      case 'real': return realProductPrompts;
      case 'edge': return edgeCasePrompts;
      default: return allTestCases;
    }
  };

  const runEvaluation = useCallback(async () => {
    const testCases = getFilteredCases();
    setIsRunning(true);
    setResults([]);
    setAggregateMetrics(null);

    const allResults = [];

    for (const testCase of testCases) {
      setCurrentTest(testCase.name);

      const result = await evaluateTestCase(testCase, llmConfig, (progress) => {
        // Progress callback
      });

      allResults.push(result);
      setResults([...allResults]);

      // Small delay between tests to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    setAggregateMetrics(computeAggregateMetrics(allResults));
    setIsRunning(false);
    setCurrentTest(null);
  }, [llmConfig, filter]);

  return (
    <div className="eval-dashboard animate-fadeIn">
      <div className="eval-header">
        <div>
          <h2>Evaluation Framework</h2>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Run the test suite to measure pipeline reliability and performance
          </p>
        </div>
        <div className="eval-controls">
          <div className="tabs">
            <button className={`tab ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>
              All ({allTestCases.length})
            </button>
            <button className={`tab ${filter === 'real' ? 'active' : ''}`} onClick={() => setFilter('real')}>
              Real ({realProductPrompts.length})
            </button>
            <button className={`tab ${filter === 'edge' ? 'active' : ''}`} onClick={() => setFilter('edge')}>
              Edge ({edgeCasePrompts.length})
            </button>
          </div>
          <button
            className="btn btn-primary"
            onClick={runEvaluation}
            disabled={isRunning || !llmConfig?.apiKey}
          >
            {isRunning ? (
              <><div className="spinner" style={{ width: '16px', height: '16px' }} /> Running {currentTest}...</>
            ) : (
              '▶ Run Evaluation'
            )}
          </button>
        </div>
      </div>

      {/* Aggregate metrics */}
      {aggregateMetrics && (
        <div className="eval-aggregate glass-card" style={{ padding: '20px', marginBottom: '20px' }}>
          <h3 style={{ marginBottom: '16px' }}>Aggregate Results</h3>
          <div className="metrics-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))' }}>
            <MetricBox label="Success Rate" value={`${aggregateMetrics.successRate}%`} color={Number(aggregateMetrics.successRate) > 80 ? 'var(--accent-success)' : 'var(--accent-warning)'} />
            <MetricBox label="Avg Latency" value={`${aggregateMetrics.avgLatencySeconds}s`} color="var(--accent-info)" />
            <MetricBox label="Avg Repairs" value={aggregateMetrics.avgRepairCycles} color="var(--accent-warning)" />
            <MetricBox label="Completeness" value={`${aggregateMetrics.completenessScore}%`} color="var(--accent-primary)" />
            <MetricBox label="Total Tests" value={aggregateMetrics.total} color="var(--text-primary)" />
            <MetricBox label="Failures" value={aggregateMetrics.failureCount} color={aggregateMetrics.failureCount > 0 ? 'var(--accent-danger)' : 'var(--accent-success)'} />
          </div>
        </div>
      )}

      {/* Results table */}
      {results.length > 0 && (
        <div className="eval-results glass-card" style={{ padding: '20px' }}>
          <h3 style={{ marginBottom: '16px' }}>Test Results</h3>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Test</th>
                  <th>Status</th>
                  <th>Latency</th>
                  <th>Repairs</th>
                  <th>Errors</th>
                  <th>Tables</th>
                  <th>Endpoints</th>
                  <th>Pages</th>
                </tr>
              </thead>
              <tbody>
                {results.map(r => (
                  <tr key={r.id}>
                    <td>
                      <div>
                        <span style={{ fontWeight: 600 }}>{r.name}</span>
                        <span className="text-xs" style={{ display: 'block', color: 'var(--text-tertiary)', maxWidth: '200px' }}>
                          {r.prompt.slice(0, 60)}...
                        </span>
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${r.success ? 'badge-success' : 'badge-danger'}`}>
                        {r.success ? 'PASS' : 'FAIL'}
                      </span>
                    </td>
                    <td className="text-mono text-sm">{(r.latencyMs / 1000).toFixed(1)}s</td>
                    <td className="text-mono text-sm">{r.repairCycles || 0}</td>
                    <td className="text-mono text-sm">{r.validationErrors || 0}</td>
                    <td className="text-mono text-sm">{r.tableCount || '—'}</td>
                    <td className="text-mono text-sm">{r.endpointCount || '—'}</td>
                    <td className="text-mono text-sm">{r.pageCount || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Test case preview (when not running) */}
      {results.length === 0 && !isRunning && (
        <div className="eval-preview glass-card" style={{ padding: '20px' }}>
          <h3 style={{ marginBottom: '16px' }}>Test Cases ({getFilteredCases().length})</h3>
          <div className="test-case-list">
            {getFilteredCases().map(tc => (
              <div key={tc.id} className="test-case-item">
                <div className="test-case-header">
                  <span className={`badge ${tc.id.startsWith('real') ? 'badge-info' : 'badge-warning'}`}>
                    {tc.id.startsWith('real') ? 'PRODUCT' : tc.type?.toUpperCase() || 'EDGE'}
                  </span>
                  <span className="test-case-name">{tc.name}</span>
                </div>
                <p className="test-case-prompt text-sm" style={{ color: 'var(--text-secondary)' }}>
                  {tc.prompt.slice(0, 120)}...
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MetricBox({ label, value, color }) {
  return (
    <div className="metric-card glass-card" style={{ padding: '12px' }}>
      <span className="metric-value" style={{ color, fontSize: '1.3rem' }}>{value}</span>
      <span className="metric-label" style={{ fontSize: '0.72rem' }}>{label}</span>
    </div>
  );
}
