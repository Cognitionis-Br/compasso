-- ============================================================
-- 2026-10-09_fase2a_modulo_funcao.sql
-- Compasso — Fase 2A: registrar VIS-FY-01 e VIS-FY-02/04/05
-- na tabela modulo_funcao como funcionalidades NUCLEO.
--
-- Cria a tabela se ainda não existir (idempotente).
-- ============================================================

CREATE TABLE IF NOT EXISTS modulo_funcao (
    activity_key   TEXT PRIMARY KEY,
    modulo         TEXT NOT NULL CHECK (modulo IN ('NUCLEO','WORKFLOW','EMAIL','FINANCEIRO','PLANEJAMENTO_ESTRATEGICO')),
    tipo           TEXT NOT NULL DEFAULT 'LICENCIAVEL' CHECK (tipo IN ('NUCLEO','LICENCIAVEL')),
    observacao     TEXT,
    atualizado_por TEXT,
    atualizado_em  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE modulo_funcao DISABLE ROW LEVEL SECURITY;

INSERT INTO modulo_funcao (activity_key, modulo, tipo, observacao)
VALUES
    ('fy_lista',     'NUCLEO', 'NUCLEO', 'Exercícios Fiscais — lista e gestão (VIS-FY-01)'),
    ('fy_workspace', 'NUCLEO', 'NUCLEO', 'Exercício Fiscal — workspace (VIS-FY-02/04/05)')
ON CONFLICT (activity_key) DO UPDATE
    SET modulo     = EXCLUDED.modulo,
        tipo       = EXCLUDED.tipo,
        observacao = EXCLUDED.observacao;
