-- =========================================================================
-- 2026-08-31_split_parametros_cadastros_2abas.sql
-- Compasso — SÓ Compasso, não roda contra a base do Compasso.
--
-- NOVO (a pedido do usuário): padroniza 5 telas de "Parâmetros e Cadastros"
-- no mesmo modelo de 2 abas das demais telas (Usuários, Funções, Cargos,
-- Empresas Terceirizadas...) — uma aba pra Cadastrar, outra pra consultar
-- os Cadastrados. No catálogo de RBAC (catalogo_atividades) cada uma das 5
-- vira DUAS atividades: "<x>:criar" e "<x>:cadastrados", liberáveis
-- separadamente por função.
--
--   areas               -> areas:criar / areas:cadastrados
--   pessoas_solicitantes -> pessoas_solicitantes:criar / :cadastrados
--   portes              -> portes:criar / portes:cadastrados
--   tipos_projeto       -> tipos_projeto:criar / tipos_projeto:cadastrados
--   return_benefit      -> return_benefit:criar / return_benefit:cadastrados
--
-- A linha antiga de cada tela é RENOMEADA pra "<x>:criar" (preserva o id,
-- então as funções que já tinham acesso à tela continuam podendo
-- cadastrar). A "<x>:cadastrados" é criada nova e concedida às MESMAS
-- funções que têm a "<x>:criar" — ninguém perde acesso.
--
-- Idempotente — pode rodar mais de uma vez sem erro.
-- Rode no Supabase → SQL Editor (projeto fytynjjvzecljmgbtwec).
-- =========================================================================

-- ---------------------------------------------------------------------------
-- 1) Renomeia a atividade única -> "<x>:criar" (só age se a antiga existir).
-- ---------------------------------------------------------------------------
UPDATE catalogo_atividades SET activity_key = 'areas:criar',
       atividade = 'Cadastrar Área'                  WHERE activity_key = 'areas';
UPDATE catalogo_atividades SET activity_key = 'pessoas_solicitantes:criar',
       atividade = 'Cadastrar Pessoa Solicitante'    WHERE activity_key = 'pessoas_solicitantes';
UPDATE catalogo_atividades SET activity_key = 'portes:criar',
       atividade = 'Cadastrar Porte'                 WHERE activity_key = 'portes';
UPDATE catalogo_atividades SET activity_key = 'tipos_projeto:criar',
       atividade = 'Cadastrar Tipo de Projeto'       WHERE activity_key = 'tipos_projeto';
UPDATE catalogo_atividades SET activity_key = 'return_benefit:criar',
       atividade = 'Cadastrar Return / Benefit'      WHERE activity_key = 'return_benefit';

-- ---------------------------------------------------------------------------
-- 2) Cria a atividade "<x>:cadastrados" (mesmo grupo/função/ordem da :criar),
--    se ainda não existir.
-- ---------------------------------------------------------------------------
INSERT INTO catalogo_atividades (grupo_funcao, funcao, atividade, activity_key, restricao_area, ordem)
SELECT grupo_funcao, funcao, 'Áreas Cadastradas', 'areas:cadastrados', false, ordem
FROM catalogo_atividades WHERE activity_key = 'areas:criar'
  AND NOT EXISTS (SELECT 1 FROM catalogo_atividades WHERE activity_key = 'areas:cadastrados');

INSERT INTO catalogo_atividades (grupo_funcao, funcao, atividade, activity_key, restricao_area, ordem)
SELECT grupo_funcao, funcao, 'Pessoas Solicitantes Cadastradas', 'pessoas_solicitantes:cadastrados', false, ordem
FROM catalogo_atividades WHERE activity_key = 'pessoas_solicitantes:criar'
  AND NOT EXISTS (SELECT 1 FROM catalogo_atividades WHERE activity_key = 'pessoas_solicitantes:cadastrados');

INSERT INTO catalogo_atividades (grupo_funcao, funcao, atividade, activity_key, restricao_area, ordem)
SELECT grupo_funcao, funcao, 'Portes Cadastrados', 'portes:cadastrados', false, ordem
FROM catalogo_atividades WHERE activity_key = 'portes:criar'
  AND NOT EXISTS (SELECT 1 FROM catalogo_atividades WHERE activity_key = 'portes:cadastrados');

INSERT INTO catalogo_atividades (grupo_funcao, funcao, atividade, activity_key, restricao_area, ordem)
SELECT grupo_funcao, funcao, 'Tipos de Projeto Cadastrados', 'tipos_projeto:cadastrados', false, ordem
FROM catalogo_atividades WHERE activity_key = 'tipos_projeto:criar'
  AND NOT EXISTS (SELECT 1 FROM catalogo_atividades WHERE activity_key = 'tipos_projeto:cadastrados');

INSERT INTO catalogo_atividades (grupo_funcao, funcao, atividade, activity_key, restricao_area, ordem)
SELECT grupo_funcao, funcao, 'Return / Benefit Cadastrados', 'return_benefit:cadastrados', false, ordem
FROM catalogo_atividades WHERE activity_key = 'return_benefit:criar'
  AND NOT EXISTS (SELECT 1 FROM catalogo_atividades WHERE activity_key = 'return_benefit:cadastrados');

-- ---------------------------------------------------------------------------
-- 3) Concede "<x>:cadastrados" a toda função que já tem "<x>:criar"
--    (funções com acesso_irrestrito ignoram o catálogo, não precisam disto).
-- ---------------------------------------------------------------------------
INSERT INTO funcao_atividades (funcao_id, atividade_id)
SELECT fa.funcao_id, novo.id
FROM funcao_atividades fa
JOIN catalogo_atividades cri  ON cri.id = fa.atividade_id
JOIN catalogo_atividades novo ON novo.activity_key = replace(cri.activity_key, ':criar', ':cadastrados')
WHERE cri.activity_key IN (
        'areas:criar', 'pessoas_solicitantes:criar', 'portes:criar',
        'tipos_projeto:criar', 'return_benefit:criar')
  AND NOT EXISTS (
        SELECT 1 FROM funcao_atividades f2
        WHERE f2.funcao_id = fa.funcao_id AND f2.atividade_id = novo.id);

NOTIFY pgrst, 'reload schema';

-- ---------------------------------------------------------------------------
-- Conferência (opcional):
--   SELECT activity_key, grupo_funcao, funcao, atividade, ordem
--   FROM catalogo_atividades
--   WHERE activity_key LIKE 'areas:%' OR activity_key LIKE 'pessoas_solicitantes:%'
--      OR activity_key LIKE 'portes:%' OR activity_key LIKE 'tipos_projeto:%'
--      OR activity_key LIKE 'return_benefit:%'
--   ORDER BY ordem, activity_key;
-- =========================================================================
