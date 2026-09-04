-- =========================================================================
-- 2026-09-04_funcao_ignora_restricao_area.sql
-- Compasso — projeto Supabase fytynjjvzecljmgbtwec.
--
-- A pedido do usuário: "Restrição de Área por Atividade" (13.5), quando
-- ligada numa atividade, só deixa cada usuário ver os dados da própria
-- área — hoje só ADMINISTRADOR/PROPRIETÁRIO (acesso_irrestrito) e a área
-- TECNOLOGIA DA INFORMAÇÃO escapam disso (js/config/funcoes.js,
-- usuarioEhDaAreaTI/filtrarProjetosPorArea). Faltava uma exceção
-- concedível a QUALQUER outra função, sem dar acesso irrestrito ao
-- sistema inteiro.
--
-- Novo flag por FUNÇÃO (não por usuário — mesmo modelo de
-- acesso_irrestrito/eh_proprietario): uma função marcada aqui enxerga
-- todas as áreas em qualquer atividade com Restrição de Área ligada,
-- mesmo continuando limitada pelo catálogo de atividades normalmente
-- (não é acesso irrestrito).
--
-- Idempotente. Supabase → SQL Editor.
-- =========================================================================

ALTER TABLE funcoes ADD COLUMN IF NOT EXISTS ignora_restricao_area BOOLEAN NOT NULL DEFAULT false;

NOTIFY pgrst, 'reload schema';

-- Conferência:
--   SELECT nome, acesso_irrestrito, eh_proprietario, ignora_restricao_area FROM funcoes ORDER BY nome;
-- =========================================================================
