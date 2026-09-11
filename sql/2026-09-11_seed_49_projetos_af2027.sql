-- =========================================================================
-- 2026-09-11_seed_49_projetos_af2027.sql
-- Compasso — projeto Supabase fytynjjvzecljmgbtwec.
--
-- Substitui "sql/2026-09-02_seed_49_projetos_teste CARGA DE 49 PROJETOS
-- PARA TESTES.sql". Aquele script fazia 1 INSERT gigante (49 linhas x
-- ~170 colunas) chumbando: nomes de área, produto_id 2/3/4/5,
-- tipo_projeto_id 3, pilar_estrategico_id 6 e iniciativa_estrategica_id 26
-- — se qualquer um desses ids não existir mais no cadastro atual (produto
-- recriado, pilar/iniciativa mudou), o INSERT inteiro falha por violação
-- de chave estrangeira, ou (pior, se não houver FK) grava referências
-- mortas que aparecem em branco/"#id" nas telas.
--
-- Este script resolve tudo em runtime a partir do cadastro atual —
-- mesmo padrão de sql/2026-09-10_seed_12_projetos_af2026.sql — e usa só
-- as colunas de `projetos` que o app realmente lê hoje. Muitas colunas do
-- script antigo (responsavel, gp, dt_inicio_prev/termino_prev/inicio_real/
-- termino_real, obs, roi, equipe_ti, aprov_ti_*, aprov_negocio_*, dt_envio_*,
-- dt_limite_technical/execution/uat/golive, etc.) não são lidas por
-- nenhuma tela atual — confirmado por busca no código — e foram
-- deliberadamente OMITIDAS (a tabela pode até ainda ter essas colunas;
-- omitir uma coluna deixa o valor NULL/default, o que é seguro).
--
-- 49 projetos "projeto de testes 0001".."0049", todos:
--   - AF2027 (o AF de pipeline/orçamentação do ambiente de teste)
--   - Business Case, sub_status "A PLANEJAR" (nada orçado ainda)
--   - NÃO Extraordinário, NÃO Carryover, NÃO Cancelado
--   - produto sempre um produto ATIVO real (nunca NAO_CLASSIFICADO)
--   - área + pessoa solicitante sempre um par real e coerente
--   - códigos PRJ-FY27-501-<mnem> .. PRJ-FY27-549-<mnem> (faixa 5xx, não
--     colide com a numeração que a RPC gera para demandas reais de AF2027)
--
-- Se faltar cadastro essencial (nenhuma área com pessoa, nenhum produto
-- ativo, nenhum tipo de projeto ativo), o script ABORTA com mensagem
-- dizendo o quê, em vez de gravar dado inconsistente.
--
-- Idempotente (NOT EXISTS por código). Supabase -> SQL Editor.
-- =========================================================================

DO $$
DECLARE
    v_areas    TEXT[];    -- áreas ativas COM pessoa solicitante ativa
    v_prods    BIGINT[];  -- produtos ativos (fora NAO_CLASSIFICADO)
    v_pilares  BIGINT[];  -- pilares AF2027 ativos
    v_tipo_id  BIGINT;
    v_tipo_cod TEXT;

    i          INT;
    v_area     TEXT;
    v_mnem     TEXT;
    v_pessoa   TEXT;
    v_prod     BIGINT;
    v_pilar    BIGINT;
    v_ini      BIGINT;
    v_codigo   TEXT;
