# Matriz de Permissões — Auditoria (Etapa 1)

**Data:** 28/08/2026
**Escopo:** Compasso (Cognitionis) — não cobre Compasso, que é um codebase separado.
**Natureza deste documento:** levantamento e organização. Nenhum comportamento do sistema foi alterado
pra produzir este documento. Toda inconsistência listada na Seção 3 é sinalização para decisão humana,
não uma correção já aplicada. A coluna "Função(ões) autorizada(s) hoje" reflete o conteúdo real de
`funcao_atividades` no banco em 28/08/2026 (consultado diretamente, não estimado).

## 0. Como o controle de acesso funciona hoje — 3 eixos independentes

1. **RBAC por atividade** (`catalogo_atividades` + `funcao_atividades` + `usuario_funcoes`) — o motor
   "oficial": cada linha de `catalogo_atividades` é uma aba/sub-aba/ação (`activity_key`), cada `funcao`
   (papel) é vinculada a um subconjunto delas, e cada usuário tem 1+ funções. Checado via
   `usuarioTemAtividade(activityKey)` / `botaoSeTemAtividade(activityKey, html)`
   (`js/config/funcoes.js`). Funções com `acesso_irrestrito = true` ignoram o catálogo por completo.
2. **Papéis hardcoded** (`ehAdministrador`, `ehProprietario`) — dois booleans globais computados no
   login a partir de `funcoes.acesso_irrestrito` / `funcoes.eh_proprietario` (com fallback pelo nome
   literal — `'ADMINISTRADOR'` / `'PROPRIETARIO'`). Usados em `if`s fora do catálogo — só em
   Ferramentas de Dev e Licenciamento de Módulos (ver Seção 1, pontos #10 e #11).
3. **Licenciamento de Módulos** (`licenca_modulos`, `js/core/licenca.js`) — eixo separado: liga/desliga
   blocos inteiros (`WORKFLOW`, `EMAIL`, `FINANCEIRO`, `PLANEJAMENTO_ESTRATEGICO`) independente de
   quem é o usuário. Um usuário pode ter a atividade liberada e mesmo assim ver a tela bloqueada se o
   módulo dono dela estiver desativado (`TAB_MODULO_MAP`, mesmo arquivo).

**Nenhum dos três eixos é reforçado no banco — RLS está desligado em todas as tabelas** (já anotado em
`CLAUDE.md`, seção "Known gaps"). Tudo abaixo é controle de interface, não de dado: um usuário
autenticado (ou só com a `anon key`, que é pública) pode chamar
`_supabase.from('<qualquer_tabela>').update(...)` direto pelo console do navegador e contornar 100% do
que está descrito neste documento.

---

## 1. Metodologia

Varredura em todo `js/**/*.js` atrás de: `usuarioTemAtividade(`, `botaoSeTemAtividade(`,
`ehAdministrador`, `ehProprietario`, `moduloAtivo(`, `filtrarProjetosPorArea(`, e o padrão
`*Restrito`/`*Conteudo` de `switchTab` (`js/ui/navigation.js`). Cruzado com `catalogo_atividades` (77
linhas), `funcoes` (10 papéis) e `funcao_atividades` (124 concessões) — consulta direta ao banco, não
estimativa.

**Todos os pontos de checagem de permissão encontrados no código — lista completa:**

| # | Onde | O que protege | Como |
|---|---|---|---|
| 1 | `js/config/funcoes.js:aplicarVisibilidadeMenu()` | Visibilidade de **todo** `link-<tabId>`/`view-btn-<tabId>`, para as 77 linhas do catálogo | `usuarioTemAlgumaAtividadeDoTab(tabId) && moduloAtivo(moduloDoTab(tabId))` |
| 2 | `js/approvals/comite.js:50` | Botão Aprovar/Reprovar em Aprovar Orçamento por Projeto | `botaoSeTemAtividade('aprov_comite', ...)` |
| 3 | `js/projects/core.js:545` | Formulário de Nova Demanda | `usuarioTemAtividade('f1_formalizacao:criar')` |
| 4 | `js/projects/core.js:570` | Botão de editar em Formalizar Demanda | `usuarioTemAtividade('f1_formalizacao:a_planejar' \| ':em_andamento')` |
| 5 | `js/requirements/requirements.js:213` | Botão Concluir Etapa de Requerimentos | `botaoSeTemAtividade('req_conclusao', ...)` |
| 6 | `js/technical/technical.js:110` | Botão Concluir Etapa Technical | `botaoSeTemAtividade('tech_conclusao', ...)` |
| 7 | `js/ui/navigation.js` (`funcoes_permissoes`) | Conteúdo real de Funções e Permissões — **inclusive os checkboxes Acesso Irrestrito e É Proprietário** | `usuarioTemAlgumaAtividadeDoTab('funcoes_permissoes')` — **catálogo, não hardcoded** (ver achado crítico #1 abaixo) |
| 8 | `js/ui/navigation.js` (`atribuicao_funcoes`) | Conteúdo real de Atribuição de Função aos Usuários | `usuarioTemAlgumaAtividadeDoTab('atribuicao_funcoes')` — **catálogo, não hardcoded** |
| 9 | `js/ui/navigation.js` (`restricao_area_atividades`) | Conteúdo real de Restrição de Área | `usuarioTemAlgumaAtividadeDoTab('restricao_area_atividades')` — **catálogo, não hardcoded** |
| 10 | `js/ui/navigation.js` (`dev_tools`) + `js/dev-tools/{reset,limpeza-base,criar-teste}.js` | Ferramentas de Dev — checagem repetida em cada ação | `if (ehAdministrador)` — **hardcoded de verdade**, ignora o catálogo |
| 11 | `js/ui/navigation.js` (`licenciamento_modulos`) | Conteúdo real de Licenciamento de Módulos | `if (ehProprietario)` — **hardcoded de verdade** |
| 12 | `js/config/funcoes.js:filtrarProjetosPorArea()` | Filtro de linhas por área do usuário, usado em 15 telas de listagem | `restricao_area` por `activity_key`, ignorado se `ehAdministrador` ou usuário da área TI |
| 13 | `js/requirements/requirements.js` + `js/config/bloqueio-orcamento.js` | Bloqueio de avanço de fase por variação de orçamento | `moduloAtivo('FINANCEIRO')` |
| 14 | `js/ui/navigation.js:switchTab()` (topo da função) | Carregamento de qualquer tela de módulo desativado | `moduloAtivo(moduloDoTab(tabId))` |
| 15 | `js/users/usuarios.js` + `supabase/functions/admin-create-user/index.ts` | Criação de usuário — único ponto com reforço **no servidor** | Edge Function verifica `ADMINISTRADOR` com o service role key |

**Correção importante em relação a uma primeira leitura do código:** os pontos #7, #8 e #9 **não são**
protegidos do mesmo jeito que #10 e #11. Só #10 (Ferramentas de Dev) e #11 (Licenciamento de Módulos)
checam um papel hardcoded que ninguém pode conceder a si mesmo via tela. #7, #8 e #9 checam uma
atividade do catálogo comum — **qualquer papel que receba essa atividade tem acesso total à tela**,
inclusive para editar outros papéis. Isso é a base do achado crítico #1 abaixo.

---

## 2. Matriz completa

Convenção da coluna **Onde é checado**: "Só menu (#1)" = a única proteção é o link sumir do menu — a
tela/ação funciona normalmente se acessada por outro caminho (`switchTab('tabId')` no console, um
bookmark direto). A coluna de função reflete `funcao_atividades` real no banco hoje — **ADMINISTRADOR e
PROPRIETARIO não aparecem em nenhuma linha porque `acesso_irrestrito=true` os faz ignorar o catálogo
inteiro** (eles têm acesso a tudo, sempre, por fora desta tabela).

### FISCAL YEAR

| Ação | Tabela(s) afetada(s) | Operação | Função(ões) autorizada(s) hoje | Onde é checado |
|---|---|---|---|---|
| Gestão do Ano Fiscal | `anos_fiscais_config` | UPDATE | GESTOR TI, GOVERNANÇA | Só menu (#1). Módulo: WORKFLOW |
| Gestão de Projetos Carryover | `projetos` | UPDATE | GESTOR TI, GOVERNANÇA | Só menu (#1). Módulo: WORKFLOW |

### BUSINESS CASE

| Ação | Tabela(s) afetada(s) | Operação | Função(ões) autorizada(s) hoje | Onde é checado |
|---|---|---|---|---|
| Criar Nova Demanda | `projetos`, `contadores_codigo_projeto` | INSERT | FINANCEIRO, GESTOR DE NEGOCIOS | Botão (#3) + menu (#1) |
| Formalizar Demanda — A Planejar/Em Andamento | `projetos` | UPDATE | FINANCEIRO, GESTOR DE NEGOCIOS | Botão (#4) + menu (#1) |
| Formalizar Demanda — Canceladas (consulta) | `projetos` | SELECT | FINANCEIRO, GESTOR DE NEGOCIOS | Só menu (#1) |
| Orçamentar Demanda (A Planejar/Em Andamento/Concluídas) | `projetos` | UPDATE | GESTOR TI | **Só menu (#1)** — nenhum botão de ação é checado individualmente |
| **Aprovar Orçamento por Projeto** | `projetos` (`val_bc`, `etapa_atual`) | UPDATE | FINANCEIRO | Botão de aprovar/reprovar (#2) + menu (#1) |
| **Aprovar Orçamento Fiscal Year** | `projetos`, `anos_fiscais_config` | UPDATE | FINANCEIRO | **Só menu (#1)** — o botão de aprovação em si não é checado (ver 3.c) |
| **Aprovar Demanda Extraordinária** | `projetos`, `adhoc_aprovacoes` | INSERT/UPDATE | GESTOR TI, GOVERNANÇA | **Só menu (#1)** |

### REQUERIMENTS

| Ação | Tabela(s) afetada(s) | Operação | Função(ões) autorizada(s) hoje | Onde é checado |
|---|---|---|---|---|
| Gerar Requerimentos — A Planejar | `projeto_etapas` | INSERT/UPDATE | GESTOR TI | Só menu (#1) |
| Gerar Requerimentos — Em Andamento/Concluídas | `projeto_etapas` | UPDATE/SELECT | GESTOR TI, ANALISTA DE TI | Só menu (#1) |
| Avaliar Requerimentos por Negócio | `projeto_etapas`, `log_decisoes_etapa` | UPDATE | APROVADOR (NEGÓCIOS) | **Só menu (#1)** |
| Avaliar Requerimentos por TI | `projeto_etapas`, `log_decisoes_etapa` | UPDATE | GESTOR TI | **Só menu (#1)** |
| **Concluir Etapa de Requerimentos** (decide bloqueio por variação de orçamento) | `projetos`, `log_alteracoes_horas` | UPDATE | GESTOR TI | Botão (#5) + menu (#1) + `moduloAtivo('FINANCEIRO')` (#13) |

### TECNICAL

| Ação | Tabela(s) afetada(s) | Operação | Função(ões) autorizada(s) hoje | Onde é checado |
|---|---|---|---|---|
| Gerar Especificação — A Planejar | `projeto_etapas` | INSERT/UPDATE | GESTOR TI | Só menu (#1) |
| Gerar Especificação — Execução | `projeto_etapas` | UPDATE | GESTOR TI, ANALISTA DE TI | Só menu (#1) |
| Avaliar Especificação por Negócio | `projeto_etapas`, `log_decisoes_etapa` | UPDATE | APROVADOR (NEGÓCIOS) | **Só menu (#1)** |
| **Concluir Etapa Tecnical** | `projetos`, `log_alteracoes_horas` | UPDATE | GESTOR TI | Botão (#6) + menu (#1) + `moduloAtivo('FINANCEIRO')` (#13) |

### EXECUTION / UAT / GO-LIVE

| Ação | Tabela(s) afetada(s) | Operação | Função(ões) autorizada(s) hoje | Onde é checado |
|---|---|---|---|---|
| Execution (Planejar/Andamento/Subprojetos) | `projeto_etapas` | INSERT/UPDATE | GESTOR TI, ANALISTA DE TI | **Só menu (#1)** |
| UAT — Ratificar, Em Andamento | `projeto_etapas`, `log_ratificacao_planejamento` | UPDATE | GESTOR TI, ANALISTA DE TI | **Só menu (#1)** |
| Go-Live — Ratificar, Em Andamento | `projeto_etapas` | UPDATE | GESTOR TI, ANALISTA DE TI | **Só menu (#1)** |
| Go-Live — Gestão de Ocorrências | `golive_ocorrencias` | INSERT/UPDATE | GESTOR TI | **Só menu (#1)** |
| **Go-Live — Termo de Aceite de Projeto** (documento formal) | `golive_termo_aceite` | INSERT | GESTOR TI (só ela — nenhum papel de aprovação de negócio tem essa atividade) | **Só menu (#1)** |
| Concluir Projeto | `projetos` | UPDATE | GESTOR TI | **Só menu (#1)** |

### GOVERNANÇA

| Ação | Tabela(s) afetada(s) | Operação | Função(ões) autorizada(s) hoje | Onde é checado |
|---|---|---|---|---|
| Cobrança de Ajustes | `emails_pendentes`, `email_fluxo` | INSERT | GOVERNANÇA | Só menu (#1). Módulo: EMAIL |
| Retomar Projetos em Hold | `projetos`, `log_retomada_hold` | UPDATE | GOVERNANÇA | Só menu (#1) |
| **Mudança de Orçamento** (libera projeto bloqueado por estouro) | `projetos`, `log_aprovacao_mudanca_orcamento` | UPDATE/INSERT | *(nenhum papel não-admin tem `mudanca_orcamento` concedida hoje — só ADMINISTRADOR/PROPRIETARIO acessam)* | **Só menu (#1)** + `moduloAtivo('FINANCEIRO')` (#14) |

### CONTRATO E TERCEIROS (módulo FINANCEIRO)

| Ação | Tabela(s) afetada(s) | Operação | Função(ões) autorizada(s) hoje | Onde é checado |
|---|---|---|---|---|
| Empresas Terceirizadas | `empresas_terceirizadas` | INSERT/UPDATE | GESTOR TI, GOVERNANÇA | **Só menu (#1)** |
| Contratos Terceirizados | `contratos_projeto`, `contratos_pagamentos` | INSERT/UPDATE | GESTOR TI, GOVERNANÇA | **Só menu (#1)** |
| Contratos por Projeto (vínculo) | `contratos_vinculos_projeto`, `log_alteracao_vinculo_contrato` | INSERT/UPDATE/DELETE | GESTOR TI, GOVERNANÇA | **Só menu (#1)** |
| **Registro de Valores Realizados** (lançamento financeiro real) | `contratos_pagamentos` | INSERT/UPDATE | GESTOR TI, GOVERNANÇA | **Só menu (#1)** |
| Relatório de Projetos (Contratos) | — | SELECT | GESTOR TI, GOVERNANÇA | Só menu (#1) |

> **Nota de nomenclatura** (ver 3.c #6): o papel chamado **FINANCEIRO** não tem nenhuma atividade deste
> grupo — só GESTOR TI e GOVERNANÇA têm. Quem gerencia contratos e pagamentos hoje, pelo nome dos
> papéis, é "Gestor de TI".

### PERFIS DE ACESSO

| Ação | Tabela(s) afetada(s) | Operação | Função(ões) autorizada(s) hoje | Onde é checado |
|---|---|---|---|---|
| **Cadastrar Novos Usuários** | `usuarios` (via Edge Function) | INSERT | GOVERNANÇA | Menu (#1) + **reforço no servidor** (#15) |
| Usuários Cadastrados (editar perfil/área/cargo) | `usuarios` | UPDATE | GOVERNANÇA | **Só menu (#1)** — a edição de perfil é um `update` direto no cliente, não passa pela Edge Function |
| **Cadastrar/Editar Funções** (inclui os checkboxes Acesso Irrestrito e É Proprietário) | `funcoes` | INSERT/UPDATE | GOVERNANÇA | Tela inteira (#7) — **catálogo comum, não hardcoded** (ver achado crítico #1) |
| **Atribuição de Função aos Usuários** | `usuario_funcoes` | INSERT/DELETE | GOVERNANÇA | Tela inteira (#8) — **catálogo comum, não hardcoded** |
| Responsáveis por Atividades | `responsaveis_atividades`, `usuario_atividades_responsavel` | INSERT/UPDATE | GOVERNANÇA | Só menu (#1) |
| Restrição de Área por Atividade | `catalogo_atividades` | UPDATE | GOVERNANÇA | Tela inteira (#9) — **catálogo comum, não hardcoded** |

### PARÂMETROS E CADASTRO

| Ação | Tabela(s) afetada(s) | Operação | Função(ões) autorizada(s) hoje | Onde é checado |
|---|---|---|---|---|
| Áreas Solicitantes | `areas_solicitantes` | INSERT/UPDATE/DELETE | GOVERNANÇA | Só menu (#1) |
| Pessoas Solicitantes | `pessoas_solicitantes` | INSERT/UPDATE/DELETE | GOVERNANÇA | Só menu (#1) |
| Cadastro de Porte | `portes` | INSERT/UPDATE | GOVERNANÇA | Só menu (#1) |
| Tipos de Projetos | `tipos_projeto` | INSERT/UPDATE | GOVERNANÇA | Só menu (#1) |
| Return / Benefit | `tipos_return_benefit`, `projeto_benefit_results` | INSERT/UPDATE | GOVERNANÇA | Só menu (#1) |
| Planejamento Estratégico (Pilares/Iniciativas) | `pilares_estrategicos`, `iniciativas_estrategicas` | INSERT/UPDATE | GOVERNANÇA | Só menu (#1). Módulo: PLANEJAMENTO_ESTRATEGICO |

### ADMINISTRAÇÃO

| Ação | Tabela(s) afetada(s) | Operação | Função(ões) autorizada(s) hoje | Onde é checado |
|---|---|---|---|---|
| Fases e Etapas do Workflow | `fases_etapas` | INSERT/UPDATE | GOVERNANÇA | **Só menu (#1)** — mexe na sequência de todo o motor de fases |
| SLA e Prazos | `sla_etapa_porte`, `parametro_prazos`/`parametros_prazos` | INSERT/UPDATE | GOVERNANÇA, ANALISTA DE TI | Só menu (#1) |
| Gestão de Templates (e-mail) | `email_templates` | INSERT/UPDATE | GESTOR DE EMAIL, GOVERNANÇA | Só menu (#1). Módulo: EMAIL |
| Gestão do Fluxo de E-mail | `email_fluxo` | UPDATE | GESTOR DE EMAIL, GOVERNANÇA | Só menu (#1). Módulo: EMAIL |
| Fila de E-mail | `emails_pendentes` | UPDATE/DELETE | GESTOR DE EMAIL, GOVERNANÇA | Só menu (#1). Módulo: EMAIL |
| Cargos | `cargos` | INSERT/UPDATE | *(nenhum papel não-admin)* | Só menu (#1) |
| Percentual de Bloqueio de Orçamento | `config_bloqueio_orcamento` | UPDATE | *(nenhum papel não-admin)* | Só menu (#1). Módulo: FINANCEIRO |
| **Licenciamento de Módulos** | `licenca_modulos` | UPDATE | **Só PROPRIETARIO** | Tela inteira (#11) — único ponto restrito por `ehProprietario`, não pelo catálogo |

### FERRAMENTAS DO DEV

| Ação | Tabela(s) afetada(s) | Operação | Função(ões) autorizada(s) hoje | Onde é checado |
|---|---|---|---|---|
| Reset de Base | `projetos`, `projeto_etapas`, etc. | UPDATE/DELETE | **Só ADMINISTRADOR** (hardcoded) | Tela + cada ação (#10) |
| Limpeza Física de Base | `projetos`, `anos_fiscais_config`, `contadores_codigo_projeto` | **DELETE** | **Só ADMINISTRADOR** (hardcoded) | Tela + cada ação (#10) |
| Criar Projeto de Teste | `projetos` | INSERT | **Só ADMINISTRADOR** (hardcoded) | Tela + ação (#10) |

### DASHBOARD / ROADMAP / CONSULTAS / FINANCEIRO / CRONOGRAMA (visões)

| Ação | Tabela(s) afetada(s) | Operação | Função(ões) autorizada(s) hoje | Onde é checado |
|---|---|---|---|---|
| Dashboard | `projetos` (agregado) | SELECT | FINANCEIRO, EXECUTIVO, GESTOR DE NEGOCIOS, GESTOR TI, GOVERNANÇA | Menu (#1) + restrição de área (#12, ativa aqui) |
| Roadmap | `projetos` (agregado) | SELECT | mesmos acima | Menu (#1) + restrição de área (#12, ativa). Módulo: WORKFLOW |
| Visão de Orçamento | `projetos`, `contratos_pagamentos` | SELECT | EXECUTIVO, GESTOR DE NEGOCIOS, GESTOR TI, GOVERNANÇA (**não** FINANCEIRO — ver nota acima) | Menu (#1) + restrição de área. Módulo: FINANCEIRO |
| Alertas de Orçamento | `projetos` | SELECT | mesmos de Visão de Orçamento | Menu (#1) + restrição de área. Módulo: FINANCEIRO |
| Cronograma e Evolução | `projetos` | SELECT | EXECUTIVO, ANALISTA DE TI, GESTOR TI, GOVERNANÇA, GESTOR DE NEGOCIOS | Menu (#1) + restrição de área |
| Consultas | `projetos` | SELECT | Todos os papéis não-admin exceto GESTOR DE EMAIL | Menu (#1) + restrição de área |

**Cobertura:** 77 linhas de `catalogo_atividades` + 2 papéis hardcoded (#10, #11) + 1 eixo de módulos (4
módulos) = **80 pontos de controle**, todos mapeados acima.

---

## 3. Comparação com o banco — inconsistências encontradas

### Achado crítico #1 — GOVERNANÇA pode se autopromover a ADMINISTRADOR/PROPRIETARIO pela própria UI

Este é o achado mais importante deste levantamento, e só apareceu ao cruzar o código com o conteúdo
real de `funcao_atividades` (não bastava ler o código isoladamente).

- `funcoes_permissoes` (tela que cria/edita papéis, **incluindo os checkboxes "Acesso Irrestrito" e "É
  Proprietário"**) e `atribuicao_funcoes` (tela que atribui papéis a usuários) são protegidas pelo
  **mesmo mecanismo comum de catálogo** que qualquer outra tela (#7, #8) — não pelo `ehAdministrador`
  hardcoded que protege Ferramentas de Dev.
- O papel **GOVERNANÇA** tem as duas atividades concedidas hoje (`funcoes_permissoes:criar`,
  `funcoes_permissoes:cadastradas`, `atribuicao_funcoes`), junto com `restricao_area_atividades`,
  `usuarios:criar/cadastrados` e praticamente todo o resto de PERFIS DE ACESSO/PARÂMETROS/ADMINISTRAÇÃO
  (39 atividades ao todo — o papel com mais atividades concedidas do sistema, mais que qualquer outro
  não-admin).
- Isso significa que **qualquer usuário com o papel GOVERNANÇA pode, pela tela normal do sistema — sem
  precisar de DevTools nem contornar nada — entrar em Funções e Permissões, editar o próprio papel
  GOVERNANÇA (ou criar um novo) e marcar "Acesso Irrestrito" e/ou "É Proprietário"**, virando
  ADMINISTRADOR ou PROPRIETARIO por conta própria. Não existe log de auditoria dessa tela — a mudança
  não fica registrada em lugar nenhum além do valor final da coluna.
- **Mitigante hoje:** nenhum usuário real tem o papel GOVERNANÇA atribuído no momento (confirmado
  direto no banco — os 6 usuários cadastrados têm ADMINISTRADOR, PROPRIETARIO, GESTOR DE EMAIL,
  EXECUTIVO ou FINANCEIRO). Ou seja, a exposição é de **configuração**, não de **uso ativo** — mas
  qualquer atribuição futura do papel GOVERNANÇA (ele existe e parece pensado pra um gestor de
  operações, não pra um administrador de sistema) herda esse poder sem nenhum aviso na tela de
  Atribuição de Função.

### 3.a — Ações protegidas no código sem registro correspondente na tabela

- `ehAdministrador` e `ehProprietario` (Ferramentas de Dev, Licenciamento de Módulos) são flags de
  papel, não atividades — não aparecem em `catalogo_atividades`. Por design, mas vale deixar
  explícito: o catálogo não é o inventário completo de "coisas que exigem permissão".
- `moduloAtivo(...)` (Licenciamento de Módulos) também não tem representação no catálogo — checado
  direto contra `licenca_modulos`, tabela paralela.
- `licenciamento_modulos` tem `ordem = 76` no catálogo, colidindo com `mudanca_orcamento` (mesma
  `ordem`, já existente antes desta sessão) — efeito só cosmético (ordenação da tela).

### 3.b — Cobertura por proteção real (além do menu)

Das 77 linhas do catálogo, **62 (≈80%) não têm nenhuma segunda camada além do link do menu sumir**
(marcadas "Só menu (#1)" na Seção 2) — incluindo grupos inteiros como EXECUTION, CONTRATO E TERCEIROS e
PARÂMETROS E CADASTRO. Isso não torna a atividade "inútil" (o link sumir é proteção de UX real pra
navegação normal), mas não protege contra acesso direto (`switchTab(...)` no console) nem contra
chamada direta à API do Supabase (sem RLS).

### 3.c — Inconsistências (mesma ação, checada de formas diferentes)

1. **Concluir Etapa (Requerimentos/Technical) vs. Concluir Fase Genérica (Execution/UAT/Go-Live)** —
   os dois primeiros têm botão de ação checado (`botaoSeTemAtividade`); os demais, usando o mesmo motor
   compartilhado `js/phases/generic-workflow-ui.js`, não têm nenhuma checagem em nenhum botão.
2. **Aprovar Orçamento por Projeto vs. Aprovar Orçamento Fiscal Year** — a primeira tem o botão de
   aprovar/reprovar checado; a segunda (mesma decisão, escala maior) não tem nenhuma checagem além do
   menu, apesar de estarem lado a lado no mesmo grupo do catálogo.
3. **`funcoes_permissoes`/`atribuicao_funcoes`/`restricao_area_atividades` vs. `dev_tools`/
   `licenciamento_modulos`** — as 3 primeiras usam o catálogo comum (concedível a qualquer papel); as
   2 últimas usam papel hardcoded (não concedível). Mesmo "nível de criticidade" percebido (são todas
   telas de administração do próprio sistema de permissões), dois modelos de proteção diferentes — e é
   essa diferença que produz o achado crítico #1.
4. **`licenciamento_modulos` duplicado em `ordem = 76`** no catálogo (ver 3.a).
5. **Restrição de área desigual dentro do mesmo grupo de sub-abas** — `f1_formalizacao:canceladas` não
   passa por `filtrarProjetosPorArea`, enquanto `:criar`, `:a_planejar` e `:em_andamento` (mesmo grupo)
   passam. Sem efeito hoje (`restricao_area` nasce `false` em tudo), mas quebra a expectativa se
   alguém marcar `restricao_area = true` nessa sub-aba específica esperando que funcione como as
   irmãs.
6. **O papel chamado FINANCEIRO não tem nenhuma atividade financeira** — zero atividades de CONTRATO E
   TERCEIROS, `visao_orcamento` ou `alertas_orcamento`. Quem tem essas atividades são GESTOR TI e
   GOVERNANÇA. O nome do papel não corresponde ao que ele de fato acessa — risco de confusão na hora
   de atribuir papéis (alguém vendo "FINANCEIRO" na lista de papéis e presumindo que dá acesso
   financeiro).

### Achado crítico #2 — RLS desligado (infraestrutura, não específico de nenhuma tela)

Já documentado em `CLAUDE.md`. Repetido aqui porque é o que torna a Seção 3.b relevante de verdade: sem
RLS, "só menu" não é uma segunda linha de defesa — é a única, pra qualquer ação que não tenha um dos 15
pontos de checagem da Seção 1.

---

## 4. Resumo

- **Ações mapeadas:** 77 linhas do catálogo (100% cobertas) + 2 papéis hardcoded + 1 eixo de módulos (4
  módulos) = **80 pontos de controle**, todos na Seção 2.
- **Pontos com proteção além do link do menu:** 15 de ~80 (≈19%).
- **Lacunas/inconsistências encontradas:** 2 achados críticos (autopromoção via GOVERNANÇA; RLS
  desligado) + 6 inconsistências estruturais (Seção 3.c) + 3 itens de "sem registro correspondente"
  (Seção 3.a).
- **As 3 mais críticas, na minha avaliação:**
  1. **GOVERNANÇA pode se autopromover a ADMINISTRADOR/PROPRIETARIO pela própria tela do sistema**
     (achado crítico #1) — não precisa de DevTools nem de contornar nada; é a única lacuna deste
     levantamento que é uma falha de **design** da separação de papéis, não só de reforço ausente.
     Ainda não está em uso (nenhum usuário tem GOVERNANÇA hoje), mas é a mais grave.
  2. **RLS desligado** (achado crítico #2) — fundação de tudo o resto; sem ele, fechar botões
     individualmente é só UX.
  3. **Aprovar Orçamento Fiscal Year sem checagem de botão** (3.c #2) — decisão financeira de escala
     maior que a aprovação por projeto (que É protegida), sem nenhuma verificação além do menu.

Nenhuma mudança de comportamento foi feita. Recomendo decidir a prioridade entre: (a) separar
`funcoes_permissoes`/`atribuicao_funcoes` do catálogo comum, exigindo `ehAdministrador` como camada
extra (mesmo padrão de Ferramentas de Dev) — resolve o achado crítico #1 rápido; (b) RLS — estrutural,
maior esforço, mas é o que sustenta tudo; (c) fechar os botões de ação individuais nos ~62 pontos "só
menu" — importante, mas de valor limitado enquanto RLS estiver desligado.
