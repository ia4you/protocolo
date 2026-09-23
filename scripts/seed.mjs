// Carga db/seed/questions.json en la BD. Es idempotente y conserva los ids:
// categorías por slug, preguntas por (categoría, posición) y opciones por
// (pregunta, posición) se actualizan solo si cambian. Todo en una transacción.
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
         WHERE (categories.name, categories.icon, categories.position)
           IS DISTINCT FROM (EXCLUDED.name, EXCLUDED.icon, EXCLUDED.position)
       RETURNING id`,
      [c.slug, c.name, c.icon, c.position]
    );
    // Sin cambios, el upsert no devuelve fila: se busca el id existente
    categoryIds[c.slug] =
      rows[0]?.id ??
      (await client.query("SELECT id FROM categories WHERE slug = $1", [c.slug])).rows[0].id;
  }

  const stats = { questionsInserted: 0, questionsUpdated: 0, optionsInserted: 0, optionsUpdated: 0, optionsDeleted: 0 };

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
      const { rowCount } = await client.query(
        `UPDATE questions SET text = $1, explanation = $2
         WHERE id = $3 AND (text, explanation) IS DISTINCT FROM ($1, $2)`,
        [q.text, q.explanation, questionId]
      );
      stats.questionsUpdated += rowCount;
    } else {
      const { rows } = await client.query(
        `INSERT INTO questions (category_id, text, explanation, position)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [categoryId, q.text, q.explanation, q.position]
      );
      questionId = rows[0].id;
      stats.questionsInserted++;
    }

    // Opciones que ya no están en la semilla
    const { rowCount: deleted } = await client.query(
      "DELETE FROM options WHERE question_id = $1 AND NOT (position = ANY($2::int[]))",
      [questionId, q.options.map((o) => o.position)]
    );
    stats.optionsDeleted += deleted;

    // Primero las incorrectas: si la correcta cambia de posición, se desmarca
    // la antigua antes de marcar la nueva (índice de una correcta por pregunta)
    const ordered = [...q.options].sort((a, b) => a.is_correct - b.is_correct);
    for (const o of ordered) {
      const { rowCount: updated } = await client.query(
        `UPDATE options SET text = $3, is_correct = $4
         WHERE question_id = $1 AND position = $2
           AND (text, is_correct) IS DISTINCT FROM ($3, $4)`,
        [questionId, o.position, o.text, o.is_correct]
      );
      stats.optionsUpdated += updated;
      const { rowCount: inserted } = await client.query(
        `INSERT INTO options (question_id, position, text, is_correct)
         SELECT $1, $2, $3, $4
         WHERE NOT EXISTS (SELECT 1 FROM options WHERE question_id = $1 AND position = $2)`,
        [questionId, o.position, o.text, o.is_correct]
      );
      stats.optionsInserted += inserted;
    }
  }

  await client.query("COMMIT");
  console.log(
    `Semilla aplicada: ${data.categories.length} categorías, ${data.questions.length} preguntas.`
  );
  console.log(
    `Preguntas: ${stats.questionsInserted} nuevas, ${stats.questionsUpdated} modificadas. ` +
      `Opciones: ${stats.optionsInserted} nuevas, ${stats.optionsUpdated} modificadas, ${stats.optionsDeleted} eliminadas.`
  );
} catch (err) {
  await client.query("ROLLBACK");
  console.error("Error, no se ha guardado nada:", err.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
