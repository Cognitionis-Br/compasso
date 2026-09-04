-- =========================================================================
-- 2026-09-04_fix_portes_valor_not_null.sql
-- Compasso — projeto Supabase fytynjjvzecljmgbtwec.
--
-- BUG: "Cadastro de Porte" (js/config/portes.js) passou de faixa por
-- VALOR (valor_minimo/valor_maximo) para faixa por HORAS (horas_minimo/
-- horas_maximo) — a tela não grava mais valor_minimo/valor_maximo (ver
-- comentário no topo do arquivo). Mas essas duas colunas continuam
-- NOT NULL na tabela, então todo INSERT novo (ex.: cadastrar um Porte
-- depois de uma carga zero, que apaga a tabela) falha com:
--   null value in column "valor_minimo" of relation "portes" violates
--   not-null constraint
--
-- FIX: as colunas ficam (histórico dos portes antigos, por valor), só
-- deixam de ser obrigatórias.
--
-- Idempotente. Supabase → SQL Editor.
-- =========================================================================

ALTER TABLE portes ALTER COLUMN valor_minimo DROP NOT NULL;
ALTER TABLE portes ALTER COLUMN valor_maximo DROP NOT NULL;

NOTIFY pgrst, 'reload schema';

-- Conferência (attnotnull deve ser 'f' nas duas):
--   SELECT attname, attnotnull FROM pg_attribute
--   WHERE attrelid = 'portes'::regclass AND attname IN ('valor_minimo','valor_maximo');
-- =========================================================================
