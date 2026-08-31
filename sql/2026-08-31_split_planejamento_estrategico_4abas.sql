-- =========================================================================
-- 2026-08-31_split_planejamento_estrategico_4abas.sql
-- Compasso — SÓ Compasso, não roda contra a base do Compasso.
--
-- NOVO (a pedido do usuário): a tela Planejamento Estratégico deixa de ter
-- 2 sub-abas (Pilares / Iniciativas) e passa a ter 4 — Cadastrar +
-- Cadastrados pra cada uma:
--
--   planejamento_estrategico:pilares      -> :pilares_criar / :pilares_cadastrados
--   planejamento_estrategico:iniciativas  -> :iniciativas_criar / :iniciativas_cadastrados
--
-- A linha antiga de cada sub-área é RENOMEADA pra "..._criar" (preserva o
-- id, então quem já podia cadastrar continua podendo). A "..._cadastrados"
-- é criada nova e concedida às MESMAS funções que têm a "..._criar".
--
-- Idempotente. Rode no Supabase → SQL Editor (projeto fytynjjvzecljmgbtwec).
-- Complementa 2026-08-31_split_parametros_cadastros_2abas.sql.
-- =========================================================================

-- 1) Renomeia as atividades antigas -> "..._criar" (só age se existirem).
UPDATE catalogo_atividades SET activity_key = 'planejamento_estrategico:pilares_criar',
       atividade = 'Cadastrar Pilares Estratégicos'
 WHERE activity_key = 'planejamento_estrategico:pilares';
UPDATE catalogo_atividades SET activity_key = 'planejamento_estrategico:iniciativas_criar',
       atividade = 'Cadastrar Iniciativas Estratégicas'
 WHERE activity_key = 'planejamento_estrategico:iniciativas';

-- 2) Cria as atividades "..._cadastrados" (mesmo grupo/função/ordem).
INSERT INTO catalogo_atividades (grupo_funcao, funcao, atividade, activity_key, restricao_area, ordem)
SELECT grupo_funcao, funcao, 'Pilares Estratégicos Cadastrados',
       'planejamento_estrategico:pilares_cadastrados', false, ordem
FROM catalogo_atividades WHERE activity_key = 'planejamento_estrategico:pilares_criar'
  AND NOT EXISTS (SELECT 1 FROM catalogo_atividades
                  WHERE activity_key = 'planejamento_estrategico:pilares_cadastrados');

INSERT INTO catalogo_atividades (grupo_funcao, funcao, atividade, activity_key, restricao_area, ordem)
SELECT grupo_funcao, funcao, 'Iniciativas Estratégicas Cadastradas',
       'planejamento_estrategico:iniciativas_cadastrados', false, ordem
FROM catalogo_atividades WHERE activity_key = 'planejamento_estrategico:iniciativas_criar'
  AND NOT EXISTS (SELECT 1 FROM catalogo_atividades
                  WHERE activity_key = 'planejamento_estrategico:iniciativas_cadastrados');

-- 3) Concede "..._cadastrados" a toda função que já tem a "..._criar"
--    correspondente (funções com acesso_irrestrito ignoram o catálogo).
INSERT INTO funcao_atividades (funcao_id, atividade_id)
SELECT fa.funcao_id, novo.id
FROM funcao_atividades fa
JOIN catalogo_atividades cri  ON cri.id = fa.atividade_id
JOIN catalogo_atividades novo ON novo.activity_key = replace(cri.activity_key, '_criar', '_cadastrados')
WHERE cri.activity_key IN (
        'planejamento_estrategico:pilares_criar',
        'planejamento_estrategico:iniciativas_criar')
  AND NOT EXISTS (
        SELECT 1 FROM funcao_atividades f2
        WHERE f2.funcao_id = fa.funcao_id AND f2.atividade_id = novo.id);

NOTIFY pgrst, 'reload schema';

-- Conferência (opcional):
--   SELECT activity_key, atividade, ordem FROM catalogo_atividades
--   WHERE activity_key LIKE 'planejamento_estrategico:%' ORDER BY ordem, activity_key;
-- =========================================================================
