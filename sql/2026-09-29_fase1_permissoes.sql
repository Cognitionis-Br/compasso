-- ==========================================================================
-- Fase 1 — D-11: catalogo_atividades para os novos tabs de fila por etapa
--           e concede permissão a todas as funções existentes (mesma
--           lógica do sql/2026-09-23_r3_catalogo.sql)
-- ==========================================================================

-- Inserir novas atividades (idempotente)
INSERT INTO catalogo_atividades (grupo, subgrupo, atividade, activity_key, restricao_area, ordem)
SELECT 'GESTÃO E GOVERNANÇA', 'Projetos', 'Fila — Requerimentos', 'projetos_requerimentos', false, 20
WHERE NOT EXISTS (SELECT 1 FROM catalogo_atividades WHERE activity_key = 'projetos_requerimentos');

INSERT INTO catalogo_atividades (grupo, subgrupo, atividade, activity_key, restricao_area, ordem)
SELECT 'GESTÃO E GOVERNANÇA', 'Projetos', 'Fila — Especificação', 'projetos_especificacao', false, 21
WHERE NOT EXISTS (SELECT 1 FROM catalogo_atividades WHERE activity_key = 'projetos_especificacao');

INSERT INTO catalogo_atividades (grupo, subgrupo, atividade, activity_key, restricao_area, ordem)
SELECT 'GESTÃO E GOVERNANÇA', 'Projetos', 'Fila — Execução', 'projetos_execucao', false, 22
WHERE NOT EXISTS (SELECT 1 FROM catalogo_atividades WHERE activity_key = 'projetos_execucao');

INSERT INTO catalogo_atividades (grupo, subgrupo, atividade, activity_key, restricao_area, ordem)
SELECT 'GESTÃO E GOVERNANÇA', 'Projetos', 'Fila — UAT', 'projetos_uat', false, 23
WHERE NOT EXISTS (SELECT 1 FROM catalogo_atividades WHERE activity_key = 'projetos_uat');

INSERT INTO catalogo_atividades (grupo, subgrupo, atividade, activity_key, restricao_area, ordem)
SELECT 'GESTÃO E GOVERNANÇA', 'Projetos', 'Fila — Go Live', 'projetos_golive', false, 24
WHERE NOT EXISTS (SELECT 1 FROM catalogo_atividades WHERE activity_key = 'projetos_golive');

INSERT INTO catalogo_atividades (grupo, subgrupo, atividade, activity_key, restricao_area, ordem)
SELECT 'GESTÃO E GOVERNANÇA', 'Projetos', 'Fila — Encerramento', 'projetos_encerramento', false, 25
WHERE NOT EXISTS (SELECT 1 FROM catalogo_atividades WHERE activity_key = 'projetos_encerramento');

INSERT INTO catalogo_atividades (grupo, subgrupo, atividade, activity_key, restricao_area, ordem)
SELECT 'GESTÃO E GOVERNANÇA', 'Projetos', 'Base de Conhecimento', 'conhecimento', false, 30
WHERE NOT EXISTS (SELECT 1 FROM catalogo_atividades WHERE activity_key = 'conhecimento');

-- Conceder leitura a todas as funções existentes (idempotente)
INSERT INTO funcao_atividades (funcao_id, atividade_id, pode_consultar, pode_incluir, pode_alterar, pode_deletar)
SELECT f.id, ca.id, true, false, false, false
FROM funcoes f
CROSS JOIN catalogo_atividades ca
WHERE ca.activity_key IN (
    'projetos_requerimentos', 'projetos_especificacao', 'projetos_execucao',
    'projetos_uat', 'projetos_golive', 'projetos_encerramento', 'conhecimento'
)
AND NOT EXISTS (
    SELECT 1 FROM funcao_atividades fa
    WHERE fa.funcao_id = f.id AND fa.atividade_id = ca.id
);
