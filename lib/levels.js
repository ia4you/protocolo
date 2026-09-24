// Niveles del quiz. Deben coincidir con el CHECK de questions.level
// (db/migrations/002_question_levels.sql) y con LEVELS en scripts/seed.mjs.
export const LEVELS = ["amateur", "medio", "master"];
export const LEVEL_LABELS = { amateur: "Amateur", medio: "Medio", master: "Master" };
export const DEFAULT_LEVEL = "amateur";
