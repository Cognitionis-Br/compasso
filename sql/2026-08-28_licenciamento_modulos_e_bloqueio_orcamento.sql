-- =========================================================================
-- 2026-08-28_licenciamento_modulos_e_bloqueio_orcamento.sql
-- Compasso — SÓ Compasso (projeto Supabase fytynjjvzecljmgbtwec).
--
-- Parte 1: Licenciamento de Módulos — tabela de flags liga/desliga por
-- módulo comercial (WORKFLOW, EMAIL, FINANCEIRO, PLANEJAMENTO_ESTRATEGICO),
-- lida por js/core/licenca.js (moduloAtivo/carregarLicenca) pra
-- esconder/bloquear telas do sistema conforme o plano contratado.
--
-- Parte 2: Mudança de Orçamento — troca os 4 percentuais separados
-- (req/tech × horas/valor) de config_bloqueio_orcamento por 1 parâmetro
-- único (percentual_bloqueio_variacao), agora dependente do módulo
-- FINANCEIRO estar ativo. As colunas antigas NÃO são apagadas (histórico/
-- rollback), só deixam de ser lidas pelo app a partir deste checkpoint.
--
-- Idempotente — pode rodar mais de uma vez sem erro.
-- =========================================================================

CREATE TABLE IF NOT EXISTS licenca_modulos (
    modulo_codigo   TEXT PRIMARY KEY,
    nome_exibicao   TEXT NOT NULL,
    ativo           BOOLEAN NOT NULL DEFAULT true,
    atualizado_por  TEXT,
    atualizado_em   TIMESTAMPTZ
);

INSERT INTO licenca_modulos (modulo_codigo, nome_exibicao, ativo) VALUES
    ('WORKFLOW', 'Workflow de Projetos', true),
    ('EMAIL', 'Notificações por E-mail', true),
    ('FINANCEIRO', 'Financeiro & Contratos', true),
    ('PLANEJAMENTO_ESTRATEGICO', 'Planejamento Estratégico', true)
ON CONFLICT (modulo_codigo) DO NOTHING;

ALTER TABLE config_bloqueio_orcamento
    ADD COLUMN IF NOT EXISTS percentual_bloqueio_variacao NUMERIC;

-- Entrada no catálogo de atividades (mesmo padrão do resto do sistema —
-- ver catalogo_atividades) pra a tela "Licenciamento de Módulos" poder
-- ser concedida por função, igual a qualquer outra. Na prática só
-- ADMINISTRADOR (acesso_irrestrito=true) enxerga por padrão — a própria
-- view ainda faz uma checagem extra de ehAdministrador (mesma camada
-- dupla usada em Ferramentas de Dev), então mesmo que outra função
-- receba esta atividade, o conteúdo continua bloqueado até ser
-- explicitamente liberado nesse ponto do código.
INSERT INTO catalogo_atividades (grupo_funcao, funcao, atividade, activity_key, ordem) VALUES
    ('ADMINISTRAÇÃO', 'Licenciamento de Módulos', 'Licenciamento de Módulos', 'licenciamento_modulos', 76)
ON CONFLICT (activity_key) DO NOTHING;

NOTIFY pgrst, 'reload schema';
