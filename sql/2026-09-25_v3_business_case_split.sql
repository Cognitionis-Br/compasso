-- =========================================================================
-- 2026-09-25_v3_business_case_split.sql
-- Compasso 2.0 — V3 (Business Case como objeto distinto de Project).
-- PASSO 2, 4 e 5 do plano (ver C:\Users\sergi\.claude\plans\
-- elegant-jumping-elephant.md). RODE sql/2026-09-25_v3_backup.sql
-- ANTES deste.
--
-- >>> RODÁVEL ATÉ O PASSO 3 (inclusive) HOJE — cria business_cases/
--     projects e popula as duas a partir de `projetos`. 100% aditivo:
--     não apaga, não altera e não bloqueia nada em `projetos`; pode
--     rodar em produção agora mesmo, sem esperar o Passo 0.
--
--     PASSO 4 e PASSO 5 (retarget de FK, renomear `projetos`, criar a
--     view + triggers) ainda NÃO estão escritos — aguardando o
--     resultado das duas consultas do Passo 0 (lista de FKs + lista de
--     colunas de `projetos`) pra preencher com segurança. Só ficam os
--     TODOs marcados abaixo, como lembrete do que falta. <<<
-- =========================================================================

-- -------------------------------------------------------------------------
-- PASSO 2 — cria business_cases e projects preservando TODAS as colunas
-- de `projetos` (LIKE ... INCLUDING ALL copia colunas/tipos/defaults/
-- índices automaticamente, sem precisar do CREATE TABLE original — que
-- não existe no repo).
-- -------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS business_cases (LIKE projetos INCLUDING ALL);
CREATE TABLE IF NOT EXISTS projects (LIKE projetos INCLUDING ALL);

-- `projects` ganha o vínculo de proveniência (NEG-04) — nullable pra
-- acomodar subprojetos, que nascem direto em Execution sem Business Case
-- próprio (js/subprojetos/subprojetos.js).
ALTER TABLE projects ADD COLUMN IF NOT EXISTS business_case_codigo TEXT REFERENCES business_cases(codigo);

-- -------------------------------------------------------------------------
-- TODO (depende da lista de colunas de `projetos` — Passo 0 expandido):
-- DROP COLUMN nas colunas que não fazem sentido em cada tabela.
--
-- Lista PROVISÓRIA, baseada só no inventário de código (39+21 arquivos
-- mapeados) — NÃO aplicar ainda sem conferir contra a lista real de
-- colunas, porque uma coluna que eu não conheço pode ficar sem ir pra
-- lugar nenhum. Quando a lista chegar, cada linha abaixo vira um
-- `ALTER TABLE ... DROP COLUMN ...` real, uma por uma, revisada.
--
-- Candidatas a sair de `business_cases` (só fazem sentido pós-nascimento
-- do Project): bloqueado_mudanca_orcamento, mudanca_orcamento_aprovado_por,
-- mudanca_orcamento_aprovado_em, mudanca_orcamento_motivo_aprovacao,
-- val_req, val_tech, horas_req, horas_tech, ultima_reprovacao_por,
-- ultima_reprovacao_em, ultima_reprovacao_etapa, qtd_reprovacoes,
-- is_subprojeto, projeto_pai_codigo.
--
-- Candidatas a sair de `projects` (só fazem sentido pré-nascimento, já
-- preservadas em business_cases via a FK de proveniência):
-- pessoa_solicitante, objetivo, key_results, tipo_qualificacao,
-- status_comite.
--
-- Em caso de dúvida sobre uma coluna específica: NÃO remover de nenhuma
-- das duas — sobra inofensiva é mais segura que falta que quebra um
-- INSERT/UPDATE existente.
-- -------------------------------------------------------------------------

-- -------------------------------------------------------------------------
-- PASSO 3 — popular as tabelas novas a partir do `projetos` atual.
-- business_cases recebe TODA linha (preserva a origem de todo Project já
-- nascido, mesmo os que avançaram de fase — NEG-04); projects recebe só
-- quem já saiu de BUSINESS CASE, com business_case_codigo = codigo (mesma
-- identidade, sem clonagem — NEG-05/NEG-06).
-- -------------------------------------------------------------------------

INSERT INTO business_cases SELECT * FROM projetos
WHERE NOT EXISTS (SELECT 1 FROM business_cases bc WHERE bc.codigo = projetos.codigo);

INSERT INTO projects
SELECT p.*, p.codigo AS business_case_codigo FROM projetos p
WHERE p.etapa_atual <> 'BUSINESS CASE'
  AND NOT EXISTS (SELECT 1 FROM projects pr WHERE pr.codigo = p.codigo);
-- Funciona hoje porque nenhuma DROP COLUMN foi aplicada ainda (as duas
-- tabelas ainda são cópia 1:1 de `projetos` + business_case_codigo no
-- fim). Se algum dia rodar o DROP COLUMN do bloco acima ANTES deste
-- INSERT, troque o `SELECT *` por uma lista explícita de colunas.

-- -------------------------------------------------------------------------
-- PASSO 4 — TODO: retargetar as FKs conhecidas (raid_items, gates, tasks,
-- ia_especificacoes, project_documents — todas projeto_codigo) de
-- projetos(codigo) pra projects(codigo), e as FKs que vierem do
-- levantamento do Passo 0.
-- -------------------------------------------------------------------------

-- -------------------------------------------------------------------------
-- PASSO 5 — TODO: renomear projetos -> projetos_pre_v3_backup, criar a
-- view projetos (LEFT JOIN business_cases + projects) e os 3 triggers
-- INSTEAD OF (INSERT/UPDATE/DELETE) descritos no plano.
-- -------------------------------------------------------------------------

NOTIFY pgrst, 'reload schema';
-- =========================================================================
