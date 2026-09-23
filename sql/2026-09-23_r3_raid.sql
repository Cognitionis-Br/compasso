-- =========================================================================
-- 2026-09-23_r3_raid.sql
-- Compasso 2.0 — Release 3. SÓ Compasso.
--
-- Riscos e Ocorrências (RAID: Risco/Problema/Impedimento/Decisão) no
-- nível do projeto — não existia nenhum log genérico assim (só
-- golive_ocorrencias, estreito e específico da fase Go-Live). Reaproveita
-- fn_usuario_tem_acesso_projeto (Release 2) como gate de RLS — mesma
-- regra de escopo de projeto já usada em tasks/documentos.
--
-- Idempotente.
-- =========================================================================

CREATE TABLE IF NOT EXISTS raid_items (
    id                    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    projeto_codigo        TEXT NOT NULL REFERENCES projetos(codigo),
    tipo                  TEXT NOT NULL CHECK (tipo IN ('RISCO', 'PROBLEMA', 'IMPEDIMENTO', 'DECISAO')),
    titulo                TEXT NOT NULL,
    descricao             TEXT,
    probabilidade         TEXT CHECK (probabilidade IN ('BAIXA', 'MEDIA', 'ALTA')),
    impacto               TEXT CHECK (impacto IN ('BAIXA', 'MEDIA', 'ALTA')),
    status                TEXT NOT NULL DEFAULT 'ABERTO' CHECK (status IN ('ABERTO', 'EM_ANDAMENTO', 'RESOLVIDO', 'CANCELADO')),
    responsavel_user_id   UUID REFERENCES auth.users(id),
    prazo                 DATE,
    criado_por            UUID REFERENCES auth.users(id),
    criado_em             TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolvido_em          TIMESTAMPTZ
);

ALTER TABLE raid_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS raid_items_acesso ON raid_items;
CREATE POLICY raid_items_acesso ON raid_items FOR ALL
    USING (fn_usuario_tem_acesso_projeto(projeto_codigo))
    WITH CHECK (fn_usuario_tem_acesso_projeto(projeto_codigo));

NOTIFY pgrst, 'reload schema';

-- Conferência:
--   SELECT * FROM raid_items;
-- =========================================================================
