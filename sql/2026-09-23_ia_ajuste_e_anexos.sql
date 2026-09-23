-- =========================================================================
-- 2026-09-23_ia_ajuste_e_anexos.sql
-- Compasso — SÓ Compasso (projeto Supabase fytynjjvzecljmgbtwec).
--
-- Fase 2 do Módulo de Construção de Requerimentos com IA: histórico de
-- mensagens (contexto pro modo de ajuste), anexo DOCX gerado a cada
-- geração/ajuste, e ampliação dos templates (deixa de ser só técnico).
-- Aditivo — não altera o formato das tabelas já em produção
-- (ia_especificacoes, ia_templates_prompt, ia_especificacoes_historico,
-- ia_config_geral, criadas em 2026-09-23_ia_construcao_requerimentos.sql).
--
-- Sem RLS (mesmo tratamento do resto das tabelas de app do Compasso).
-- Idempotente.
-- =========================================================================

-- Histórico de mensagens user/assistant — dá contexto pro modo de ajuste
-- sem reconstruir o prompt do zero a cada rodada.
CREATE TABLE IF NOT EXISTS ia_especificacoes_mensagens (
    id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    especificacao_id  BIGINT NOT NULL REFERENCES ia_especificacoes(id),
    papel             TEXT NOT NULL CHECK (papel IN ('user', 'assistant')),
    conteudo          TEXT NOT NULL,
    criado_por        TEXT,
    criado_em         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Anexo DOCX gerado a cada geração/ajuste — mesmo padrão de
-- contratos_pendencias_anexos / bucket contratos-anexos
-- (sql/2026-09-08_storage_contratos_anexos.sql).
CREATE TABLE IF NOT EXISTS ia_especificacoes_anexos (
    id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    especificacao_id  BIGINT NOT NULL REFERENCES ia_especificacoes(id),
    versao            INT NOT NULL,
    storage_path      TEXT NOT NULL,
    nome_original     TEXT NOT NULL,
    tipo_mime         TEXT NOT NULL DEFAULT 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    tamanho_bytes     BIGINT,
    gerado_em         TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE ia_especificacoes_mensagens DISABLE ROW LEVEL SECURITY;
ALTER TABLE ia_especificacoes_anexos DISABLE ROW LEVEL SECURITY;

-- Bucket novo (privado — igual contratos-anexos: upload só via service
-- key na Netlify Function, leitura só via signed URL curta).
INSERT INTO storage.buckets (id, name, public)
VALUES ('ia-documentos-gerados', 'ia-documentos-gerados', false)
ON CONFLICT (id) DO NOTHING;

-- Amplia o template padrão — deixa de ser só "técnico" (a pedido do
-- usuário: "os templates e a conversa estao restritas a um conteudo
-- tecnico").
UPDATE ia_templates_prompt
SET system_prompt = 'Você é um Analista Sênior integrado ao software corporativo. Sua missão é transformar requisitos brutos em documentação de nível de produção — técnica ou de negócio, conforme o conteúdo recebido.
Diretrizes:
1. Responda APENAS em Markdown estruturado.
2. Se houver diagramas, utilize EXCLUSIVAMENTE a sintaxe Mermaid.js.'
WHERE titulo = 'Especificação Técnica de Módulo';

-- Novo template, focado em negócio/processo (aparece no mesmo seletor de
-- templates ativos, sem precisar de mudança de código).
INSERT INTO ia_templates_prompt (titulo, system_prompt, user_prompt_template, campos_obrigatorios)
SELECT
    'Especificação de Negócio/Processo',
    'Você é um Analista de Negócios Sênior. Sua missão é transformar uma necessidade de negócio em um documento de requisitos claro, sem jargão técnico desnecessário.
Diretrizes:
1. Responda APENAS em Markdown estruturado.
2. Se houver fluxos de processo, utilize EXCLUSIVAMENTE a sintaxe Mermaid.js (flowchart).',
    'Por favor, gere o documento de requisitos de negócio abaixo.
- Nome da Demanda: {{nome_modulo}}
- Objetivo de Negócio: {{objetivo_negocio}}
- Área(s) Impactada(s): {{areas_impactadas}}

# Regras de Negócio
{{regras_negocio}}',
    '[
        {"chave": "nome_modulo", "rotulo": "Nome da Demanda", "tipo": "texto"},
        {"chave": "objetivo_negocio", "rotulo": "Objetivo de Negócio", "tipo": "texto"},
        {"chave": "areas_impactadas", "rotulo": "Área(s) Impactada(s)", "tipo": "texto"},
        {"chave": "regras_negocio", "rotulo": "Regras de Negócio", "tipo": "textarea"}
    ]'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM ia_templates_prompt WHERE titulo = 'Especificação de Negócio/Processo');

NOTIFY pgrst, 'reload schema';

-- Conferência:
--   SELECT titulo, ativo FROM ia_templates_prompt;
--   SELECT id, name, public FROM storage.buckets WHERE id = 'ia-documentos-gerados';
-- =========================================================================
