-- =========================================================================
-- 2026-09-09_pendencias_escalonamento_nf.sql   (Release 1 — Fase B)
-- Compasso — projeto Supabase fytynjjvzecljmgbtwec.
--
-- Escalonamento de Nota Fiscal pendente (spec §6 / §10.3): uma pendência
-- de contrato sinalizada "NF não recebida" que passar de 5 dias ÚTEIS
-- sem NF gera 1 e-mail de alerta (uma vez), além do destaque visual que
-- já existe na lista.
--
-- Reaproveita a fila de e-mail existente: novo ponto de disparo em
-- email_fluxo (configurado na tela "Envio de E-mail — Gestão do Fluxo").
-- Nasce INATIVO e como EMAIL_FIXO — o admin define o destinatário
-- (Gestor de Contratos / Governança), o remetente, e liga a linha.
--
-- RLS: contratos_pendencias já está off; email_fluxo/email_templates
-- estão sob RLS — rode DIRETO no SQL Editor. Idempotente.
-- =========================================================================

-- 1. marca de "já escalonei esta pendência" (evita reenvio)
ALTER TABLE contratos_pendencias ADD COLUMN IF NOT EXISTS escalado_nf_em TIMESTAMPTZ;

-- 2. template do e-mail de escalonamento
INSERT INTO email_templates (assunto, texto, ativo)
SELECT '[Compasso] NF pendente há mais de {{dias}} dias úteis — {{contrato}}',
       'Prezado(a),' || chr(10) || chr(10) ||
       'A pendência de contrato {{pendencia}} (fornecedor {{fornecedor}}, contrato {{contrato}}, ' ||
       'valor {{valor}}) está há mais de {{dias}} dias úteis sem a Nota Fiscal anexada e não pode ' ||
       'ser aprovada até a regularização.' || chr(10) || chr(10) ||
       'Providencie o anexo da NF em Contratos e Fornecedores > Pendências de Contratos, ou ' ||
       'registre uma dispensa com justificativa.' || chr(10) || chr(10) ||
       'Área de Governança',
       true
WHERE NOT EXISTS (SELECT 1 FROM email_templates WHERE assunto LIKE '[Compasso] NF pendente há mais de%');

-- 3. ponto de disparo (lista fixa de email_fluxo) — nasce inativo
INSERT INTO email_fluxo (fase, etapa, quando_dispara, tipo_destinatario, ativo, template_id)
SELECT 'PENDÊNCIAS DE CONTRATO', 'ESCALONAMENTO NF', 'NF pendente há mais de 5 dias úteis',
       'EMAIL_FIXO', false,
       (SELECT id FROM email_templates WHERE assunto LIKE '[Compasso] NF pendente há mais de%' ORDER BY id LIMIT 1)
WHERE NOT EXISTS (
    SELECT 1 FROM email_fluxo
    WHERE fase = 'PENDÊNCIAS DE CONTRATO' AND etapa = 'ESCALONAMENTO NF'
);

NOTIFY pgrst, 'reload schema';

-- Conferência:
--   SELECT fase, etapa, quando_dispara, tipo_destinatario, ativo, template_id
--   FROM email_fluxo WHERE fase = 'PENDÊNCIAS DE CONTRATO';
-- =========================================================================
