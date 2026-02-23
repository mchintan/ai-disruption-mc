import React from 'react';
import { POLICY_ACTIONS } from '../utils/policyActions';

export function DecisionModal({
  decisionPoint,
  recommendedAction,
  onSelectAction,
  onSkip
}) {
  if (!decisionPoint) return null;

  const { year, phaseIndex, applicableActions } = decisionPoint;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.85)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
    }}>
      <div style={{
        background: '#1e293b',
        border: '1px solid #334155',
        borderRadius: 12,
        padding: 32,
        maxWidth: 800,
        maxHeight: '80vh',
        overflow: 'auto',
      }}>
        <h2 style={{
          fontSize: 24,
          fontWeight: 700,
          marginBottom: 8,
          color: '#f1f5f9'
        }}>
          Decision Point: {year}
        </h2>
        <p style={{
          fontSize: 14,
          color: '#94a3b8',
          marginBottom: 24
        }}>
          The simulation has reached a critical inflection point. Choose a policy intervention:
        </p>

        {/* AI Recommendation */}
        <div style={{
          background: 'rgba(34, 211, 238, 0.1)',
          border: '2px solid #22d3ee',
          borderRadius: 8,
          padding: 16,
          marginBottom: 24,
        }}>
          <div style={{ fontWeight: 700, color: '#22d3ee', marginBottom: 4 }}>
            AI Recommendation
          </div>
          <div style={{ fontSize: 16, color: '#f1f5f9' }}>
            {POLICY_ACTIONS.find(a => a.id === recommendedAction)?.label}
          </div>
          <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>
            {POLICY_ACTIONS.find(a => a.id === recommendedAction)?.description}
          </div>
        </div>

        {/* Action Options */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 12,
          marginBottom: 24,
        }}>
          {applicableActions.map(actionId => {
            const action = POLICY_ACTIONS.find(a => a.id === actionId);
            const isRecommended = actionId === recommendedAction;

            return (
              <button
                key={actionId}
                onClick={() => onSelectAction(action)}
                style={{
                  background: isRecommended ? 'rgba(34, 211, 238, 0.15)' : '#334155',
                  border: isRecommended ? '2px solid #22d3ee' : '1px solid #475569',
                  borderRadius: 8,
                  padding: 16,
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = isRecommended
                    ? 'rgba(34, 211, 238, 0.25)'
                    : '#475569';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = isRecommended
                    ? 'rgba(34, 211, 238, 0.15)'
                    : '#334155';
                }}
              >
                <div style={{ fontWeight: 700, fontSize: 14, color: '#f1f5f9', marginBottom: 6 }}>
                  {action.label}
                </div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 8 }}>
                  {action.description}
                </div>
                <div style={{ fontSize: 10, color: '#64748b' }}>
                  Effects: {Object.keys(action.effects).length > 0
                    ? Object.entries(action.effects).slice(0, 2).map(([key, eff]) =>
                        `${key.replace(/_/g, ' ')} (${eff.drift > 0 ? '+' : ''}${eff.drift}%)`
                      ).join(', ')
                    : 'None'}
                </div>
              </button>
            );
          })}
        </div>

        {/* Control Buttons */}
        <div style={{ display: 'flex', gap: 12 }}>
          <button
            onClick={() => {
              const action = POLICY_ACTIONS.find(a => a.id === recommendedAction);
              onSelectAction(action);
            }}
            style={{
              flex: 1,
              background: '#22d3ee',
              color: '#0f172a',
              border: 'none',
              borderRadius: 6,
              padding: '12px 24px',
              fontSize: 14,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Accept AI Recommendation
          </button>
          <button
            onClick={onSkip}
            style={{
              background: 'transparent',
              color: '#94a3b8',
              border: '1px solid #475569',
              borderRadius: 6,
              padding: '12px 24px',
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            Skip Decision
          </button>
        </div>
      </div>
    </div>
  );
}
