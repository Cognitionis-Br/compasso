# RELATORIO_A0_ADM.md — Fase 1A · A0 · Auditoria ADM

**Produto:** Compasso 2.0  
**Revisão:** 2026-10-08  
**Critério de conclusão (QA-ADM-14):** 100% dos itens legados com destino ou decisão de descontinuação; não há dois mecanismos ativos para a mesma autorização.  
**Fonte de contagens:** `sql/2026-09-30_adm_a0_inventario.sql` rodado em produção (2026-10-08)

---

## 1. Inventário legado → VIEW destino

### 1.1 SCR-23 · Cadastros (7 VIEWs)

| Grupo legado | Tabela(s) real(is) | Entidade M | VIEW destino | Qtd em prod. |
|---|---|---|---|---|
| Áreas | `areas_solicitantes` | AREA | VIEW-CAD-ORG | ver SQL |
| Cargos | `cargos` | JOB_TITLE | VIEW-CAD-CARGOS | ver SQL |
| Pessoas solicitantes | `pessoas_solicitantes` | PERSON | VIEW-CAD-PESSOAS | ver SQL |
| Fornecedores | `empresas_terceirizadas` | SUPPLIER | VIEW-CAD-FORNECEDORES | ver SQL |
| Portes | `portes` | PROJECT_SIZE | VIEW-CAD-PORTES | ver SQL |
| Tipos de projeto | `tipos_projeto` | PROJECT_TYPE | VIEW-CAD-CLASSIFICACOES | ver SQL |
| Produtos | `produtos` | PRODUCT | VIEW-CAD-CLASSIFICACOES | ver SQL |
| Retorno/Benefícios | `tipos_return_benefit` | BENEFIT_TYPE | VIEW-CAD-CLASSIFICACOES | ver SQL |
| Pilares estratégicos | `pilares_estrategicos` | STRATEGIC_PILLAR | VIEW-CAD-ESTRATEGIA | ver SQL |
| Iniciativas estratégicas | `iniciativas_estrategicas` | STRATEGIC_INITIATIVE | VIEW-CAD-ESTRATEGIA | ver SQL |
| Dados Empresa (parte cadastral) | `empresa_licenciada` (campos cadastrais) | ORGANIZATION | VIEW-CAD-ORG | — |

**Itens novos (sem legado):** nenhum em SCR-23.

### 1.2 SCR-24 · Administração (12 VIEWs)

| Grupo legado | Tabela(s) real(is) | Entidade M | VIEW destino | Qtd em prod. |
|---|---|---|---|---|
| Usuários | `perfis_usuarios` | USER | VIEW-ADM-USUARIOS | ver SQL |
| Atribuição de funções | `usuario_funcoes` | USER_PROFILE_ASSIGNMENT | VIEW-ADM-USUARIOS (seção Perfis) | ver SQL |
| Funções e permissões | `funcoes` + `catalogo_atividades` + `funcao_atividades` | PROFILE · ROLE · PERMISSION | VIEW-ADM-PERFIS | ver SQL |
| Restrição área/atividade | `usuario_funcoes` (campo de escopo) | SCOPE | VIEW-ADM-PERFIS (escopo) | — |
| Responsáveis por atividade | `responsaveis_atividades` + `usuario_atividades_responsavel` | TEAM · TEAM_MEMBERSHIP | VIEW-ADM-EQUIPES | ver SQL |
| SLA e prazos | sem tabela própria (parametrizado no código) | SLA_POLICY · ESCALATION_LEVEL | VIEW-ADM-SLA | — |
| Workflow (etapas) | sem tabela própria (hardcoded) | WORKFLOW · WORKFLOW_VERSION | VIEW-ADM-WORKFLOW | — |
| Fila de e-mail | `emails_pendentes` | EMAIL_QUEUE | VIEW-ADM-INTEGRACOES | ver SQL |
| Auditoria | `audit_events` | AUDIT_EVENT | VIEW-ADM-AUDITORIA | ver SQL |

**Itens novos (sem legado) — precisam de tabelas novas:**

| VIEW | Entidade(s) novas | Nível | Observação |
|---|---|---|---|
| VIEW-ADM-SESSOES | IDENTITY · SESSION | 2 | Sem equivalente legado |
| VIEW-ADM-APTIDOES | SKILL · PERSON_SKILL | 1 | Sem equivalente legado |
| VIEW-ADM-ALCADAS | AUTHORITY_MATRIX · AUTHORITY_RULE | 4 | Absorve alçadas espalhadas por módulo (hardcoded) |
| VIEW-ADM-DELEGACOES | DELEGATION | 3 | Sem equivalente legado |
| VIEW-ADM-SOD | SOD_RULE · SOD_CONFLICT | 4 | Sem equivalente legado |

