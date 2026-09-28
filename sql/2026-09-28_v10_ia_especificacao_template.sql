-- =============================================================================
-- V10: IA Workspace M07 — seed de template para Especificação Técnica
-- Aditivo: só adiciona um template novo; nenhuma tabela nova.
-- Idempotente via ON CONFLICT DO NOTHING.
-- =============================================================================

INSERT INTO ia_templates_prompt (titulo, ativo, system_prompt, user_prompt_template, campos_obrigatorios)
VALUES (
    'Especificação Técnica de Sistema',
    true,
    'Você é um arquiteto de software sênior especializado em documentação técnica de sistemas. Seu objetivo é produzir uma Especificação Técnica completa e clara, baseada nos requerimentos de negócio fornecidos. A especificação deve cobrir: visão geral da solução, arquitetura de alto nível, componentes e interfaces, modelo de dados relevante, fluxos de integração, regras de segurança e acesso, e critérios de aceite técnico. Use linguagem técnica precisa mas compreensível. Estruture em seções Markdown com títulos (##), subtítulos (###), listas e tabelas onde adequado. Inclua diagramas em Mermaid quando útil para ilustrar fluxos ou arquitetura.',
    'Projeto: {{nome_projeto}}

Fase: Especificação Técnica

Requerimentos de Negócio (contexto):
{{requerimentos_negocio}}

Escopo técnico a cobrir:
{{escopo_tecnico}}

Restrições e premissas técnicas:
{{restricoes_tecnicas}}

Integrações conhecidas:
{{integracoes}}

Com base no contexto acima, elabore a Especificação Técnica completa do sistema, cobrindo arquitetura, componentes, modelo de dados, fluxos e critérios de aceite técnico.',
    '[
        {"chave": "nome_projeto", "rotulo": "Nome do Projeto / Sistema", "tipo": "text"},
        {"chave": "requerimentos_negocio", "rotulo": "Requerimentos de Negócio (cole o documento ou resumo)", "tipo": "textarea"},
        {"chave": "escopo_tecnico", "rotulo": "Escopo Técnico a Cobrir", "tipo": "textarea"},
        {"chave": "restricoes_tecnicas", "rotulo": "Restrições e Premissas Técnicas", "tipo": "textarea"},
        {"chave": "integracoes", "rotulo": "Integrações Conhecidas (sistemas, APIs, bancos)", "tipo": "textarea"}
    ]'::jsonb
)
ON CONFLICT DO NOTHING;
