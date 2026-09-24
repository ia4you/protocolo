-- Niveles de pregunta: cada nivel es un conjunto independiente de preguntas.
-- Las existentes quedan como 'amateur' (ADD COLUMN con DEFAULT rellena todas
-- las filas actuales con ese valor).

ALTER TABLE questions
  ADD COLUMN level TEXT NOT NULL DEFAULT 'amateur'
  CONSTRAINT questions_level_check CHECK (level IN ('amateur', 'medio', 'master'));

-- La posición pasa a ser única dentro de (nivel, categoría): una misma
-- categoría puede tener su propia secuencia 0, 1, 2… en cada nivel.
-- Al empezar por level, este índice también sirve para filtrar por nivel.
ALTER TABLE questions DROP CONSTRAINT questions_category_position_key;
ALTER TABLE questions
  ADD CONSTRAINT questions_level_category_position_key
  UNIQUE (level, category_id, position) DEFERRABLE INITIALLY IMMEDIATE;
