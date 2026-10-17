// LLM integration — Google Gemini. All calls are server-side (API key never
// reaches the client). Falls back to a deterministic mock plan when no key is
// set, so the app is runnable end-to-end in dev without credentials.

import { GoogleGenAI, Type } from '@google/genai';
import { SYSTEM_PROMPT } from './coach.js';
import { CATEGORIES } from './db.js';
import {
  clampDifficulty, MAX_STEPS, MAX_TASKS, MAX_HABITS, MAX_MILESTONES,
  PER_WEEK_MIN, PER_WEEK_MAX, PER_WEEK_DEFAULT, BOSS_WEEKS_MIN, BOSS_WEEKS_MAX, BOSS_WEEKS_DEFAULT,
} from './engine.js';

const KEY = process.env.GEMINI_API_KEY;
// gemini-2.5-flash is closed to new keys (404 since 2026); the API points to 3.8.
const MODEL = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
const defaultClient = KEY ? new GoogleGenAI({ apiKey: KEY }) : null;
export const HAS_KEY = Boolean(KEY);

export { MAX_STEPS, MAX_TASKS };
const MAX_TITLE = 80;
const MAX_LABEL = 160;

export class CoachError extends Error {}

const PLAN_TOOL = {
  name: 'proposer_plan',
  description: 'Propose le plan structuré pour atteindre l’objectif de l’utilisateur.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      kind: { type: Type.STRING, enum: ['project', 'routine'], description: 'project = un parcours qui se termine ; routine = tenir un rythme.' },
      title: { type: Type.STRING, description: 'Titre court de l’objectif.' },
      category: { type: Type.STRING, enum: CATEGORIES.map((c) => c.id), description: 'Catégorie de l’objectif.' },
      difficulty: { type: Type.INTEGER, description: 'Rating de difficulté, 400 à 2200.' },
      intro: { type: Type.STRING, description: 'Présentation du plan en 2-3 phrases, adressée à "tu".' },
      habits: {
        type: Type.ARRAY,
        description: 'Routine seulement : 1 à 3 habitudes récurrentes.',
        items: {
          type: Type.OBJECT,
          properties: {
            label: { type: Type.STRING, description: 'Action d’une séance, avec sa durée (ex. "Lire 20 min").' },
            per_week: { type: Type.INTEGER, description: 'Séances par semaine, 1 à 7.' },
          },
          required: ['label', 'per_week'],
        },
      },
      milestones: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'Routine seulement : 0 à 8 jalons de niveau, sans ordre imposé.' },
      boss_weeks: { type: Type.INTEGER, description: 'Routine seulement : semaines tenues d’affilée pour vaincre le boss, 4 à 12.' },
      steps: {
        type: Type.ARRAY,
        description: 'Projet seulement : étapes dans l’ordre chronologique.',
        items: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING, description: 'Nom du jalon.' },
            tasks: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'Tâches concrètes et cochables.' },
          },
          required: ['title', 'tasks'],
        },
      },
    },
    required: ['kind', 'title', 'category', 'difficulty', 'intro'],
  },
};

// Goal text → { title, category, difficulty, intro, steps: [{ title, tasks[] }] }.
// Nothing is persisted here: the caller shows the proposal and saves it only
// once the user confirms. One retry on an unusable answer, then CoachError.
export async function analyzeGoal({ prompt, client = defaultClient }) {
  const text = String(prompt ?? '').trim();
  if (!text) throw new CoachError('empty goal');
  if (!client) return mockPlan(text);

  let lastErr;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await client.models.generateContent({
        model: MODEL,
        contents: [{ role: 'user', parts: [{ text: `Mon objectif : ${text}` }] }],
        config: {
          systemInstruction: SYSTEM_PROMPT,
          maxOutputTokens: 4000,
          // Thinking is on by default on 2.5 and consumes the output budget —
          // disabled so the function call never gets truncated.
          thinkingConfig: { thinkingBudget: 0 },
          tools: [{ functionDeclarations: [PLAN_TOOL] }],
          toolConfig: {
            functionCallingConfig: { mode: 'ANY', allowedFunctionNames: [PLAN_TOOL.name] },
          },
        },
      });
      const call = res.functionCalls?.[0];
      if (!call) throw new CoachError('no function call');
      return validatePlan(call.args, text);
    } catch (err) {
      lastErr = err;
      console.error(`analyzeGoal attempt ${attempt + 1} failed:`, err.message);
    }
  }
  throw new CoachError(`plan generation failed: ${lastErr?.message}`);
}

const clean = (s, max) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const fold = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

// Accepts the id or the display name, with or without accents; else "autre".
function normalizeCategory(raw) {
  const v = fold(String(raw ?? ''));
  const hit = CATEGORIES.find((c) => c.id === v || fold(c.name) === v);
  return hit ? hit.id : 'autre';
}

const clampInt = (v, min, max, fallback) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};

