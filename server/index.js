import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { db, getActiveProject } from './db.js';
import { COACHES, DEFAULT_COACH, getCoach } from './coaches.js';
import { coachReply, generatePlan, HAS_KEY } from './llm.js';

const app = new Hono();
app.use('/api/*', cors());

const now = () => new Date().toISOString();
const today = () => now().slice(0, 10);
const coachList = () =>
  Object.values(COACHES).map((c) => ({ id: c.id, name: c.name, persona: c.persona }));

// Opening check-in thresholds (PRD open question — see docs/PRD.md §8).
const SEUIL_JOURS_SANS_LOG = 2;   // days without a weigh-in before the coach pings
const SEUIL_ADHERENCE = 50;       // % of week engagements below which we ping
const AGE_PROGRAMME_MIN = 5;      // days into the week before adherence is judged

const daysBetween = (from, to = now()) =>
  Math.floor((Date.parse(to.slice(0, 10)) - Date.parse(from.slice(0, 10))) / 86400000);

// --- helpers ---------------------------------------------------------------
function currentProgram(projectId) {
  const prog = db.prepare(
    `SELECT * FROM program WHERE project_id = ? ORDER BY semaine DESC LIMIT 1`
  ).get(projectId);
  if (!prog) return null;
  const engagements = db.prepare(
    `SELECT * FROM engagement WHERE program_id = ? ORDER BY id`
  ).all(prog.id);
  return { ...prog, plan: JSON.parse(prog.plan_json), engagements };
}

function metrics(projectId) {
  const rows = db.prepare(
    `SELECT * FROM measurement WHERE project_id = ? ORDER BY date`
  ).all(projectId);
  const poids = rows.map((r) => r.poids);
  const actuel = poids.at(-1) ?? null;
  const last7 = poids.slice(-7);
  const tendance7 = last7.length >= 2 ? +(last7.at(-1) - last7[0]).toFixed(1) : 0;
  const prog = currentProgram(projectId);
  const faits = prog ? prog.engagements.filter((e) => e.fait).length : 0;
  const total = prog ? prog.engagements.length : 0;
  const derniere_mesure = rows.at(-1)?.date ?? null;
  return {
    actuel,
    tendance7,
    adherence: total ? Math.round((faits / total) * 100) : 0,
    faits,
    total,
    derniere_mesure,
    // null = never logged, which counts as "overdue" for the check-in rule.
    jours_sans_log: derniere_mesure ? daysBetween(derniere_mesure) : null,
    measurements: rows,
  };
}

// Where the user stands in the project: week N of duree_semaines + % to target.
function progress(project) {
  const m = metrics(project.id);
  const u = db.prepare(`SELECT * FROM user WHERE id = 1`).get();
  const jours = Math.max(0, daysBetween(project.date_debut));
  const semaine_courante = Math.min(project.duree_semaines, Math.floor(jours / 7) + 1);
  let pct_objectif = null;
  if (u.poids_depart != null && u.poids_cible != null && u.poids_depart !== u.poids_cible && m.actuel != null) {
    const brut = (u.poids_depart - m.actuel) / (u.poids_depart - u.poids_cible);
    pct_objectif = Math.max(0, Math.min(100, Math.round(brut * 100)));
  }
  return {
    semaine_courante,
    duree_semaines: project.duree_semaines,
    jours_ecoules: jours,
    poids_depart: u.poids_depart,
    poids_cible: u.poids_cible,
    pct_objectif,
    reste_kg: m.actuel != null && u.poids_cible != null ? +(m.actuel - u.poids_cible).toFixed(1) : null,
  };
}

