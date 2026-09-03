-- =========================================================================
-- 2026-09-03_expurgo_referencias_origem.sql
-- Compasso — projeto Supabase fytynjjvzecljmgbtwec.
--
-- FASE 2 do expurgo de referências ao cliente/sistema de origem
-- (cliente de origem / Compasso / Compasso). O código e a documentação já foram limpos no
-- repositório; este script trata o BANCO.
--
-- Abordagem (spec §2.2): NÃO apagar linhas de log/auditoria — substituir o
-- texto nos campos livres, preservando a rastreabilidade do restante.
--
-- Rode em DUAS ETAPAS, no Supabase → SQL Editor:
--   ETAPA 1 (só leitura) — descobre onde há ocorrência.
--   ETAPA 2 (escrita)    — troca o texto nas colunas que a Etapa 1 apontou.
-- =========================================================================


-- =========================================================================
-- ETAPA 1 — DIAGNÓSTICO (não altera nada). Lista tabela.coluna + nº de
-- linhas que contêm 'cliente de origem', 'Compasso' ou 'compasso' (case-insensitive, palavra
-- inteira para 'compasso'/'btb' para não pegar substring aleatória).
-- =========================================================================
DO $$
DECLARE
    r        RECORD;
    v_count  BIGINT;
    v_regex  TEXT := '(cliente de origem|Compasso|one[ _-]?btb|\yotb\y|\ybtb\y)';
BEGIN
    RAISE NOTICE '=== Ocorrências de referências de origem por tabela.coluna ===';
    FOR r IN
        SELECT c.table_schema, c.table_name, c.column_name
        FROM information_schema.columns c
        JOIN information_schema.tables t
          ON t.table_schema = c.table_schema AND t.table_name = c.table_name
        WHERE c.table_schema = 'public'
          AND t.table_type = 'BASE TABLE'
          AND c.data_type IN ('text','character varying','character')
        ORDER BY c.table_name, c.column_name
    LOOP
        EXECUTE format(
            'SELECT count(*) FROM %I.%I WHERE %I ~* %L',
            r.table_schema, r.table_name, r.column_name, v_regex
        ) INTO v_count;
        IF v_count > 0 THEN
            RAISE NOTICE '  % . %  ->  % linha(s)', r.table_name, r.column_name, v_count;
        END IF;
    END LOOP;
    RAISE NOTICE '=== fim ===';
END $$;


-- =========================================================================
-- ETAPA 2 — SUBSTITUIÇÃO (escrita). Preencha p_alvos com os pares
-- tabela.coluna que a Etapa 1 listou e rode. Idempotente (rodar de novo
-- não muda mais nada). Registra o resumo da operação em
-- log_expurgo_referencias_origem.
--
-- Regras de troca:
--   'Compasso'  -> 'Compasso'      (case-insensitive)
--   'Compasso'     -> 'Compasso'      (palavra inteira)
--   'cliente de origem' / 'cliente de origem' -> 'cliente de origem'
-- =========================================================================

CREATE TABLE IF NOT EXISTS log_expurgo_referencias_origem (
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    executado_em  TIMESTAMPTZ NOT NULL DEFAULT now(),
    executado_por TEXT,
    tabela        TEXT,
    coluna        TEXT,
    linhas_afetadas BIGINT
);
ALTER TABLE log_expurgo_referencias_origem DISABLE ROW LEVEL SECURITY;

DO $$
DECLARE
    -- >>> EDITE AQUI com o resultado da Etapa 1 (formato 'tabela.coluna') <<<
    p_alvos   TEXT[] := ARRAY[
        -- 'adhoc_aprovacoes.observacao',
        -- 'log_decisoes_etapa.motivo',
        -- 'projetos.observacao'
    ];
    p_quem    TEXT := 'EXPURGO ORIGEM 2026-09-03';
    par       TEXT;
    v_tab     TEXT;
    v_col     TEXT;
    v_regex   TEXT := '(cliente de origem|Compasso|one[ _-]?btb|\yotb\y|\ybtb\y)';
    v_rows    BIGINT;
BEGIN
    IF array_length(p_alvos, 1) IS NULL THEN
        RAISE NOTICE 'Nenhum alvo informado — preencha p_alvos com o resultado da Etapa 1.';
        RETURN;
    END IF;
    FOREACH par IN ARRAY p_alvos LOOP
        v_tab := split_part(par, '.', 1);
        v_col := split_part(par, '.', 2);
        EXECUTE format($f$
            UPDATE %I SET %I =
                regexp_replace(
                  regexp_replace(
                    regexp_replace(%I, '(banco[ ]+)?cliente de origem([ ]+do[ ]+brasil)?', 'cliente de origem', 'gi'),
                  '(Compasso|one[ _-]?btb)', 'Compasso', 'gi'),
                '\yotb\y', 'Compasso', 'gi')
            WHERE %I ~* %L
        $f$, v_tab, v_col, v_col, v_col, v_regex);
        GET DIAGNOSTICS v_rows = ROW_COUNT;
        INSERT INTO log_expurgo_referencias_origem (executado_por, tabela, coluna, linhas_afetadas)
            VALUES (p_quem, v_tab, v_col, v_rows);
        RAISE NOTICE '  % . %  ->  % linha(s) trocada(s)', v_tab, v_col, v_rows;
    END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';

-- Conferência: re-rode a ETAPA 1; deve listar 0 tabelas.
-- =========================================================================
