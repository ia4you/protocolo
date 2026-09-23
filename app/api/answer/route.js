import { NextResponse } from "next/server";
import pool from "@/lib/db";

export const dynamic = "force-dynamic";

// Recibe { option_id } y devuelve si es correcta, cuál era la correcta
// y la explicación de la pregunta. Solo se revela una vez respondida.
export async function POST(request) {
  let optionId;
  try {
    optionId = (await request.json())?.option_id;
  } catch {
    return NextResponse.json({ error: "JSON no válido" }, { status: 400 });
  }
  if (!Number.isInteger(optionId) || optionId <= 0) {
    return NextResponse.json({ error: "option_id debe ser un entero positivo" }, { status: 400 });
  }

  try {
    const { rows } = await pool.query(
      `SELECT o.is_correct, q.explanation,
              (SELECT c.id FROM options c WHERE c.question_id = q.id AND c.is_correct) AS correct_option_id
       FROM options o JOIN questions q ON q.id = o.question_id
       WHERE o.id = $1`,
      [optionId]
    );
    if (!rows.length) {
      return NextResponse.json({ error: "Opción no encontrada" }, { status: 404 });
    }
    const { is_correct, explanation, correct_option_id } = rows[0];
    return NextResponse.json({ correct: is_correct, correct_option_id, explanation });
  } catch (err) {
    console.error("POST /api/answer:", err);
    return NextResponse.json({ error: "No se pudo comprobar la respuesta" }, { status: 500 });
  }
}
