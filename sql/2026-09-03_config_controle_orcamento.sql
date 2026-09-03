-- =========================================================================
-- 2026-09-03_config_controle_orcamento.sql
-- Compasso — SÓ Compasso (projeto Supabase fytynjjvzecljmgbtwec).
--
-- Feature 1.1 — Modo de controle orçamentário (rege a elegibilidade de
-- projetos no trade-off da Demanda Extraordinária):
--   'AF'      -> todos os projetos do Ano Fiscal (comportamento atual, default)
--   'AREA'    -> só projetos da mesma área do projeto extraordinário
--   'PRODUTO' -> só projetos do mesmo produto do projeto extraordinário
--
-- NÃO altera o seletor "Agrupar orçamento por" do Dashboard/Financeiro —
-- esse continua sendo escolha de tela, independente deste parâmetro.
--
-- Append-only: cada alteração faz INSERT de nova linha; a vigente é a de
-- maior alterado_em. A linha de catalogo_atividades (atividade DELEGÁVEL —
-- um Administrador pode conceder 'controle_orcamento' a outro perfil em
-- Funções e Permissões) está em 2026-09-03_catalogo_admin_orcamento.sql.
--
-- Sem RLS. Idempotente. Rode no Supabase → SQL Editor.
-- =========================================================================

CREATE TABLE IF NOT EXISTS config_controle_orcamento (
    id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    modo           TEXT NOT NULL DEFAULT 'AF' CHECK (modo IN ('AF', 'AREA', 'PRODUTO')),
    vigencia_de    DATE NOT NULL DEFAULT CURRENT_DATE,
    alterado_por   TEXT,
    alterado_em    TIMESTAMPTZ NOT NULL DEFAULT now(),
    modo_anterior  TEXT
);

ALTER TABLE config_controle_orcamento DISABLE ROW LEVEL SECURITY;

-- Linha inicial = 'AF' (mantém o comportamento atual).
INSERT INTO config_controle_orcamento (modo, alterado_por)
    SELECT 'AF', 'SEED'
    WHERE NOT EXISTS (SELECT 1 FROM config_controle_orcamento);

NOTIFY pgrst, 'reload schema';

-- Conferência:
--   SELECT * FROM config_controle_orcamento ORDER BY alterado_em DESC;
-- =========================================================================
