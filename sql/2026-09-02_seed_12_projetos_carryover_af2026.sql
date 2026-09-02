-- =========================================================================
-- 2026-09-02_seed_12_projetos_carryover_af2026.sql
-- Compasso — projeto Supabase fytynjjvzecljmgbtwec. NÃO roda contra o Compasso.
--
-- Carga de 12 projetos do Ano Fiscal 2026, AINDA EM ANDAMENTO e NÃO
-- marcados como Carryover — para exercitar o próprio processo: marcar como
-- Carryover e/ou cancelar, e ver o tratamento na virada do AF.
--
-- NOTA (código): a tela Projetos Carry Over foi ajustada para também listar
-- como candidatos os projetos de um Ano Fiscal ANTERIOR ao corrente ainda
-- em andamento (sem trava de Q4) — ver js/carryover/carryover.js
-- (elegivelComoCandidatoCarryoverAFAnterior). Sem esse ajuste, estes 12
-- projetos de AF2026 não apareceriam na tela enquanto o AF corrente é AF2027.
--
-- Distribuição de fases (soma 12):
--   03  -> REQUERIMENTOS, "A PLANEJAR"          (sem planejamento de fase)
--   02  -> EXECUÇÃO, "A PLANEJAR"               (Especificação concluída)
--   03  -> EXECUÇÃO, "EM ANDAMENTO"             (Execução planejada + evoluindo)
--   02  -> UAT                                  (Execução concluída, UAT evoluindo)
--   02  -> GO-LIVE                              (Execução+UAT concluídas, Go-Live evoluindo)
--
-- Variedade: área solicitante, pessoa solicitante, produto e
-- pilar/iniciativa estratégica.
--
-- Pilar/Iniciativa Estratégica: NÃO existe nenhuma cadastrada para AF2026.
-- Este script cria os Pilares AF2026 (e suas Iniciativas) copiando os do
-- AF2027 — Seção 1 abaixo.
--
-- Códigos: PRJ-FY26-901-<mnem> .. PRJ-FY26-912-<mnem> (faixa 9xx, não
-- colide com a numeração que a RPC gera para demandas reais de AF2026).
--
-- Datas encadeadas de abr/2026 a dez/2026, seguindo a ordem normal do
-- workflow.
--
-- Idempotente (guardas NOT EXISTS / ON CONFLICT DO NOTHING). Rode no
-- Supabase -> SQL Editor.
-- =========================================================================


-- =========================================================================
-- SEÇÃO 1 — Pilares e Iniciativas Estratégicas para AF2026
--           (cópia dos que existem em AF2027)
-- =========================================================================
DO $$
DECLARE
    r_pilar   RECORD;
    v_novo_id BIGINT;
BEGIN
    FOR r_pilar IN
        SELECT * FROM pilares_estrategicos
        WHERE ano_fiscal = 'AF2027' AND ativo IS NOT FALSE
        ORDER BY nome
    LOOP
        SELECT id INTO v_novo_id
        FROM pilares_estrategicos
        WHERE ano_fiscal = 'AF2026' AND upper(nome) = upper(r_pilar.nome);

        IF v_novo_id IS NULL THEN
            INSERT INTO pilares_estrategicos (ano_fiscal, nome, descricao, ativo, criado_por, criado_em)
            VALUES ('AF2026', r_pilar.nome, r_pilar.descricao, true, 'CARGA CARRYOVER 2026', now())
            RETURNING id INTO v_novo_id;

            INSERT INTO iniciativas_estrategicas (pilar_id, nome, descricao, ativo, criado_por, criado_em)
            SELECT v_novo_id, i.nome, i.descricao, true, 'CARGA CARRYOVER 2026', now()
            FROM iniciativas_estrategicas i
            WHERE i.pilar_id = r_pilar.id AND i.ativo IS NOT FALSE;
        END IF;
    END LOOP;
END $$;


