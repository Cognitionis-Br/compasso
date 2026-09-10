-- =========================================================================
-- 2026-09-10_seed_12_projetos_af2026.sql
-- Compasso — projeto Supabase fytynjjvzecljmgbtwec.
--
-- Substitui sql/2026-09-02_seed_12_projetos_carryover_af2026.sql.
--
-- Carga de 12 projetos do Ano Fiscal 2026, EM ANDAMENTO e NÃO marcados
-- como Carryover — para exercitar o processo (marcar carryover / cancelar
-- / tratar na virada do AF) e as telas de portfólio.
--
-- DIFERENÇA para a versão anterior: NÃO chumba mais nomes de área, pessoa
-- solicitante, produto_id, nome de pilar, tipo de projeto, porte nem id de
-- etapa. Tudo é resolvido em tempo de execução a partir do conteúdo atual
-- das tabelas de cadastro/parâmetros. Roda em qualquer base que tenha:
--   - >= 1 área ativa COM >= 1 pessoa solicitante ativa
--   - >= 1 produto ativo (fora 'NAO_CLASSIFICADO')
--   - >= 1 tipo de projeto ativo
--   - fases_etapas populada (fases de Requerimentos, Especificação,
--     Execução, UAT e Go-Live)
-- Se faltar algo, o script aborta com mensagem explicando o quê.
--
-- Distribuição (soma 12):
--   03 -> fase de Requerimentos, "A PLANEJAR"      (sem projeto_etapas)
--   02 -> fase de Execução, "A PLANEJAR"           (REQ+ESPEC concluídas)
--   03 -> fase de Execução, "EM ANDAMENTO"         (Execução ~40%)
--   02 -> fase de UAT, "EM ANDAMENTO"              (Execução concluída, UAT ~30%)
--   02 -> fase de Go-Live, "EM ANDAMENTO"          (Exec+UAT concluídas, Go-Live ~20%)
--
-- Códigos: PRJ-FY26-901-<mnem> .. PRJ-FY26-912-<mnem> (faixa 9xx — não
-- colide com a numeração da RPC para demandas reais de AF2026).
--
-- Idempotente (guardas NOT EXISTS / ON CONFLICT DO NOTHING).
-- Supabase -> SQL Editor.
-- =========================================================================

-- Marcador de origem desta carga (usado para localizar/normalizar).
--   projetos.aprovador_nome = 'CARGA 12 AF2026'


-- =========================================================================
-- SEÇÃO 0 — Registro do AF2026 em anos_fiscais_config
--   O seletor de Ano Fiscal do Dashboard / Roadmap / Financeiro / Consulta
--   é montado A PARTIR desta tabela (js/core/filtro-af-visao.js). Sem uma
--   linha para 'AF2026', os 12 projetos existem mas o AF2026 nem aparece
--   como opção. Cria a linha como "Ano Fiscal em andamento" (orçamento
--   fechado, AF ainda não encerrado). Não mexe se já existir.
-- =========================================================================
INSERT INTO anos_fiscais_config (ano_fiscal, orcamento_fechado, recebimento_demandas_aberto, ano_fiscal_fechado)
VALUES ('AF2026', true, false, false)
ON CONFLICT (ano_fiscal) DO NOTHING;


