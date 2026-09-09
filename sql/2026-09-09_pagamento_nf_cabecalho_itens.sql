-- =========================================================================
-- 2026-09-09_pagamento_nf_cabecalho_itens.sql   (Release 1 — FINANCEIRO)
-- Compasso — projeto Supabase fytynjjvzecljmgbtwec.
--
-- Um pagamento (uma Nota Fiscal) pode envolver MAIS DE UM projeto do
-- mesmo contrato. Modelo novo: CABEÇALHO (a NF) + ITENS (rateio por
-- projeto), com Σ itens = valor total da NF.
--
--   contratos_pagamentos            -> cabeçalho da NF
--   contratos_pagamento_itens       -> rateio (1 linha por vínculo/projeto)
--   contratos_pagamentos_anexos     -> anexos da NF (mesmo padrão das
--                                      pendências; bucket contratos-anexos)
--
-- Idem para a área de staging:
--   contratos_pendencias            -> cabeçalho (valor = total da NF)
--   contratos_pendencias_itens      -> rateio por projeto
--
-- Terminologia: "Empresas Terceirizadas" passa a se chamar FORNECEDORES
-- na UI. A TABELA física continua empresas_terceirizadas e a coluna
-- contratos_projeto.empresa_codigo — só a interface muda.
--
-- RLS off (padrão). Idempotente. Supabase -> SQL Editor.
-- =========================================================================

-- -------------------------------------------------------------------------
-- 1. contratos_pagamentos vira CABEÇALHO
-- -------------------------------------------------------------------------
ALTER TABLE contratos_pagamentos ADD COLUMN IF NOT EXISTS valor_total_nf NUMERIC(15,2);
ALTER TABLE contratos_pagamentos ADD COLUMN IF NOT EXISTS data_pagamento DATE;
ALTER TABLE contratos_pagamentos ADD COLUMN IF NOT EXISTS numero_nf      TEXT;
-- vinculo_id / valor_pago ficam (legado — pagamentos antigos de 1 projeto);
-- não são mais escritos. Deixa nullable para os novos cabeçalhos.
ALTER TABLE contratos_pagamentos ALTER COLUMN vinculo_id DROP NOT NULL;
ALTER TABLE contratos_pagamentos ALTER COLUMN valor_pago DROP NOT NULL;

CREATE TABLE IF NOT EXISTS contratos_pagamento_itens (
    id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    pagamento_id   BIGINT NOT NULL REFERENCES contratos_pagamentos(id) ON DELETE CASCADE,
    vinculo_id     BIGINT NOT NULL REFERENCES contratos_vinculos_projeto(id),
    projeto_codigo TEXT NOT NULL,
    valor          NUMERIC(15,2) NOT NULL
);
ALTER TABLE contratos_pagamento_itens DISABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS ix_pag_itens_pagamento ON contratos_pagamento_itens(pagamento_id);
CREATE INDEX IF NOT EXISTS ix_pag_itens_vinculo   ON contratos_pagamento_itens(vinculo_id);

CREATE TABLE IF NOT EXISTS contratos_pagamentos_anexos (
    id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    pagamento_id   BIGINT NOT NULL REFERENCES contratos_pagamentos(id) ON DELETE CASCADE,
    storage_path   TEXT NOT NULL,
    nome_original  TEXT,
    tipo_mime      TEXT,
    tamanho_bytes  BIGINT,
    classificacao  TEXT NOT NULL DEFAULT 'NOTA_FISCAL'
                   CHECK (classificacao IN ('NOTA_FISCAL','COMPROVANTE','OUTRO')),
    enviado_por    TEXT,
    enviado_em     TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE contratos_pagamentos_anexos DISABLE ROW LEVEL SECURITY;

-- BACKFILL: cada pagamento antigo (1 projeto) vira cabeçalho + 1 item.
UPDATE contratos_pagamentos p
   SET valor_total_nf = COALESCE(p.valor_total_nf, p.valor_pago),
       data_pagamento = COALESCE(p.data_pagamento, p.registrado_em::date)
 WHERE p.valor_total_nf IS NULL;

INSERT INTO contratos_pagamento_itens (pagamento_id, vinculo_id, projeto_codigo, valor)
SELECT p.id, p.vinculo_id, v.projeto_codigo, p.valor_pago
FROM contratos_pagamentos p
JOIN contratos_vinculos_projeto v ON v.id = p.vinculo_id
WHERE p.vinculo_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM contratos_pagamento_itens i WHERE i.pagamento_id = p.id);

-- -------------------------------------------------------------------------
-- 2. Staging: contratos_pendencias ganha itens de rateio
-- -------------------------------------------------------------------------
ALTER TABLE contratos_pendencias ADD COLUMN IF NOT EXISTS numero_nf TEXT;  -- agrupador do canal Excel/e-mail

CREATE TABLE IF NOT EXISTS contratos_pendencias_itens (
    id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    pendencia_id   BIGINT NOT NULL REFERENCES contratos_pendencias(id) ON DELETE CASCADE,
    vinculo_id     BIGINT REFERENCES contratos_vinculos_projeto(id),
    projeto_ref    TEXT,
    projeto_codigo TEXT,
    valor          NUMERIC(15,2) NOT NULL
);
ALTER TABLE contratos_pendencias_itens DISABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS ix_pend_itens_pendencia ON contratos_pendencias_itens(pendencia_id);

-- BACKFILL: pendência PAGAMENTO antiga (1 projeto) vira cabeçalho + 1 item.
INSERT INTO contratos_pendencias_itens (pendencia_id, vinculo_id, projeto_ref, projeto_codigo, valor)
SELECT pe.id, pe.vinculo_id, pe.projeto_ref, pe.projeto_codigo, pe.valor
FROM contratos_pendencias pe
WHERE pe.tipo = 'PAGAMENTO'
  AND pe.valor IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM contratos_pendencias_itens i WHERE i.pendencia_id = pe.id);

NOTIFY pgrst, 'reload schema';

-- Conferência:
--   SELECT p.id, p.valor_total_nf,
--          (SELECT sum(valor) FROM contratos_pagamento_itens WHERE pagamento_id = p.id) AS soma_itens
--   FROM contratos_pagamentos p ORDER BY p.id;
-- =========================================================================