-- =========================================================================
-- SEÇÃO 2 — Os 12 projetos Carryover de AF2026
-- =========================================================================
-- Helpers de leitura (subselect) usados nas linhas abaixo:
--   pilar AF2026 por nome          -> (SELECT id FROM pilares_estrategicos WHERE ano_fiscal='AF2026' AND nome = ?)
--   iniciativa do pilar AF2026     -> (SELECT id FROM iniciativas_estrategicas WHERE pilar_id = <pilar> ORDER BY id LIMIT 1 OFFSET ?)

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
)
SELECT
    v.codigo, v.nome, 'AF2026', v.area, v.pessoa, DATE '2026-04-01',
    'DESENVOLVIMENTO', 3, v.produto_id, v.tipo_orcamento, v.qualificacao, 'M',
    'EM ANDAMENTO', 'ATIVO', v.etapa_atual, v.sub_status, 'APROVADO', 'SIM',
    'APROVADO', DATE '2026-04-10', DATE '2026-04-10', 'CARGA CARRYOVER 2026',
    v.val_bc, v.val_req, v.val_tech, v.horas_bc, v.horas_req, v.horas_tech, v.val_bc, v.realizado,
    0, 0, 'SIM', 0, false,
    'Projeto de carga para testes de carryover (AF2026).',
    'Testar o tratamento de carryover na virada do Ano Fiscal.',
    'Concluir o ciclo do projeto dentro do próximo Ano Fiscal.',
    (SELECT id FROM pilares_estrategicos WHERE ano_fiscal = 'AF2026' AND nome = v.pilar_nome),
    (SELECT id FROM iniciativas_estrategicas
       WHERE pilar_id = (SELECT id FROM pilares_estrategicos WHERE ano_fiscal = 'AF2026' AND nome = v.pilar_nome)
       ORDER BY id LIMIT 1 OFFSET v.ini_offset),
    false, false, false,
    false, false,
    DATE '2026-04-11',
    DATE '2026-05-05',
    CASE WHEN v.etapa_atual = 'REQUIREMENTS' THEN NULL ELSE 'CARGA CARRYOVER 2026' END,
    CASE WHEN v.etapa_atual = 'REQUIREMENTS' THEN NULL ELSE DATE '2026-05-15' END,
    CASE WHEN v.etapa_atual = 'REQUIREMENTS' THEN NULL ELSE 'CARGA CARRYOVER 2026' END,
    CASE WHEN v.etapa_atual = 'REQUIREMENTS' THEN NULL ELSE DATE '2026-06-30' END