// Day-by-day log: weigh-ins and ticked engagements merged on the date key.
function history(projectId) {
  const mes = db.prepare(
    `SELECT date, poids FROM measurement WHERE project_id = ? ORDER BY date`
  ).all(projectId);
  const engs = db.prepare(
    `SELECT e.date, e.libelle, e.cible FROM engagement e
       JOIN program p ON p.id = e.program_id
      WHERE p.project_id = ? AND e.fait = 1 AND e.date IS NOT NULL
      ORDER BY e.date`
  ).all(projectId);

  const jours = new Map();
  const day = (d) => {
    if (!jours.has(d)) jours.set(d, { date: d, poids: null, delta: null, engagements: [] });
    return jours.get(d);
  };
  mes.forEach((r, i) => {
    const j = day(r.date);
    j.poids = r.poids;
    j.delta = i > 0 ? +(r.poids - mes[i - 1].poids).toFixed(1) : null;
  });
  for (const e of engs) day(e.date).engagements.push({ libelle: e.libelle, cible: e.cible });

  return [...jours.values()].sort((a, b) => b.date.localeCompare(a.date));
}

// --- opening check-in ------------------------------------------------------
// Returns the reason a proactive coach message is due, or null. Throttled to
// once per calendar day so reopening the app doesn't spam the chat.
function checkinReason(project) {
  if (project.statut !== 'active') return null;
  if (project.dernier_checkin?.slice(0, 10) === today()) return null;

  const m = metrics(project.id);
  if (m.jours_sans_log === null || m.jours_sans_log >= SEUIL_JOURS_SANS_LOG) return 'no_log';

  const prog = currentProgram(project.id);
  if (prog && daysBetween(prog.genere_le) >= AGE_PROGRAMME_MIN && m.adherence < SEUIL_ADHERENCE) {
    return 'engagements_en_retard';
  }
  return null;
}

function contextNote(project) {
  const m = metrics(project.id);
  const u = db.prepare(`SELECT * FROM user WHERE id = 1`).get();
  return `Objectif: ${project.objectif ?? '—'}. Poids actuel: ${m.actuel ?? '?'}kg, cible: ${u.poids_cible ?? '?'}kg. Tendance 7j: ${m.tendance7}kg. Adhérence engagements: ${m.faits}/${m.total}.`;
}

function messages(projectId) {
  return db.prepare(`SELECT * FROM message WHERE project_id = ? ORDER BY id`).all(projectId);
}

// --- state -----------------------------------------------------------------
app.get('/api/state', (c) => {
  const project = getActiveProject();
  const user = db.prepare(`SELECT * FROM user WHERE id = 1`).get();
  return c.json({
    hasKey: HAS_KEY,
    coaches: coachList(),
    user,
    project,
    messages: project ? messages(project.id) : [],
    program: project ? currentProgram(project.id) : null,
    metrics: project ? metrics(project.id) : null,
    progress: project && project.statut === 'active' ? progress(project) : null,
    checkin: project ? { raison: checkinReason(project) } : null,
  });
});

// --- onboarding: start (create project + first coach message) --------------
app.post('/api/onboarding/start', async (c) => {
  const { coachId = DEFAULT_COACH } = await c.req.json().catch(() => ({}));
  const info = db.prepare(
    `INSERT INTO project (coach_id, date_debut, statut) VALUES (?, ?, 'onboarding')`
  ).run(coachId, now());
  const projectId = info.lastInsertRowid;
  const opener = await coachReply({
    coachId,
    messages: [{ role: 'user', contenu: 'Démarre l’onboarding : présente-toi en une phrase et demande-moi mon objectif, mon poids actuel et ma cible.' }],
  });
  db.prepare(
    `INSERT INTO message (project_id, role, coach_id, contenu, timestamp) VALUES (?, 'coach', ?, ?, ?)`
  ).run(projectId, coachId, opener, now());
  const project = getActiveProject();
  return c.json({ project, messages: messages(projectId) });
});

// --- onboarding: user turn -------------------------------------------------
app.post('/api/onboarding/message', async (c) => {
  const project = getActiveProject();
  if (!project) return c.json({ error: 'no project' }, 400);
  const { text } = await c.req.json();
  db.prepare(
    `INSERT INTO message (project_id, role, contenu, timestamp) VALUES (?, 'user', ?, ?)`
  ).run(project.id, text, now());
  const reply = await coachReply({ coachId: project.coach_id, messages: messages(project.id) });
  db.prepare(
    `INSERT INTO message (project_id, role, coach_id, contenu, timestamp) VALUES (?, 'coach', ?, ?, ?)`
  ).run(project.id, project.coach_id, reply, now());
  return c.json({ messages: messages(project.id) });
});

