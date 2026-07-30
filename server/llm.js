// LLM integration — Google Gemini. All calls are server-side (API key never
// reaches the client). Falls back to deterministic mock replies when no key is
// set, so the app is runnable end-to-end in dev without credentials.

import { GoogleGenAI, Type } from '@google/genai';
import { getCoach } from './coaches.js';

const KEY = process.env.GEMINI_API_KEY;
const CHAT_MODEL = 'gemini-2.5-flash';
const client = KEY ? new GoogleGenAI({ apiKey: KEY }) : null;
export const HAS_KEY = Boolean(KEY);

// --- 1 & 3. Chat / onboarding reply -----------------------------------------
export async function coachReply({ coachId, messages, contextNote = '' }) {
  const coach = getCoach(coachId);
  if (!client) return mockReply(coach, messages);

  const system = contextNote
    ? `${coach.systemPrompt}\n\nContexte à jour :\n${contextNote}`
    : coach.systemPrompt;

  const res = await client.models.generateContent({
    model: CHAT_MODEL,
    contents: messages.map((m) => ({
      role: m.role === 'coach' ? 'model' : 'user',
      parts: [{ text: m.contenu ?? m.content ?? '' }],
    })),
    config: {
      systemInstruction: system,
      maxOutputTokens: 500,
      // Thinking is on by default on 2.5 and consumes the output budget —
      // disabled so short chat replies never come back empty.
      thinkingConfig: { thinkingBudget: 0 },
    },
  });
  return (res.text ?? '').trim();
}

// --- 2. Structured weekly program generation --------------------------------
const PLAN_TOOL = {
  name: 'proposer_programme',
  description: 'Propose le programme hebdo structuré pour l’utilisateur.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      semaine: { type: Type.INTEGER, description: 'Numéro de semaine (1 pour le début).' },
      resume: { type: Type.STRING, description: 'Résumé court du plan de la semaine, adressé à "tu".' },
      engagements: {
        type: Type.ARRAY,
        description: 'Liste des engagements concrets et cochables de la semaine.',
        items: {
          type: Type.OBJECT,
          properties: {
            jour: { type: Type.STRING, description: 'Jour ou moment (ex: "Lundi", "3x/sem").' },
            libelle: { type: Type.STRING, description: 'Ex: "20 pompes", "Séance cardio 30 min".' },
            cible: { type: Type.STRING, description: 'Cible mesurable ex: "20 reps", "30 min", "fait".' },
          },
          required: ['libelle', 'cible'],
        },
      },
    },
    required: ['semaine', 'resume', 'engagements'],
  },
};

export async function generatePlan({ coachId, profile, semaine = 1 }) {
  const coach = getCoach(coachId);
  if (!client) return mockPlan(semaine);

  const res = await client.models.generateContent({
    model: CHAT_MODEL,
    contents: [{
      role: 'user',
      parts: [{
        text: `Profil utilisateur :\n${JSON.stringify(profile, null, 2)}\n\nGénère le programme de la semaine ${semaine}.`,
      }],
    }],
    config: {
      systemInstruction: `${coach.systemPrompt}\n\nTu génères un programme fitness perso pour la semaine ${semaine}. Appelle l'outil proposer_programme avec des engagements concrets, mesurables, adaptés au profil.`,
      maxOutputTokens: 900,
      tools: [{ functionDeclarations: [PLAN_TOOL] }],
      toolConfig: {
        functionCallingConfig: { mode: 'ANY', allowedFunctionNames: ['proposer_programme'] },
      },
    },
  });
  const call = res.functionCalls?.[0];
  if (!call) throw new Error('Plan generation returned no function call');
  return validatePlan(call.args, semaine);
}

function validatePlan(plan, semaine) {
  if (!plan || !Array.isArray(plan.engagements) || plan.engagements.length === 0) {
    throw new Error('Invalid plan: engagements missing');
  }
  return {
    semaine: plan.semaine ?? semaine,
    resume: String(plan.resume ?? ''),
    engagements: plan.engagements.map((e) => ({
      jour: e.jour ?? '',
      libelle: String(e.libelle),
      cible: String(e.cible ?? 'fait'),
    })),
  };
}

// --- Mock fallbacks (no API key) --------------------------------------------
function mockReply(coach, messages) {
  const last = messages[messages.length - 1];
  const txt = (last?.contenu ?? last?.content ?? '').slice(0, 60);
  const byCoach = {
    Max: `Reçu 5/5${txt ? ` sur "${txt}"` : ''}. On avance tranquille mais on avance 💪`,
    Sam: `Ok. ${txt ? `T'as dit "${txt}". ` : ''}On fait quoi concrètement.`,
    Nova: `Noté. ${txt ? `Entrée : "${txt}". ` : ''}Donnée enregistrée, on suit la tendance.`,
  };
  return Promise.resolve(`[mock · pas de clé API] ${byCoach[coach.name] ?? byCoach.Max}`);
}

function mockPlan(semaine) {
  return Promise.resolve({
    semaine,
    resume: '[mock] Semaine de démarrage : on pose les bases, 3 séances.',
    engagements: [
      { jour: 'Lundi', libelle: '20 pompes', cible: '20 reps' },
      { jour: 'Lundi', libelle: '15 abdos', cible: '15 reps' },
      { jour: 'Mercredi', libelle: 'Cardio', cible: '30 min' },
      { jour: 'Vendredi', libelle: 'Marche rapide', cible: '5 000 pas' },
    ],
  });
}