FROM (VALUES
    --  codigo               nome                          area                          pessoa                              produto  t.orc    qualif  etapa_atual    sub_status     val_bc   val_req  val_tech realiz.  pilar_nome                ini_offset  horas_bc horas_req horas_tech
    ('PRJ-FY26-901-TII', 'PROJETO 2026 CARRYOVER 01', 'TECNOLOGIA DA INFORMAÇÃO', 'PESSOA RESPONSAVEL TI',            2, 'CAPEX', 'GROW', 'REQUIREMENTS', 'A PLANEJAR',   200000,       0,       0,      0, 'PILAR ESTRATEGICO 001', 0, 400,   0,   0),
    ('PRJ-FY26-902-COR', 'PROJETO 2026 CARRYOVER 02', 'CORRETORA',               'PESSOA RESPONSAVEL CORRETORA 2',   3, 'OPEX',  'REG',  'REQUIREMENTS', 'A PLANEJAR',   180000,       0,       0,      0, 'PILAR ESTRATEGICO 002', 0, 360,   0,   0),
    ('PRJ-FY26-903-COB', 'PROJETO 2026 CARRYOVER 03', 'COBRANÇA',                'PESSOA RESPONSAVEL COBRANÇA',     4, 'CAPEX', 'RUN',  'REQUIREMENTS', 'A PLANEJAR',   150000,       0,       0,      0, 'PILAR ESTRATEGICO 004', 0, 300,   0,   0),
    ('PRJ-FY26-904-CRD', 'PROJETO 2026 CARRYOVER 04', 'CREDITO',                 'PESSOA RESPONSAVEL CREDITO',      5, 'OPEX',  'GROW', 'EXECUTION',    'A PLANEJAR',   220000,  240000,  255000,      0, 'PILAR ESTRATEGICO 005', 1, 440, 480, 510),
    ('PRJ-FY26-905-RSK', 'PROJETO 2026 CARRYOVER 05', 'RISCO',                   'PESSOA RESPONSAVEL RISCO 1',      2, 'CAPEX', 'REG',  'EXECUTION',    'A PLANEJAR',   260000,  270000,  280000,      0, 'PILAR ESTRATEGICO 006', 1, 520, 540, 560),
    ('PRJ-FY26-906-PRD', 'PROJETO 2026 CARRYOVER 06', 'PRODUTOS',                'PESSOA RESPONSAVEL PRODUTOS',     3, 'OPEX',  'RUN',  'EXECUTION',    'EM ANDAMENTO', 300000,  310000,  320000,  90000, 'PILAR ESTRATEGICO 007', 1, 600, 620, 640),
    ('PRJ-FY26-907-CTR', 'PROJETO 2026 CARRYOVER 07', 'CONTROLADORIA',           'PESSOA RESPONSAVEL CONTROLADORIA',4, 'CAPEX', 'GROW', 'EXECUTION',    'EM ANDAMENTO', 175000,  185000,  195000,  60000, 'PILAR ESTRATEGICO 009', 0, 350, 370, 390),
    ('PRJ-FY26-908-BKO', 'PROJETO 2026 CARRYOVER 08', 'BACKOFFICE',              'PESSOA RESPONSAVEL BACKOFFICE',   5, 'OPEX',  'REG',  'EXECUTION',    'EM ANDAMENTO', 240000,  245000,  250000, 100000, 'PILAR ESTRATEGICO 010', 1, 480, 490, 500),
    ('PRJ-FY26-909-CON', 'PROJETO 2026 CARRYOVER 09', 'CONSÓRCIO',               'PESSOA RESPONSAVEL CONSORCIO',    2, 'CAPEX', 'GROW', 'UAT',          'EM ANDAMENTO', 210000,  220000,  230000, 140000, 'PILAR ESTRATEGICO 001', 0, 420, 440, 460),
    ('PRJ-FY26-910-MKT', 'PROJETO 2026 CARRYOVER 10', 'MARKETING',               'PESSOA RESPONSAVEL MARKETING',    3, 'OPEX',  'RUN',  'UAT',          'EM ANDAMENTO', 190000,  200000,  205000, 120000, 'PILAR ESTRATEGICO 002', 2, 380, 400, 410),
    ('PRJ-FY26-911-RHU', 'PROJETO 2026 CARRYOVER 11', 'RECURSOS HUMANOS',        'PESSOA RESPONSAVEL RH',           4, 'CAPEX', 'REG',  'GOLIVE',       'EM ANDAMENTO', 165000,  170000,  178000, 150000, 'PILAR ESTRATEGICO 004', 0, 330, 340, 356),
    ('PRJ-FY26-912-CRD', 'PROJETO 2026 CARRYOVER 12', 'CREDITO',                 'PESSOA RESPONSAVEL CREDITO 2',    5, 'OPEX',  'GROW', 'GOLIVE',       'EM ANDAMENTO', 280000,  290000,  300000, 240000, 'PILAR ESTRATEGICO 005', 2, 560, 580, 600)
) AS v(codigo, nome, area, pessoa, produto_id, tipo_orcamento, qualificacao, etapa_atual, sub_status,
       val_bc, val_req, val_tech, realizado, pilar_nome, ini_offset, horas_bc, horas_req, horas_tech)
WHERE NOT EXISTS (SELECT 1 FROM projetos p WHERE p.codigo = v.codigo);