// --- onboarding: complete (save profile, generate plan, activate) ----------
app.post('/api/onboarding/complete', async (c) => {
  const project = getActiveProject();
  if (!project) return c.json({ error: 'no project' }, 400);
  const p = await c.req.json();
  db.prepare(
    `UPDATE user SET poids_depart=?, poids_cible=?, taille=?, niveau=?, dispo_par_semaine=?, contraintes=? WHERE id=1`
  ).run(p.poids_depart ?? null, p.poids_cible ?? null, p.taille ?? null, p.niveau ?? null, p.dispo_par_semaine ?? null, p.contraintes ?? null);
  // Generate the plan before activating anything: if the LLM fails, the project
  // stays in onboarding and the user can retry instead of landing plan-less.
  let plan;
  try {
    plan = await generatePlan({ coachId: project.coach_id, profile: p, semaine: 1 });
  } catch (err) {
    console.error('generatePlan failed:', err);
    return c.json({ error: 'plan generation failed' }, 502);
  }

  db.prepare(`UPDATE project SET objectif=?, duree_semaines=?, statut='active' WHERE id=?`)
    .run(p.objectif ?? 'Perte de poids', p.duree_semaines ?? 12, project.id);

  // seed first measurement from starting weight
  if (p.poids_depart) {
    db.prepare(`INSERT INTO measurement (project_id, date, poids) VALUES (?, ?, ?)`)
      .run(project.id, now().slice(0, 10), p.poids_depart);
  }

  const progInfo = db.prepare(
    `INSERT INTO program (project_id, semaine, plan_json, genere_le) VALUES (?, ?, ?, ?)`
  ).run(project.id, plan.semaine, JSON.stringify(plan), now());
  const insEng = db.prepare(
    `INSERT INTO engagement (program_id, jour, libelle, cible) VALUES (?, ?, ?, ?)`
  );
  for (const e of plan.engagements) insEng.run(progInfo.lastInsertRowid, e.jour, e.libelle, e.cible);

  return c.json({ project: getActiveProject(), program: currentProgram(project.id) });
});

// --- chat (active project) -------------------------------------------------
app.post('/api/chat', async (c) => {
  const project = getActiveProject();
  if (!project) return c.json({ error: 'no project' }, 400);
  const { text } = await c.req.json();
  db.prepare(`INSERT INTO message (project_id, role, contenu, timestamp) VALUES (?, 'user', ?, ?)`)
    .run(project.id, text, now());
  const reply = await coachReply({
    coachId: project.coach_id,
    messages: messages(project.id),
    contextNote: contextNote(project),
  });
  db.prepare(`INSERT INTO message (project_id, role, coach_id, contenu, timestamp) VALUES (?, 'coach', ?, ?, ?)`)
    .run(project.id, project.coach_id, reply, now());
  return c.json({ messages: messages(project.id) });
});

// --- switch coach (same project) -------------------------------------------
app.post('/api/project/coach', async (c) => {
  const project = getActiveProject();
  if (!project) return c.json({ error: 'no project' }, 400);
  const { coachId } = await c.req.json();
  if (!COACHES[coachId]) return c.json({ error: 'unknown coach' }, 400);
  db.prepare(`UPDATE project SET coach_id=? WHERE id=?`).run(coachId, project.id);
  const coach = getCoach(coachId);
  const line = await coachReply({
    coachId,
    messages: [{ role: 'user', contenu: `Tu prends le relais comme coach (${coach.name}). Présente-toi en une phrase et enchaîne.` }],
    contextNote: contextNote(project),
  });
  db.prepare(`INSERT INTO message (project_id, role, coach_id, contenu, timestamp) VALUES (?, 'coach', ?, ?, ?)`)
    .run(project.id, coachId, line, now());
  return c.json({ project: getActiveProject(), messages: messages(project.id) });
});

