/* Shared utilities: session persistence, shuffling, objective metadata. */

const STORAGE_KEY = 'cysa_quiz_session_v1';

const TILE_THEMES = {
  lightning: { emoji: '⚡', label: 'Lightning' },
  fire:      { emoji: '🔥', label: 'Fire' },
  storm:     { emoji: '⛈️', label: 'Storm Cloud' },
  sun:       { emoji: '☀️', label: 'Sun' },
  green:     { emoji: '🌿', label: 'Green' }
};

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function subObjectiveLabel(subId) {
  for (const domain of Object.keys(CYSA_SUB_OBJECTIVES)) {
    const match = CYSA_SUB_OBJECTIVES[domain].find(s => s.id === subId);
    if (match) return match.label;
  }
  return subId;
}

function questionPool(objectiveCodes) {
  if (!objectiveCodes || objectiveCodes.length === 0) return CYSA_QUESTIONS;
  const set = new Set(objectiveCodes);
  return CYSA_QUESTIONS.filter(q => set.has(q.sub));
}

/** Build a brand-new randomized quiz session (fresh questions + shuffled option order). */
function buildSession({ mode, count, objectives, label, theme }) {
  const pool = shuffle(questionPool(objectives));
  const picked = pool.slice(0, Math.min(count, pool.length));
  const questions = picked.map(q => ({
    id: q.id,
    q: q.q,
    objective: q.objective,
    objectiveName: q.objectiveName,
    sub: q.sub,
    subLabel: subObjectiveLabel(q.sub),
    options: shuffle(q.options)
  }));
  return {
    sessionId: 'sess_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
    createdAt: Date.now(),
    mode,
    label,
    theme,
    objectives: objectives || [],
    requestedCount: count,
    questions,
    currentIndex: 0,
    userAnswers: new Array(questions.length).fill(null),
    finished: false,
    score: null,
    round: 1
  };
}

/** A retake round: only the questions missed last round, reshuffled, with fresh option order. */
function buildRetakeSession(prev, missedIds) {
  const byId = new Map(CYSA_QUESTIONS.map(q => [q.id, q]));
  const picked = shuffle(missedIds.map(id => byId.get(id)).filter(Boolean));
  const questions = picked.map(q => ({
    id: q.id,
    q: q.q,
    objective: q.objective,
    objectiveName: q.objectiveName,
    sub: q.sub,
    subLabel: subObjectiveLabel(q.sub),
    options: shuffle(q.options)
  }));
  return {
    sessionId: 'sess_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
    createdAt: Date.now(),
    mode: prev.mode,
    label: prev.label,
    theme: prev.theme,
    objectives: prev.objectives,
    requestedCount: prev.requestedCount,
    questions,
    currentIndex: 0,
    userAnswers: new Array(questions.length).fill(null),
    finished: false,
    score: null,
    round: (prev.round || 1) + 1
  };
}

/** Ids of the questions answered wrong or left unanswered. */
function missedQuestionIds(session) {
  return session.questions.filter((q, i) => {
    const a = session.userAnswers[i];
    return !(a !== null && a !== undefined && q.options[a] && q.options[a].correct);
  }).map(q => q.id);
}

function loadSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

function saveSession(session) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

function clearSession() {
  localStorage.removeItem(STORAGE_KEY);
}

function hasResumableSession() {
  const s = loadSession();
  return !!(s && !s.finished && s.questions && s.questions.length > 0);
}

function computeScore(session) {
  let correct = 0;
  session.questions.forEach((q, i) => {
    const ansIdx = session.userAnswers[i];
    if (ansIdx !== null && ansIdx !== undefined && q.options[ansIdx] && q.options[ansIdx].correct) {
      correct++;
    }
  });
  const total = session.questions.length;
  const scoreOutOf100 = total === 0 ? 0 : Math.round((correct / total) * 100);
  return { correct, total, scoreOutOf100 };
}

function objectiveBreakdown(session) {
  const stats = {};
  session.questions.forEach((q, i) => {
    if (!stats[q.sub]) {
      stats[q.sub] = { name: q.subLabel, correct: 0, total: 0 };
    }
    stats[q.sub].total++;
    const ansIdx = session.userAnswers[i];
    if (ansIdx !== null && ansIdx !== undefined && q.options[ansIdx] && q.options[ansIdx].correct) {
      stats[q.sub].correct++;
    }
  });
  return stats;
}
