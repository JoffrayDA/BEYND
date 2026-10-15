import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { Card, Badge } from '../ds.js';

const JOURS = ['dim', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam'];
const MOIS = ['jan', 'fév', 'mar', 'avr', 'mai', 'juin', 'juil', 'août', 'sep', 'oct', 'nov', 'déc'];

function label(iso) {
  const d = new Date(`${iso}T00:00:00`);
  return `${JOURS[d.getDay()]} ${d.getDate()} ${MOIS[d.getMonth()]}`;
}

export function History() {
  const [jours, setJours] = useState(null);

  useEffect(() => {
    api.history().then((r) => setJours(r.jours)).catch(() => setJours([]));
  }, []);

  if (!jours) {
    return <div style={{ padding: 16, color: 'var(--color-text-muted)' }}>Chargement…</div>;
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <h2 style={{ fontFamily: 'var(--font-display)', margin: 0, fontSize: 'var(--text-lg)' }}>Historique</h2>

      {jours.length === 0 && (
        <p style={{ color: 'var(--color-text-muted)' }}>Rien de loggé pour l’instant.</p>
      )}

      {jours.map((j) => (
        <Card key={j.date} padding="12px">
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <strong style={{ flex: 1 }}>{label(j.date)}</strong>
            {j.poids != null && (
              <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{j.poids} kg</span>
            )}
            {j.delta != null && j.delta !== 0 && (
              <Badge tone={j.delta < 0 ? 'success' : 'neutral'}>
                {j.delta > 0 ? '+' : ''}{j.delta}
              </Badge>
            )}
          </div>
          {j.engagements.length > 0 && (
            <ul style={{ margin: '8px 0 0', paddingLeft: 18, fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
              {j.engagements.map((e, i) => (
                <li key={i}>{e.libelle} · {e.cible}</li>
              ))}
            </ul>
          )}
        </Card>
      ))}
    </div>
  );
}
