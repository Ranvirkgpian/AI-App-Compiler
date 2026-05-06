import React, { useState, useCallback, useRef } from 'react';
import { runPipeline } from '../compiler/pipeline';
import { PipelineVisualizer } from './PipelineVisualizer';
import { ConfigViewer } from './ConfigViewer';
import { MetricsPanel } from './MetricsPanel';
import { AppRenderer } from '../runtime/AppRenderer';
import { EvalDashboard } from '../evaluation/EvalDashboard';

/**
 * CompilerInterface — the main UI for the AI App Compiler
 */
export function CompilerInterface() {
  // Settings
  const [provider, setProvider] = useState('gemini');
  const [apiKey, setApiKey] = useState('');
  const [showSettings, setShowSettings] = useState(true);

  // Pipeline state
  const [prompt, setPrompt] = useState('');
  const [isCompiling, setIsCompiling] = useState(false);
  const [pipelineResult, setPipelineResult] = useState(null);
  const [stageUpdates, setStageUpdates] = useState([]);

  // View state
  const [activeView, setActiveView] = useState('compiler'); // compiler, preview, evaluation
  const [outputTab, setOutputTab] = useState('config'); // config, intent, design, metrics

  const promptRef = useRef(null);

  const llmConfig = { provider, apiKey };

  const handleCompile = useCallback(async () => {
    if (!prompt.trim() || !apiKey.trim()) return;

    setIsCompiling(true);
    setPipelineResult(null);
    setStageUpdates([]);
    setOutputTab('config');

    try {
      const result = await runPipeline(prompt, llmConfig, (stageIndex, status, message) => {
        setStageUpdates(prev => {
          const updated = [...prev];
          updated[stageIndex] = { status, message, latencyMs: null };
          return updated;
        });
      });

      setPipelineResult(result);
    } catch (error) {
      console.error('Pipeline error:', error);
      setPipelineResult({ isSuccess: false, error: error.message, stages: [], totalLatencyMs: 0 });
    } finally {
      setIsCompiling(false);
    }
  }, [prompt, apiKey, provider]);

  const examplePrompts = [
    'Build a CRM with login, contacts, dashboard, role-based access, and premium plan with payments. Admins can see analytics.',
    'Create a project management tool with Kanban board, team assignments, and deadline tracking.',
    'Build a blog platform with posts, comments, categories, and admin panel.',
    'Create an HR portal with employee profiles, leave management, and attendance tracking.',
  ];

  return (
    <div className="compiler-interface">
      {/* Header */}
      <header className="compiler-header">
        <div className="header-left">
          <h1 className="logo">
            <span className="logo-icon">⚡</span>
            <span className="text-gradient">AI App Compiler</span>
          </h1>
          <p className="tagline text-sm">Natural Language → Validated Config → Working Application</p>
        </div>
        <div className="header-right">
          <div className="view-tabs tabs">
            <button className={`tab ${activeView === 'compiler' ? 'active' : ''}`} onClick={() => setActiveView('compiler')}>
              🔧 Compiler
            </button>
            <button className={`tab ${activeView === 'preview' ? 'active' : ''}`} onClick={() => setActiveView('preview')} disabled={!pipelineResult?.finalConfig}>
              🖥️ Preview
            </button>
            <button className={`tab ${activeView === 'evaluation' ? 'active' : ''}`} onClick={() => setActiveView('evaluation')}>
              📊 Evaluation
            </button>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => setShowSettings(!showSettings)}>
            ⚙️ Settings
          </button>
        </div>
      </header>

      {/* Settings panel */}
      {showSettings && (
        <div className="settings-panel glass-card animate-fadeIn">
          <div className="settings-grid">
            <div className="setting-group">
              <label className="form-label">LLM Provider</label>
              <select className="input" value={provider} onChange={e => setProvider(e.target.value)}>
                <option value="gemini">Google Gemini 2.0 Flash</option>
                <option value="gemma">Google Gemma 4 26B</option>
                <option value="groq">Groq (Llama 3.1 8B — fast)</option>
              </select>
            </div>
            <div className="setting-group">
              <label className="form-label">API Key</label>
              <input
                className="input"
                type="password"
                value={apiKey}
                onChange={e => setApiKey(e.target.value.replace(/[^\x20-\x7E]/g, '').trim())}
                placeholder={`Enter your ${provider === 'groq' ? 'Groq' : 'Gemini'} API key...`}
              />
            </div>
            <div className="setting-group" style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowSettings(false)}>
                ✓ Done
              </button>
            </div>
          </div>
          <p className="text-xs" style={{ color: 'var(--text-tertiary)', marginTop: '8px' }}>
            Your API key is stored locally and never sent to our servers. It's only used for direct LLM API calls from your browser.
          </p>
        </div>
      )}

      {/* Main Content */}
      {activeView === 'compiler' && (
        <div className="compiler-main">
          {/* Left panel: Input */}
          <div className="input-panel">
            <div className="prompt-section glass-card">
              <h3 style={{ marginBottom: '12px' }}>
                <span style={{ marginRight: '8px' }}>💬</span>
                Application Description
              </h3>
              <textarea
                ref={promptRef}
                className="input prompt-textarea"
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                placeholder="Describe the application you want to build...&#10;&#10;Example: Build a CRM with login, contacts management, dashboard with analytics, role-based access, and premium plan with payments."
                rows={6}
              />
              <div className="prompt-actions">
                <button
                  className="btn btn-primary btn-lg"
                  onClick={handleCompile}
                  disabled={isCompiling || !prompt.trim() || !apiKey.trim()}
                >
                  {isCompiling ? (
                    <><div className="spinner" style={{ width: '18px', height: '18px' }} /> Compiling...</>
                  ) : (
                    '⚡ Compile Application'
                  )}
                </button>
                {!apiKey.trim() && (
                  <span className="text-xs" style={{ color: 'var(--accent-warning)' }}>
                    ⚠ Set your API key in Settings first
                  </span>
                )}
              </div>

              {/* Example prompts */}
              <div className="example-prompts">
                <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Try an example:</span>
                <div className="example-list">
                  {examplePrompts.map((ep, i) => (
                    <button
                      key={i}
                      className="btn btn-ghost btn-sm example-btn"
                      onClick={() => setPrompt(ep)}
                    >
                      {ep.slice(0, 50)}...
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Pipeline Visualizer */}
            <div className="pipeline-section glass-card">
              <h3 style={{ marginBottom: '12px' }}>
                <span style={{ marginRight: '8px' }}>🔄</span>
                Compilation Pipeline
              </h3>
              <PipelineVisualizer stages={
                pipelineResult
                  ? pipelineResult.stages
                  : stageUpdates
              } />
            </div>

            {/* Metrics */}
            {pipelineResult && (
              <MetricsPanel pipelineResult={pipelineResult} />
            )}
          </div>

          {/* Right panel: Output */}
          <div className="output-panel">
            {pipelineResult ? (
              <>
                <div className="output-tabs tabs" style={{ marginBottom: '12px' }}>
                  <button className={`tab ${outputTab === 'config' ? 'active' : ''}`} onClick={() => setOutputTab('config')}>
                    📋 App Config
                  </button>
                  <button className={`tab ${outputTab === 'intent' ? 'active' : ''}`} onClick={() => setOutputTab('intent')}>
                    🎯 Intent
                  </button>
                  <button className={`tab ${outputTab === 'design' ? 'active' : ''}`} onClick={() => setOutputTab('design')}>
                    🏗️ Design
                  </button>
                </div>

                {outputTab === 'config' && (
                  <ConfigViewer
                    config={pipelineResult.finalConfig}
                    validationErrors={pipelineResult.validationErrors || []}
                  />
                )}
                {outputTab === 'intent' && (
                  <ConfigViewer
                    config={pipelineResult.stages?.[0]?.data}
                    validationErrors={pipelineResult.stages?.[0]?.validationErrors || []}
                  />
                )}
                {outputTab === 'design' && (
                  <ConfigViewer
                    config={pipelineResult.stages?.[1]?.data}
                    validationErrors={pipelineResult.stages?.[1]?.validationErrors || []}
                  />
                )}

                {pipelineResult.error && (
                  <div className="error-banner glass-card" style={{ padding: '16px', marginTop: '12px', borderColor: 'var(--accent-danger)' }}>
                    <span className="badge badge-danger" style={{ marginBottom: '8px' }}>Pipeline Error</span>
                    <p className="text-sm" style={{ color: 'var(--accent-danger)' }}>{pipelineResult.error}</p>
                  </div>
                )}
              </>
            ) : (
              <div className="output-placeholder glass-card" style={{ padding: '48px', textAlign: 'center' }}>
                <div style={{ fontSize: '3rem', marginBottom: '16px' }}>🏗️</div>
                <h3 style={{ marginBottom: '8px' }}>Ready to Compile</h3>
                <p className="text-sm" style={{ color: 'var(--text-secondary)', maxWidth: '400px', margin: '0 auto' }}>
                  Enter an application description and click "Compile Application" to generate a full
                  app configuration with UI, API, Database, and Auth schemas.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Preview Mode */}
      {activeView === 'preview' && pipelineResult?.finalConfig && (
        <div className="preview-container animate-fadeIn">
          <div className="preview-header glass-card" style={{ padding: '8px 16px', marginBottom: '12px' }}>
            <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              🖥️ Live Preview — {pipelineResult.finalConfig.metadata?.appName || 'Generated App'}
            </span>
            <button className="btn btn-ghost btn-sm" onClick={() => setActiveView('compiler')}>
              ← Back to Compiler
            </button>
          </div>
          <div className="preview-frame">
            <AppRenderer config={pipelineResult.finalConfig} />
          </div>
        </div>
      )}

      {/* Evaluation Mode */}
      {activeView === 'evaluation' && (
        <div className="eval-container" style={{ padding: '20px' }}>
          <EvalDashboard llmConfig={llmConfig} />
        </div>
      )}
    </div>
  );
}
