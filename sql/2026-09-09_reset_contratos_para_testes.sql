-- =========================================================================
-- 2026-09-09_reset_contratos_para_testes.sql   (Release 1 — FERRAMENTA DE TESTE)
-- Compasso — projeto Supabase fytynjjvzecljmgbtwec.
--
-- Zera TODO o módulo "Contratos e Fornecedores" para uma nova rodada de
-- testes, SEM tocar em projetos, etapas ou no cadastro de Fornecedores
-- (empresas_terceirizadas). Equivale ao botão "Zerar Contratos e
-- Fornecedores" em Ferramentas de Dev, mas roda direto no SQL Editor
-- (não depende de deploy).
--
-- NÃO é idempotente no sentido de dados (apaga o que houver), mas pode
-- rodar quantas vezes quiser. Ordem via TRUNCATE ... CASCADE.
--
-- ⚠️ AÇÃO DESTRUTIVA E IRREVERSÍVEL. Rode só em ambiente de teste.
-- =========================================================================

BEGIN;

TRUNCATE TABLE
    contratos_pagamentos_anexos,
    contratos_pagamento_itens,
    contratos_pagamentos,
    contratos_pendencias_anexos,
    contratos_pendencias_itens,
    log_contratos_pendencias,
    contratos_pendencias,
    contratos_propostas,
    log_alteracao_vinculo_contrato,
    contratos_vinculos_projeto,
    contratos_projeto,
    contadores_contrato_af
RESTART IDENTITY CASCADE;

-- "realizado" de cada projeto volta a ser só o gasto das etapas
-- (sem nenhum vínculo de contrato).
UPDATE projetos p
   SET realizado = COALESCE((
       SELECT SUM(e.valor_gasto_execucao)
       FROM projeto_etapas e
       WHERE e.projeto_codigo = p.codigo
   ), 0);

COMMIT;

-- -------------------------------------------------------------------------
-- Anexos no Storage (bucket contratos-anexos): a limpeza dos ARQUIVOS em
-- si é feita pela API (botão em Ferramentas de Dev, ou manualmente no
-- Dashboard → Storage). A linha abaixo só remove as REFERÊNCIAS em
-- storage.objects — descomente se o seu projeto permitir DML nessa tabela
-- pelo SQL Editor (alguns retornam "must be owner of table objects").
-- -------------------------------------------------------------------------
-- DELETE FROM storage.objects WHERE bucket_id = 'contratos-anexos';

NOTIFY pgrst, 'reload schema';

-- Conferência:
--   SELECT
--     (SELECT count(*) FROM contratos_projeto)            AS contratos,
--     (SELECT count(*) FROM contratos_vinculos_projeto)   AS vinculos,
--     (SELECT count(*) FROM contratos_pendencias)         AS pendencias,
--     (SELECT count(*) FROM contratos_pagamentos)         AS pagamentos,
--     (SELECT count(*) FROM empresas_terceirizadas)       AS fornecedores_mantidos;
-- =========================================================================
