const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

let _sessionId: string | null = null;

function getSessionId(): string {
  if (!_sessionId) {
    _sessionId = sessionStorage.getItem("mc_session") || Math.random().toString(36).substring(2, 10);
    sessionStorage.setItem("mc_session", _sessionId);
  }
  return _sessionId;
}

export { getSessionId };

export function track(event: string, data?: Record<string, unknown>): void {
  try {
    const payload = JSON.stringify({
      event,
      session: getSessionId(),
      ts: Date.now() / 1000,
      ...data,
    });
    if (navigator.sendBeacon) {
      navigator.sendBeacon(
        `${API_BASE}/api/obs/event`,
        new Blob([payload], { type: "application/json" }),
      );
    } else {
      fetch(`${API_BASE}/api/obs/event`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
        keepalive: true,
      }).catch(() => {});
    }
  } catch {
    // Telemetry is fire-and-forget, never block the UI
  }
}
