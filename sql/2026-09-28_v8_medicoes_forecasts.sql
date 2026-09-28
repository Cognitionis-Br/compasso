-- =============================================================================
-- V8: Financeiro Avançado — Medições de Custo + Forecasts (EAC)
-- Executar no Supabase SQL Editor antes do deploy do código
-- =============================================================================

CREATE TABLE IF NOT EXISTS medicoes (
    id           SERIAL PRIMARY KEY,
    projeto_codigo TEXT NOT NULL,
    periodo      TEXT NOT NULL,              -- 'YYYY-MM' (ex.: '2026-09')
    valor        NUMERIC(14,2) NOT NULL CHECK (valor > 0),
    descricao    TEXT,
    criado_por   TEXT,
    criado_em    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_medicoes_projeto
    ON medicoes(projeto_codigo);

-- RLS: mesma política permissiva dos demais módulos
ALTER TABLE medicoes ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='medicoes' AND policyname='medicoes_select') THEN
    CREATE POLICY "medicoes_select" ON medicoes FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='medicoes' AND policyname='medicoes_insert') THEN
    CREATE POLICY "medicoes_insert" ON medicoes FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='medicoes' AND policyname='medicoes_update') THEN
    CREATE POLICY "medicoes_update" ON medicoes FOR UPDATE USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='medicoes' AND policyname='medicoes_delete') THEN
    CREATE POLICY "medicoes_delete" ON medicoes FOR DELETE USING (true);
  END IF;
END $$;

-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS forecasts (
    id           SERIAL PRIMARY KEY,
    projeto_codigo TEXT NOT NULL,
    valor_eac    NUMERIC(14,2) NOT NULL CHECK (valor_eac >= 0),
    premissa     TEXT,
    criado_por   TEXT,
    criado_em    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_forecasts_projeto
    ON forecasts(projeto_codigo);

ALTER TABLE forecasts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='forecasts' AND policyname='forecasts_select') THEN
    CREATE POLICY "forecasts_select" ON forecasts FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='forecasts' AND policyname='forecasts_insert') THEN
    CREATE POLICY "forecasts_insert" ON forecasts FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='forecasts' AND policyname='forecasts_delete') THEN
    CREATE POLICY "forecasts_delete" ON forecasts FOR DELETE USING (true);
  END IF;
END $$;
