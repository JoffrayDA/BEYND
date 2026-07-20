import React, { useState } from 'react';
import { api } from '../api.js';
import { Button, Card, Input } from '../ds.js';

export function Log({ state, refresh }) {
  const [program, setProgram] = useState(state.program);
  const [weight, setWeight] = useState('');
  const [busy, setBusy] = useState(false);

  async function addWeight() {
    const val = Number(weight);
    if (!val || busy) return;
    setBusy(true);
    await api.addMeasurement(val);
    setWeight('');
    await refresh();
    setBusy(false);
  }

  async function toggle(id) {
    const r = await api.toggleEngagement(id);
    setProgram(r.program);
    refresh();
  }

  const engagements = program?.engagements || [];

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <h2 style={{ fontFamily: 'var(--font-display)', margin: '0 0 8px' }}>Peser</h2>
        <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
          <div style={{ flex: 1 }} onKeyDown={(e) => { if (e.key === 'Enter') addWeight(); }}>
            <Input type="number" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="Poids du jour (kg)" />
          </div>
          <Button onClick={addWeight} disabled={busy || !weight}>Enregistrer</Button>
        </div>
      </div>

      <div>
        <h2 style={{ fontFamily: 'var(--font-display)', margin: '0 0 4px' }}>Engagements — semaine {program?.semaine ?? 1}</h2>
        {program?.plan?.resume && (
          <p style={{ color: 'var(--color-text-muted)', margin: '0 0 12px', fontSize: 'var(--text-sm)' }}>{program.plan.resume}</p>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {engagements.map((e) => (
            <Card key={e.id} padding="12px">
              <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
                <input type="checkbox" checked={!!e.fait} onChange={() => toggle(e.id)}
                  style={{ width: 22, height: 22, accentColor: 'var(--color-primary)' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, textDecoration: e.fait ? 'line-through' : 'none', opacity: e.fait ? 0.55 : 1 }}>{e.libelle}</div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>{e.jour} · {e.cible}</div>
                </div>
              </label>
            </Card>
          ))}
          {engagements.length === 0 && <p style={{ color: 'var(--color-text-muted)' }}>Aucun engagement pour l’instant.</p>}
        </div>
      </div>
    </div>
  );
}
