-- =========================================================================
-- 2026-09-11_perfil_operador_restricao_atividade.sql
-- Compasso — projeto Supabase fytynjjvzecljmgbtwec.
--
-- Perfil OPERADOR: uma função com a chave nova só enxerga projetos onde o
-- usuário está registrado como responsável de alguma atividade/etapa
-- planejada (projeto_etapas.responsavel_etapa_email) — mesmo padrão de
-- funcoes.ignora_restricao_area, só que restritivo em vez de bypass.
-- Filtro aplicado em js/config/funcoes.js (filtrarProjetosPorArea).
--
-- Também cria o catálogo + auditoria da nova tela "Troca de Responsável
-- nas Atividades dos Projetos" (menu Governança).
--
-- RLS: funcoes/catalogo_atividades/modulo_funcao estão sob RLS — rode
-- DIRETO no SQL Editor do Supabase (service_role ignora RLS).
-- log_troca_responsavel_atividade fica sem RLS (padrão do projeto).
-- Idempotente.
-- =========================================================================

-- 1. Chave por função — restringe por atividade responsável
ALTER TABLE funcoes ADD COLUMN IF NOT EXISTS restringe_por_atividade_responsavel BOOLEAN NOT NULL DEFAULT false;

-- 2. Auditoria da troca (append-only)
CREATE TABLE IF NOT EXISTS log_troca_responsavel_atividade (
    id                          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    projeto_codigo              TEXT NOT NULL,
    etapa_id                    BIGINT NOT NULL,
    etapa_nome                  TEXT,
    responsavel_anterior_nome   TEXT,
    responsavel_anterior_email  TEXT,
    responsavel_novo_nome       TEXT NOT NULL,
    responsavel_novo_email      TEXT NOT NULL,
    motivo                      TEXT NOT NULL,
    trocado_por                 TEXT NOT NULL,
    trocado_em                  TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE log_troca_responsavel_atividade DISABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS ix_log_troca_resp_ativ_projeto ON log_troca_responsavel_atividade(projeto_codigo);

-- 3. Catálogo — grupo GOVERNANÇA, 1 atividade só (mesmo padrão de
--    mudanca_orcamento / retomar_hold: usuarioPodeAlterarTela(tabId) direto,
--    sem sufixo :consultar/:alterar). Delegável — sem grant inicial, Admin/
--    Proprietário entram por bypass.
INSERT INTO catalogo_atividades (grupo, subgrupo, atividade, activity_key, restricao_area, ordem)
SELECT 'GOVERNANÇA', 'Troca de Responsável de Atividade', 'Consultar e trocar responsável', 'troca_responsavel_atividade', false, 95
WHERE NOT EXISTS (SELECT 1 FROM catalogo_atividades WHERE activity_key = 'troca_responsavel_atividade');

-- 4. Licenciamento de módulo — mesma família de retomar_hold/mudanca_orcamento
INSERT INTO modulo_funcao (activity_key, modulo, tipo, observacao) VALUES
  ('troca_responsavel_atividade', 'WORKFLOW', 'LICENCIAVEL', 'Reatribui o responsável de uma atividade/etapa planejada de projeto (Governança) — suporte ao perfil OPERADOR')
ON CONFLICT (activity_key) DO UPDATE
  SET modulo = EXCLUDED.modulo, tipo = EXCLUDED.tipo, observacao = EXCLUDED.observacao, atualizado_em = now();

NOTIFY pgrst, 'reload schema';

-- Conferência:
--   SELECT nome, restringe_por_atividade_responsavel FROM funcoes;
--   SELECT activity_key FROM catalogo_atividades WHERE activity_key = 'troca_responsavel_atividade';
--   SELECT * FROM log_troca_responsavel_atividade ORDER BY trocado_em DESC LIMIT 10;
-- =========================================================================
