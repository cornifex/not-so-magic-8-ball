// The list of choices on a "make your own" ball: add, remove, and remember
// them between visits (in this browser only).

import { useEffect, useImperativeHandle, useRef, useState } from "react";
import { MAX_CHOICE_LENGTH, MAX_CHOICES, MIN_CHOICES } from "../shared/validation.js";

const STORAGE_KEY = "not-so-magic-8-ball:choices";
const PLACEHOLDERS = ["Chili", "Ramen", "Salad", "Tacos", "Soup", "Leftovers"];

export function useSavedChoices() {
  const [choices, setChoices] = useState(loadChoices);
  useEffect(() => {
    saveChoices(choices);
  }, [choices]);
  return [choices, setChoices];
}

export function ChoicesEditor({ ref, choices, onChange }) {
  const inputs = useRef([]);
  const [focusIndex, setFocusIndex] = useState(null);

  // Focus moves to a new row, or to a neighbor of a removed one, after the
  // list re-renders.
  useEffect(() => {
    if (focusIndex === null) return;
    inputs.current[focusIndex]?.focus();
    setFocusIndex(null);
  }, [focusIndex]);

  useImperativeHandle(ref, () => ({
    focus() {
      const empty = choices.findIndex((choice) => !choice.trim());
      inputs.current[empty === -1 ? 0 : empty]?.focus();
    },
  }), [choices]);

  function update(index, value) {
    onChange(choices.map((choice, i) => (i === index ? value : choice)));
  }

  function add() {
    onChange([...choices, ""]);
    setFocusIndex(choices.length);
  }

  function remove(index) {
    onChange(choices.filter((_, i) => i !== index));
    setFocusIndex(Math.min(index, choices.length - 2));
  }

  return (
    <fieldset className="choices">
      <legend>Choices on the die</legend>
      <ol className="choice-list">
        {choices.map((choice, i) => (
          <li key={i}>
            <input
              ref={(input) => { inputs.current[i] = input; }}
              type="text"
              value={choice}
              onChange={(event) => update(i, event.target.value)}
              maxLength={MAX_CHOICE_LENGTH}
              placeholder={PLACEHOLDERS[i]}
              aria-label={`Choice ${i + 1}`}
              enterKeyHint="send"
            />
            <button
              type="button"
              className="choice-remove"
              onClick={() => remove(i)}
              disabled={choices.length <= MIN_CHOICES}
              aria-label={`Remove choice ${i + 1}`}
            >
              ×
            </button>
          </li>
        ))}
      </ol>
      <div className="choices-meta">
        <button type="button" className="add-choice" onClick={add} disabled={choices.length >= MAX_CHOICES}>
          + Add choice
        </button>
        <span>{MIN_CHOICES}–{MAX_CHOICES} choices, up to {MAX_CHOICE_LENGTH} characters each.</span>
      </div>
    </fieldset>
  );
}

function loadChoices() {
  let saved = [];
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (Array.isArray(stored)) saved = stored.filter((value) => typeof value === "string");
  } catch {
    // Storage can be unavailable (private mode, blocked); start fresh.
  }
  const choices = saved.slice(0, MAX_CHOICES);
  while (choices.length < MIN_CHOICES) choices.push("");
  return choices;
}

function saveChoices(choices) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(choices));
  } catch {
    // Choices just won't persist.
  }
}
