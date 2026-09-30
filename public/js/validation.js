// Input rules shared by the browser and the Worker, so the character
// counters, the server-side checks, and (later) the cache key all agree.

export const MAX_QUESTION_LENGTH = 80;
export const MIN_CHOICES = 2;
export const MAX_CHOICES = 6;
export const MAX_CHOICE_LENGTH = 24;

const INVISIBLE_CHARS = /[​-‏‪-‮⁠-⁤﻿]/g;

export function normalizeText(raw) {
  return String(raw ?? "")
    .normalize("NFKC")
    .replace(INVISIBLE_CHARS, "")
    .replace(/\p{Cc}/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function validateQuestion(raw) {
  const question = normalizeText(raw);
  if (!question) {
    return { ok: false, error: "Ask the ball something first." };
  }
  if (question.length > MAX_QUESTION_LENGTH) {
    return { ok: false, error: `Keep it to ${MAX_QUESTION_LENGTH} characters or fewer.` };
  }
  return { ok: true, question };
}

// Choices for a "make your own" ball. Blank entries are dropped, so the
// editor can send its empty rows as-is.
export function validateChoices(raw) {
  if (!Array.isArray(raw) || raw.length > MAX_CHOICES * 2) {
    return { ok: false, error: "Choices must be a short list." };
  }
  const choices = raw.map((c) => normalizeText(typeof c === "string" ? c : "")).filter(Boolean);
  if (choices.length < MIN_CHOICES) {
    return { ok: false, error: `Add at least ${MIN_CHOICES} choices for the die.` };
  }
  if (choices.length > MAX_CHOICES) {
    return { ok: false, error: `Keep it to ${MAX_CHOICES} choices or fewer.` };
  }
  if (choices.some((c) => c.length > MAX_CHOICE_LENGTH)) {
    return { ok: false, error: `Keep each choice to ${MAX_CHOICE_LENGTH} characters or fewer.` };
  }
  if (new Set(choices.map((c) => c.toLowerCase())).size !== choices.length) {
    return { ok: false, error: "Each choice needs to be different." };
  }
  return { ok: true, choices };
}
