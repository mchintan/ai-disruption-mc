import React from 'react';

export function LandscapePrompt() {
  return (
    <div className="landscape-prompt" style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: '#060810',
      display: 'none',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '32px',
      textAlign: 'center',
    }}>
      <div style={{
        animation: 'rotate 2s ease-in-out infinite',
        marginBottom: 24,
      }}>
        <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="#22d3ee" strokeWidth="2">
          <rect x="3" y="6" width="18" height="12" rx="2" />
          <path d="M9 2v4M15 2v4M9 18v4M15 18v4" />
        </svg>
      </div>

      <h2 style={{
        fontSize: 24,
        fontWeight: 700,
        color: '#22d3ee',
        marginBottom: 16,
        fontFamily: "'JetBrains Mono', monospace",
      }}>
        Please Rotate Your Device
      </h2>

      <p style={{
        fontSize: 16,
        color: '#94a3b8',
        lineHeight: 1.6,
        maxWidth: 400,
        fontFamily: "'IBM Plex Sans', sans-serif",
      }}>
        This Monte Carlo simulation is optimized for landscape mode to display charts and data properly.
      </p>

      <div style={{
        marginTop: 24,
        padding: '12px 24px',
        background: 'rgba(34, 211, 238, 0.1)',
        border: '1px solid rgba(34, 211, 238, 0.3)',
        borderRadius: 8,
        fontSize: 14,
        color: '#64748b',
        fontFamily: "'JetBrains Mono', monospace",
      }}>
        🔄 Turn your phone sideways
      </div>
    </div>
  );
}
