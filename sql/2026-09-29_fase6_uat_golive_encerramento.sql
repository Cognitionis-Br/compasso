-- =========================================================================
-- 2026-09-29_fase6_uat_golive_encerramento.sql
-- Compasso 2.0 — Fase 6: UAT (cap.07), Go Live (cap.08), Encerramento (cap.09)
--
-- Idempotente: CREATE TABLE IF NOT EXISTS + ADD COLUMN IF NOT EXISTS +
-- DROP/CREATE VIEW + DROP/CREATE TRIGGER.
-- =========================================================================

-- -------------------------------------------------------------------------
-- 1. Estados por etapa
-- -------------------------------------------------------------------------
ALTER TABLE projects
    ADD COLUMN IF NOT EXISTS uat_estado     TEXT DEFAULT 'UAT_PLANNING',
    ADD COLUMN IF NOT EXISTS golive_estado  TEXT DEFAULT 'GO_LIVE_PLANNING',
    ADD COLUMN IF NOT EXISTS enc_estado     TEXT DEFAULT 'CLOSING';

-- -------------------------------------------------------------------------
-- 2. UAT: ciclos, casos de teste, defeitos
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS uat_ciclos (
    id             SERIAL PRIMARY KEY,
    projeto_codigo TEXT NOT NULL,
    numero         INT NOT NULL,
    ambiente       TEXT,
    dt_inicio      DATE,
    dt_fim         DATE,
    status         TEXT NOT NULL DEFAULT 'PLANEJADO'
                   CHECK (status IN ('PLANEJADO','EM_ANDAMENTO','ENCERRADO')),
    resultado      TEXT,
    criado_por     TEXT,
    criado_em      TIMESTAMPTZ DEFAULT now(),
    UNIQUE (projeto_codigo, numero)
);
CREATE INDEX IF NOT EXISTS idx_uat_ciclos_proj ON uat_ciclos (projeto_codigo);

