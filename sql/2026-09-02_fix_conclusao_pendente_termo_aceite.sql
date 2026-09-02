-- =========================================================================
-- 2026-09-02_fix_conclusao_pendente_termo_aceite.sql
--
-- Correcao de dados (bug reportado): projetos que ja tiveram a baixa
-- final registrada (projeto_concluido = true) mas ficaram presos com
-- sub_status = 'PENDENTE TERMO DE ACEITE' e etapa_atual = 'GOLIVE'.
--
-- Causa: apos a mudanca do fluxo de Go-Live (o projeto a 100% nao avanca
-- mais sozinho para 'CONCLUIDO', fica 'PENDENTE TERMO DE ACEITE'), a tela
-- "Concluir Projeto/Subprojeto" gravava projeto_concluido = true mas nao
-- atualizava etapa_atual/sub_status. Ja corrigido no app
-- (js/conclusao/conclusao-projeto.js); este script conserta as linhas
-- que ja foram concluidas com o estado antigo.
--
-- Idempotente: rodar quantas vezes precisar.
-- Rode no Supabase SQL Editor.
-- =========================================================================

UPDATE projetos
SET etapa_atual = 'CONCLUIDO',
    sub_status  = 'CONCLUIDO'
WHERE projeto_concluido = true
  AND (
        UPPER(COALESCE(sub_status, '')) = 'PENDENTE TERMO DE ACEITE'
     OR UPPER(COALESCE(etapa_atual, '')) = 'GOLIVE'
  );

-- Conferencia (deve voltar 0 linhas):
-- SELECT codigo, etapa_atual, sub_status, projeto_concluido
-- FROM projetos
-- WHERE projeto_concluido = true
--   AND (UPPER(COALESCE(sub_status,'')) = 'PENDENTE TERMO DE ACEITE'
--        OR UPPER(COALESCE(etapa_atual,'')) = 'GOLIVE');
