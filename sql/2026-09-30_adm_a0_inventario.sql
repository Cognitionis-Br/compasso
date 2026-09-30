-- =============================================================================
-- COMPASSO 2.0 — Fase 1A ADM · A0 Inventário
-- Data: 2026-09-30
-- Propósito: inventariar o que existe hoje contra as 30 VIEWs da especificação
--            ADM (SCR-23/24/25) e a Matriz de Migração. Este arquivo é
--            SOMENTE LEITURA — todas as queries são SELECT.
--            Rodar no SQL Editor do Supabase para obter as contagens reais.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- SEÇÃO 1 — MAPEAMENTO LEGADO → VIEW DESTINO
-- (Análise de código; contagens reais abaixo na Seção 2)
-- ---------------------------------------------------------------------------
--
-- LEGADO (tab/função)               DESTINO                  AÇÃO NECESSÁRIA
-- ─────────────────────────────────────────────────────────────────────────────
-- areas                          → VIEW-CAD-ORG           Renomear + expandir para
--                                                          hierarquia (org/empresa/unidade/área)
-- pessoas_solicitantes           → VIEW-CAD-PESSOAS       Renomear label; expandir tipos
-- cargos                         → VIEW-CAD-CARGOS        Label ok; nenhuma mudança estrutural
-- portes                         → VIEW-CAD-PORTES        Renomear para "Portes e Faixas"
-- tipos_projeto                  → VIEW-CAD-CLASSIFICACOES Consolidar com produtos + return_benefit
-- produtos                       → VIEW-CAD-CLASSIFICACOES Consolidar
-- return_benefit                 → VIEW-CAD-CLASSIFICACOES Consolidar (campo allows_value preservado)
-- planejamento_estrategico       → VIEW-CAD-ESTRATEGIA    Renomear para "Estratégia"
-- empresas_terceirizadas         → VIEW-CAD-FORNECEDORES  Renomear para "Fornecedores"
-- ─────────────────────────────────────────────────────────────────────────────
-- usuarios                       → VIEW-ADM-USUARIOS      Expandir (perfis com escopo, sessões)
-- funcoes_permissoes             → VIEW-ADM-PERFIS        Renomear; catálogo atual (funcoes +
--                                                          catalogo_atividades) converte para
--                                                          Profile/Role/Permission
-- atribuicao_funcoes             → VIEW-ADM-USUARIOS      Seção de atribuição de perfil com escopo
-- restricao_area_atividades      → VIEW-ADM-PERFIS        Converte para Scope/Context
-- responsaveis                   → VIEW-ADM-EQUIPES       Converte para Team/Assignment
-- workflow_etapas                → VIEW-ADM-WORKFLOW      Renomear; versionamento adicionado
-- prazos                         → VIEW-ADM-SLA           Renomear para "SLA e Prazos"
-- auditoria                      → VIEW-ADM-AUDITORIA     Já compatível; só expandir filtros
-- [NOVO] —                       → VIEW-ADM-SESSOES       Criar (identidades e sessões ativas)
-- [NOVO] —                       → VIEW-ADM-APTIDOES      Criar (skills e vínculos pessoa)
-- [NOVO] —                       → VIEW-ADM-ALCADAS       Criar (matriz de autoridade versionada)
-- [NOVO] —                       → VIEW-ADM-DELEGACOES    Criar (delegações temporárias)
-- [NOVO] —                       → VIEW-ADM-SOD           Criar (segregação de funções)
-- fila_email                     → VIEW-ADM-INTEGRACOES   Mover de Configurações para
--                                                          Administração (fila + monitoramento)
-- ─────────────────────────────────────────────────────────────────────────────
-- configuracoes (geral)          → VIEW-CFG-ORGANIZACAO   Renomear; separar dados-empresa
-- controle_orcamento +
--   percentual_bloqueio          → VIEW-CFG-FINANCEIRO    Consolidar em política financeira
-- periodo_ano_fiscal             → VIEW-CFG-FY            Renomear para "Configuração do AF"
-- gestao_templates               → VIEW-CFG-TEMPLATES     Renomear; versionamento adicionado
-- gestao_fluxo_email             → VIEW-CFG-EVENTOS       Renomear para "Eventos × Canais"
-- ia_templates + ia_config       → VIEW-CFG-IA            Consolidar em única VIEW
-- rate_card (js/rate-card/)      → VIEW-CFG-RATECARDS     Adicionar ao menu Configurações;
--                                                          tabela rate_card_papeis já existe
-- [NOVO] —                       → VIEW-CFG-ESTIMATIVAS   Criar (políticas de estimativa)
-- [NOVO] —                       → VIEW-CFG-NOTIFICACOES  Criar (configurações de notificação)
-- ─────────────────────────────────────────────────────────────────────────────
-- dados_empresa (Proprietário)   → VIEW-CAD-ORG (parte cadastral)
--                                  VIEW-CFG-LICENCA (parte contrato/licença)
-- licenciamento_modulos          → VIEW-CFG-LICENCA       Mover para Configurações
--   (Proprietário)                                         (restrito a ehProprietario via R-ADM-23)
-- ─────────────────────────────────────────────────────────────────────────────
-- Ferramentas Dev                 → Fora da navegação funcional (R-ADM-09, Matriz de Migração)
-- ─────────────────────────────────────────────────────────────────────────────

-- ---------------------------------------------------------------------------
-- SEÇÃO 2 — QUERIES DE CONTAGEM (rodar para "contagem real" conforme A0)
-- ---------------------------------------------------------------------------

