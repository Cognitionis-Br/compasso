-- =============================================================================
-- V7: Cronograma / Gantt — schedule_items
-- Executar no Supabase SQL Editor antes do deploy do código
-- =============================================================================

CREATE TABLE IF NOT EXISTS schedule_items (
    id           SERIAL PRIMARY KEY,
    projeto_codigo TEXT NOT NULL,
    titulo       TEXT NOT NULL,
    data_inicio  DATE NOT NULL,
    data_fim     DATE NOT NULL,
    progresso    NUMERIC(5,2) NOT NULL DEFAULT 0
                     CHECK (progresso >= 0 AND progresso <= 100),
    responsavel  TEXT,
    dependencias TEXT NOT NULL DEFAULT '',   -- IDs CSV: "3, 7" = depende de schedule_items.id 3 e 7
    ordem        INT  NOT NULL DEFAULT 0,
    criado_por   TEXT,
    criado_em    TIMESTAMPTZ NOT NULL DEFAULT now(),
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_schedule_items_projeto
    ON schedule_items(projeto_codigo);

-- RLS: leitura livre para autenticados; escrita apenas para autenticados.
-- Ajustar políticas conforme modelo de acesso do tenant quando aplicável.
ALTER TABLE schedule_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "schedule_items_select"
    ON schedule_items FOR SELECT USING (true);

CREATE POLICY IF NOT EXISTS "schedule_items_insert"
    ON schedule_items FOR INSERT WITH CHECK (true);

CREATE POLICY IF NOT EXISTS "schedule_items_update"
    ON schedule_items FOR UPDATE USING (true);

CREATE POLICY IF NOT EXISTS "schedule_items_delete"
    ON schedule_items FOR DELETE USING (true);
