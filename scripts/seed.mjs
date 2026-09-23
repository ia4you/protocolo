// Carga db/seed/questions.json en la BD. Es idempotente: categorías por slug
// y preguntas por (categoría, posición) se actualizan si ya existen, y las
// opciones de cada pregunta sembrada se reemplazan. Todo en una transacción.
import { readFile } from "node:fs/promises";
import path from "node:path";
import pg from "pg";

const SEED_FILE = path.join(process.cwd(), "db", "seed", "questions.json");

function validate({ categories, questions }) {
  const errors = [];
  const slugs = new Set(categories.map((c) => c.slug));
  if (slugs.size !== categories.length) errors.push("Hay slugs de categoría repetidos");

  const questionKeys = new Set();
  for (const q of questions) {
    const where = `Pregunta ${q.category_slug}#${q.position}`;
    if (!slugs.has(q.category_slug)) errors.push(`${where}: categoría inexistente`);
    const key = `${q.category_slug}#${q.position}`;
    if (questionKeys.has(key)) errors.push(`${where}: posición repetida`);
    questionKeys.add(key);

    if (!q.text?.trim() || !q.explanation?.trim()) errors.push(`${where}: falta texto o explicación`);
    if (q.options.length < 2) errors.push(`${where}: necesita al menos 2 opciones`);
    const correct = q.options.filter((o) => o.is_correct).length;
    if (correct !== 1) errors.push(`${where}: tiene ${correct} opciones correctas (debe ser 1)`);
    const positions = new Set(q.options.map((o) => o.position));
    if (positions.size !== q.options.length) errors.push(`${where}: posiciones de opción repetidas`);
  }
  return errors;
}

if (!process.env.DATABASE_URL) {
  console.error("Falta DATABASE_URL");
  process.exit(1);
}

const data = JSON.parse(await readFile(SEED_FILE, "utf8"));
const errors = validate(data);
if (errors.length) {
  console.error("Datos de semilla no válidos:\n- " + errors.join("\n- "));
  process.exit(1);
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

try {
  await client.query("BEGIN");

  const categoryIds = {};
  for (const c of data.categories) {
    const { rows } = await client.query(
      `INSERT INTO categories (slug, name, icon, position) VALUES ($1, $2, $3, $4)
       ON CONFLICT (slug) DO UPDATE
         SET name = EXCLUDED.name, icon = EXCLUDED.icon, position = EXCLUDED.position
       RETURNING id`,
      [c.slug, c.name, c.icon, c.position]
    );
    categoryIds[c.slug] = rows[0].id;
  }

  // ON CONFLICT no admite restricciones DEFERRABLE, así que el upsert es manual
  for (const q of data.questions) {
    const categoryId = categoryIds[q.category_slug];
    const existing = await client.query(
      "SELECT id FROM questions WHERE category_id = $1 AND position = $2",
      [categoryId, q.position]
    );
    let questionId;
    if (existing.rows.length) {
      questionId = existing.rows[0].id;
      await client.query(
        "UPDATE questions SET text = $1, explanation = $2 WHERE id = $3",
        [q.text, q.explanation, questionId]
      );
      await client.query("DELETE FROM options WHERE question_id = $1", [questionId]);
    } else {
      const { rows } = await client.query(
        `INSERT INTO questions (category_id, text, explanation, position)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [categoryId, q.text, q.explanation, q.position]
      );
      questionId = rows[0].id;
    }

    for (const o of q.options) {
      await client.query(
        "INSERT INTO options (question_id, text, is_correct, position) VALUES ($1, $2, $3, $4)",
        [questionId, o.text, o.is_correct, o.position]
      );
    }
  }

  await client.query("COMMIT");
  console.log(
    `Semilla aplicada: ${data.categories.length} categorías, ${data.questions.length} preguntas.`
  );
} catch (err) {
  await client.query("ROLLBACK");
  console.error("Error, no se ha guardado nada:", err.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
