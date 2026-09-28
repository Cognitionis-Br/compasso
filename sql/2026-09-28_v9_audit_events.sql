-- =============================================================================
-- V9: Auditoria / Compliance — audit_events + triggers em business_cases/projects
-- Executar no Supabase SQL Editor antes do deploy do código
-- =============================================================================

CREATE TABLE IF NOT EXISTS audit_events (
    id             BIGSERIAL PRIMARY KEY,
    entidade       TEXT NOT NULL,      -- 'business_cases', 'projects', 'gates', etc.
    entidade_id    TEXT NOT NULL,      -- código do projeto ou id do registro
    acao           TEXT NOT NULL,      -- 'CRIADO', 'FASE_ALTERADA', 'STATUS_ALTERADO',
                                       --  'ORCAMENTO_ALTERADO', 'BLOQUEIO_ALTERADO',
                                       --  'PROJECT_CRIADO'
    campo          TEXT,               -- campo alterado (NULL em criações)
    valor_anterior TEXT,
    valor_novo     TEXT,
    usuario        TEXT,               -- nome do usuário (NULL quando só trigger)
    origem         TEXT NOT NULL DEFAULT 'trigger',  -- 'trigger' | 'app'
    criado_em      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_entidade_id ON audit_events(entidade_id);
CREATE INDEX IF NOT EXISTS idx_audit_criado_em   ON audit_events(criado_em DESC);

-- RLS: leitura livre; escrita apenas pelo sistema (trigger + service role)
ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='audit_events' AND policyname='audit_events_select') THEN
    CREATE POLICY "audit_events_select" ON audit_events FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='audit_events' AND policyname='audit_events_insert') THEN
    CREATE POLICY "audit_events_insert" ON audit_events FOR INSERT WITH CHECK (true);
  END IF;
END $$;

-- =============================================================================
-- Função e triggers em business_cases e projects
-- =============================================================================

CREATE OR REPLACE FUNCTION fn_audit_projeto() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO audit_events(entidade, entidade_id, acao, campo, valor_novo, origem)
    VALUES (TG_TABLE_NAME, NEW.codigo,
            CASE TG_TABLE_NAME WHEN 'projects' THEN 'PROJECT_CRIADO' ELSE 'CRIADO' END,
            NULL, NEW.nome, 'trigger');

  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.etapa_atual IS DISTINCT FROM NEW.etapa_atual THEN
      INSERT INTO audit_events(entidade, entidade_id, acao, campo, valor_anterior, valor_novo, origem)
      VALUES (TG_TABLE_NAME, NEW.codigo, 'FASE_ALTERADA', 'etapa_atual',
              OLD.etapa_atual, NEW.etapa_atual, 'trigger');
    END IF;

    IF OLD.sub_status IS DISTINCT FROM NEW.sub_status THEN
      INSERT INTO audit_events(entidade, entidade_id, acao, campo, valor_anterior, valor_novo, origem)
      VALUES (TG_TABLE_NAME, NEW.codigo, 'STATUS_ALTERADO', 'sub_status',
              OLD.sub_status, NEW.sub_status, 'trigger');
    END IF;

    IF OLD.val_bc IS DISTINCT FROM NEW.val_bc THEN
      INSERT INTO audit_events(entidade, entidade_id, acao, campo, valor_anterior, valor_novo, origem)
      VALUES (TG_TABLE_NAME, NEW.codigo, 'ORCAMENTO_ALTERADO', 'val_bc',
              OLD.val_bc::TEXT, NEW.val_bc::TEXT, 'trigger');
    END IF;

    IF OLD.val_req IS DISTINCT FROM NEW.val_req THEN
      INSERT INTO audit_events(entidade, entidade_id, acao, campo, valor_anterior, valor_novo, origem)
      VALUES (TG_TABLE_NAME, NEW.codigo, 'ORCAMENTO_ALTERADO', 'val_req',
              OLD.val_req::TEXT, NEW.val_req::TEXT, 'trigger');
    END IF;

    IF OLD.val_tech IS DISTINCT FROM NEW.val_tech THEN
      INSERT INTO audit_events(entidade, entidade_id, acao, campo, valor_anterior, valor_novo, origem)
      VALUES (TG_TABLE_NAME, NEW.codigo, 'ORCAMENTO_ALTERADO', 'val_tech',
              OLD.val_tech::TEXT, NEW.val_tech::TEXT, 'trigger');
    END IF;

    IF (OLD.bloqueado_mudanca_orcamento IS DISTINCT FROM NEW.bloqueado_mudanca_orcamento)
       AND NEW.bloqueado_mudanca_orcamento IS NOT NULL THEN
      INSERT INTO audit_events(entidade, entidade_id, acao, campo, valor_anterior, valor_novo, origem)
      VALUES (TG_TABLE_NAME, NEW.codigo, 'BLOQUEIO_ALTERADO', 'bloqueado_mudanca_orcamento',
              OLD.bloqueado_mudanca_orcamento::TEXT, NEW.bloqueado_mudanca_orcamento::TEXT, 'trigger');
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Triggers (DROP + CREATE para idempotência)
DROP TRIGGER IF EXISTS trg_audit_business_cases ON business_cases;
CREATE TRIGGER trg_audit_business_cases
  AFTER INSERT OR UPDATE ON business_cases
  FOR EACH ROW EXECUTE FUNCTION fn_audit_projeto();

DROP TRIGGER IF EXISTS trg_audit_projects ON projects;
CREATE TRIGGER trg_audit_projects
  AFTER INSERT OR UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION fn_audit_projeto();
