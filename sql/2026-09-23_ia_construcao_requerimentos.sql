-- =========================================================================
-- 2026-09-23_ia_construcao_requerimentos.sql
-- Compasso — SÓ Compasso (projeto Supabase fytynjjvzecljmgbtwec).
--
-- Módulo de Construção de Requerimentos com IA — adaptação do documento
-- do usuário (Especificacao_Sistema_Orquestrador_IA.docx) pro padrão real
-- do Compasso (Netlify Function síncrona chamando OpenAI, sem fila/worker
-- persistente — ver o plano aprovado na sessão). Escopo inicial: só a
-- etapa "GERAR REQUERIMENTOS" (campo etapa_nome já existe pra reuso
-- futuro em outras etapas, sem migração de schema).
--
-- Sem RLS (mesmo tratamento do resto das tabelas de app do Compasso).
-- Idempotente.
-- =========================================================================

CREATE TABLE IF NOT EXISTS ia_templates_prompt (
    id                    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    titulo                TEXT NOT NULL,
    ativo                 BOOLEAN NOT NULL DEFAULT true,
    system_prompt         TEXT NOT NULL,
    user_prompt_template  TEXT NOT NULL,       -- com {{placeholders}}
    campos_obrigatorios   JSONB NOT NULL,      -- [{chave, rotulo, tipo}]
    criado_por            TEXT,
    criado_em             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ia_especificacoes (
    id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    projeto_codigo    TEXT NOT NULL REFERENCES projetos(codigo),
    etapa_nome        TEXT NOT NULL DEFAULT 'GERAR REQUERIMENTOS',
    template_id       BIGINT REFERENCES ia_templates_prompt(id),
    dados_entrada     JSONB NOT NULL DEFAULT '{}'::jsonb,
    prompt_montado    TEXT,
    resultado_ia      TEXT,
    status            TEXT NOT NULL DEFAULT 'RASCUNHO'
                          CHECK (status IN ('RASCUNHO', 'AGUARDANDO_IA', 'CONCLUIDO', 'ERRO')),
    erro_detalhe      TEXT,
    versao            INT NOT NULL DEFAULT 1,
    criado_por        TEXT,
    criado_em         TIMESTAMPTZ NOT NULL DEFAULT now(),
    atualizado_em     TIMESTAMPTZ,
    UNIQUE (projeto_codigo, etapa_nome)
);

-- Histórico append-only de cada geração — requisito explícito do
-- documento ("arquivar artefatos técnicos... de maneira versionável").
CREATE TABLE IF NOT EXISTS ia_especificacoes_historico (
    id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    especificacao_id  BIGINT NOT NULL REFERENCES ia_especificacoes(id),
    versao            INT NOT NULL,
    prompt_montado    TEXT NOT NULL,
    resultado_ia      TEXT,
    status            TEXT NOT NULL,
    gerado_por        TEXT,
    gerado_em         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Chave geral + modelo (mesmo padrão de config_email_geral.envio_ativo).
CREATE TABLE IF NOT EXISTS ia_config_geral (
    id      BIGINT PRIMARY KEY DEFAULT 1,
    ativo   BOOLEAN NOT NULL DEFAULT true,
    modelo  TEXT NOT NULL DEFAULT 'gpt-4o',
    CHECK (id = 1)
);
INSERT INTO ia_config_geral (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

ALTER TABLE ia_templates_prompt DISABLE ROW LEVEL SECURITY;
ALTER TABLE ia_especificacoes DISABLE ROW LEVEL SECURITY;
ALTER TABLE ia_especificacoes_historico DISABLE ROW LEVEL SECURITY;
ALTER TABLE ia_config_geral DISABLE ROW LEVEL SECURITY;

-- Seed do template padrão — texto EXATO do documento anexado pelo usuário
-- (Especificacao_Sistema_Orquestrador_IA.docx, seção 4).
INSERT INTO ia_templates_prompt (titulo, system_prompt, user_prompt_template, campos_obrigatorios)
SELECT
    'Especificação Técnica de Módulo',
    'Você é um Arquiteto de Sistemas Sênior integrado ao software corporativo. Sua missão é transformar requisitos brutos em especificações técnicas de nível de produção.
Diretrizes:
1. Responda APENAS em Markdown estruturado.
2. Se houver diagramas, utilize EXCLUSIVAMENTE a sintaxe Mermaid.js.',
    'Por favor, gere a especificação técnica para o módulo descrito abaixo.
- Nome: {{nome_modulo}}
- Stack Obrigatória: {{stack_tecnica}}
- Volumetria Estimada: {{volumetria}}

# Regras de Negócio
{{regras_negocio}}',
    '[
        {"chave": "nome_modulo", "rotulo": "Nome do Módulo", "tipo": "texto"},
        {"chave": "stack_tecnica", "rotulo": "Stack Obrigatória", "tipo": "texto"},
        {"chave": "volumetria", "rotulo": "Volumetria Estimada", "tipo": "texto"},
        {"chave": "regras_negocio", "rotulo": "Regras de Negócio", "tipo": "textarea"}
    ]'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM ia_templates_prompt);

NOTIFY pgrst, 'reload schema';

-- Conferência:
--   SELECT id, titulo, ativo, jsonb_array_length(campos_obrigatorios) AS n_campos
--   FROM ia_templates_prompt;
--   SELECT * FROM ia_config_geral;
-- =========================================================================