-- =========================================================================
-- SEÇÃO 1 — Pilares e Iniciativas Estratégicas de AF2026
--   Se AF2026 não tiver nenhum pilar, copia os de AF2026 <- AF2027.
--   (Se AF2027 também não tiver, os 12 projetos ficam sem pilar — ok.)
-- =========================================================================
DO $$
DECLARE
    r_pilar   RECORD;
    v_novo_id BIGINT;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pilares_estrategicos WHERE ano_fiscal = 'AF2026' AND ativo IS NOT FALSE) THEN
        FOR r_pilar IN
            SELECT * FROM pilares_estrategicos
            WHERE ano_fiscal = 'AF2027' AND ativo IS NOT FALSE
            ORDER BY nome
        LOOP
            INSERT INTO pilares_estrategicos (ano_fiscal, nome, descricao, ativo, criado_por, criado_em)
            VALUES ('AF2026', r_pilar.nome, r_pilar.descricao, true, 'CARGA 12 AF2026', now())
            RETURNING id INTO v_novo_id;

            INSERT INTO iniciativas_estrategicas (pilar_id, nome, descricao, ativo, criado_por, criado_em)
            SELECT v_novo_id, i.nome, i.descricao, true, 'CARGA 12 AF2026', now()
            FROM iniciativas_estrategicas i
            WHERE i.pilar_id = r_pilar.id AND i.ativo IS NOT FALSE;
        END LOOP;
    END IF;
END $$;


-- =========================================================================
-- SEÇÃO 2 — Os 12 projetos
-- =========================================================================
DO $$
DECLARE
    -- referências resolvidas do cadastro atual
    v_areas      TEXT[];    -- nomes (upper) de áreas ativas COM pessoa ativa
    v_prods      BIGINT[];  -- ids de produtos ativos (fora NAO_CLASSIFICADO)
    v_pilares    BIGINT[];  -- ids de pilares AF2026 ativos
    v_tipo_id    BIGINT;
    v_tipo_cod   TEXT;
    v_fase_req    TEXT;
    v_fase_tech   TEXT;
    v_fase_exec   TEXT;
    v_fase_uat    TEXT;
    v_fase_golive TEXT;

    -- por projeto
    i             INT;
    v_perfil      TEXT;
    v_val_bc      NUMERIC; v_val_req NUMERIC; v_val_tech NUMERIC;
    v_hs_bc       NUMERIC; v_hs_req  NUMERIC; v_hs_tech  NUMERIC;
    v_realizado   NUMERIC;
    v_area        TEXT;
    v_mnem        TEXT;
    v_pessoa      TEXT;
    v_prod        BIGINT;
    v_pilar       BIGINT;
    v_ini         BIGINT;
    v_porte       TEXT;
    v_orc         TEXT;
    v_qual        TEXT;
    v_fase        TEXT;
    v_sub         TEXT;
    v_previsto    NUMERIC;
    v_codigo      TEXT;
