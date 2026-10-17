async function req(path, opts = {}) {
  const res = await fetch(`/api${path}`, {
    headers: { 'content-type': 'application/json' },
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `${path} → ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

export const api = {
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
};
