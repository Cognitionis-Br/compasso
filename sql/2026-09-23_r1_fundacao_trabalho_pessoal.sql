-- =========================================================================
-- 2026-09-23_r1_fundacao_trabalho_pessoal.sql
-- Compasso 2.0 — Release 1 (Fundação e Trabalho Pessoal).
-- SÓ Compasso (projeto Supabase fytynjjvzecljmgbtwec).
--
-- Emula, dentro do Supabase, os princípios de "backend como fonte de
-- verdade" do pacote COMPASSO 2.0 – DEV HANDOFF (docs/revisao telas/):
-- autorização, transições e concorrência validadas no servidor, não só no
-- JS do cliente. Ver o plano aprovado na sessão pra detalhes e pra por que
-- (RLS estava desligado em 100% das tabelas do app até aqui).
--
-- Tabelas novas: tasks, task_history, notifications, user_preferences.
-- RLS LIGADO nelas (primeira vez no projeto) — o resto do schema (~90
-- tabelas) continua RLS off como sempre, fora de escopo deste release.
--
-- Idempotente.
-- =========================================================================

CREATE TABLE IF NOT EXISTS tasks (
    id                 BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    projeto_codigo     TEXT REFERENCES projetos(codigo),
    titulo             TEXT NOT NULL,
    descricao          TEXT,
    assigned_user_id   UUID NOT NULL REFERENCES auth.users(id),
    status             TEXT NOT NULL DEFAULT 'A_FAZER'
                           CHECK (status IN ('A_FAZER', 'EM_ANDAMENTO', 'AGUARDANDO', 'CONCLUIDO')),
    prioridade         TEXT NOT NULL DEFAULT 'MEDIA'
                           CHECK (prioridade IN ('BAIXA', 'MEDIA', 'ALTA')),
    prazo              DATE,
    progresso          INT NOT NULL DEFAULT 0 CHECK (progresso BETWEEN 0 AND 100),
    version            INT NOT NULL DEFAULT 1,
    criado_por         UUID REFERENCES auth.users(id),
    criado_em          TIMESTAMPTZ NOT NULL DEFAULT now(),
    concluido_em       TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS task_history (
    id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    task_id        BIGINT NOT NULL REFERENCES tasks(id),
    campo          TEXT NOT NULL,
    de_valor       TEXT,
    para_valor     TEXT,
    alterado_por   UUID REFERENCES auth.users(id),
    alterado_em    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notifications (
    id                     BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    destinatario_user_id   UUID NOT NULL REFERENCES auth.users(id),
    tipo                   TEXT NOT NULL,
    titulo                 TEXT NOT NULL,
    link_tab               TEXT,
    link_codigo_projeto    TEXT,
    lida_em                TIMESTAMPTZ,
    criado_em              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_preferences (
    usuario_id              UUID PRIMARY KEY REFERENCES auth.users(id),
    filtros_meu_trabalho    JSONB NOT NULL DEFAULT '{}'::jsonb,
    view_meu_trabalho       TEXT NOT NULL DEFAULT 'lista' CHECK (view_meu_trabalho IN ('lista', 'kanban'))
);

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tasks_dono ON tasks;
CREATE POLICY tasks_dono ON tasks FOR ALL
    USING (assigned_user_id = auth.uid() OR criado_por = auth.uid())
    WITH CHECK (assigned_user_id = auth.uid() OR criado_por = auth.uid());

DROP POLICY IF EXISTS notifications_dono ON notifications;
CREATE POLICY notifications_dono ON notifications FOR ALL
    USING (destinatario_user_id = auth.uid())
    WITH CHECK (destinatario_user_id = auth.uid());

DROP POLICY IF EXISTS task_history_leitura ON task_history;
CREATE POLICY task_history_leitura ON task_history FOR SELECT
    USING (EXISTS (SELECT 1 FROM tasks t WHERE t.id = task_history.task_id AND t.assigned_user_id = auth.uid()));

DROP POLICY IF EXISTS user_preferences_dono ON user_preferences;
CREATE POLICY user_preferences_dono ON user_preferences FOR ALL
    USING (usuario_id = auth.uid())
    WITH CHECK (usuario_id = auth.uid());

-- -------------------------------------------------------------------------
-- fn_usuario_tem_atividade — espelha usuarioTemAtividade() (JS,
-- js/config/funcoes.js:619) no servidor, reaproveitando o MESMO modelo de
-- RBAC já existente (usuario_funcoes → funcoes → funcao_atividades →
-- catalogo_atividades), pra usar em policies RLS dos releases seguintes.
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_usuario_tem_atividade(p_activity_key TEXT)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM usuario_funcoes uf
        JOIN funcoes f ON f.id = uf.funcao_id
        WHERE uf.usuario_id = auth.uid() AND f.acesso_irrestrito = true
    ) OR EXISTS (
        SELECT 1
        FROM usuario_funcoes uf
        JOIN funcao_atividades fa ON fa.funcao_id = uf.funcao_id
        JOIN catalogo_atividades ca ON ca.id = fa.atividade_id
        WHERE uf.usuario_id = auth.uid()
          AND ca.activity_key = p_activity_key
          AND fa.pode_consultar IS NOT FALSE
    );
$$;

-- -------------------------------------------------------------------------
-- RPCs — toda mutação de tarefa passa por aqui (não por PATCH direto na
-- tabela), pra permitir validar transição + concorrência otimista no
-- servidor, como pede o pacote.
-- -------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION fn_criar_tarefa(
    p_titulo TEXT, p_descricao TEXT DEFAULT NULL, p_projeto_codigo TEXT DEFAULT NULL,
    p_prioridade TEXT DEFAULT 'MEDIA', p_prazo DATE DEFAULT NULL
)
RETURNS tasks
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_task tasks;
BEGIN
    INSERT INTO tasks (titulo, descricao, projeto_codigo, prioridade, prazo, assigned_user_id, criado_por)
    VALUES (p_titulo, p_descricao, p_projeto_codigo, p_prioridade, p_prazo, auth.uid(), auth.uid())
    RETURNING * INTO v_task;
    RETURN v_task;
END;
$$;

CREATE OR REPLACE FUNCTION fn_atualizar_tarefa(
    p_task_id BIGINT, p_client_version INT,
    p_titulo TEXT DEFAULT NULL, p_descricao TEXT DEFAULT NULL,
    p_prioridade TEXT DEFAULT NULL, p_prazo DATE DEFAULT NULL, p_progresso INT DEFAULT NULL
)
RETURNS tasks
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_task tasks;
BEGIN
    UPDATE tasks SET
        titulo = COALESCE(p_titulo, titulo),
        descricao = COALESCE(p_descricao, descricao),
        prioridade = COALESCE(p_prioridade, prioridade),
        prazo = COALESCE(p_prazo, prazo),
        progresso = COALESCE(p_progresso, progresso),
        version = version + 1
    WHERE id = p_task_id AND version = p_client_version
      AND (assigned_user_id = auth.uid() OR criado_por = auth.uid())
    RETURNING * INTO v_task;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'CONFLITO_VERSAO: a tarefa % foi alterada por outra sessão. Recarregue antes de tentar de novo.', p_task_id;
    END IF;
    RETURN v_task;
END;
$$;

-- Transições válidas calculadas no servidor — o frontend só apresenta os
-- botões correspondentes ao estado atual, mas não pode forçar uma
-- transição fora deste grafo.
CREATE OR REPLACE FUNCTION fn_transicionar_tarefa(p_task_id BIGINT, p_novo_status TEXT, p_client_version INT)
RETURNS tasks
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_task tasks;
    v_status_atual TEXT;
    v_transicoes_validas TEXT[];
BEGIN
    SELECT status INTO v_status_atual FROM tasks WHERE id = p_task_id;
    IF v_status_atual IS NULL THEN
        RAISE EXCEPTION 'Tarefa % não encontrada.', p_task_id;
    END IF;

    v_transicoes_validas := CASE v_status_atual
        WHEN 'A_FAZER'      THEN ARRAY['EM_ANDAMENTO']
        WHEN 'EM_ANDAMENTO' THEN ARRAY['A_FAZER', 'AGUARDANDO', 'CONCLUIDO']
        WHEN 'AGUARDANDO'   THEN ARRAY['EM_ANDAMENTO', 'CONCLUIDO']
        WHEN 'CONCLUIDO'    THEN ARRAY['EM_ANDAMENTO']
        ELSE ARRAY[]::TEXT[]
    END;

    IF NOT (p_novo_status = ANY(v_transicoes_validas)) THEN
        RAISE EXCEPTION 'Transição inválida: % -> %.', v_status_atual, p_novo_status;
    END IF;

    UPDATE tasks SET
        status = p_novo_status,
        version = version + 1,
        concluido_em = CASE WHEN p_novo_status = 'CONCLUIDO' THEN now() ELSE NULL END
    WHERE id = p_task_id AND version = p_client_version
      AND (assigned_user_id = auth.uid() OR criado_por = auth.uid())
    RETURNING * INTO v_task;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'CONFLITO_VERSAO: a tarefa % foi alterada por outra sessão. Recarregue antes de tentar de novo.', p_task_id;
    END IF;

    INSERT INTO task_history (task_id, campo, de_valor, para_valor, alterado_por)
    VALUES (p_task_id, 'status', v_status_atual, p_novo_status, auth.uid());

    RETURN v_task;
END;
$$;

CREATE OR REPLACE FUNCTION fn_marcar_notificacao_lida(p_notification_id BIGINT)
RETURNS notifications
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_notificacao notifications;
BEGIN
    UPDATE notifications SET lida_em = now()
    WHERE id = p_notification_id AND destinatario_user_id = auth.uid() AND lida_em IS NULL
    RETURNING * INTO v_notificacao;
    RETURN v_notificacao;
END;
$$;

CREATE OR REPLACE FUNCTION fn_marcar_todas_notificacoes_lidas()
RETURNS INT
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_linhas INT;
BEGIN
    UPDATE notifications SET lida_em = now()
    WHERE destinatario_user_id = auth.uid() AND lida_em IS NULL;
    GET DIAGNOSTICS v_linhas = ROW_COUNT;
    RETURN v_linhas;
END;
$$;

NOTIFY pgrst, 'reload schema';

-- Conferência:
--   SELECT * FROM tasks; SELECT * FROM notifications;
--   SELECT fn_usuario_tem_atividade('meu_trabalho');  -- rodar autenticado como o usuário de teste
-- =========================================================================
