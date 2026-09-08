-- =========================================================================
-- 2026-09-08_contratos_pendencias.sql   (Release 1 — módulo FINANCEIRO)
-- Compasso — projeto Supabase fytynjjvzecljmgbtwec.
--
-- Contratos e Terceiros — Fase A: staging de pendências + base oficial de
-- propostas + anexos de Nota Fiscal + auditoria. Nenhuma gravação na base
-- oficial (contratos_pagamentos / contratos_propostas) acontece fora da
-- tela de aprovação (js/contratos/pendencias.js).
--
-- Sem RLS (padrão do projeto — controle de acesso no front, ver
-- catalogo_atividades 'contratos_pendencias:*'). Idempotente.
-- Rode no Supabase → SQL Editor.
-- =========================================================================

-- -------------------------------------------------------------------------
-- 1. Base oficial de PROPOSTAS (não existia — "Proposta" era só conceito
--    nos comentários de js/contratos/contratos.js).
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS contratos_propostas (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    contrato_id         BIGINT NOT NULL REFERENCES contratos_projeto(id),
    vinculo_id          BIGINT REFERENCES contratos_vinculos_projeto(id),
    projeto_codigo      TEXT,
    fornecedor          TEXT,
    valor               NUMERIC(15,2) NOT NULL,
    data_referencia     DATE,
    descricao           TEXT,
    origem_pendencia_id BIGINT,
    criado_por          TEXT,
    criado_em           TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE contratos_propostas DISABLE ROW LEVEL SECURITY;

-- -------------------------------------------------------------------------
-- 2. STAGING — toda entrada cai aqui como pendência
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS contratos_pendencias (
    id                 BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tipo               TEXT NOT NULL CHECK (tipo IN ('PROPOSTA','PAGAMENTO')),
    origem             TEXT NOT NULL CHECK (origem IN ('MANUAL','UPLOAD_EXCEL','EMAIL')),
    referencia         TEXT,                     -- §4.3 (usado/validado no Canal 1)
    -- valores CRUS (o que chegou) e RESOLVIDOS (o que o aprovador confirmou)
    contrato_ref       TEXT,
    contrato_id        BIGINT REFERENCES contratos_projeto(id),
    projeto_ref        TEXT,
    projeto_codigo     TEXT,
    vinculo_id         BIGINT REFERENCES contratos_vinculos_projeto(id),
    fornecedor         TEXT,
    valor              NUMERIC(15,2),
    data_referencia    DATE,
    descricao          TEXT,
    status             TEXT NOT NULL DEFAULT 'PENDENTE'
                       CHECK (status IN ('PENDENTE','ERRO_LEITURA','APROVADA','REJEITADA')),
    nf_status          TEXT NOT NULL DEFAULT 'NAO_RECEBIDA'
                       CHECK (nf_status IN ('RECEBIDA','NAO_RECEBIDA','DISPENSADA')),
    erros_leitura      JSONB,                    -- [{campo, motivo}] p/ ERRO_LEITURA / import
    lote_importacao    TEXT,                     -- agrupa as linhas de um mesmo upload
    justificativa_dispensa_nf TEXT,
    promovido_para_tabela TEXT,                  -- 'contratos_pagamentos' | 'contratos_propostas'
    promovido_para_id  BIGINT,
    criado_por         TEXT,
    criado_em          TIMESTAMPTZ NOT NULL DEFAULT now(),
    decidido_por       TEXT,
    decidido_em        TIMESTAMPTZ,
    motivo_decisao     TEXT
);
ALTER TABLE contratos_pendencias DISABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS ix_contratos_pendencias_status ON contratos_pendencias(status);
CREATE INDEX IF NOT EXISTS ix_contratos_pendencias_lote   ON contratos_pendencias(lote_importacao);

-- -------------------------------------------------------------------------
-- 3. ANEXOS (1:N) — arquivo fica no Storage (bucket contratos-anexos)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS contratos_pendencias_anexos (
    id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    pendencia_id   BIGINT NOT NULL REFERENCES contratos_pendencias(id) ON DELETE CASCADE,
    storage_path   TEXT NOT NULL,
    nome_original  TEXT,
    tipo_mime      TEXT,
    tamanho_bytes  BIGINT,
    classificacao  TEXT NOT NULL DEFAULT 'OUTRO'
                   CHECK (classificacao IN ('NOTA_FISCAL','COMPROVANTE','OUTRO')),
    enviado_por    TEXT,
    enviado_em     TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE contratos_pendencias_anexos DISABLE ROW LEVEL SECURITY;

-- -------------------------------------------------------------------------
-- 4. AUDITORIA — append-only (§7.4)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS log_contratos_pendencias (
    id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    pendencia_id BIGINT NOT NULL,
    acao         TEXT NOT NULL,   -- CRIADA|IMPORTADA|ANEXO_ADD|ANEXO_REMOVIDO
                                  -- CORRIGIDA|APROVADA|REJEITADA|NF_DISPENSADA
    por          TEXT,
    em           TIMESTAMPTZ NOT NULL DEFAULT now(),
    detalhe      JSONB            -- {antes:{...}, depois:{...}} nas correções
);
ALTER TABLE log_contratos_pendencias DISABLE ROW LEVEL SECURITY;

-- -------------------------------------------------------------------------
-- 5. Gate de módulo (fonte de verdade em runtime — js/core/licenca.js)
-- -------------------------------------------------------------------------
INSERT INTO modulo_funcao (activity_key, modulo, tipo, observacao) VALUES
  ('contratos_pendencias', 'FINANCEIRO', 'LICENCIAVEL',
   'Pendencias de Contratos e Terceiros — staging + aprovacao (Release 1)')
ON CONFLICT (activity_key) DO UPDATE
  SET modulo = EXCLUDED.modulo, tipo = EXCLUDED.tipo,
      observacao = EXCLUDED.observacao, atualizado_em = now();

NOTIFY pgrst, 'reload schema';

-- Conferência:
--   SELECT modulo FROM modulo_funcao WHERE activity_key = 'contratos_pendencias';
--   \d contratos_pendencias
-- =========================================================================
