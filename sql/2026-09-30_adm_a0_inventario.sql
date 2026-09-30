-- =============================================================================
-- COMPASSO 2.0 — Fase 1A ADM · A0 Inventário
-- Data: 2026-09-30
-- Propósito: inventariar o que existe hoje contra as 30 VIEWs do SCR-23/24/25
--            e a Matriz de Migração. SOMENTE LEITURA.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- MAPEAMENTO LEGADO → VIEW DESTINO
-- ---------------------------------------------------------------------------
-- Tab legado (código)              Tabela real             VIEW destino
-- ─────────────────────────────────────────────────────────────────────────────
-- areas                         areas_solicitantes       VIEW-CAD-ORG
-- pessoas_solicitantes          pessoas_solicitantes     VIEW-CAD-PESSOAS
-- cargos                        cargos                   VIEW-CAD-CARGOS
-- portes                        portes                   VIEW-CAD-PORTES
-- tipos_projeto                 tipos_projeto            VIEW-CAD-CLASSIFICACOES
-- produtos                      produtos                 VIEW-CAD-CLASSIFICACOES
-- return_benefit                tipos_return_benefit     VIEW-CAD-CLASSIFICACOES
-- planejamento_estrategico      pilares_estrategicos +   VIEW-CAD-ESTRATEGIA
--                               iniciativas_estrategicas
-- empresas_terceirizadas        empresas_terceirizadas   VIEW-CAD-FORNECEDORES
-- ─────────────────────────────────────────────────────────────────────────────
-- usuarios                      perfis_usuarios          VIEW-ADM-USUARIOS
-- funcoes_permissoes            funcoes +                VIEW-ADM-PERFIS
--                               catalogo_atividades +
--                               funcao_atividades
-- atribuicao_funcoes            usuario_funcoes          VIEW-ADM-USUARIOS (seção)
-- restricao_area_atividades     usuario_funcoes          VIEW-ADM-PERFIS (scope)
-- responsaveis                  usuario_atividades_      VIEW-ADM-EQUIPES
--                               responsavel +
--                               responsaveis_atividades
-- workflow_etapas               (sem tabela própria)     VIEW-ADM-WORKFLOW
-- prazos                        (sem tabela própria)     VIEW-ADM-SLA
-- auditoria                     audit_events             VIEW-ADM-AUDITORIA
-- [NOVO]                        —                        VIEW-ADM-SESSOES
-- [NOVO]                        —                        VIEW-ADM-APTIDOES
-- [NOVO]                        —                        VIEW-ADM-ALCADAS
-- [NOVO]                        —                        VIEW-ADM-DELEGACOES
-- [NOVO]                        —                        VIEW-ADM-SOD
-- fila_email                    email_queue              VIEW-ADM-INTEGRACOES
-- ─────────────────────────────────────────────────────────────────────────────
-- configuracoes                 empresa_licenciada       VIEW-CFG-ORGANIZACAO
-- controle_orcamento +                                   VIEW-CFG-FINANCEIRO
--   percentual_bloqueio_orcamento
-- periodo_ano_fiscal                                     VIEW-CFG-FY
-- gestao_templates              templates_email          VIEW-CFG-TEMPLATES
-- gestao_fluxo_email                                     VIEW-CFG-EVENTOS
-- ia_templates + ia_config                               VIEW-CFG-IA
-- rate_card                     rate_card_papeis         VIEW-CFG-RATECARDS
-- [NOVO]                        —                        VIEW-CFG-ESTIMATIVAS
-- [NOVO]                        —                        VIEW-CFG-NOTIFICACOES
-- dados_empresa (Proprietário)  empresa_licenciada       VIEW-CAD-ORG (parte)
-- licenciamento_modulos         licenca_modulos +        VIEW-CFG-LICENCA
--                               modulo_funcao
-- ─────────────────────────────────────────────────────────────────────────────

-- ---------------------------------------------------------------------------
-- QUERIES DE CONTAGEM (Seção 2, RESPOSTA_AUDITORIA_FASE0 D5)
-- ---------------------------------------------------------------------------

