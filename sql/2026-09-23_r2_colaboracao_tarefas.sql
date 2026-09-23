-- =========================================================================
-- 2026-09-23_r2_colaboracao_tarefas.sql
-- Compasso 2.0 — Release 2 (Workspace Colaborativo do Projeto).
-- SÓ Compasso (projeto Supabase fytynjjvzecljmgbtwec).
--
-- Evolui a tabela `tasks` do Release 1 com checklist, comentários,
-- anexos, dependências e menções, e cria o repositório geral de
-- documentos do projeto (project_documents/versions) — ver o plano
-- aprovado na sessão.
--
-- Introduz fn_usuario_tem_acesso_projeto: "este usuário vê este
-- projeto?" no servidor — espelha a MESMA regra de
-- filtrarProjetosPorArea() (js/config/funcoes.js:756), só a parte de
-- OPERADOR/responsavel_etapa (a única que hoje de fato restringe
-- visibilidade de projeto por usuário). Necessário porque agora
-- precisamos checar o acesso de OUTRO usuário (o mencionado num
-- comentário), não só do usuário logado.
--
-- Idempotente.
-- =========================================================================

CREATE OR REPLACE FUNCTION fn_usuario_tem_acesso_projeto(p_projeto_codigo TEXT, p_usuario_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_restrito BOOLEAN;
BEGIN
    -- Admin/Proprietário (via funcoes.acesso_irrestrito/eh_proprietario) sempre veem tudo.
    IF EXISTS (
        SELECT 1 FROM usuario_funcoes uf JOIN funcoes f ON f.id = uf.funcao_id
        WHERE uf.usuario_id = p_usuario_id AND (f.acesso_irrestrito = true OR f.eh_proprietario = true)
    ) THEN
        RETURN true;
    END IF;

    -- Só restringe se alguma função do usuário tiver restringe_por_atividade_responsavel.
    SELECT EXISTS (
        SELECT 1 FROM usuario_funcoes uf JOIN funcoes f ON f.id = uf.funcao_id
        WHERE uf.usuario_id = p_usuario_id AND f.restringe_por_atividade_responsavel = true
    ) INTO v_restrito;

    IF NOT v_restrito THEN
        RETURN true;
    END IF;

    -- auth.users (não perfis_usuarios) porque o e-mail de login é sempre
    -- o de auth.users — perfis_usuarios não tem coluna email própria.
    RETURN EXISTS (
        SELECT 1 FROM projeto_etapas pe
        JOIN auth.users u ON u.id = p_usuario_id
        WHERE pe.projeto_codigo = p_projeto_codigo
          AND lower(pe.responsavel_etapa_email) = lower(u.email)
    );
END;
$$;

-- -------------------------------------------------------------------------
-- Tabelas novas
-- -------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS task_checklist_items (
    id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    task_id      BIGINT NOT NULL REFERENCES tasks(id),
    texto        TEXT NOT NULL,
    concluido    BOOLEAN NOT NULL DEFAULT false,
    ordem        INT NOT NULL DEFAULT 0,
    criado_em    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS task_comments (
    id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    task_id      BIGINT NOT NULL REFERENCES tasks(id),
    autor_id     UUID REFERENCES auth.users(id),
    conteudo     TEXT NOT NULL,
    criado_em    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS task_mentions (
    id                   BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    task_comment_id      BIGINT NOT NULL REFERENCES task_comments(id),
    mentioned_user_id    UUID NOT NULL REFERENCES auth.users(id),
    criado_em            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS task_attachments (
    id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    task_id          BIGINT NOT NULL REFERENCES tasks(id),
    storage_path     TEXT NOT NULL,
    nome_original    TEXT NOT NULL,
    tipo_mime        TEXT,
    tamanho_bytes    BIGINT,
    enviado_por      UUID REFERENCES auth.users(id),
    enviado_em       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS task_dependencies (
    id                    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    task_id               BIGINT NOT NULL REFERENCES tasks(id),
    depende_de_task_id    BIGINT NOT NULL REFERENCES tasks(id),
    criado_em             TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (task_id, depende_de_task_id),
    CHECK (task_id <> depende_de_task_id)
);

CREATE TABLE IF NOT EXISTS project_documents (
    id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    projeto_codigo    TEXT NOT NULL REFERENCES projetos(codigo),
    titulo            TEXT NOT NULL,
    criado_por        UUID REFERENCES auth.users(id),
    criado_em         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS project_document_versions (
    id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    document_id      BIGINT NOT NULL REFERENCES project_documents(id),
    versao           INT NOT NULL,
    storage_path     TEXT NOT NULL,
    nome_original    TEXT NOT NULL,
    tamanho_bytes    BIGINT,
    enviado_por      UUID REFERENCES auth.users(id),
    enviado_em       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE task_checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_mentions ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_dependencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_document_versions ENABLE ROW LEVEL SECURITY;

-- -------------------------------------------------------------------------
-- RLS — dono da tarefa-pai OU quem tem acesso ao projeto da tarefa pode
-- ler/escrever (colaboração dentro do projeto); leitura de anexo/checklist
-- de tarefa sem projeto (tarefa pessoal) continua só pro dono.
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_usuario_pode_ver_tarefa(p_task_id BIGINT)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT EXISTS (
        SELECT 1 FROM tasks t
        WHERE t.id = p_task_id
          AND (t.assigned_user_id = auth.uid() OR t.criado_por = auth.uid()
               OR (t.projeto_codigo IS NOT NULL AND fn_usuario_tem_acesso_projeto(t.projeto_codigo)))
    );
$$;

DROP POLICY IF EXISTS task_checklist_acesso ON task_checklist_items;
CREATE POLICY task_checklist_acesso ON task_checklist_items FOR ALL
    USING (fn_usuario_pode_ver_tarefa(task_id)) WITH CHECK (fn_usuario_pode_ver_tarefa(task_id));

DROP POLICY IF EXISTS task_comments_acesso ON task_comments;
CREATE POLICY task_comments_acesso ON task_comments FOR ALL
    USING (fn_usuario_pode_ver_tarefa(task_id)) WITH CHECK (fn_usuario_pode_ver_tarefa(task_id));

DROP POLICY IF EXISTS task_mentions_acesso ON task_mentions;
CREATE POLICY task_mentions_acesso ON task_mentions FOR ALL
    USING (mentioned_user_id = auth.uid() OR EXISTS (SELECT 1 FROM task_comments c WHERE c.id = task_comment_id AND fn_usuario_pode_ver_tarefa(c.task_id)))
    WITH CHECK (EXISTS (SELECT 1 FROM task_comments c WHERE c.id = task_comment_id AND fn_usuario_pode_ver_tarefa(c.task_id)));

DROP POLICY IF EXISTS task_attachments_acesso ON task_attachments;
CREATE POLICY task_attachments_acesso ON task_attachments FOR ALL
    USING (fn_usuario_pode_ver_tarefa(task_id)) WITH CHECK (fn_usuario_pode_ver_tarefa(task_id));

DROP POLICY IF EXISTS task_dependencies_acesso ON task_dependencies;
CREATE POLICY task_dependencies_acesso ON task_dependencies FOR ALL
    USING (fn_usuario_pode_ver_tarefa(task_id)) WITH CHECK (fn_usuario_pode_ver_tarefa(task_id));

DROP POLICY IF EXISTS project_documents_acesso ON project_documents;
CREATE POLICY project_documents_acesso ON project_documents FOR ALL
    USING (fn_usuario_tem_acesso_projeto(projeto_codigo)) WITH CHECK (fn_usuario_tem_acesso_projeto(projeto_codigo));

DROP POLICY IF EXISTS project_document_versions_acesso ON project_document_versions;
CREATE POLICY project_document_versions_acesso ON project_document_versions FOR ALL
    USING (EXISTS (SELECT 1 FROM project_documents d WHERE d.id = document_id AND fn_usuario_tem_acesso_projeto(d.projeto_codigo)))
    WITH CHECK (EXISTS (SELECT 1 FROM project_documents d WHERE d.id = document_id AND fn_usuario_tem_acesso_projeto(d.projeto_codigo)));

-- NOVO: agora que tarefas de projeto são colaborativas, a policy de
-- leitura de `tasks` (Release 1) precisa incluir quem tem acesso ao
-- projeto, não só o dono — mutação continua só pra dono (RPCs do R1 já
-- checam assigned_user_id/criado_por no WHERE, então ficam inalteradas).
DROP POLICY IF EXISTS tasks_dono ON tasks;
CREATE POLICY tasks_leitura ON tasks FOR SELECT
    USING (assigned_user_id = auth.uid() OR criado_por = auth.uid()
           OR (projeto_codigo IS NOT NULL AND fn_usuario_tem_acesso_projeto(projeto_codigo)));
CREATE POLICY tasks_escrita ON tasks FOR INSERT WITH CHECK (assigned_user_id = auth.uid() OR criado_por = auth.uid());
CREATE POLICY tasks_atualizacao ON tasks FOR UPDATE
    USING (assigned_user_id = auth.uid() OR criado_por = auth.uid())
    WITH CHECK (assigned_user_id = auth.uid() OR criado_por = auth.uid());
CREATE POLICY tasks_delecao ON tasks FOR DELETE USING (assigned_user_id = auth.uid() OR criado_por = auth.uid());

-- -------------------------------------------------------------------------
-- Trigger de menção — só cria notificação se o mencionado tiver acesso ao
-- projeto da tarefa (evita vazar menção pra fora do escopo).
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_trg_notificar_mencao()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_task_id BIGINT;
    v_projeto_codigo TEXT;
    v_titulo TEXT;
BEGIN
    SELECT c.task_id, t.projeto_codigo, t.titulo INTO v_task_id, v_projeto_codigo, v_titulo
    FROM task_comments c JOIN tasks t ON t.id = c.task_id
    WHERE c.id = NEW.task_comment_id;

    IF v_projeto_codigo IS NULL OR fn_usuario_tem_acesso_projeto(v_projeto_codigo, NEW.mentioned_user_id) THEN
        INSERT INTO notifications (destinatario_user_id, tipo, titulo, link_tab, link_codigo_projeto)
        VALUES (NEW.mentioned_user_id, 'MENCAO', 'Você foi mencionado em: ' || COALESCE(v_titulo, 'uma tarefa'), 'meu_trabalho', v_projeto_codigo);
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notificar_mencao ON task_mentions;
CREATE TRIGGER trg_notificar_mencao AFTER INSERT ON task_mentions
    FOR EACH ROW EXECUTE FUNCTION fn_trg_notificar_mencao();

-- -------------------------------------------------------------------------
-- fn_transicionar_tarefa (Release 1) ganha checagem de dependência:
-- recusa concluir se alguma tarefa da qual esta depende ainda não está
-- concluída.
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_transicionar_tarefa(p_task_id BIGINT, p_novo_status TEXT, p_client_version INT)
RETURNS tasks
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_task tasks;
    v_status_atual TEXT;
    v_transicoes_validas TEXT[];
    v_pendentes INT;
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

    IF p_novo_status = 'CONCLUIDO' THEN
        SELECT COUNT(*) INTO v_pendentes
        FROM task_dependencies dep
        JOIN tasks dep_task ON dep_task.id = dep.depende_de_task_id
        WHERE dep.task_id = p_task_id AND dep_task.status <> 'CONCLUIDO';
        IF v_pendentes > 0 THEN
            RAISE EXCEPTION 'DEPENDENCIA_PENDENTE: existem % tarefa(s) das quais esta depende ainda não concluídas.', v_pendentes;
        END IF;
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

-- Buckets novos (privados — mesmo padrão de contratos-anexos).
INSERT INTO storage.buckets (id, name, public) VALUES ('task-anexos', 'task-anexos', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('projeto-documentos', 'projeto-documentos', false) ON CONFLICT (id) DO NOTHING;

NOTIFY pgrst, 'reload schema';

-- Conferência:
--   SELECT fn_usuario_tem_acesso_projeto('PRJ-001');
--   SELECT * FROM task_dependencies;
-- =========================================================================
