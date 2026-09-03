-- =========================================================================
-- 2026-09-03_expurgo_referencias_origem.sql
-- Compasso — projeto Supabase fytynjjvzecljmgbtwec.
--
-- FASE 2 do expurgo de referências ao cliente / sistema de origem no BANCO.
-- Código e documentação já foram limpos no repositório.
--
-- Abordagem (spec §2.2): NÃO apagar linhas de log/auditoria — substituir o
-- texto nos campos livres, preservando a rastreabilidade do restante.
--
-- Os PADRÕES de busca e as SUBSTITUIÇÕES não ficam escritos aqui de
-- propósito (para o script não reintroduzir os termos no repositório).
-- Pegue os valores de `p_padrao` e `p_trocas` no material entregue à parte
-- (com a equipe) e cole nos dois DO-blocks abaixo antes de rodar.
--
-- Rode em DUAS ETAPAS, no Supabase → SQL Editor:
--   ETAPA 1 (só leitura) — descobre onde há ocorrência.
--   ETAPA 2 (escrita)    — troca o texto nas colunas que a Etapa 1 apontou.
-- =========================================================================


-- =========================================================================
-- ETAPA 1 — DIAGNÓSTICO (não altera nada). Lista tabela.coluna + nº de
-- linhas que casam com o padrão, varrendo todas as colunas de texto de
-- public.*.
-- =========================================================================
DO $$
DECLARE
    r        RECORD;
    v_count  BIGINT;
    -- >>> COLE AQUI o padrão POSIX (ex.: '(term1|term2|\yterm3\y)') <<<
    v_regex  TEXT := '<<<PADRAO_ORIGEM>>>';
BEGIN
    IF v_regex = '<<<PADRAO_ORIGEM>>>' THEN
        RAISE EXCEPTION 'Cole o padrão de busca em v_regex antes de rodar.';
    END IF;
    RAISE NOTICE '=== Ocorrências por tabela.coluna ===';
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
-- tabela.coluna que a Etapa 1 listou, cole v_regex e a expressão de troca
-- v_troca (regexp_replace aninhado, do material entregue à parte), e rode.
-- Idempotente. Registra o resumo em log_expurgo_referencias_origem.
-- =========================================================================

CREATE TABLE IF NOT EXISTS log_expurgo_referencias_origem (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    executado_em    TIMESTAMPTZ NOT NULL DEFAULT now(),
    executado_por   TEXT,
    tabela          TEXT,
    coluna          TEXT,
    linhas_afetadas BIGINT
);
ALTER TABLE log_expurgo_referencias_origem DISABLE ROW LEVEL SECURITY;

DO $$
DECLARE
    -- >>> EDITE: pares 'tabela.coluna' da Etapa 1 <<<
    p_alvos  TEXT[] := ARRAY[
        -- 'adhoc_aprovacoes.observacao',
        -- 'projetos.observacao'
    ]::TEXT[];
    p_quem   TEXT := 'EXPURGO ORIGEM 2026-09-03';
    -- >>> COLE o mesmo padrão da Etapa 1 <<<
    v_regex  TEXT := '<<<PADRAO_ORIGEM>>>';
    par      TEXT;
    v_tab    TEXT;
    v_col    TEXT;
    v_rows   BIGINT;
BEGIN
    IF v_regex = '<<<PADRAO_ORIGEM>>>' THEN
        RAISE EXCEPTION 'Cole o padrão de busca em v_regex antes de rodar.';
    END IF;
    IF array_length(p_alvos, 1) IS NULL THEN
        RAISE NOTICE 'Nenhum alvo — preencha p_alvos com o resultado da Etapa 1.';
        RETURN;
    END IF;
    FOREACH par IN ARRAY p_alvos LOOP
        v_tab := split_part(par, '.', 1);
        v_col := split_part(par, '.', 2);
        -- A expressão de troca (regexp_replace aninhado) vem no material à
        -- parte; cole-a no lugar de <<<TROCA(%1$I)>>>, usando %1$I como o
        -- nome da coluna.
        EXECUTE format($f$
            UPDATE %1$I SET %2$I = <<<TROCA(%2$I)>>>
            WHERE %2$I ~* %3$L
        $f$, v_tab, v_col, v_regex);
        GET DIAGNOSTICS v_rows = ROW_COUNT;
        INSERT INTO log_expurgo_referencias_origem (executado_por, tabela, coluna, linhas_afetadas)
            VALUES (p_quem, v_tab, v_col, v_rows);
        RAISE NOTICE '  % . %  ->  % linha(s) trocada(s)', v_tab, v_col, v_rows;
    END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';

-- Conferência: re-rode a ETAPA 1; deve listar 0 tabelas.
-- =========================================================================
