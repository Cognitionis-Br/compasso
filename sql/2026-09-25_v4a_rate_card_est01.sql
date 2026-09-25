-- =========================================================================
-- 2026-09-25_v4a_rate_card_est01.sql
-- Compasso 2.0 — V4 (Estimation), parte A: Rate Card + EST-01.
--
-- Puramente aditivo — não altera nenhuma tabela existente. `business_cases`
-- já tem `val_bc`/`horas_bc` (herdados de `projetos` no V3), mas nenhuma
-- tela de produção os preenche hoje; este script só acrescenta a estrutura
-- que vai alimentá-los pela tela nova "Estimativa (EST-01)".
--
-- Reversível: DROP TABLE business_case_estimativas; DROP TABLE
-- rate_card_papeis; (sem tocar em business_cases/projects).
-- =========================================================================

CREATE TABLE IF NOT EXISTS rate_card_papeis (
    id SERIAL PRIMARY KEY,
    papel TEXT UNIQUE NOT NULL,
    valor_hora NUMERIC(12,2) NOT NULL,
    ativo BOOLEAN NOT NULL DEFAULT true,
    atualizado_por TEXT,
    atualizado_em TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS business_case_estimativas (
    id SERIAL PRIMARY KEY,
    business_case_codigo TEXT NOT NULL REFERENCES business_cases(codigo),
    versao INT NOT NULL,
    premissas TEXT,
    itens JSONB NOT NULL, -- [{papel, horas, valor_hora_snapshot, subtotal}]
    total_horas NUMERIC(10,2) NOT NULL,
    custo_estimado NUMERIC(14,2) NOT NULL,
    criado_por TEXT,
    criado_em TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_business_case_estimativas_bc ON business_case_estimativas (business_case_codigo);

-- Catálogo de acesso da tela nova "Rate Card" (mesmo padrão de
-- sql/2026-09-23_r1_catalogo_trabalho_pessoal.sql) — sem isso o link fica
-- escondido pra todo mundo (aplicarVisibilidadeMenu em js/config/funcoes.js
-- só mostra tabIds presentes em catalogo_atividades). Concedida por padrão
-- a todas as funções já cadastradas; a edição em si continua restrita a
-- ehProprietario dentro da própria tela (checagem em JS), então não há
-- risco em liberar a leitura pra todo mundo aqui.
INSERT INTO catalogo_atividades (grupo, subgrupo, atividade, activity_key, restricao_area, ordem)
SELECT 'FINANCEIRO', 'Rate Card', 'Rate Card (Papéis e Valores/Hora)', 'rate_card', false,
       (SELECT COALESCE(MAX(ordem), 0) + 1 FROM catalogo_atividades)
WHERE NOT EXISTS (SELECT 1 FROM catalogo_atividades WHERE activity_key = 'rate_card');

INSERT INTO funcao_atividades (funcao_id, atividade_id, pode_consultar, pode_incluir, pode_alterar, pode_deletar)
SELECT f.id, ca.id, true, true, true, true
FROM funcoes f
CROSS JOIN catalogo_atividades ca
WHERE ca.activity_key = 'rate_card'
  AND NOT EXISTS (
      SELECT 1 FROM funcao_atividades fa
      WHERE fa.funcao_id = f.id AND fa.atividade_id = ca.id
  );

-- Seed inicial (3 papéis de exemplo) — o usuário ajusta os valores reais
-- pela tela depois. Idempotente (não duplica se já existir).
INSERT INTO rate_card_papeis (papel, valor_hora)
SELECT 'Analista', 120.00 WHERE NOT EXISTS (SELECT 1 FROM rate_card_papeis WHERE papel = 'Analista');
INSERT INTO rate_card_papeis (papel, valor_hora)
SELECT 'Desenvolvedor', 150.00 WHERE NOT EXISTS (SELECT 1 FROM rate_card_papeis WHERE papel = 'Desenvolvedor');
INSERT INTO rate_card_papeis (papel, valor_hora)
SELECT 'Gerente de Projeto', 200.00 WHERE NOT EXISTS (SELECT 1 FROM rate_card_papeis WHERE papel = 'Gerente de Projeto');

NOTIFY pgrst, 'reload schema';

-- Conferência:
--   SELECT * FROM rate_card_papeis ORDER BY papel;
--   SELECT * FROM catalogo_atividades WHERE activity_key = 'rate_card';
-- =========================================================================
