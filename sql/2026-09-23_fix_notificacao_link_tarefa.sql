-- =========================================================================
-- 2026-09-23_fix_notificacao_link_tarefa.sql
-- Compasso — SÓ Compasso.
--
-- CORREÇÃO: a notificação de menção (fn_trg_notificar_mencao,
-- sql/2026-09-23_r2_colaboracao_tarefas.sql) só guardava link_tab
-- ('meu_trabalho') — ao clicar, o usuário só caía na tela geral de Meu
-- Trabalho, sem abrir a tarefa/comentário de verdade (bug reportado:
-- "ao clicar na notificação não traz o comentário").
--
-- Adiciona notifications.link_task_id — a notificação de menção passa a
-- guardar QUAL tarefa, e o front (js/notificacoes/notificacoes.js) abre
-- direto o Workspace do projeto (ou Meu Trabalho, se a tarefa não tiver
-- projeto) já com o Drawer daquela tarefa aberto.
--
-- Idempotente.
-- =========================================================================

ALTER TABLE notifications ADD COLUMN IF NOT EXISTS link_task_id BIGINT REFERENCES tasks(id);

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
        INSERT INTO notifications (destinatario_user_id, tipo, titulo, link_tab, link_codigo_projeto, link_task_id)
        VALUES (NEW.mentioned_user_id, 'MENCAO', 'Você foi mencionado em: ' || COALESCE(v_titulo, 'uma tarefa'), 'meu_trabalho', v_projeto_codigo, v_task_id);
    END IF;
    RETURN NEW;
END;
$$;

NOTIFY pgrst, 'reload schema';

-- Conferência:
--   SELECT id, tipo, link_task_id, link_codigo_projeto FROM notifications WHERE tipo = 'MENCAO' ORDER BY criado_em DESC LIMIT 5;
-- =========================================================================
