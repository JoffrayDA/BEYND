async function req(path, opts = {}) {
  const res = await fetch(`/api${path}`, {
    headers: { 'content-type': 'application/json' },
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  if (!res.ok) throw new Error(`${path} → ${res.status}`);
  return res.json();
}

export const api = {
  state: () => req('/state'),
  onboardingStart: (coachId) => req('/onboarding/start', { method: 'POST', body: { coachId } }),
  onboardingMessage: (text) => req('/onboarding/message', { method: 'POST', body: { text } }),
  onboardingComplete: (profile) => req('/onboarding/complete', { method: 'POST', body: profile }),
  chat: (text) => req('/chat', { method: 'POST', body: { text } }),
  switchCoach: (coachId) => req('/project/coach', { method: 'POST', body: { coachId } }),
  addMeasurement: (poids) => req('/measurement', { method: 'POST', body: { poids } }),
  toggleEngagement: (id) => req(`/engagement/${id}/toggle`, { method: 'POST' }),
};