-- =========================================================================
-- SEÇÃO 3 — Planejamento de fase (projeto_etapas)
-- etapa_id: 18 GERAR REQ | 20 APROVAR REQ NEGÓCIO | 19 APROVAR REQ TI |
--           21 FECHAR REQ | 22 GERAR ESPEC | 27 AVALIAR ESPEC NEGÓCIO |
--           23 FECHAR ESPEC | 24 EXECUÇÃO | 25 UAT | 26 GO-LIVE
-- situacao: EXECUCAO_CONCLUIDO (100%) | EXECUCAO_EM_ANDAMENTO (1-99) |
--           EXECUCAO_A_INICIAR (planejado, 0%)
-- =========================================================================
DO $$
DECLARE
    r RECORD;
    v_resp_email TEXT := 'resp.carga.carryover@cognitionis.com.br';
BEGIN
    FOR r IN
        SELECT codigo,
               CASE codigo
                   WHEN 'PRJ-FY26-901-TII' THEN 'REQ_PLAN'
                   WHEN 'PRJ-FY26-902-COR' THEN 'REQ_PLAN'
                   WHEN 'PRJ-FY26-903-COB' THEN 'REQ_PLAN'
                   WHEN 'PRJ-FY26-904-CRD' THEN 'EXEC_PLAN'
                   WHEN 'PRJ-FY26-905-RSK' THEN 'EXEC_PLAN'
                   WHEN 'PRJ-FY26-906-PRD' THEN 'EXEC_ANDAMENTO'
                   WHEN 'PRJ-FY26-907-CTR' THEN 'EXEC_ANDAMENTO'
                   WHEN 'PRJ-FY26-908-BKO' THEN 'EXEC_ANDAMENTO'
                   WHEN 'PRJ-FY26-909-CON' THEN 'UAT'
                   WHEN 'PRJ-FY26-910-MKT' THEN 'UAT'
                   WHEN 'PRJ-FY26-911-RHU' THEN 'GOLIVE'
                   WHEN 'PRJ-FY26-912-CRD' THEN 'GOLIVE'
               END AS perfil,
               pessoa_solicitante AS resp_nome
        FROM projetos
        WHERE codigo LIKE 'PRJ-FY26-9%' AND aprovador_nome = 'CARGA CARRYOVER 2026'
    LOOP
        -- ---- REQUERIMENTOS + ESPECIFICAÇÃO concluídas (todos, exceto os 3 "REQ A PLANEJAR") ----
        IF r.perfil <> 'REQ_PLAN' THEN
            INSERT INTO projeto_etapas
                (projeto_codigo, etapa_id, situacao, responsavel_etapa_nome, responsavel_etapa_email,
                 data_inicio_planejamento, data_termino_planejamento, percentual_evolucao,
                 evolucao_atualizada_em, concluido_por, concluido_em, observacoes_conclusao)
            SELECT r.codigo, e.id, 'EXECUCAO_CONCLUIDO', r.resp_nome, v_resp_email,
                   e.ini, e.fim, 100, now(), 'CARGA CARRYOVER 2026', now(), 'Concluído na carga de teste.'
            FROM (VALUES
                (18, DATE '2026-04-15', DATE '2026-05-05'),
                (20, DATE '2026-05-06', DATE '2026-05-11'),
                (19, DATE '2026-05-06', DATE '2026-05-11'),
                (21, DATE '2026-05-12', DATE '2026-05-15'),
                (22, DATE '2026-05-16', DATE '2026-06-10'),
                (27, DATE '2026-06-11', DATE '2026-06-20'),
                (23, DATE '2026-06-21', DATE '2026-06-30')
            ) AS e(id, ini, fim)
            ON CONFLICT (projeto_codigo, etapa_id) DO NOTHING;
        END IF;

        -- ---- EXECUÇÃO / UAT / GO-LIVE (planejadas juntas em "Planejar Execução") ----
        IF r.perfil IN ('EXEC_ANDAMENTO', 'UAT', 'GOLIVE') THEN
            INSERT INTO projeto_etapas
                (projeto_codigo, etapa_id, situacao, responsavel_etapa_nome, responsavel_etapa_email,
                 data_inicio_planejamento, data_termino_planejamento, percentual_evolucao,
                 evolucao_atualizada_em, concluido_por, concluido_em, observacoes_conclusao)
            SELECT r.codigo, e.id,
                   CASE
                       WHEN e.id = 24 AND r.perfil = 'EXEC_ANDAMENTO' THEN 'EXECUCAO_EM_ANDAMENTO'
                       WHEN e.id = 24 THEN 'EXECUCAO_CONCLUIDO'
                       WHEN e.id = 25 AND r.perfil = 'UAT' THEN 'EXECUCAO_EM_ANDAMENTO'
                       WHEN e.id = 25 AND r.perfil = 'GOLIVE' THEN 'EXECUCAO_CONCLUIDO'
                       WHEN e.id = 25 THEN 'EXECUCAO_A_INICIAR'
                       WHEN e.id = 26 AND r.perfil = 'GOLIVE' THEN 'EXECUCAO_EM_ANDAMENTO'
                       ELSE 'EXECUCAO_A_INICIAR'
                   END,
                   r.resp_nome, v_resp_email, e.ini, e.fim,
                   CASE
                       WHEN e.id = 24 AND r.perfil = 'EXEC_ANDAMENTO' THEN 40
                       WHEN e.id = 24 THEN 100
                       WHEN e.id = 25 AND r.perfil = 'UAT' THEN 30
                       WHEN e.id = 25 AND r.perfil = 'GOLIVE' THEN 100
                       WHEN e.id = 26 AND r.perfil = 'GOLIVE' THEN 20
                       ELSE 0
                   END,
                   now(),
                   CASE WHEN (e.id = 24 AND r.perfil IN ('UAT','GOLIVE')) OR (e.id = 25 AND r.perfil = 'GOLIVE')
                        THEN 'CARGA CARRYOVER 2026' ELSE NULL END,
                   CASE WHEN (e.id = 24 AND r.perfil IN ('UAT','GOLIVE')) OR (e.id = 25 AND r.perfil = 'GOLIVE')
                        THEN now() ELSE NULL END,
                   CASE WHEN (e.id = 24 AND r.perfil IN ('UAT','GOLIVE')) OR (e.id = 25 AND r.perfil = 'GOLIVE')
                        THEN 'Concluído na carga de teste.' ELSE NULL END
            FROM (VALUES
                (24, DATE '2026-07-01', DATE '2026-09-30'),
                (25, DATE '2026-10-01', DATE '2026-11-15'),
                (26, DATE '2026-11-16', DATE '2026-12-20')
            ) AS e(id, ini, fim)
            ON CONFLICT (projeto_codigo, etapa_id) DO NOTHING;
        END IF;
    END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';

-- =========================================================================
-- Conferência rápida (rode separado se quiser):
--   SELECT etapa_atual, sub_status, count(*)
--   FROM projetos WHERE codigo LIKE 'PRJ-FY26-9%' GROUP BY 1,2 ORDER BY 1,2;
--
--   SELECT p.codigo, p.etapa_atual, p.sub_status, p.produto_id,
--          pe.nome AS pilar, ie.nome AS iniciativa,
--          (SELECT count(*) FROM projeto_etapas x WHERE x.projeto_codigo = p.codigo) AS qtd_etapas
--   FROM projetos p
--   LEFT JOIN pilares_estrategicos pe ON pe.id = p.pilar_estrategico_id
--   LEFT JOIN iniciativas_estrategicas ie ON ie.id = p.iniciativa_estrategica_id
--   WHERE p.codigo LIKE 'PRJ-FY26-9%' ORDER BY p.codigo;
-- =========================================================================
