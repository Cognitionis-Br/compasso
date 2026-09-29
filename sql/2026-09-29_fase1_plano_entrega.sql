-- ==========================================================================
-- Fase 1 — D-12: tabelas plano_entrega / plano_entrega_bloco /
--           registro_planejamento  (schema-only; dados entram pela UI)
-- ==========================================================================

-- Plano de Entrega (cabeçalho por projeto + etapa)
CREATE TABLE IF NOT EXISTS plano_entrega (
    id                         SERIAL PRIMARY KEY,
    projeto_codigo             TEXT NOT NULL,
    etapa                      TEXT NOT NULL,
    titulo                     TEXT,
    data_inicio_planejada      DATE,
    data_fim_planejada         DATE,
    data_inicio_real           DATE,
    data_fim_real              DATE,
    situacao                   TEXT NOT NULL DEFAULT 'RASCUNHO',
    criado_por                 TEXT,
    criado_em                  TIMESTAMPTZ DEFAULT now(),
    atualizado_em              TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS plano_entrega_projeto_idx ON plano_entrega (projeto_codigo);
CREATE INDEX IF NOT EXISTS plano_entrega_etapa_idx   ON plano_entrega (projeto_codigo, etapa);

-- Blocos/entregas dentro de um Plano de Entrega
CREATE TABLE IF NOT EXISTS plano_entrega_bloco (
    id                  SERIAL PRIMARY KEY,
    plano_entrega_id    INT NOT NULL REFERENCES plano_entrega(id) ON DELETE CASCADE,
    ordem               INT NOT NULL DEFAULT 0,
    titulo              TEXT NOT NULL,
    descricao           TEXT,
    responsavel         TEXT,
    data_prevista       DATE,
    data_real           DATE,
    situacao            TEXT NOT NULL DEFAULT 'PENDENTE',
    criado_em           TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS plano_entrega_bloco_plano_idx ON plano_entrega_bloco (plano_entrega_id);

-- Registro de Planejamento (histórico de decisões/versões do plano)
CREATE TABLE IF NOT EXISTS registro_planejamento (
    id               SERIAL PRIMARY KEY,
    projeto_codigo   TEXT NOT NULL,
    etapa            TEXT,
    tipo             TEXT NOT NULL DEFAULT 'DECISAO',
    descricao        TEXT NOT NULL,
    registrado_por   TEXT,
    registrado_em    TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS registro_planejamento_projeto_idx ON registro_planejamento (projeto_codigo);