### 1.3 SCR-25 · Configurações (11 VIEWs)

| Grupo legado | Tabela(s) real(is) | Entidade M | VIEW destino | Qtd em prod. |
|---|---|---|---|---|
| Dados Empresa (parte configuração) | `empresa_licenciada` (campos config.) | ORGANIZATION_PREFERENCE | VIEW-CFG-ORGANIZACAO | — |
| Licenciamento de módulos | `licenca_modulos` + `modulo_funcao` | LICENSE · CAPABILITY | VIEW-CFG-LICENCA | ver SQL |
| Período / Ano Fiscal | `config_periodo_ano_fiscal` | FISCAL_CONFIGURATION | VIEW-CFG-FY | ver SQL |
| Rate Card | `rate_card_papeis` | RATE_CARD · RATE_CARD_LINE | VIEW-CFG-RATECARDS | ver SQL |
| Controle orçamentário | `controle_orcamento` + `percentual_bloqueio_orcamento` | FINANCIAL_POLICY | VIEW-CFG-FINANCEIRO | ver SQL |
| Gestão de Templates | `templates_email` | — | VIEW-CFG-TEMPLATES | ver SQL |
| Gestão fluxo e-mail | sem tabela própria (código) | — | VIEW-CFG-EVENTOS | — |
| IA templates e config | `ia_templates` + `ia_config` | — | VIEW-CFG-IA | ver SQL |

**Itens novos (sem legado) — precisam de tabelas novas:**

| VIEW | Entidade(s) novas | Nível | Observação |
|---|---|---|---|
| VIEW-CFG-ESTIMATIVAS | ESTIMATION_POLICY | 3 | EST-01 motor (V4+) |
| VIEW-CFG-NOTIFICACOES | NOTIFICATION_SETTING | 1 | Sem tabela dedicada hoje |
| VIEW-CFG-EVENTOS | EVENT_CHANNEL_RULE | 2 | Sem tabela dedicada hoje |
| VIEW-CFG-PARAMETROS | SYSTEM_PARAMETER | por parâmetro | 6ª família confirmada (Q6) |

---

## 2. Grupos legados descontinuados (Matriz de Migração)

Os grupos abaixo somem do menu. Os dados migram para as VIEWs indicadas; nenhum dado é descartado.

| Grupo legado no menu | Destino |
|---|---|
| Perfis de Acesso | VIEW-ADM-PERFIS |
| Parâmetros e Cadastros | VIEW-CAD-* + VIEW-CFG-* (por tabela) |
| Proprietário | VIEW-CAD-ORG + VIEW-CFG-ORGANIZACAO |
| Ferramentas Dev (exceto reset) | VIEW-ADM-AUDITORIA (auditoria técnica) |
| Governança › Workflows e Auditoria | VIEW-ADM-WORKFLOW + VIEW-ADM-AUDITORIA |
| Rate Card (menu Financeiro legado) | VIEW-CFG-RATECARDS |
| Notificações (menu Parâmetros legado) | VIEW-CFG-NOTIFICACOES |

---

## 3. modulo_funcao — situação e gap ADM

| Módulo | Entradas atuais | Decisão A0 |
|---|---|---|
| EMAIL | 4 | Mantém; integra com VIEW-ADM-INTEGRACOES |
| FINANCEIRO | 12 | Mantém; integra com VIEW-CFG-FINANCEIRO |
| IA | 2 | Mantém; integra com VIEW-CFG-IA |
| NUCLEO | 19 | Mantém; base de autorização geral |
| PLANEJAMENTO_ESTRATEGICO | 1 | Mantém |
| WORKFLOW | 24 | Mantém; integra com VIEW-ADM-WORKFLOW |
| **ADM** | **0** | **Criar na A1** — funções das 30 VIEWs; classificação: open (Q2) |
| **Total atual** | **62** | |

**Decisão Q2:** As funções do módulo ADM serão classificadas como open (sem gate de licença). Todo usuário com perfil administrativo pode acessar as VIEWs para as quais tem permissão atribuída; o `modulo_funcao` não adiciona restrição adicional de licença para o módulo ADM.

O catálogo de funções ADM está em `adm_funcoes.json` (incluso no pacote do caderno). O INSERT de produção faz parte da entrega A1.

---

## 4. Mecanismos de autorização — sobreposições identificadas