// --- log: measurement ------------------------------------------------------
app.post('/api/measurement', (c) => {
  const project = getActiveProject();
  if (!project) return c.json({ error: 'no project' }, 400);
  return c.req.json().then((b) => {
    const poids = Number(b.poids);
    if (!Number.isFinite(poids) || poids <= 0) return c.json({ error: 'invalid poids' }, 400);
    db.prepare(`INSERT INTO measurement (project_id, date, poids) VALUES (?, ?, ?)`)
      .run(project.id, b.date ?? now().slice(0, 10), poids);
    return c.json({ metrics: metrics(project.id) });
  });
});

// --- log: toggle engagement ------------------------------------------------
app.post('/api/engagement/:id/toggle', (c) => {
  const id = c.req.param('id');
  const eng = db.prepare(`SELECT * FROM engagement WHERE id=?`).get(id);
  if (!eng) return c.json({ error: 'not found' }, 404);
  const fait = eng.fait ? 0 : 1;
  db.prepare(`UPDATE engagement SET fait=?, date=? WHERE id=?`)
    .run(fait, fait ? now().slice(0, 10) : null, id);
  const project = getActiveProject();
  return c.json({ program: currentProgram(project.id), metrics: metrics(project.id) });
});

// --- P1: history -----------------------------------------------------------
app.get('/api/history', (c) => {
  const project = getActiveProject();
  if (!project) return c.json({ error: 'no project' }, 400);
  return c.json({ jours: history(project.id) });
});

// --- P1: settings (profile + project) --------------------------------------
app.post('/api/profile', async (c) => {
  const project = getActiveProject();
  if (!project) return c.json({ error: 'no project' }, 400);
  const b = await c.req.json();

  const u = db.prepare(`SELECT * FROM user WHERE id = 1`).get();
  const pick = (key, cast = Number) => {
    if (b[key] === undefined || b[key] === '' || b[key] === null) return u[key];
    const v = cast(b[key]);
    return Number.isNaN(v) ? u[key] : v;
  };
  db.prepare(
    `UPDATE user SET poids_cible=?, taille=?, niveau=?, dispo_par_semaine=?, contraintes=? WHERE id=1`
  ).run(
    pick('poids_cible'),
    pick('taille'),
    b.niveau ?? u.niveau,
    pick('dispo_par_semaine'),
    b.contraintes ?? u.contraintes,
  );

  const duree = Number(b.duree_semaines);
  db.prepare(`UPDATE project SET objectif=?, duree_semaines=? WHERE id=?`).run(
    b.objectif ?? project.objectif,
    Number.isFinite(duree) && duree > 0 ? duree : project.duree_semaines,
    project.id,
  );

  const updated = getActiveProject();
  return c.json({
    user: db.prepare(`SELECT * FROM user WHERE id = 1`).get(),
    project: updated,
    progress: progress(updated),
  });
});

// --- P1: opening check-in --------------------------------------------------
app.post('/api/checkin', async (c) => {
  const project = getActiveProject();
  if (!project) return c.json({ error: 'no project' }, 400);
  const raison = checkinReason(project);
  if (!raison) return c.json({ fired: false, messages: messages(project.id) });

  const m = metrics(project.id);
  const consigne = raison === 'no_log'
    ? `Ça fait ${m.jours_sans_log ?? 'plusieurs'} jour(s) qu'il n'a pas loggé son poids. Relance-le sur ce point précis, en une ou deux phrases.`
    : `Il n'a coché que ${m.faits}/${m.total} engagements de la semaine. Relance-le là-dessus, en une ou deux phrases.`;

  const line = await coachReply({
    coachId: project.coach_id,
    messages: [...messages(project.id), { role: 'user', contenu: `[système] Ouvre la conversation toi-même. ${consigne} N'invente pas de chiffres.` }],
    contextNote: contextNote(project),
  });
  db.prepare(`INSERT INTO message (project_id, role, coach_id, contenu, timestamp) VALUES (?, 'coach', ?, ?, ?)`)
    .run(project.id, project.coach_id, line, now());
  db.prepare(`UPDATE project SET dernier_checkin=? WHERE id=?`).run(now(), project.id);

  return c.json({ fired: true, raison, messages: messages(project.id) });
});

const port = Number(process.env.PORT) || 8787;
serve({ fetch: app.fetch, port });
console.log(`BEYND server on :${port}  (LLM key: ${HAS_KEY ? 'yes' : 'no — mock mode'})`);