-- Áreas (→ VIEW-CAD-ORG)
SELECT COUNT(*) AS total_areas, SUM(CASE WHEN ativo THEN 1 ELSE 0 END) AS ativas
FROM areas_solicitantes;

-- Pessoas (→ VIEW-CAD-PESSOAS)
SELECT COUNT(*) AS total_pessoas FROM pessoas_solicitantes;

-- Cargos (→ VIEW-CAD-CARGOS)
SELECT COUNT(*) AS total_cargos FROM cargos;

-- Portes (→ VIEW-CAD-PORTES)
SELECT COUNT(*) AS total_portes FROM portes;

-- Tipos de projeto (→ VIEW-CAD-CLASSIFICACOES)
SELECT COUNT(*) AS total_tipos_projeto FROM tipos_projeto;

-- Produtos (→ VIEW-CAD-CLASSIFICACOES)
SELECT COUNT(*) AS total_produtos FROM produtos;

-- Retorno/Benefícios (→ VIEW-CAD-CLASSIFICACOES)
SELECT COUNT(*) AS total_beneficios FROM tipos_return_benefit;

-- Pilares e iniciativas (→ VIEW-CAD-ESTRATEGIA)
SELECT
    (SELECT COUNT(*) FROM pilares_estrategicos) AS total_pilares,
    (SELECT COUNT(*) FROM iniciativas_estrategicas) AS total_iniciativas;

-- Fornecedores (→ VIEW-CAD-FORNECEDORES)
SELECT COUNT(*) AS total_fornecedores FROM empresas_terceirizadas;

-- Usuários (→ VIEW-ADM-USUARIOS)
SELECT COUNT(*) AS total_usuarios FROM perfis_usuarios;

-- Usuários por função (→ VIEW-ADM-PERFIS)
SELECT f.nome AS funcao, COUNT(uf.usuario_id) AS qtd_usuarios
FROM funcoes f
LEFT JOIN usuario_funcoes uf ON uf.funcao_id = f.id
GROUP BY f.nome ORDER BY f.nome;

-- Funções cadastradas (→ VIEW-ADM-PERFIS)
SELECT
    COUNT(*) AS total_funcoes,
    SUM(CASE WHEN acesso_irrestrito THEN 1 ELSE 0 END) AS funcoes_admin,
    SUM(CASE WHEN eh_proprietario THEN 1 ELSE 0 END) AS funcoes_proprietario
FROM funcoes;

-- Atividades no catálogo (→ VIEW-ADM-PERFIS permissions)
SELECT COUNT(*) AS total_atividades FROM catalogo_atividades;

-- Responsáveis por atividade (→ VIEW-ADM-EQUIPES)
SELECT COUNT(*) AS total_responsaveis FROM responsaveis_atividades;

-- Auditoria (→ VIEW-ADM-AUDITORIA)
SELECT COUNT(*) AS total_eventos FROM audit_events;

-- Rate card (→ VIEW-CFG-RATECARDS)
SELECT COUNT(*) AS total_papeis, SUM(CASE WHEN ativo THEN 1 ELSE 0 END) AS ativos
FROM rate_card_papeis;

-- Fila de e-mail (→ VIEW-ADM-INTEGRACOES)
SELECT status, COUNT(*) AS qtd FROM email_queue GROUP BY status ORDER BY status;

-- modulo_funcao por módulo (D5)
SELECT modulo, COUNT(*) AS qtd_funcoes
FROM modulo_funcao
GROUP BY modulo ORDER BY modulo;

-- Licença / módulos (→ VIEW-CFG-LICENCA)
SELECT COUNT(*) AS total_modulos FROM licenca_modulos;

-- FYs por status (D5)
SELECT
    ano_fiscal,
    ano_fiscal_fechado,
    status,
    bc_package_status
FROM fiscal_years
ORDER BY ano_fiscal;

-- BCs por sub_status e adhoc (D5)
SELECT
    sub_status,
    COALESCE(adhoc, false) AS adhoc,
    COUNT(*) AS qtd
FROM business_cases
GROUP BY sub_status, adhoc
ORDER BY sub_status;