BEGIN
    -- ---- resolver cadastros -------------------------------------------------
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
        WHERE ano_fiscal = 'AF2026' AND ativo IS NOT FALSE ORDER BY nome
    );

    v_fase_req    := (SELECT fase FROM fases_etapas WHERE upper(fase) LIKE 'REQ%'                                   AND ativo IS NOT FALSE ORDER BY ordem LIMIT 1);
    v_fase_tech   := (SELECT fase FROM fases_etapas WHERE (upper(fase) LIKE 'TECH%' OR upper(fase) LIKE 'ESPEC%')   AND ativo IS NOT FALSE ORDER BY ordem LIMIT 1);
    v_fase_exec   := (SELECT fase FROM fases_etapas WHERE upper(fase) LIKE 'EXEC%'                                  AND ativo IS NOT FALSE ORDER BY ordem LIMIT 1);
    v_fase_uat    := (SELECT fase FROM fases_etapas WHERE upper(fase) LIKE 'UAT%'                                   AND ativo IS NOT FALSE ORDER BY ordem LIMIT 1);
    v_fase_golive := (SELECT fase FROM fases_etapas WHERE (upper(fase) LIKE 'GO%LIVE%' OR upper(fase) LIKE 'GOLIVE%') AND ativo IS NOT FALSE ORDER BY ordem LIMIT 1);
    IF v_fase_req IS NULL OR v_fase_tech IS NULL OR v_fase_exec IS NULL OR v_fase_uat IS NULL OR v_fase_golive IS NULL THEN
        RAISE EXCEPTION 'fases_etapas incompleta (REQ=% TECH=% EXEC=% UAT=% GOLIVE=%) — rode a carga do motor de workflow antes.',
            v_fase_req, v_fase_tech, v_fase_exec, v_fase_uat, v_fase_golive;
    END IF;

    -- ---- 12 projetos -----------------------------------------------------
    FOR i IN 1..12 LOOP
        -- perfil de fase + valores/horas por slot
        v_perfil := CASE
            WHEN i <= 3  THEN 'REQ_PLAN'
            WHEN i <= 5  THEN 'EXEC_PLAN'
            WHEN i <= 8  THEN 'EXEC_ANDAMENTO'
            WHEN i <= 10 THEN 'UAT'
            ELSE 'GOLIVE'
        END;

        v_val_bc   := 150000 + (i * 12000);
        v_val_req  := CASE WHEN v_perfil = 'REQ_PLAN' THEN 0 ELSE v_val_bc + 15000 END;
        v_val_tech := CASE WHEN v_perfil = 'REQ_PLAN' THEN 0 ELSE v_val_bc + 30000 END;
        v_hs_bc    := v_val_bc  / 500.0;
        v_hs_req   := CASE WHEN v_perfil = 'REQ_PLAN' THEN 0 ELSE v_val_req  / 500.0 END;
        v_hs_tech  := CASE WHEN v_perfil = 'REQ_PLAN' THEN 0 ELSE v_val_tech / 500.0 END;
        v_realizado := CASE v_perfil
            WHEN 'REQ_PLAN'       THEN 0
            WHEN 'EXEC_PLAN'      THEN 0
            WHEN 'EXEC_ANDAMENTO' THEN round(v_val_tech * 0.30)
            WHEN 'UAT'            THEN round(v_val_tech * 0.55)
            ELSE                       round(v_val_tech * 0.80)
        END;

        v_area   := v_areas[((i - 1) % array_length(v_areas, 1)) + 1];
        v_mnem   := upper(COALESCE((SELECT mnemonico FROM areas_solicitantes WHERE upper(nome) = v_area LIMIT 1), ''));
        IF v_mnem = '' THEN v_mnem := 'DEV'; END IF;

        SELECT nome INTO v_pessoa
        FROM pessoas_solicitantes
        WHERE upper(area) = v_area AND ativo IS NOT FALSE
        ORDER BY nome LIMIT 1;

        v_prod  := v_prods[((i - 1) % array_length(v_prods, 1)) + 1];

        IF array_length(v_pilares, 1) IS NULL THEN
            v_pilar := NULL; v_ini := NULL;
        ELSE
            v_pilar := v_pilares[((i - 1) % array_length(v_pilares, 1)) + 1];
            SELECT id INTO v_ini FROM iniciativas_estrategicas
            WHERE pilar_id = v_pilar AND ativo IS NOT FALSE ORDER BY id LIMIT 1;
        END IF;

        v_porte := COALESCE(
            (SELECT codigo FROM portes
             WHERE horas_minimo <= GREATEST(v_hs_bc, v_hs_req, v_hs_tech)
             ORDER BY horas_minimo DESC LIMIT 1),
            (SELECT codigo FROM portes ORDER BY horas_minimo LIMIT 1),
            'M'
        );

        v_orc  := CASE WHEN i % 2 = 0 THEN 'OPEX' ELSE 'CAPEX' END;
        v_qual := (ARRAY['GROW', 'REG', 'RUN'])[((i - 1) % 3) + 1];

        v_fase := CASE v_perfil
            WHEN 'REQ_PLAN'       THEN v_fase_req
            WHEN 'EXEC_PLAN'      THEN v_fase_exec
            WHEN 'EXEC_ANDAMENTO' THEN v_fase_exec
            WHEN 'UAT'            THEN v_fase_uat
            ELSE                       v_fase_golive
        END;
        v_sub := CASE WHEN v_perfil IN ('REQ_PLAN', 'EXEC_PLAN') THEN 'A PLANEJAR' ELSE 'EM ANDAMENTO' END;
        v_previsto := COALESCE(NULLIF(v_val_tech, 0), NULLIF(v_val_req, 0), v_val_bc);

        v_codigo := 'PRJ-FY26-9' || lpad(i::text, 2, '0') || '-' || v_mnem;

        IF NOT EXISTS (SELECT 1 FROM projetos WHERE codigo = v_codigo) THEN
            INSERT INTO projetos (
                codigo, nome, ano_fiscal, area, pessoa_solicitante, data_solicitacao,
                tipo_projeto, tipo_projeto_id, produto_id, tipo_orcamento, tipo_qualificacao, tamanho,
                status, situacao_ativo, etapa_atual, sub_status, status_orcamento, orcamento_aprovado,
                status_comite, dt_comite, dt_aprovacao, aprovador_nome,
                val_bc, val_req, val_tech, horas_bc, horas_req, horas_tech, previsto, realizado,
                orcamento_adicional, projecao_novo_af, ciclo_mtbp, qtd_reprovacoes, bloqueado_mudanca_orcamento,
                descricao_projeto, objetivo, key_results,
                pilar_estrategico_id, iniciativa_estrategica_id,
                is_adhoc, is_subprojeto, projeto_concluido,
                is_carry_over, is_carryover,
                data_solicitacao_req, dt_limite_req, req_concluido_por, req_concluido_em,
                tech_concluido_por, tech_concluido_em
            ) VALUES (
                v_codigo, 'PROJETO 2026 CARGA ' || lpad(i::text, 2, '0'), 'AF2026', v_area, v_pessoa, DATE '2026-04-01',
                v_tipo_cod, v_tipo_id, v_prod, v_orc, v_qual, v_porte,
                'EM ANDAMENTO', 'ATIVO', v_fase, v_sub, 'APROVADO', 'SIM',
                'APROVADO', DATE '2026-04-10', DATE '2026-04-10', 'CARGA 12 AF2026',
                v_val_bc, v_val_req, v_val_tech, v_hs_bc, v_hs_req, v_hs_tech, v_previsto, v_realizado,
                0, 0, 'SIM', 0, false,
                'Projeto de carga para testes (AF2026).',
                'Exercitar carryover, cancelamento e telas de portfólio.',
                'Concluir o ciclo dentro do próximo Ano Fiscal.',
                v_pilar, v_ini,
                false, false, false,
                false, false,
                DATE '2026-04-11',
                DATE '2026-05-05',
                CASE WHEN v_perfil = 'REQ_PLAN' THEN NULL ELSE 'CARGA 12 AF2026' END,
                CASE WHEN v_perfil = 'REQ_PLAN' THEN NULL ELSE DATE '2026-05-15' END,
                CASE WHEN v_perfil = 'REQ_PLAN' THEN NULL ELSE 'CARGA 12 AF2026' END,
                CASE WHEN v_perfil = 'REQ_PLAN' THEN NULL ELSE DATE '2026-06-30' END
            );
        END IF;
    END LOOP;
