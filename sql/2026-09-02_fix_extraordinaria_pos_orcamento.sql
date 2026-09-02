-- =========================================================================
-- 2026-09-02_fix_extraordinaria_pos_orcamento.sql
--
-- Bug reportado: PRJ-FY26-001-RHU entrou como Demanda Extraordinaria de
-- AF2026, teve "Orcamentar Demanda" concluida (100%) e ficou sem aparecer
-- na tela "Aprovar Demanda Extraordinaria".
--
-- Causa (ja corrigida no app, js/adhoc/tradeoff.js):
--   1) a tela mirava o AF calculado pela data (AF2027), nao o AF em
--      andamento (AF2026), onde as Extraordinarias sao registradas;
--   2) a lista de "aguardando trade-off" exigia sub_status = 'APROVADO',
--      mas a Extraordinaria nao passa mais pelo Comite (d1ebf06) e fica
--      em 'ORCAMENTO REALIZADO' depois de orcada.
--
-- Na maioria dos casos NAO e preciso mexer nos dados: o projeto ja esta
-- em BUSINESS CASE / 'ORCAMENTO REALIZADO' e volta a aparecer sozinho na
-- tela apos o deploy do app.
--
-- Este script so age se o projeto tiver sido, por engano, empurrado para
-- 'CONCLUIDO' sem nunca ter tido etapa de Go-Live. Idempotente.
-- Rode no Supabase SQL Editor.
-- =========================================================================

-- 1) Diagnostico (rode e confira antes do UPDATE):
-- SELECT p.codigo, p.is_adhoc, p.ano_fiscal, p.etapa_atual, p.sub_status,
--        p.projeto_concluido, p.status_comite
-- FROM projetos p
-- WHERE p.codigo = 'PRJ-FY26-001-RHU';
--
-- SELECT pe.etapa_id, fe.etapa, fe.fase, pe.percentual_evolucao, pe.situacao
-- FROM projeto_etapas pe
-- JOIN fases_etapas fe ON fe.id = pe.etapa_id
-- WHERE pe.projeto_codigo = 'PRJ-FY26-001-RHU'
-- ORDER BY fe.ordem;

-- 2) Reparo condicional: Extraordinaria com "REALIZAR ORCAMENTO" concluida
--    e SEM nenhuma etapa de Go-Live, mas presa em CONCLUIDO -> devolve
--    para BUSINESS CASE / ORCAMENTO REALIZADO para entrar no trade-off.
UPDATE projetos p
SET etapa_atual = 'BUSINESS CASE',
    sub_status  = 'ORÇAMENTO REALIZADO',
    projeto_concluido = false
WHERE p.is_adhoc = true
  AND (
        UPPER(COALESCE(p.etapa_atual, '')) = 'CONCLUIDO'
     OR UPPER(COALESCE(p.sub_status, '')) = 'CONCLUIDO'
     OR p.projeto_concluido = true
  )
  AND EXISTS (
        SELECT 1 FROM projeto_etapas pe
        JOIN fases_etapas fe ON fe.id = pe.etapa_id
        WHERE pe.projeto_codigo = p.codigo
          AND fe.etapa = 'REALIZAR ORÇAMENTO'
          AND pe.situacao = 'EXECUCAO_CONCLUIDO'
  )
  AND NOT EXISTS (
        SELECT 1 FROM projeto_etapas pe
        JOIN fases_etapas fe ON fe.id = pe.etapa_id
        WHERE pe.projeto_codigo = p.codigo
          AND fe.fase IN ('GOLIVE', 'GO LIVE')
  );

-- Nota: o sub_status alvo e 'ORÇAMENTO REALIZADO' (com cedilha), a mesma
-- string que o app grava e filtra.