-- 2.1 — Funções cadastradas (legacy → VIEW-ADM-PERFIS)
SELECT
    COUNT(*) AS total_funcoes,
    SUM(CASE WHEN acesso_irrestrito THEN 1 ELSE 0 END) AS funcoes_admin,
    SUM(CASE WHEN eh_proprietario THEN 1 ELSE 0 END)   AS funcoes_proprietario
FROM funcoes;

-- 2.2 — Atividades no catálogo (legacy → VIEW-ADM-PERFIS permissions)
SELECT COUNT(*) AS total_atividades FROM catalogo_atividades;

-- 2.3 — Usuários e atribuições
SELECT
    COUNT(*) AS total_usuarios
FROM perfis_usuarios;

SELECT
    COUNT(*) AS total_atribuicoes
FROM usuario_funcoes;

-- 2.4 — Áreas solicitantes (legacy → VIEW-CAD-ORG)
SELECT COUNT(*) AS total_areas FROM areas;

-- 2.5 — Pessoas solicitantes (legacy → VIEW-CAD-PESSOAS)
SELECT COUNT(*) AS total_pessoas FROM pessoas_solicitantes;

-- 2.6 — Cargos (legacy → VIEW-CAD-CARGOS)
SELECT COUNT(*) AS total_cargos FROM cargos;

-- 2.7 — Portes (legacy → VIEW-CAD-PORTES)
SELECT COUNT(*) AS total_portes FROM portes_projetos;

-- 2.8 — Tipos de projeto (legacy → VIEW-CAD-CLASSIFICACOES)
SELECT COUNT(*) AS total_tipos FROM tipos_projeto;

-- 2.9 — Produtos (legacy → VIEW-CAD-CLASSIFICACOES)
SELECT COUNT(*) AS total_produtos FROM produtos;

-- 2.10 — Retorno/Benefícios (legacy → VIEW-CAD-CLASSIFICACOES)
SELECT COUNT(*) AS total_beneficios FROM retorno_beneficios;

-- 2.11 — Pilares e iniciativas estratégicas (legacy → VIEW-CAD-ESTRATEGIA)
SELECT
    (SELECT COUNT(*) FROM planejamento_estrategico_pilares) AS total_pilares,
    (SELECT COUNT(*) FROM planejamento_estrategico_iniciativas) AS total_iniciativas;

-- 2.12 — Fornecedores (legacy → VIEW-CAD-FORNECEDORES)
SELECT COUNT(*) AS total_fornecedores FROM empresas_terceirizadas;

-- 2.13 — Rate card (legacy → VIEW-CFG-RATECARDS)
SELECT COUNT(*) AS total_papeis_rate_card FROM rate_card_papeis;

-- 2.14 — Responsáveis por atividade (legacy → VIEW-ADM-EQUIPES)
SELECT COUNT(*) AS total_responsaveis FROM responsaveis_atividade;

-- 2.15 — Auditoria (legacy → VIEW-ADM-AUDITORIA)
SELECT COUNT(*) AS total_eventos FROM log_auditoria;

-- 2.16 — Templates de e-mail (legacy → VIEW-CFG-TEMPLATES)
SELECT COUNT(*) AS total_templates FROM templates_email;

-- 2.17 — Fila de e-mail (legacy → VIEW-ADM-INTEGRACOES)
SELECT
    status,
    COUNT(*) AS qtd
FROM email_queue
GROUP BY status
ORDER BY status;

-- ---------------------------------------------------------------------------
-- SEÇÃO 3 — VERIFICAÇÃO GAPS vs 30 VIEWs
-- ---------------------------------------------------------------------------
--
-- VIEWs NOVAS (sem equivalente no legado — precisam de tabelas novas):
--   VIEW-ADM-SESSOES        → tabelas: identities, sessions
--   VIEW-ADM-APTIDOES       → tabelas: skills, person_skills
--   VIEW-ADM-ALCADAS        → tabelas: authority_matrix, authority_rules
--   VIEW-ADM-DELEGACOES     → tabelas: delegations
--   VIEW-ADM-SOD            → tabelas: sod_rules, sod_conflicts
--   VIEW-CFG-ESTIMATIVAS    → tabelas: estimation_policy, estimation_policy_version
--   VIEW-CFG-NOTIFICACOES   → tabelas: notification_settings
--
-- VIEWs com tabelas existentes mas RENAMING/ESTRUTURA:
--   VIEW-CAD-ORG            → tabela 'areas' precisa de: parent_id, node_type,
--                              company/unit rows (actualmente só AREA)
--   VIEW-CAD-PESSOAS        → tabela 'pessoas_solicitantes' precisa de: person_type,
--                              job_title_id, user_id (vínculo)
--   VIEW-ADM-PERFIS         → funcoes + catalogo_atividades → Profile/Role/Permission
--                              (migração complexa, Fase A3)
--   VIEW-CFG-LICENCA        → modulo_funcao continua como fonte de verdade (R-ADM-42);
--                              License/Capability é camada sobre ela
--
-- ---------------------------------------------------------------------------
-- RESULTADO ESPERADO DA A0:
--   QA-ADM-14: todos os 34 itens legados identificados acima têm destino.
--   Não há duplicidade de mecanismos após a migração.
--   7 VIEWs novas precisam de SQL de criação (Fase A1 SQL).
-- ---------------------------------------------------------------------------
