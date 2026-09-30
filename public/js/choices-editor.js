// The list of choices on a "make your own" ball: add, remove, and remember
// them between visits (in this browser only).

import { MAX_CHOICE_LENGTH, MAX_CHOICES, MIN_CHOICES } from "./validation.js";

const STORAGE_KEY = "not-so-magic-8-ball:choices";
const PLACEHOLDERS = ["Chili", "Ramen", "Salad", "Tacos", "Soup", "Leftovers"];

export function createChoicesEditor(fieldset) {
  const list = fieldset.querySelector(".choice-list");
  const addButton = fieldset.querySelector(".add-choice");
  fieldset.querySelector(".choices-hint").textContent =
    `${MIN_CHOICES}–${MAX_CHOICES} choices, up to ${MAX_CHOICE_LENGTH} characters each.`;

  const saved = load();
  const initial = saved.length >= MIN_CHOICES ? saved.slice(0, MAX_CHOICES) : Array(MIN_CHOICES).fill("");
  initial.forEach(addRow);
  sync();

  addButton.addEventListener("click", () => {
    const input = addRow("");
    sync();
    input.focus();
  });

  list.addEventListener("click", (event) => {
    const remove = event.target.closest(".choice-remove");
    if (remove) removeRow(remove.closest("li"));
  });

  list.addEventListener("input", save);

  function addRow(value) {
    const row = document.createElement("li");
    const input = document.createElement("input");
    input.type = "text";
    input.maxLength = MAX_CHOICE_LENGTH;
    input.value = value;
    input.enterKeyHint = "send";
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "choice-remove";
    remove.textContent = "×";
    row.append(input, remove);
    list.append(row);
    return input;
  }

  function removeRow(row) {
    const index = [...list.children].indexOf(row);
    row.remove();
    sync();
    save();
    const inputs = list.querySelectorAll("input");
    inputs[Math.min(index, inputs.length - 1)].focus();
  }

  // Keep labels, placeholders, and button states in step with the rows.
  function sync() {
    const rows = [...list.children];
    rows.forEach((row, i) => {
      const input = row.querySelector("input");
      const remove = row.querySelector("button");
      input.placeholder = PLACEHOLDERS[i];
      input.setAttribute("aria-label", `Choice ${i + 1}`);
      remove.setAttribute("aria-label", `Remove choice ${i + 1}`);
      remove.disabled = rows.length <= MIN_CHOICES;
    });
    addButton.disabled = rows.length >= MAX_CHOICES;
  }

  function values() {
    return [...list.querySelectorAll("input")].map((input) => input.value);
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(values()));
    } catch {
      // Storage can be unavailable (private mode, blocked); choices just won't persist.
    }
  }

  function load() {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
      return Array.isArray(stored) ? stored.filter((v) => typeof v === "string") : [];
    } catch {
      return [];
    }
  }

  return {
    values,
    focus() {
      const inputs = [...list.querySelectorAll("input")];
      (inputs.find((input) => !input.value.trim()) ?? inputs[0]).focus();
    },
  };
}
