-- =========================================================================
-- 2026-09-01_produtos_e_produto_id.sql
-- Compasso — SÓ Compasso (projeto Supabase fytynjjvzecljmgbtwec).
--
-- Agrupamento de Orçamento por Produto — item 1 e 2 da tarefa.
--   * tabela `produtos` (mesmo padrão de tipos_projeto)
--   * sentinela NAO_CLASSIFICADO / "Não Classificado"
--   * projetos.produto_id (FK) + migração de todos os projetos para o sentinela
--
-- `produtos` NÃO fica sob RLS (mesmo tratamento de tipos_projeto/areas) —
-- o app grava nela com a chave publishable, como nas demais telas de
-- Parâmetros e Cadastros.
--
-- Idempotente. Rode no Supabase → SQL Editor.
-- =========================================================================

CREATE TABLE IF NOT EXISTS produtos (
    id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    codigo     TEXT NOT NULL UNIQUE,
    nome       TEXT NOT NULL,
    ativo      BOOLEAN NOT NULL DEFAULT true,
    criado_por TEXT,
    criado_em  TIMESTAMPTZ DEFAULT now()
);

-- Sentinela: valor histórico dos projetos antigos. NÃO é oferecido como
-- opção na tela de Formalizar Demanda (filtro no front).
INSERT INTO produtos (codigo, nome, criado_por, ativo)
SELECT 'NAO_CLASSIFICADO', 'Não Classificado', 'sistema', true
WHERE NOT EXISTS (SELECT 1 FROM produtos WHERE codigo = 'NAO_CLASSIFICADO');

ALTER TABLE projetos ADD COLUMN IF NOT EXISTS produto_id BIGINT REFERENCES produtos(id);

-- Migra todos os projetos existentes para o sentinela.
UPDATE projetos
   SET produto_id = (SELECT id FROM produtos WHERE codigo = 'NAO_CLASSIFICADO')
 WHERE produto_id IS NULL;

NOTIFY pgrst, 'reload schema';

-- Conferência:
--   SELECT count(*) AS migrados FROM projetos
--   WHERE produto_id = (SELECT id FROM produtos WHERE codigo = 'NAO_CLASSIFICADO');
-- =========================================================================