// Lenient on shape (trims, drops empties, truncates overflow), strict on
// substance: a plan with no usable step (project) or habit (routine), or no
// numeric difficulty, is rejected.
export function validatePlan(plan, fallbackTitle = '') {
  if (!plan || typeof plan !== 'object') throw new CoachError('plan is not an object');
  const difficulty = Number(plan.difficulty);
  if (!Number.isFinite(difficulty)) throw new CoachError('difficulty missing');
  const base = {
    title: clean(plan.title, MAX_TITLE) || clean(fallbackTitle, MAX_TITLE),
    category: normalizeCategory(plan.category),
    difficulty: clampDifficulty(difficulty),
    intro: clean(plan.intro, 600),
  };

  if (plan.kind === 'routine') {
    const habits = (Array.isArray(plan.habits) ? plan.habits : [])
      .map((h) => ({ label: clean(h?.label, MAX_LABEL), per_week: clampInt(h?.per_week, PER_WEEK_MIN, PER_WEEK_MAX, PER_WEEK_DEFAULT) }))
      .filter((h) => h.label)
      .slice(0, MAX_HABITS);
    if (habits.length === 0) throw new CoachError('no usable habit');
    const milestones = (Array.isArray(plan.milestones) ? plan.milestones : [])
      .map((m) => clean(m, MAX_TITLE)).filter(Boolean).slice(0, MAX_MILESTONES);
    return {
      kind: 'routine', ...base, habits, milestones,
      boss_weeks: clampInt(plan.boss_weeks, BOSS_WEEKS_MIN, BOSS_WEEKS_MAX, BOSS_WEEKS_DEFAULT),
    };
  }

  const steps = (Array.isArray(plan.steps) ? plan.steps : [])
    .map((s) => ({
      title: clean(s?.title, MAX_TITLE),
      tasks: (Array.isArray(s?.tasks) ? s.tasks : [])
        .map((t) => clean(t, MAX_LABEL))
        .filter(Boolean)
        .slice(0, MAX_TASKS),
    }))
    .filter((s) => s.title && s.tasks.length > 0)
    .slice(0, MAX_STEPS);
  if (steps.length === 0) throw new CoachError('no usable step');

  return { kind: 'project', ...base, steps };
}

// --- Mock fallback (no API key) ---------------------------------------------
// A rhythm-like goal gets the callisthenics routine, anything else the
// brief's first use case (§9), so both kinds are playable without a key.
const ROUTINE_HINT = /routine|habitude|lire|lecture|callisth|sport|courir|muscu|méditer|chaque (jour|semaine)/i;

function mockPlan(prompt) {
  if (ROUTINE_HINT.test(prompt)) {
    return Promise.resolve(validatePlan({
      kind: 'routine',
      title: prompt,
      category: 'sport',
      difficulty: 1600,
      intro: '[mock · pas de clé API] Routine type : 3 séances par semaine, des jalons de niveau, et le boss tombe après 8 semaines tenues d’affilée.',
      habits: [{ label: 'Séance callisthénie (45 min)', per_week: 3 }, { label: 'Mobilité épaules et poignets (10 min)', per_week: 2 }],
      milestones: ['10 tractions strictes', 'Pompe en équilibre contre le mur', 'Premier muscle-up'],
      boss_weeks: 8,
    }, prompt));
  }
  return Promise.resolve(validatePlan({
    kind: 'project',
    title: prompt,
    category: 'tech',
    difficulty: 1850,
    intro: '[mock · pas de clé API] Plan type pentester sur 6 mois, 1 à 2 h par jour. 5 étapes, de Pre Security jusqu’à l’eJPT.',
    steps: [
      { title: 'Mois 1 — Bases', tasks: ['Parcours Pre Security (TryHackMe)', 'Bandit niveaux 0 à 10 (OverTheWire)', 'Bandit niveaux 11 à 20 (OverTheWire)', 'Bases de Bash : 5 scripts courts', 'Bases de Python : 5 scripts courts'] },
      { title: 'Mois 2 — Cyber Security 101', tasks: ['Module Networking (TryHackMe)', 'Module Linux (TryHackMe)', 'Module Windows (TryHackMe)', 'Module Web Hacking (TryHackMe)'] },
      { title: 'Mois 3-4 — Jr Penetration Tester', tasks: ['Parcours Jr Penetration Tester (TryHackMe) — 1re moitié', 'Parcours Jr Penetration Tester (TryHackMe) — 2de moitié', 'Labs SQL injection (PortSwigger Academy)', 'Labs XSS (PortSwigger Academy)'] },
      { title: 'Mois 5 — Machines complètes', tasks: ['Room Vulnversity', 'Room Kenobi', 'Room Blue', 'Room Steel Mountain', '2 machines faciles sur Hack The Box'] },
      { title: 'Mois 6 — Certification', tasks: ['Révision des notes et checklist eJPT', 'Examen blanc', 'Passer l’eJPT'] },
    ],
  }, prompt));
}
