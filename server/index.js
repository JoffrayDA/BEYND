import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { db, getActiveProject } from './db.js';
import { COACHES, DEFAULT_COACH, getCoach } from './coaches.js';
import { coachReply, generatePlan, HAS_KEY } from './llm.js';

const app = new Hono();
app.use('/api/*', cors());

const now = () => new Date().toISOString();
const coachList = () =>
  Object.values(COACHES).map((c) => ({ id: c.id, name: c.name, persona: c.persona }));

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
  return { actuel, tendance7, adherence: total ? Math.round((faits / total) * 100) : 0, faits, total, measurements: rows };
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
  db.prepare(`UPDATE project SET objectif=?, duree_semaines=?, statut='active' WHERE id=?`)
    .run(p.objectif ?? 'Perte de poids', p.duree_semaines ?? 12, project.id);

  // seed first measurement from starting weight
  if (p.poids_depart) {
    db.prepare(`INSERT INTO measurement (project_id, date, poids) VALUES (?, ?, ?)`)
      .run(project.id, now().slice(0, 10), p.poids_depart);
  }

  const plan = await generatePlan({ coachId: project.coach_id, profile: p, semaine: 1 });
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
  return c.req.json().then((b) => {
    db.prepare(`INSERT INTO measurement (project_id, date, poids) VALUES (?, ?, ?)`)
      .run(project.id, b.date ?? now().slice(0, 10), b.poids);
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

const port = Number(process.env.PORT) || 8787;
serve({ fetch: app.fetch, port });
console.log(`BEYND server on :${port}  (LLM key: ${HAS_KEY ? 'yes' : 'no — mock mode'})`);
