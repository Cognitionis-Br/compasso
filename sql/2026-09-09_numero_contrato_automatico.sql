-- =========================================================================
-- 2026-09-09_numero_contrato_automatico.sql   (Release 1 — módulo FINANCEIRO)
-- Compasso — projeto Supabase fytynjjvzecljmgbtwec.
--
-- O número do contrato em "Contratos Terceirizados" passa a ser GERADO
-- automaticamente no formato:
--
--     <codigo_empresa><YYYY><MM><NNNN>
--
--   YYYY = ano do Ano Fiscal (ex.: AF2027 -> 2027)
--   MM   = mês de registro do contrato (2 dígitos)
--   NNNN = sequencial de contratos DENTRO do Ano Fiscal (4 dígitos),
--          reiniciado a cada Ano Fiscal (contador por AF).
--
-- Mesmo padrão da numeração de projeto (contadores_codigo_projeto +
-- proximo_numero_projeto).
--
-- Este script:
--   1. cria contadores_contrato_af + a RPC atômica proximo_numero_contrato;
--   2. acrescenta ano_fiscal / mes_registro / numero_sequencial em
--      contratos_projeto;
--   3. faz o BACKFILL dos contratos já existentes: deriva o AF pela
--      data_inicio, renumera por AF (ordem data_inicio, id) e reescreve
--      numero_contrato no formato novo; ajusta o contador de cada AF.
--
-- RLS off (padrão do projeto). Idempotente. Supabase -> SQL Editor.
-- =========================================================================

-- -------------------------------------------------------------------------
-- 1. Contador por Ano Fiscal + RPC atômica
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS contadores_contrato_af (
    ano_fiscal    TEXT PRIMARY KEY,
    ultimo_numero INTEGER NOT NULL DEFAULT 0
);
ALTER TABLE contadores_contrato_af DISABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.proximo_numero_contrato(p_ano_fiscal TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $fn$
DECLARE
    v_num INTEGER;
BEGIN
    INSERT INTO contadores_contrato_af (ano_fiscal, ultimo_numero)
    VALUES (p_ano_fiscal, 1)
    ON CONFLICT (ano_fiscal) DO UPDATE
        SET ultimo_numero = contadores_contrato_af.ultimo_numero + 1
    RETURNING ultimo_numero INTO v_num;
    RETURN v_num;
END;
$fn$;
GRANT EXECUTE ON FUNCTION public.proximo_numero_contrato(TEXT) TO anon, authenticated, service_role;

-- -------------------------------------------------------------------------
-- 2. Colunas novas em contratos_projeto
-- -------------------------------------------------------------------------
ALTER TABLE contratos_projeto ADD COLUMN IF NOT EXISTS ano_fiscal        TEXT;
ALTER TABLE contratos_projeto ADD COLUMN IF NOT EXISTS mes_registro      TEXT;   -- 'MM'
ALTER TABLE contratos_projeto ADD COLUMN IF NOT EXISTS numero_sequencial INTEGER;

-- helper: Ano Fiscal (string 'AFxxxx') que contém a data d, respeitando
-- config_periodo_ano_fiscal (mês de início; default 4 = abril).
CREATE OR REPLACE FUNCTION public.fn_ano_fiscal_de(d DATE)
RETURNS TEXT
LANGUAGE plpgsql
AS $fn$
DECLARE
    v_mes_inicio SMALLINT := 4;
    v_mes        SMALLINT;
    v_ano        INT;
    v_start_year INT;
    v_af_ano     INT;
BEGIN
    IF d IS NULL THEN RETURN NULL; END IF;
    BEGIN
        SELECT mes_inicio INTO v_mes_inicio
        FROM config_periodo_ano_fiscal
        WHERE vigencia_de <= d
        ORDER BY vigencia_de DESC
        LIMIT 1;
    EXCEPTION WHEN undefined_table THEN v_mes_inicio := 4;
    END;
    IF v_mes_inicio IS NULL THEN v_mes_inicio := 4; END IF;

    v_mes := EXTRACT(MONTH FROM d);
    v_ano := EXTRACT(YEAR  FROM d);
    v_start_year := CASE WHEN v_mes >= v_mes_inicio THEN v_ano ELSE v_ano - 1 END;
    v_af_ano := CASE WHEN v_mes_inicio = 1 THEN v_start_year ELSE v_start_year + 1 END;
    RETURN 'AF' || v_af_ano::TEXT;
END;
$fn$;

-- -------------------------------------------------------------------------
-- 3. BACKFILL dos contratos existentes
-- -------------------------------------------------------------------------
WITH renum AS (
    SELECT
        cp.id,
        fn_ano_fiscal_de(cp.data_inicio)                                    AS af,
        to_char(cp.data_inicio, 'MM')                                       AS mm,
        row_number() OVER (
            PARTITION BY fn_ano_fiscal_de(cp.data_inicio)
            ORDER BY cp.data_inicio, cp.id
        )                                                                   AS seq
    FROM contratos_projeto cp
)
UPDATE contratos_projeto cp
   SET ano_fiscal        = r.af,
       mes_registro       = r.mm,
       numero_sequencial  = r.seq,
       numero_contrato    = upper(cp.empresa_codigo)
                            || regexp_replace(r.af, '\D', '', 'g')
                            || r.mm
                            || lpad(r.seq::text, 4, '0')
  FROM renum r
 WHERE cp.id = r.id;

-- contador de cada AF = maior sequencial já usado
INSERT INTO contadores_contrato_af (ano_fiscal, ultimo_numero)
SELECT ano_fiscal, COALESCE(MAX(numero_sequencial), 0)
FROM contratos_projeto
WHERE ano_fiscal IS NOT NULL
GROUP BY ano_fiscal
ON CONFLICT (ano_fiscal) DO UPDATE
    SET ultimo_numero = GREATEST(contadores_contrato_af.ultimo_numero, EXCLUDED.ultimo_numero);

-- garante linha 0 para os AFs já configurados (para a prévia funcionar
-- antes do 1º contrato do ano)
INSERT INTO contadores_contrato_af (ano_fiscal, ultimo_numero)
SELECT ano_fiscal, 0 FROM anos_fiscais_config
ON CONFLICT (ano_fiscal) DO NOTHING;

NOTIFY pgrst, 'reload schema';

-- Conferência:
--   SELECT id, empresa_codigo, ano_fiscal, mes_registro, numero_sequencial, numero_contrato
--   FROM contratos_projeto ORDER BY ano_fiscal, numero_sequencial;
--   SELECT * FROM contadores_contrato_af ORDER BY ano_fiscal;
-- =========================================================================