END $$;

-- Normaliza (caso uma versão anterior tenha marcado carryover): os 12
-- devem estar EM ANDAMENTO e NÃO marcados, para o fluxo de "Marcar
-- Carryover" poder ser exercitado.
UPDATE projetos
SET is_carryover = false, is_carry_over = false, valor_carryover = NULL,
    carryover_marcado_por = NULL, carryover_marcado_em = NULL,
    carryover_etapa_marcacao = NULL, carryover_sub_status_marcacao = NULL
WHERE codigo LIKE 'PRJ-FY26-9%' AND aprovador_nome = 'CARGA 12 AF2026'
  AND is_carryover = true;


-- =========================================================================
-- SEÇÃO 3 — Planejamento de fase (projeto_etapas)
--   REQ + ESPEC concluídas para quem já passou; EXEC/UAT/GO-LIVE conforme
--   o perfil. etapa_id e a lista de etapas por fase vêm de fases_etapas.
-- =========================================================================
DO $$
DECLARE
    r_proj RECORD;
    r_et   RECORD;
    v_perfil TEXT;
    v_email  TEXT := 'resp.carga.teste@cognitionis.com.br';
    v_fase_req    TEXT;
    v_fase_tech   TEXT;
    v_fase_exec   TEXT;
    v_fase_uat    TEXT;
    v_fase_golive TEXT;
    v_ini DATE; v_fim DATE;
    v_sit TEXT; v_pct INT; v_concl_por TEXT; v_concl_em TIMESTAMPTZ; v_obs TEXT;
