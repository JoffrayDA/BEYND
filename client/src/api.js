export const AUTH_EVENT = 'beynd:auth-required';

async function req(path, opts = {}) {
  const res = await fetch(`/api${path}`, {
    headers: { 'content-type': 'application/json' },
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    // Session missing or expired: the app swaps to the login screen.
    if (res.status === 401 && path !== '/login') window.dispatchEvent(new Event(AUTH_EVENT));
    const err = new Error(data.error || `${path} → ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

export const api = {
  session: () => req('/session'),
  login: (password) => req('/login', { method: 'POST', body: { password } }),
  logout: () => req('/logout', { method: 'POST' }),
  state: () => req('/state'),
  progress: () => req('/progress'),
  analyzeGoal: (prompt) => req('/goals/analyze', { method: 'POST', body: { prompt } }),
  createGoal: (analysis) => req('/goals', { method: 'POST', body: analysis }),
  goals: ({ category, archived } = {}) => {
    const q = new URLSearchParams();
    if (category) q.set('category', category);
    if (archived) q.set('archived', '1');
    const s = q.toString();
    return req(`/goals${s ? `?${s}` : ''}`);
  },
  goal: (id) => req(`/goals/${id}`),
  updateGoal: (id, patch) => req(`/goals/${id}`, { method: 'PATCH', body: patch }),
  toggleTask: (id) => req(`/tasks/${id}/toggle`, { method: 'POST' }),
  toggleHabit: (id) => req(`/habits/${id}/toggle`, { method: 'POST' }),
  toggleMilestone: (id) => req(`/milestones/${id}/toggle`, { method: 'POST' }),
  levelUp: (goalId, body) => req(`/goals/${goalId}/level-up`, { method: 'POST', body }),
  assault: () => req('/raid/assault', { method: 'POST' }),
  raids: () => req('/raids'),
  equip: (slot, item) => req('/gear', { method: 'POST', body: { slot, item } }),
};
