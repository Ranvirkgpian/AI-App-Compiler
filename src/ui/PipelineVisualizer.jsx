import React from 'react';
import { STAGE_NAMES } from '../compiler/pipeline';

/**
 * PipelineVisualizer — shows the 4-stage pipeline with live status
 */
export function PipelineVisualizer({ stages = [] }) {
  const allStages = STAGE_NAMES.map((name, i) => {
    const stageData = stages[i];
    return {
      name,
      status: stageData?.status || 'pending',
      latencyMs: stageData?.latencyMs || null,
      error: stageData?.error || null,
      message: stageData?.message || null,
    };
  });

  return (
    <div className="pipeline-visualizer">
      <div className="pipeline-stages">
        {allStages.map((stage, i) => (
          <React.Fragment key={i}>
            <div className={`pipeline-stage stage-${stage.status}`}>
              <div className="stage-indicator">
                {stage.status === 'running' && <div className="spinner" />}
                {stage.status === 'complete' && <span className="stage-check">✓</span>}
                {stage.status === 'error' && <span className="stage-x">✕</span>}
                {stage.status === 'warning' && <span className="stage-warn">⚠</span>}
                {stage.status === 'pending' && <span className="stage-num">{i + 1}</span>}
              </div>
              <div className="stage-info">
                <span className="stage-name">{stage.name}</span>
                {stage.latencyMs !== null && (
                  <span className="stage-latency">{(stage.latencyMs / 1000).toFixed(1)}s</span>
                )}
                {stage.message && (
                  <span className="stage-message text-xs">{stage.message}</span>
                )}
              </div>
            </div>
            {i < allStages.length - 1 && (
              <div className={`pipeline-connector ${stage.status === 'complete' || stage.status === 'warning' ? 'active' : ''}`}>
                <div className="connector-line" />
                <div className="connector-arrow">→</div>
              </div>
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
