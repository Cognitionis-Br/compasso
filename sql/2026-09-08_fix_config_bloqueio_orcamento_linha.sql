-- =========================================================================
-- 2026-09-08_fix_config_bloqueio_orcamento_linha.sql
-- Compasso — projeto Supabase fytynjjvzecljmgbtwec.
--
-- BUG: "Percentual de Bloqueio de Orçamento" salvava mas não aparecia.
-- config_bloqueio_orcamento é tabela de 1 linha (id=1), e o app só fazia
-- UPDATE ... WHERE id = 1. Depois da carga zero (que apagava essa linha)
-- o UPDATE atingia 0 linhas, sem erro — "salvava" nada, e a tela lia
-- .maybeSingle() = null.
--
-- FIX (2 partes):
--   1. Garante a linha id=1 agora.
--   2. Derruba o NOT NULL das 4 colunas antigas (req/tech x horas/valor),
--      se ainda existirem e ainda forem NOT NULL — o app não escreve mais
--      nelas (só percentual_bloqueio_variacao), então um INSERT/upsert de
--      linha nova estouraria nelas, igual aconteceu em `portes`.
--
-- O app também passou a fazer UPSERT em id=1 (auto-cura), e a
-- carga_zero.sql deixou de apagar essa linha (reset in-place).
--
-- Idempotente. Supabase → SQL Editor.
-- =========================================================================

-- 1. garante a linha
INSERT INTO config_bloqueio_orcamento (id) VALUES (1)
ON CONFLICT (id) DO NOTHING;

-- 2. derruba NOT NULL das colunas legadas que porventura existam
DO $$
DECLARE
    col TEXT;
    legadas TEXT[] := ARRAY[
        'percentual_variacao_horas_requerimentos',
        'percentual_variacao_valor_requerimentos',
        'percentual_variacao_horas_technical',
        'percentual_variacao_valor_technical',
        'percentual_variacao_horas_req',
        'percentual_variacao_valor_req',
        'percentual_variacao_horas_tech',
        'percentual_variacao_valor_tech'
    ];
BEGIN
    FOREACH col IN ARRAY legadas LOOP
        IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'config_bloqueio_orcamento'
              AND column_name = col AND is_nullable = 'NO'
        ) THEN
            EXECUTE format('ALTER TABLE config_bloqueio_orcamento ALTER COLUMN %I DROP NOT NULL', col);
            RAISE NOTICE 'DROP NOT NULL: %', col;
        END IF;
    END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';

-- Conferência:
--   SELECT * FROM config_bloqueio_orcamento;   -- deve ter a linha id=1
-- =========================================================================
