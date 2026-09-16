-- =========================================================================
-- 2026-09-16_cobranca_nf_email_fornecedor.sql
-- A pedido do usuário: a cobrança de NF pendente deixou de ir pra um
-- endereço FIXO interno (configurado em Envio de E-mail > Gestão do
-- Fluxo, email_fluxo 'PENDÊNCIAS DE CONTRATO'/'ESCALONAMENTO NF' — que
-- nascia INATIVO, motivo original de a cobrança nunca sair) e passa a ir
-- direto pro e-mail CADASTRADO DO PRÓPRIO FORNECEDOR
-- (empresas_terceirizadas.email). Ver js/contratos/pendencias.js
-- (_pendEnviarCobrancaNfFornecedor) e js/contratos/pagamentos-pendentes-nf.js
-- (enviarCobrancaNf) — ambos agora enfileiram direto via enfileirarEmail,
-- sem passar mais por email_fluxo/dispararEmailFluxo.
--
-- O texto do template (criado em sql/2026-09-09_pendencias_escalonamento_nf.sql)
-- foi escrito pra um leitor INTERNO ("providencie o anexo da NF no
-- sistema") — precisa falar com o FORNECEDOR agora (pedir o reenvio da NF
-- pelo canal de e-mail). Atualiza pelo mesmo assunto-âncora, mantendo os
-- mesmos placeholders {{dias}}/{{contrato}}/{{pendencia}}/{{fornecedor}}/
-- {{valor}} já usados pelo código.
--
-- A linha em email_fluxo fica órfã (não é mais lida por código nenhum) —
-- deixada como está, não é removida por esta migração.
-- Idempotente.
-- =========================================================================

UPDATE email_templates
SET assunto = '[Compasso] NF pendente há mais de {{dias}} dias úteis — {{contrato}}',
    texto = 'Prezado(a) {{fornecedor}},' || chr(10) || chr(10) ||
       'Ainda não recebemos a Nota Fiscal referente ao contrato {{contrato}} (pendência {{pendencia}}, valor {{valor}}), pendente há mais de {{dias}} dias úteis.' || chr(10) || chr(10) ||
       'Por favor, encaminhe a Nota Fiscal pelo mesmo canal de e-mail usado no lançamento original o quanto antes, para que o pagamento possa ser processado.' || chr(10) || chr(10) ||
       'Área de Governança'
WHERE assunto LIKE '[Compasso] NF pendente há mais de%';

-- Conferência:
--   SELECT assunto, texto, ativo FROM email_templates WHERE assunto LIKE '[Compasso] NF pendente há mais de%';
-- =========================================================================
