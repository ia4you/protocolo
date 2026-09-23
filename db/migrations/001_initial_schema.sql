-- Esquema inicial: categorías, preguntas y opciones de respuesta.

CREATE TABLE categories (
  id          SERIAL PRIMARY KEY,
  slug        TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  icon        TEXT NOT NULL,
  position    INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE questions (
  id           SERIAL PRIMARY KEY,
  category_id  INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  text         TEXT NOT NULL,
  explanation  TEXT NOT NULL,
  position     INTEGER NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- DEFERRABLE para poder reordenar (intercambiar posiciones) en una transacción
  CONSTRAINT questions_category_position_key
    UNIQUE (category_id, position) DEFERRABLE INITIALLY IMMEDIATE
);

CREATE TABLE options (
  id           SERIAL PRIMARY KEY,
  question_id  INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  text         TEXT NOT NULL,
  is_correct   BOOLEAN NOT NULL DEFAULT false,
  position     INTEGER NOT NULL,
  CONSTRAINT options_question_position_key
    UNIQUE (question_id, position) DEFERRABLE INITIALLY IMMEDIATE
);

-- Como máximo una opción correcta por pregunta
CREATE UNIQUE INDEX options_one_correct_per_question
  ON options (question_id) WHERE is_correct;

-- Mantiene updated_at al día en cada UPDATE
CREATE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER categories_set_updated_at
  BEFORE UPDATE ON categories
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER questions_set_updated_at
  BEFORE UPDATE ON questions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
