-- Agrega columna income_source_id a expenses para atribuir gastos a una fuente de ingreso
ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS income_source_id uuid REFERENCES income_sources(id) ON DELETE SET NULL;