BEGIN
    v_areas := ARRAY(
        SELECT DISTINCT upper(a.nome)
        FROM areas_solicitantes a
        WHERE a.ativo IS NOT FALSE
          AND EXISTS (SELECT 1 FROM pessoas_solicitantes p
                      WHERE upper(p.area) = upper(a.nome) AND p.ativo IS NOT FALSE)
        ORDER BY 1
    );
    IF array_length(v_areas, 1) IS NULL THEN
        RAISE EXCEPTION 'Nenhuma área ativa com pessoa solicitante ativa — cadastre Áreas e Pessoas Solicitantes antes.';
    END IF;

    v_prods := ARRAY(
        SELECT id FROM produtos
        WHERE ativo IS NOT FALSE AND codigo <> 'NAO_CLASSIFICADO'
        ORDER BY codigo
    );
    IF array_length(v_prods, 1) IS NULL THEN
        RAISE EXCEPTION 'Nenhum produto ativo (fora NAO_CLASSIFICADO) — cadastre Produtos antes.';
    END IF;

    SELECT id, codigo INTO v_tipo_id, v_tipo_cod
    FROM tipos_projeto WHERE ativo IS NOT FALSE ORDER BY codigo LIMIT 1;
    IF v_tipo_id IS NULL THEN
        RAISE EXCEPTION 'Nenhum tipo de projeto ativo — cadastre Tipos de Projeto antes.';
    END IF;

    v_pilares := ARRAY(
        SELECT id FROM pilares_estrategicos
        WHERE ano_fiscal = 'AF2027' AND ativo IS NOT FALSE ORDER BY nome
    );

    FOR i IN 1..49 LOOP
        v_area := v_areas[((i - 1) % array_length(v_areas, 1)) + 1];
        v_mnem := upper(COALESCE((SELECT mnemonico FROM areas_solicitantes WHERE upper(nome) = v_area LIMIT 1), ''));
        IF v_mnem = '' THEN v_mnem := 'DEV'; END IF;

        -- dentro da mesma área, alterna entre as pessoas cadastradas
        -- (mesma lógica de pareamento do script original — 2+ pessoas por
        -- área evita repetir sempre a mesma).
        SELECT nome INTO v_pessoa FROM (
            SELECT nome, row_number() OVER (ORDER BY nome) AS rn,
                   count(*) OVER () AS qtd
            FROM pessoas_solicitantes WHERE upper(area) = v_area AND ativo IS NOT FALSE
        ) x WHERE rn = ((i - 1) % qtd) + 1;

        v_prod := v_prods[((i - 1) % array_length(v_prods, 1)) + 1];

        IF array_length(v_pilares, 1) IS NULL THEN
            v_pilar := NULL; v_ini := NULL;
        ELSE
            v_pilar := v_pilares[((i - 1) % array_length(v_pilares, 1)) + 1];
            SELECT id INTO v_ini FROM iniciativas_estrategicas
            WHERE pilar_id = v_pilar AND ativo IS NOT FALSE ORDER BY id LIMIT 1;
        END IF;

        v_codigo := 'PRJ-FY27-5' || lpad(i::text, 2, '0') || '-' || v_mnem;

        IF NOT EXISTS (SELECT 1 FROM projetos WHERE codigo = v_codigo) THEN
            INSERT INTO projetos (
                codigo, nome, ano_fiscal, area, pessoa_solicitante, data_solicitacao,
                tipo_projeto, tipo_projeto_id, produto_id, tipo_orcamento, tipo_qualificacao, tamanho,
                status, situacao_ativo, etapa_atual, sub_status, status_orcamento, orcamento_aprovado,
                status_comite,
                val_bc, val_req, val_tech, horas_bc, horas_req, horas_tech, previsto, realizado,
                orcamento_adicional, projecao_novo_af, ciclo_mtbp, qtd_reprovacoes, bloqueado_mudanca_orcamento,
                descricao_projeto, objetivo, key_results,
                pilar_estrategico_id, iniciativa_estrategica_id,
                is_adhoc, is_subprojeto, projeto_concluido,
                is_carry_over, is_carryover
            ) VALUES (
                v_codigo, 'projeto de testes ' || lpad(i::text, 4, '0'), 'AF2027', v_area, v_pessoa, DATE '2026-09-01',
                v_tipo_cod, v_tipo_id, v_prod, 'CAPEX', 'GROW', 'M',
                'EM ANDAMENTO', 'ATIVO', 'BUSINESS CASE', 'A PLANEJAR', 'A APROVAR', 'NÃO',
                'PENDENTE',
                0, 0, 0, 0, 0, 0, 0, 0,
                0, 0, 'SIM', 0, false,
                'Projeto de carga para testes.', 'testar o sistema', 'reduzir a jornada',
                v_pilar, v_ini,
                false, false, false,
                false, false
            );
        END IF;
    END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';

-- Conferência:
--   SELECT codigo, nome, area, pessoa_solicitante, produto_id, tipo_projeto_id,
--          pilar_estrategico_id, etapa_atual, sub_status, is_adhoc, is_carryover
--   FROM projetos WHERE nome ILIKE 'projeto de testes %' ORDER BY nome;
--
--   SELECT count(*) FROM projetos WHERE nome ILIKE 'projeto de testes %'; -- deve dar 49
-- =========================================================================
