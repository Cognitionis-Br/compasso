-- =========================================================================
-- 2026-09-01_ajuste_orcamento_autorizacoes.sql
-- Compasso — SÓ Compasso (projeto Supabase fytynjjvzecljmgbtwec).
--
-- Item 8 da tarefa — tela "Ajuste de Orçamento" (menu ANO FISCAL):
-- log das autorizações especiais para mover orçamento entre subgrupos
-- diferentes (área ou produto), nos processos de Carryover e Demanda
-- Extraordinária.
--
-- Sem RLS (mesmo tratamento das demais tabelas de log do sistema).
-- Idempotente. Rode no Supabase → SQL Editor.
-- =========================================================================

CREATE TABLE IF NOT EXISTS ajuste_orcamento_autorizacoes (
    id                     BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tipo_processo          TEXT NOT NULL,   -- 'CARRYOVER' | 'EXTRAORDINARIA'
    agrupamento            TEXT NOT NULL,   -- 'AREA' | 'PRODUTO'
    projeto_origem_codigo  TEXT NOT NULL,
    projeto_destino_codigo TEXT NOT NULL,
    subgrupo_origem        TEXT,            -- nome da área / código do produto de origem
    subgrupo_destino       TEXT,
    valor                  NUMERIC(15,2) NOT NULL,
    justificativa          TEXT NOT NULL,
    autorizado_por         TEXT NOT NULL,
    autorizado_em          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Sem RLS (mesmo tratamento das tabelas de log do sistema; o app grava
-- com a chave publishable). Novos projetos Supabase às vezes ligam RLS
-- por padrão — desliga explicitamente.
ALTER TABLE ajuste_orcamento_autorizacoes DISABLE ROW LEVEL SECURITY;

NOTIFY pgrst, 'reload schema';
-- =========================================================================