BEGIN
    v_fase_req    := (SELECT fase FROM fases_etapas WHERE upper(fase) LIKE 'REQ%'                                   AND ativo IS NOT FALSE ORDER BY ordem LIMIT 1);
    v_fase_tech   := (SELECT fase FROM fases_etapas WHERE (upper(fase) LIKE 'TECH%' OR upper(fase) LIKE 'ESPEC%')   AND ativo IS NOT FALSE ORDER BY ordem LIMIT 1);
    v_fase_exec   := (SELECT fase FROM fases_etapas WHERE upper(fase) LIKE 'EXEC%'                                  AND ativo IS NOT FALSE ORDER BY ordem LIMIT 1);
    v_fase_uat    := (SELECT fase FROM fases_etapas WHERE upper(fase) LIKE 'UAT%'                                   AND ativo IS NOT FALSE ORDER BY ordem LIMIT 1);
    v_fase_golive := (SELECT fase FROM fases_etapas WHERE (upper(fase) LIKE 'GO%LIVE%' OR upper(fase) LIKE 'GOLIVE%') AND ativo IS NOT FALSE ORDER BY ordem LIMIT 1);

    FOR r_proj IN
        SELECT codigo, substr(codigo, 11, 2)::int AS slot
        FROM projetos
        WHERE codigo LIKE 'PRJ-FY26-9%' AND aprovador_nome = 'CARGA 12 AF2026'
    LOOP
        v_perfil := CASE
            WHEN r_proj.slot <= 3  THEN 'REQ_PLAN'
            WHEN r_proj.slot <= 5  THEN 'EXEC_PLAN'
            WHEN r_proj.slot <= 8  THEN 'EXEC_ANDAMENTO'
            WHEN r_proj.slot <= 10 THEN 'UAT'
            ELSE 'GOLIVE'
        END;

        -- REQ + ESPEC concluídas (todos menos os 3 "REQ A PLANEJAR")
        IF v_perfil <> 'REQ_PLAN' THEN
            FOR r_et IN
                SELECT id, fase, ordem FROM fases_etapas
                WHERE fase IN (v_fase_req, v_fase_tech) AND ativo IS NOT FALSE
                ORDER BY ordem
            LOOP
                IF r_et.fase = v_fase_req THEN v_ini := DATE '2026-04-15'; v_fim := DATE '2026-05-15';
                ELSE v_ini := DATE '2026-05-16'; v_fim := DATE '2026-06-30'; END IF;

                INSERT INTO projeto_etapas
                    (projeto_codigo, etapa_id, situacao, responsavel_etapa_nome, responsavel_etapa_email,
                     data_inicio_planejamento, data_termino_planejamento, percentual_evolucao,
                     evolucao_atualizada_em, concluido_por, concluido_em, observacoes_conclusao)
                VALUES
                    (r_proj.codigo, r_et.id, 'EXECUCAO_CONCLUIDO', 'CARGA 12 AF2026', v_email,
                     v_ini, v_fim, 100, now(), 'CARGA 12 AF2026', now(), 'Concluído na carga de teste.')
                ON CONFLICT (projeto_codigo, etapa_id) DO NOTHING;
            END LOOP;
        END IF;

        -- EXEC / UAT / GO-LIVE (planejadas juntas)
        IF v_perfil IN ('EXEC_ANDAMENTO', 'UAT', 'GOLIVE') THEN
            FOR r_et IN
                SELECT id, fase, ordem FROM fases_etapas
                WHERE fase IN (v_fase_exec, v_fase_uat, v_fase_golive) AND ativo IS NOT FALSE
                ORDER BY ordem
            LOOP
                IF    r_et.fase = v_fase_exec   THEN v_ini := DATE '2026-07-01'; v_fim := DATE '2026-09-30';
                ELSIF r_et.fase = v_fase_uat    THEN v_ini := DATE '2026-10-01'; v_fim := DATE '2026-11-15';
                ELSE                                 v_ini := DATE '2026-11-16'; v_fim := DATE '2026-12-20'; END IF;

                v_sit := 'EXECUCAO_A_INICIAR'; v_pct := 0;
                v_concl_por := NULL; v_concl_em := NULL; v_obs := NULL;

                IF r_et.fase = v_fase_exec THEN
                    IF v_perfil = 'EXEC_ANDAMENTO' THEN v_sit := 'EXECUCAO_EM_ANDAMENTO'; v_pct := 40;
                    ELSE v_sit := 'EXECUCAO_CONCLUIDO'; v_pct := 100;
                         v_concl_por := 'CARGA 12 AF2026'; v_concl_em := now(); v_obs := 'Concluído na carga de teste.';
                    END IF;
                ELSIF r_et.fase = v_fase_uat THEN
                    IF    v_perfil = 'UAT'    THEN v_sit := 'EXECUCAO_EM_ANDAMENTO'; v_pct := 30;
                    ELSIF v_perfil = 'GOLIVE' THEN v_sit := 'EXECUCAO_CONCLUIDO'; v_pct := 100;
                         v_concl_por := 'CARGA 12 AF2026'; v_concl_em := now(); v_obs := 'Concluído na carga de teste.';
                    END IF;
                ELSE -- go-live
                    IF v_perfil = 'GOLIVE' THEN v_sit := 'EXECUCAO_EM_ANDAMENTO'; v_pct := 20; END IF;
                END IF;

                INSERT INTO projeto_etapas
                    (projeto_codigo, etapa_id, situacao, responsavel_etapa_nome, responsavel_etapa_email,
                     data_inicio_planejamento, data_termino_planejamento, percentual_evolucao,
                     evolucao_atualizada_em, concluido_por, concluido_em, observacoes_conclusao)
                VALUES
                    (r_proj.codigo, r_et.id, v_sit, 'CARGA 12 AF2026', v_email,
                     v_ini, v_fim, v_pct, now(), v_concl_por, v_concl_em, v_obs)
                ON CONFLICT (projeto_codigo, etapa_id) DO NOTHING;
            END LOOP;
        END IF;
    END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';

-- =========================================================================
-- Conferência:
--   SELECT etapa_atual, sub_status, count(*)
--   FROM projetos WHERE aprovador_nome = 'CARGA 12 AF2026' GROUP BY 1,2 ORDER BY 1,2;
--
--   SELECT p.codigo, p.area, p.pessoa_solicitante, p.produto_id, p.etapa_atual, p.sub_status,
--          p.val_bc, p.val_req, p.val_tech, p.realizado, p.tamanho,
--          pe.nome AS pilar,
--          (SELECT count(*) FROM projeto_etapas x WHERE x.projeto_codigo = p.codigo) AS qtd_etapas
--   FROM projetos p
--   LEFT JOIN pilares_estrategicos pe ON pe.id = p.pilar_estrategico_id
--   WHERE p.aprovador_nome = 'CARGA 12 AF2026' ORDER BY p.codigo;
-- =========================================================================
