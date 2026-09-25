-- =========================================================================
-- 2026-09-25_v3_passo5b_fix_insert_default_id.sql
-- Compasso 2.0 — V3, correção encontrada na verificação end-to-end (Passo 7).
--
-- BUG ENCONTRADO: ao formalizar uma Demanda nova pela tela real
-- ("Formalizar Demanda"), o INSERT na view `projetos` falhou com:
--   "Erro ao salvar no Supabase: null value in column "id" of relation
--    "business_cases" violates not-null constraint"
--
-- CAUSA: `business_cases`/`projects` foram criadas com
-- `LIKE projetos INCLUDING ALL`, então a coluna `id` tem
-- `DEFAULT nextval('projetos_id_seq'::regclass)` — igual a antes. O app
-- sempre confiou nesse DEFAULT (nunca manda `id` no INSERT). O problema é
-- que `_v3_upsert_dinamico` (Passo 5.3) monta o INSERT dinâmico incluindo
-- TODAS as chaves de `to_jsonb(NEW)` — inclusive `id`, que em NEW (a
-- linha que o Postgres monta pro INSTEAD OF INSERT da view) vem NULL,
-- já que uma VIEW não aplica o DEFAULT da tabela de baixo. Isso gera
-- `INSERT INTO business_cases (id, codigo, ...) VALUES (NULL, ...)` — um
-- NULL explícito, que quebra a constraint NOT NULL em vez de deixar o
-- DEFAULT da tabela valer.
--
-- FIX: no INSERT dinâmico, ignorar qualquer coluna cujo valor em
-- `p_dados` seja NULL — assim ela simplesmente não entra na lista de
-- colunas do INSERT, e o DEFAULT de cada tabela (id, e qualquer outro
-- campo com default que o app não preencha) volta a funcionar como
-- sempre funcionou na tabela `projetos` original. O UPDATE continua
-- sem essa exclusão (um UPDATE com valor NULL explícito é uma limpeza de
-- campo intencional, não deve ser descartado).
--
-- Roda DEPOIS de sql/2026-09-25_v3_passo5_view_triggers.sql. Só
-- substitui a função (CREATE OR REPLACE) — não mexe nas tabelas, view
-- ou triggers, que continuam as mesmas.
-- =========================================================================

CREATE OR REPLACE FUNCTION _v3_upsert_dinamico(p_tabela TEXT, p_dados JSONB, p_codigo TEXT) RETURNS VOID AS $$
DECLARE
    v_cols TEXT;
    v_vals TEXT;
    v_sets TEXT;
    v_existe BOOLEAN;
BEGIN
    SELECT string_agg(quote_ident(kv.key), ', ' ORDER BY kv.key),
           string_agg(quote_nullable(kv.value), ', ' ORDER BY kv.key)
    INTO v_cols, v_vals
    FROM jsonb_each_text(p_dados) kv
    WHERE kv.key IN (SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name = p_tabela)
      AND kv.value IS NOT NULL; -- FIX: omite do INSERT colunas não preenchidas, deixando o DEFAULT da tabela valer (ex.: id serial)

    IF v_cols IS NULL THEN RETURN; END IF; -- nada em comum (ou só nulos), nada a fazer

    EXECUTE format('SELECT EXISTS (SELECT 1 FROM %I WHERE codigo = %L)', p_tabela, p_codigo) INTO v_existe;

    IF v_existe THEN
        SELECT string_agg(format('%I = %L', kv.key, kv.value), ', ' ORDER BY kv.key)
        INTO v_sets
        FROM jsonb_each_text(p_dados) kv
        WHERE kv.key IN (SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name = p_tabela)
          AND kv.key <> 'codigo';
        IF v_sets IS NOT NULL THEN
            EXECUTE format('UPDATE %I SET %s WHERE codigo = %L', p_tabela, v_sets, p_codigo);
        END IF;
    ELSE
        EXECUTE format('INSERT INTO %I (%s) VALUES (%s)', p_tabela, v_cols, v_vals);
    END IF;
END;
$$ LANGUAGE plpgsql;

NOTIFY pgrst, 'reload schema';
-- =========================================================================
