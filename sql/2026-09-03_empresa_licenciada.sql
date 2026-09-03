-- =========================================================================
-- 2026-09-03_empresa_licenciada.sql
-- Compasso — projeto Supabase fytynjjvzecljmgbtwec.
--
-- FASE 3 do licenciamento — cadastro da empresa licenciada + vigência da
-- licença + logs de verificação e de renovação.
--
-- Linha ÚNICA (id = 1). Enquanto vazia/incompleta, o app mostra a tela de
-- setup bloqueante (só o Proprietário preenche). Fora da vigência, mostra
-- a tela "Licença Expirada".
--
-- Sem RLS (mesmo tratamento das demais tabelas de config; o app grava com
-- a chave publishable). Idempotente. Supabase → SQL Editor.
-- =========================================================================

CREATE TABLE IF NOT EXISTS empresa_licenciada (
    id                  SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    cnpj                TEXT,
    razao_social        TEXT,
    nome_fantasia       TEXT,
    data_aquisicao      DATE,
    vigencia_inicio     DATE,
    vigencia_termino    DATE,
    nome_cabecalho      TEXT,             -- exibido em MAIÚSCULAS (formatação na exibição)
    cor_exibicao        TEXT,             -- hex "#RRGGBB"; default aplicado no app se vazio
    logo_data_uri       TEXT,             -- data:image/png|svg+xml;base64,... (<= 2 MB)
    aviso_dias_antes    SMALLINT NOT NULL DEFAULT 30,
    atualizado_por      TEXT,
    atualizado_em       TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE empresa_licenciada DISABLE ROW LEVEL SECURITY;

INSERT INTO empresa_licenciada (id) SELECT 1
    WHERE NOT EXISTS (SELECT 1 FROM empresa_licenciada WHERE id = 1);

-- Log de toda verificação de vigência que NEGA acesso (quem tentou, quando).
CREATE TABLE IF NOT EXISTS log_licenca_verificacao (
    id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    ocorrido_em    TIMESTAMPTZ NOT NULL DEFAULT now(),
    usuario        TEXT,
    resultado      TEXT,               -- 'EXPIRADA' | 'SEM_CADASTRO'
    vigencia_termino DATE
);
ALTER TABLE log_licenca_verificacao DISABLE ROW LEVEL SECURITY;

-- Log de toda tentativa de renovação (sucesso ou falha).
CREATE TABLE IF NOT EXISTS log_renovacao_licenca (
    id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tentado_em     TIMESTAMPTZ NOT NULL DEFAULT now(),
    usuario        TEXT,
    resultado      TEXT,               -- 'OK' | 'ASSINATURA_INVALIDA' | 'CNPJ_DIVERGENTE' | 'CODIGO_INVALIDO' | 'ERRO'
    detalhe        TEXT,
    vigencia_anterior DATE,
    vigencia_nova     DATE
);
ALTER TABLE log_renovacao_licenca DISABLE ROW LEVEL SECURITY;

NOTIFY pgrst, 'reload schema';

-- Conferência:
--   SELECT * FROM empresa_licenciada;
-- =========================================================================