CREATE TABLE IF NOT EXISTS uat_casos_teste (
    id             SERIAL PRIMARY KEY,
    projeto_codigo TEXT NOT NULL,
    codigo         TEXT NOT NULL,         -- CT-001, CT-002...
    titulo         TEXT,
    criterio_ac    TEXT,                  -- AC-001, AC-002...
    requisito      TEXT,
    obrigatorio    BOOLEAN NOT NULL DEFAULT true,
    responsavel    TEXT,
    status         TEXT NOT NULL DEFAULT 'PENDENTE'
                   CHECK (status IN ('PENDENTE','APROVADO','REPROVADO','BLOQUEADO')),
    ciclo_id       INT REFERENCES uat_ciclos(id),
    evidencia      TEXT,
    criado_em      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_uat_casos_proj ON uat_casos_teste (projeto_codigo);

CREATE TABLE IF NOT EXISTS uat_defeitos (
    id             SERIAL PRIMARY KEY,
    projeto_codigo TEXT NOT NULL,
    ciclo_id       INT REFERENCES uat_ciclos(id),
    caso_id        INT REFERENCES uat_casos_teste(id),
    descricao      TEXT NOT NULL,
    severidade     TEXT NOT NULL DEFAULT 'MEDIA'
                   CHECK (severidade IN ('CRITICA','ALTA','MEDIA','BAIXA')),
    status         TEXT NOT NULL DEFAULT 'ABERTO'
                   CHECK (status IN ('ABERTO','EM_CORRECAO','PRONTO_RETESTE','FECHADO','ACEITO_RESTRICAO')),
    responsavel    TEXT,
    prazo          DATE,
    criado_por     TEXT,
    criado_em      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_uat_defeitos_proj ON uat_defeitos (projeto_codigo);

-- -------------------------------------------------------------------------
-- 3. Go Live: critérios de rollback, tentativas, ocorrências
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS golive_criterios_rollback (
    id             SERIAL PRIMARY KEY,
    projeto_codigo TEXT NOT NULL,
    criterio       TEXT NOT NULL,
    limite         TEXT NOT NULL,
    efeito         TEXT NOT NULL DEFAULT 'ROLLBACK'
                   CHECK (efeito IN ('ROLLBACK','ROLLBACK_PARCIAL','DECISAO_COMITE')),
    tempo_max      TEXT,
    ativo          BOOLEAN NOT NULL DEFAULT true,
    criado_por     TEXT,
    criado_em      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_gl_criterios_proj ON golive_criterios_rollback (projeto_codigo);

CREATE TABLE IF NOT EXISTS golive_tentativas (
    id               SERIAL PRIMARY KEY,
    projeto_codigo   TEXT NOT NULL,
    numero           INT NOT NULL,
    ambiente         TEXT,
    dt_inicio        TIMESTAMPTZ,
    resultado        TEXT NOT NULL DEFAULT 'EM_EXECUCAO'
                     CHECK (resultado IN ('EM_EXECUCAO','SUCESSO','FALHA','NAO_INICIADA')),
    iniciado_por     TEXT,
    criterio_excedido TEXT,
    rollback_inicio  TIMESTAMPTZ,
    rollback_fim     TIMESTAMPTZ,
    rollback_resultado TEXT,
    gonogo_decidido_por TEXT,
    gonogo_decidido_em  TIMESTAMPTZ,
    criado_em        TIMESTAMPTZ DEFAULT now(),
    UNIQUE (projeto_codigo, numero)
);
CREATE INDEX IF NOT EXISTS idx_gl_tentativas_proj ON golive_tentativas (projeto_codigo);

CREATE TABLE IF NOT EXISTS golive_ocorrencias_v2 (
    id             SERIAL PRIMARY KEY,
    projeto_codigo TEXT NOT NULL,
    tentativa_id   INT REFERENCES golive_tentativas(id),
    descricao      TEXT NOT NULL,
    classificacao  TEXT NOT NULL DEFAULT 'MEDIA'
                   CHECK (classificacao IN ('CRITICA','ALTA','MEDIA','BAIXA')),
    criterio_afetado TEXT,
    status         TEXT NOT NULL DEFAULT 'ABERTO'
                   CHECK (status IN ('ABERTO','EM_TRATAMENTO','FECHADO')),
    responsavel    TEXT,
    criado_por     TEXT,
    criado_em      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_gl_ocorrencias_proj ON golive_ocorrencias_v2 (projeto_codigo);

-- -------------------------------------------------------------------------
-- 4. Encerramento: pendências consolidadas
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS encerramento_pendencias (
    id              SERIAL PRIMARY KEY,
    projeto_codigo  TEXT NOT NULL,
    tipo            TEXT NOT NULL
                    CHECK (tipo IN ('RESTRICAO_UAT','RESTRICAO_GOLIVE','TAREFA','RISCO','OCORRENCIA','CONTRATO','ITEM_ACEITO')),
    descricao       TEXT NOT NULL,
    responsavel_original TEXT,
    origem          TEXT,
    tratamento      TEXT
                    CHECK (tratamento IN ('RESOLVER','TRANSFERIR','CANCELAR')),
    tratamento_novo_resp TEXT,
    tratamento_justificativa TEXT,
    status          TEXT NOT NULL DEFAULT 'SEM_TRATAMENTO'
                    CHECK (status IN ('SEM_TRATAMENTO','PENDENTE_ACEITE','TRATADO')),
    atualizado_por  TEXT,
    atualizado_em   TIMESTAMPTZ DEFAULT now(),
    criado_em       TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_enc_pendencias_proj ON encerramento_pendencias (projeto_codigo);

-- -------------------------------------------------------------------------
-- 5. Recria a view `projetos` para incluir uat_estado, golive_estado, enc_estado
-- -------------------------------------------------------------------------
DROP VIEW IF EXISTS projetos CASCADE;

DO $$
DECLARE
    col RECORD;
    select_list TEXT := '';
    tem_bc  BOOLEAN;
    tem_proj BOOLEAN;
BEGIN
    FOR col IN
        SELECT DISTINCT column_name FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name IN ('business_cases', 'projects')
          AND column_name <> 'business_case_codigo'
        ORDER BY column_name
    LOOP
        tem_bc   := EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='business_cases' AND column_name=col.column_name);
        tem_proj := EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='projects' AND column_name=col.column_name);

        IF select_list <> '' THEN select_list := select_list || ', '; END IF;

        IF tem_bc AND tem_proj THEN
            select_list := select_list || format('COALESCE(p.%1$I, bc.%1$I) AS %1$I', col.column_name);
        ELSIF tem_proj THEN
            select_list := select_list || format('p.%1$I AS %1$I', col.column_name);
        ELSE
            select_list := select_list || format('bc.%1$I AS %1$I', col.column_name);
        END IF;
    END LOOP;

    select_list := select_list || ', p.business_case_codigo';

    EXECUTE format(
        'CREATE VIEW projetos AS SELECT %s FROM business_cases bc LEFT JOIN projects p ON p.codigo = bc.codigo',
        select_list
    );
    RAISE NOTICE 'view projetos recriada com % colunas (Fase 6)', array_length(string_to_array(select_list, ','), 1);
END $$;

-- -------------------------------------------------------------------------
-- 6. Recria os 3 triggers INSTEAD OF
-- -------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_projetos_instead_insert ON projetos;
CREATE TRIGGER trg_projetos_instead_insert INSTEAD OF INSERT ON projetos
    FOR EACH ROW EXECUTE FUNCTION _v3_projetos_instead_insert();

DROP TRIGGER IF EXISTS trg_projetos_instead_update ON projetos;
CREATE TRIGGER trg_projetos_instead_update INSTEAD OF UPDATE ON projetos
    FOR EACH ROW EXECUTE FUNCTION _v3_projetos_instead_update();

DROP TRIGGER IF EXISTS trg_projetos_instead_delete ON projetos;
CREATE TRIGGER trg_projetos_instead_delete INSTEAD OF DELETE ON projetos
    FOR EACH ROW EXECUTE FUNCTION _v3_projetos_instead_delete();

-- -------------------------------------------------------------------------
-- 7. Notifica PostgREST para recarregar o schema
-- -------------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';
