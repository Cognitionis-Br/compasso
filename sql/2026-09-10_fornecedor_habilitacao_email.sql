-- =========================================================================
-- 2026-09-10_fornecedor_habilitacao_email.sql
-- Compasso — projeto Supabase fytynjjvzecljmgbtwec.
--
-- Cadastro de Fornecedores ganha o e-mail de contato e o par de atributos
-- do canal de pagamentos por e-mail:
--   A) envia_pagamento_email      (sim/não) — editável a qualquer momento
--   B) email_pagamento_aprovado   (sim/não) — só liga depois de o fornecedor
--      mandar o e-mail inicial de habilitação (R$ 0,10) e ele ser validado
--      em Pendências de Contratos.
--
-- O e-mail de habilitação entra como uma pendência tipo 'HABILITACAO'
-- (não vira pagamento — ao aprovar, liga o atributo B do fornecedor).
--
-- Idempotente. RLS: empresas_terceirizadas / contratos_pendencias já estão
-- com RLS off; email_templates está sob RLS — rode DIRETO no SQL Editor.
-- =========================================================================

-- 1. Fornecedor: e-mail + atributos A/B
ALTER TABLE empresas_terceirizadas
    ADD COLUMN IF NOT EXISTS email                        TEXT,
    ADD COLUMN IF NOT EXISTS envia_pagamento_email        BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS email_pagamento_aprovado     BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS email_pagamento_aprovado_em  TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS email_pagamento_instrucoes_em TIMESTAMPTZ;

-- 2. Pendência de habilitação (handshake) — marca qual fornecedor
ALTER TABLE contratos_pendencias
    ADD COLUMN IF NOT EXISTS habilitacao_fornecedor_codigo TEXT;

-- 3. tipo da pendência passa a aceitar 'HABILITACAO'
ALTER TABLE contratos_pendencias DROP CONSTRAINT IF EXISTS contratos_pendencias_tipo_check;
ALTER TABLE contratos_pendencias
    ADD CONSTRAINT contratos_pendencias_tipo_check
    CHECK (tipo IN ('PROPOSTA', 'PAGAMENTO', 'HABILITACAO'));

-- 4. Template "MODELO PADRÃO PARA ENVIO DE PAGAMENTOS E NOTA FISCAL"
--    (enviado ao fornecedor quando o atributo A é ligado). {{fornecedor}},
--    {{codigo}} e {{ref_habilitacao}} são substituídos no envio.
INSERT INTO email_templates (assunto, texto, ativo)
SELECT
  '[Compasso] MODELO PADRÃO PARA ENVIO DE PAGAMENTOS E NOTA FISCAL — {{fornecedor}}',
  'Prezado(a) {{fornecedor}},' || chr(10) || chr(10) ||
  'Seu cadastro foi habilitado para enviar informações de pagamento e Nota Fiscal por e-mail. ' ||
  'Antes de enviar pagamentos reais, é preciso concluir uma habilitação única.' || chr(10) || chr(10) ||
  '1) HABILITAÇÃO (uma vez). Envie um e-mail para o canal de contratos com:' || chr(10) ||
  '   Assunto: [CONTRATOS] PAGAMENTO - Contrato <número do contrato> - Projeto <projeto>' || chr(10) ||
  '   Corpo:' || chr(10) ||
  '   Referência: {{ref_habilitacao}}' || chr(10) ||
  '   Tipo de Lançamento: Pagamento' || chr(10) ||
  '   Fornecedor: {{codigo}}' || chr(10) ||
  '   Contrato: <número do contrato>' || chr(10) ||
  '   Projeto: <código ou nome do projeto>' || chr(10) ||
  '   Valor: R$ 0,10' || chr(10) ||
  '   Data de Referência: <dd/mm/aaaa>' || chr(10) ||
  '   (anexe qualquer PDF/JPG/PNG como exemplo de Nota Fiscal)' || chr(10) || chr(10) ||
  'Após recebermos e validarmos esse e-mail, seu cadastro fica liberado para pagamentos.' || chr(10) || chr(10) ||
  '2) PAGAMENTO — 1 projeto:' || chr(10) ||
  '   Referência: <referência da instância informada pela governança>' || chr(10) ||
  '   Tipo de Lançamento: Pagamento' || chr(10) ||
  '   Contrato: <número>' || chr(10) ||
  '   Projeto: <código ou nome>' || chr(10) ||
  '   Valor: R$ <valor da NF>' || chr(10) ||
  '   Data de Referência: <dd/mm/aaaa>' || chr(10) ||
  '   (anexo obrigatório: Nota Fiscal em PDF, JPG ou PNG)' || chr(10) || chr(10) ||
  '3) PAGAMENTO — vários projetos do mesmo contrato (rateio):' || chr(10) ||
  '   Referência: <referência da instância>' || chr(10) ||
  '   Tipo de Lançamento: Pagamento' || chr(10) ||
  '   Contrato: <número>' || chr(10) ||
  '   Valor Total da NF: R$ <total>' || chr(10) ||
  '   Data de Referência: <dd/mm/aaaa>' || chr(10) ||
  '   Rateio:' || chr(10) ||
  '   - Projeto <A>: R$ <parte de A>' || chr(10) ||
  '   - Projeto <B>: R$ <parte de B>' || chr(10) ||
  '   (a soma do rateio tem de fechar com o Valor Total da NF)' || chr(10) || chr(10) ||
  'Regras: sem Nota Fiscal anexada o pagamento não é aprovado; um pagamento sem NF por ' ||
  'mais de 5 dias úteis gera alerta. Guarde este e-mail como referência.' || chr(10) || chr(10) ||
  'Área de Governança',
  true
WHERE NOT EXISTS (
    SELECT 1 FROM email_templates WHERE assunto LIKE '[Compasso] MODELO PADRÃO PARA ENVIO DE PAGAMENTOS%'
);

NOTIFY pgrst, 'reload schema';

-- Conferência:
--   SELECT codigo, nome, email, envia_pagamento_email, email_pagamento_aprovado
--   FROM empresas_terceirizadas ORDER BY codigo;
--   SELECT id, assunto FROM email_templates WHERE assunto LIKE '[Compasso] MODELO PADRÃO%';
-- =========================================================================
