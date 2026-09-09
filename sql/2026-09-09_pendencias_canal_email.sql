-- =========================================================================
-- 2026-09-09_pendencias_canal_email.sql   (Release 1 — Fase C)
-- Compasso — projeto Supabase fytynjjvzecljmgbtwec.
--
-- Canal de e-mail padronizado (spec §4): uma Netlify Function
-- (netlify/functions/receber-email-contratos.js) recebe o webhook de um
-- provedor de inbound e-mail, faz o parsing do corpo e grava a pendência
-- (origem = 'EMAIL'). Aqui só a coluna de dedupe (Message-ID do e-mail),
-- p/ retry de webhook não duplicar pendência.
--
-- Idempotente. Supabase -> SQL Editor.
-- =========================================================================

ALTER TABLE contratos_pendencias ADD COLUMN IF NOT EXISTS email_message_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS ux_contratos_pendencias_email_msgid
    ON contratos_pendencias (email_message_id)
    WHERE email_message_id IS NOT NULL;

NOTIFY pgrst, 'reload schema';

-- Conferência:
--   SELECT id, origem, email_message_id, status FROM contratos_pendencias
--   WHERE origem = 'EMAIL' ORDER BY criado_em DESC;
-- =========================================================================
