-- =========================================================================
-- 2026-09-23_catalogo_ia.sql
-- Compasso — SÓ Compasso (projeto Supabase fytynjjvzecljmgbtwec).
--
-- Catálogo de atividades + licenciamento do novo módulo comercial "IA"
-- (Módulo de Construção de Requerimentos com IA — ver
-- sql/2026-09-23_ia_construcao_requerimentos.sql pro schema).
--
--   construcao_ia_requerimentos:consultar  -> botão "Construir com IA"
--       dentro da própria tela de Requerimentos (Gerar Requerimentos, Em
--       Andamento) — não é uma aba própria, então não entra em
--       modulo_funcao (o gate de módulo aqui é feito via moduloAtivo('IA')
--       direto no JS, não via bloqueio de tab).
--   ia_templates    -> tela "Gestão de Templates de IA" (Administração).
--   ia_config       -> tela "Configuração de IA" (Administração).
--
-- As 3 atividades são DELEGÁVEIS (mesmo padrão de controle_orcamento):
-- Administrador/Proprietário entram por bypass, SEM grant inicial — um
-- Administrador concede a quem fizer sentido em Funções e Permissões.
--
-- Idempotente. catalogo_atividades/funcao_atividades/modulo_funcao estão
-- sob RLS — rode DIRETO no SQL Editor do Supabase (service_role ignora
-- RLS).
-- =========================================================================

-- ---- 1. catalogo_atividades ----
INSERT INTO catalogo_atividades (grupo, subgrupo, atividade, activity_key, restricao_area, ordem)
SELECT 'INTELIGÊNCIA ARTIFICIAL', 'Construção de Requerimentos com IA', 'Consultar e Gerar', 'construcao_ia_requerimentos:consultar', false, 80
WHERE NOT EXISTS (SELECT 1 FROM catalogo_atividades WHERE activity_key = 'construcao_ia_requerimentos:consultar');

INSERT INTO catalogo_atividades (grupo, subgrupo, atividade, activity_key, restricao_area, ordem)
SELECT 'INTELIGÊNCIA ARTIFICIAL', 'Gestão de Templates de IA', 'Gestão de Templates de IA', 'ia_templates', false, 81
WHERE NOT EXISTS (SELECT 1 FROM catalogo_atividades WHERE activity_key = 'ia_templates');

INSERT INTO catalogo_atividades (grupo, subgrupo, atividade, activity_key, restricao_area, ordem)
SELECT 'INTELIGÊNCIA ARTIFICIAL', 'Configuração de IA', 'Configuração de IA', 'ia_config', false, 82
WHERE NOT EXISTS (SELECT 1 FROM catalogo_atividades WHERE activity_key = 'ia_config');

-- ---- 2. módulo comercial "IA" (widen do CHECK + registro em modulo_funcao) ----
-- O CHECK de modulo_funcao.modulo foi criado em sql/2026-09-03_modulo_funcao.sql
-- só com os módulos que existiam até então — precisa incluir 'IA'. Nome do
-- constraint é o default do Postgres pra CHECK de coluna dentro de
-- CREATE TABLE (<tabela>_<coluna>_check).
ALTER TABLE modulo_funcao DROP CONSTRAINT IF EXISTS modulo_funcao_modulo_check;
ALTER TABLE modulo_funcao ADD CONSTRAINT modulo_funcao_modulo_check
    CHECK (modulo IN ('NUCLEO', 'WORKFLOW', 'EMAIL', 'FINANCEIRO', 'PLANEJAMENTO_ESTRATEGICO', 'IA'));

INSERT INTO modulo_funcao (activity_key, modulo, tipo, observacao) VALUES
    ('ia_templates', 'IA', 'LICENCIAVEL', 'Gestão de Templates de IA'),
    ('ia_config',    'IA', 'LICENCIAVEL', 'Configuração de IA (chave geral + modelo)')
ON CONFLICT (activity_key) DO UPDATE
    SET modulo = EXCLUDED.modulo,
        tipo   = EXCLUDED.tipo,
        observacao = EXCLUDED.observacao,
        atualizado_em = now();

-- ---- 3. licenca_modulos — módulo novo, default DESLIGADO ----
-- Diferente dos módulos existentes (que já nasceram ativos quando o
-- licenciamento foi introduzido, 28/08/2026): IA é uma feature nova que
-- consome uma API paga externa — cliente existente não deve "ganhar"
-- acesso de repente. Proprietário liga manualmente em Licenciamento de
-- Módulos quando quiser habilitar.
INSERT INTO licenca_modulos (modulo_codigo, nome_exibicao, ativo) VALUES
    ('IA', 'Inteligência Artificial', false)
ON CONFLICT (modulo_codigo) DO NOTHING;

NOTIFY pgrst, 'reload schema';

-- Conferência:
--   SELECT grupo, subgrupo, atividade, activity_key, ordem
--   FROM catalogo_atividades WHERE activity_key LIKE '%ia%'
--     AND activity_key IN ('construcao_ia_requerimentos:consultar','ia_templates','ia_config');
--   SELECT activity_key, modulo FROM modulo_funcao WHERE modulo = 'IA';
--   SELECT * FROM licenca_modulos WHERE modulo_codigo = 'IA';
-- =========================================================================