| Mecanismo | Onde vive | Papel | Ação em A1+ |
|---|---|---|---|
| `ehAdministrador` (flag RBAC) | `funcoes.acesso_irrestrito` + `js/config/funcoes.js` | Administrador técnico: acesso irrestrito | Mantém como está (R-ADM-42) |
| `ehProprietario` (flag de papel) | `funcoes.eh_proprietario` + código | Proprietário: acesso a Dados Empresa | Mantém como está (R-ADM-42) |
| `restringePorAtividadeResponsavel` | `js/core/state.js` | Filtro por atividade responsável (perfil OPERADOR) | Mantém; mapeado para VIEW-ADM-ALCADAS como alçada de referência |
| `ignoraRestricaoArea` | `js/core/state.js` | Escopo organizacional irrestrito | Mantém; mapeado para SCOPE em VIEW-ADM-USUARIOS |
| `restricao_area_atividades` (tabela legada) | `usuario_funcoes` (campo de escopo) | Controle de escopo da função | Migra para SCOPE em VIEW-ADM-PERFIS na A3 |

Não há dois mecanismos ativos para a mesma autorização: cada mecanismo resolve uma camada distinta da cadeia TENANT → ... → SCOPE. A sobreposição aparente entre `ehAdministrador` (código) e `funcoes.acesso_irrestrito` (banco) é de design: o código lê o campo do banco, não há duplicidade.

---

## 5. Tabelas novas necessárias (Resumo para A1–A5)

| Fase | Tabelas novas | Qtd estimada |
|---|---|---|
| A1 · Menu | `modulo_funcao` (INSERT ADM) | 0 tabelas novas, 1 INSERT batch |
| A2 · Cadastros | Nenhuma — tabelas existentes migram com ALTER | — |
| A3 · Acesso | `profiles`, `roles`, `permissions`, `user_profile_assignments`, `identity`, `sessions` | ~6 |
| A4 · Autoridade e processos | `authority_matrix`, `authority_rules`, `delegations`, `sod_rules`, `sod_conflicts`, `teams`, `team_memberships`, `skills`, `person_skills`, `workflow_versions`, `workflow_stages`, `sla_policies`, `escalation_levels` | ~13 |
| A5 · Configurações | `organization_preferences`, `fiscal_configurations`, `estimation_policies`, `rate_cards`, `rate_card_lines`, `financial_policies`, `notification_settings`, `event_channel_rules`, `system_parameters` | ~9 |
| A6 · Operação | `integrations`, `service_accounts`, `integration_runs` | ~3 |

Todas as tabelas de fases 3A–3E já criadas (`project_fiscal_transition`, `fiscal_year_closing`, etc.) permanecem intactas.

---

## 6. QA-ADM-14 — Status

| Critério | Resultado |
|---|---|
| 100% dos itens legados com destino ou decisão de descontinuação | ATENDIDO — ver seções 1.1, 1.2, 1.3 e 2 acima |
| Não há dois mecanismos ativos para a mesma autorização | ATENDIDO — ver seção 4; sobreposição aparente explicada |

**A0 concluída. Próxima fase: A1 · Menu e esqueleto.**

---

## Apêndice — Rotas legadas a redirecionar (Matriz de Migração)

| Rota / hash legado | Nova rota |
|---|---|
| `#perfis-acesso` | `/administracao/acesso-e-seguranca/perfis` |
| `#funcoes-permissoes` | `/administracao/acesso-e-seguranca/perfis` |
| `#usuarios` | `/administracao/acesso-e-seguranca/usuarios` |
| `#areas` | `/cadastros/estrutura-organizacional/org` |
| `#cargos` | `/cadastros/estrutura-organizacional/cargos` |
| `#pessoas` | `/cadastros/pessoas-e-entidades/pessoas` |
| `#fornecedores` | `/cadastros/pessoas-e-entidades/fornecedores` |
| `#portes` | `/cadastros/portfolio-e-projetos/portes` |
| `#tipos-projeto`, `#produtos`, `#beneficios` | `/cadastros/portfolio-e-projetos/classificacoes` |
| `#planejamento-estrategico` | `/cadastros/estrategia` |
| `#configuracoes` (empresa licenciada) | `/configuracoes/organizacao-e-licenca/organizacao` |
| `#licenciamento` | `/configuracoes/organizacao-e-licenca/licenca` |
| `#rate-card` | `/configuracoes/planejamento-e-projetos/ratecards` |
| `#controle-orcamento` | `/configuracoes/financeiro` |
| `#periodo-ano-fiscal` | `/configuracoes/planejamento-e-projetos/fy` |
| `#gestao-templates` | `/configuracoes/comunicacao/templates` |
| `#ia-config` | `/configuracoes/inteligencia-artificial` |
| `#auditoria` | `/administracao/auditoria` |
| `#responsaveis` | `/administracao/organizacao-do-trabalho/equipes` |
| `#workflow` | `/administracao/processos-e-sla/workflow` |
| `#prazos` | `/administracao/processos-e-sla/sla` |
| `#fila-email`, `#email-gestao` | `/administracao/integracoes-e-operacao/integracoes` |
