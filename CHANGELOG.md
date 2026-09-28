# Changelog — Compasso

Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/);
versionamento [SemVer](https://semver.org/lang/pt-BR/) (MAJOR.MINOR.PATCH).
"Release N" é o rótulo comercial do ciclo.

A versão vigente é a de `js/core/version.js` (`COMPASSO_VERSAO`), exibida no
rodapé do login, no rodapé do menu lateral e na tela inicial.

## Como lançar uma versão

1. Editar `COMPASSO_VERSAO` em `js/core/version.js` (subir `numero`; subir
   `release` só em marcos comerciais; ajustar `data`).
2. Acrescentar a seção correspondente aqui, movendo os itens de
   *Não lançado* para ela.
3. Commit. (Deploy é o push para `main`, que dispara o Netlify.)

---

## [Não lançado]

---

## [2.1.0] - 2026-09-28 — Release 2

**Cobertura de Relatórios — 5 novos exports CSV**

### Relatórios Aprimorados (V19 + V20 + V22)

- **Export de Decisões de Fechamento AF** (V19): exporta `fechamento_af_decisoes`
  completo — Ano Fiscal, Projeto, Decisão (CONTINUAR/HOLD/CANCELAR/REVERTIDO/
  ABSORVIDO), Orçamento Remanescente, Observação, Decidido por, Quando.
- **Export de Medições de Custo** (V20): exporta `medicoes` — registros periódicos
  de custo real por projeto (período, valor, descrição, autor).
- **Export de Forecasts (EAC)** (V20): exporta `forecasts` — revisões do Estimate
  at Completion por projeto (valor EAC, premissa, autor).
- **Export de Rate Card** (V22): exporta `rate_card_papeis` — lista completa de
  papéis e valores/hora (papel, valor/hora, ativo, atualizado por).
- **Export de Estimativas EST-01/02/03** (V22): exporta `business_case_estimativas`
  — histórico versionado de estimativas por projeto e fase (projeto, fase, versão,
  horas, custo estimado, premissas, autor, data).

O catálogo de Relatórios passa de 9 para 14 entradas desde o lançamento 2.0.0.

---

## [2.0.0] - 2026-09-28 — Release 2

**Compasso 2.0 — Governança, IA, Compliance e Financeiro Avançado**

### Governança de Perfis e Acesso

- **Perfil OPERADOR — restrição por atividade responsável** (V8 prep / 2026-09-11).
  Nova chave por função "Restringe por Atividade Responsável": perfil marcado assim
  só enxerga projeto onde está registrado como responsável de etapa
  (`projeto_etapas.responsavel_etapa_email`). Filtro dentro de
  `filtrarProjetosPorArea` (ponto único compartilhado por ~25 telas).
- **Troca de Responsável de Atividade** (menu Governança): reatribuição uma a uma
  ou em lote, com auditoria em `log_troca_responsavel_atividade`.
  SQL: `sql/2026-09-11_perfil_operador_restricao_atividade.sql`.

### Financeiro Avançado (V8)

- **Medições de Custo e Forecasts (EAC)**: registros periódicos de custo real
  (`medicoes_custo`), cálculo de EAC/CPI/SPI, gráfico de tendência e projeção
  de custo final. Nova aba "Medições / EAC" no Workspace Financeiro.
  SQL: `sql/2026-09-28_v8_medicoes_custo.sql`.

### Auditoria e Compliance (V9)

- **Trilha de auditoria `audit_events`**: triggers `SECURITY DEFINER` em
  `business_cases` e `projects` gravam automaticamente CRIADO, PROJECT\_CRIADO,
  FASE\_ALTERADA, STATUS\_ALTERADO, ORCAMENTO\_ALTERADO, BLOQUEIO\_ALTERADO.
- **Tela Auditoria** (menu Governança): timeline tabular com filtros (projeto,
  ação, período, usuário), paginação de 100 e exportação CSV da página atual.
  SQL: `sql/2026-09-28_v9_audit_events.sql`.

### Inteligência Artificial (V10)

- **Especificação Técnica com IA** (Workspace Projeto, aba IA — M06 + M07):
  geração assistida de especificação técnica, refinamento iterativo e persistência
  em `ia_especificacoes`. Orquestrador com chamada a `/.netlify/functions/ia-orquestrador`.
  SQL: `sql/2026-09-28_v10_ia_especificacoes.sql`.

### Entitlements de Módulos (V11 + V13)

- **`licenca_modulos`**: tabela de entitlements por módulo (WORKFLOW, EMAIL,
  FINANCEIRO, PLANEJAMENTO\_ESTRATEGICO, IA) com `status`, `ativo`, `valid_from`,
  `valid_until`, `contractual_limit`. Tela de gestão em Licença da Empresa.
  SQL: `sql/2026-09-28_v11_licenca_modulos.sql`.
- **Histórico de alterações de entitlements** (`licenca_modulos_historico`):
  trigger `SECURITY DEFINER` registra toda mudança de `status`, `ativo`,
  `valid_from`, `valid_until` e `contractual_limit`. Toggle "ver histórico"
  na tela de entitlements.
  SQL: `sql/2026-09-28_v13_licenca_historico.sql`.

### RAID — Gate de Conclusão (V12)

- **RAID-02 enforcement**: ao concluir uma etapa, o sistema bloqueia se existir
  item RAID crítico em aberto vinculado ao projeto. Modal de confirmação lista
  os itens bloqueantes; a conclusão só prossegue após tratar ou overriding
  com justificativa registrada.

### Relatórios Aprimorados (V14 + V16)

- **3 novos exports CSV** no catálogo de Relatórios: Tarefas da Carteira
  (todos os projetos visíveis), Gates e Aprovações (histórico de gates),
  Histórico de Licenciamento (`licenca_modulos_historico`).
- **Export de Auditoria de Projetos**: exporta `audit_events` completo via
  query direta — sem limite de página, ao contrário do export da tela de Auditoria
  (que exporta só a página atual do DOM).

### Fechamento de Ano Fiscal — Absorção de Carryover (V15)

- **FY-02 — Absorção operacional de carryover**: nova aba "Absorção de Carryover"
  na tela Fechamento Ano Fiscal. Lista projetos com `is_carryover=true` do AF
  anterior; botão "Absorver" migra `ano_fiscal` para o AF atual, limpa os campos
  de carryover e grava `decisao='ABSORVIDO'` em `fechamento_af_decisoes`.
- Novo campo `carryover_ano_origem` em `business_cases` para rastreabilidade.
  SQL: `sql/2026-09-28_v15_carryover_absorcao.sql`.
- **Correção de exibição**: `resultado-af.js` scoped carryover ao AF de origem
  + imediatamente o próximo AF, eliminando o "floating" em todos os AFs futuros.

### Correção de Escopo de Carryover (V17)

- **`filtrar­Projetos­Por­Ano­Fiscal­Selecionado`** corrigido: projetos com
  `is_carryover=true` aparecem apenas no AF de origem e no AF imediatamente
  seguinte — não em todos os AFs futuros. Afeta Dashboard, Visão de Orçamento,
  Roadmap, Portfólio Executivo, Consulta de Projetos e Financeiro Corporativo.

---

## [1.2.0] - 2026-09-10 — Release 1

**Contratos e Fornecedores — canal de e-mail**

- Pendências de Contratos: nova aba **"Modelo de E-mail"** — escolhe o
  contrato e gera o texto padrão do e-mail de lançamento já com o número e os
  projetos vinculados (formato simples para 1 projeto, formato com rateio para
  vários), com botão copiar e tabela de saldo por projeto.
- Pagamento por e-mail passa a aceitar **rateio entre vários projetos** do
  mesmo contrato (bloco `Rateio:` + `Valor Total da NF:`); a soma do rateio
  tem de fechar com o total, senão erro de leitura.
- Cadastro de Fornecedores: campo **e-mail de contato** + atributos
  **A ("envia pagamentos por e-mail", editável)** e
  **B ("envio aprovado", via habilitação)**. Ao ligar A, o sistema enfileira
  ao fornecedor o template *MODELO PADRÃO PARA ENVIO DE PAGAMENTOS E NOTA
  FISCAL*.
- **Habilitação do fornecedor:** e-mail inicial com referência
  `HABILITACAO-FORNECEDOR` + código + R$ 0,10 entra como pendência tipo
  **HABILITACAO**; aprovar liga o atributo B. Enquanto B estiver desligado,
  e-mails de pagamento do fornecedor entram com erro de leitura (log
  `FORNECEDOR_NAO_AUTORIZADO`), sem virar pagamento.
- Nova env var da função de inbound: `INBOUND_CONTRATOS_HABILITACAO_REF`
  (padrão `HABILITACAO-FORNECEDOR`).
- SQL: `sql/2026-09-10_fornecedor_habilitacao_email.sql`.

---

## [1.1.0] - 2026-09-09 — Release 1

**Módulo Financeiro & Contratos — Contratos e Fornecedores com aprovação de
pagamentos/propostas.** Toda a entrega foi desenvolvida na branch `release-1`,
isolada da produção (Release 0), e agora integrada ao `main`.

### Contratos e Fornecedores

- **Renomeações** (menu, workflow, parâmetros, funções, catálogo de
  atividades): "Contratos e Terceiros" → **Contratos e Fornecedores**;
  "Empresas Terceirizadas" → **Fornecedores**; "Contratos por Projeto" →
  **Vincular Projeto e Contrato**.
- **Vincular Projeto e Contrato** — além da visão Projeto → Contrato, nova
  visão **Contrato → Projeto**: distribui o valor do contrato entre os
  projetos e mostra total / distribuído / saldo / realizado do contrato. Ao
  selecionar um projeto em qualquer das visões, os valores dele (orçamento,
  já vinculado, saldo) e as horas aparecem no painel. Regras mantidas: Σ
  vínculos de um projeto ≤ orçamento do projeto; Σ vínculos de um contrato ≤
  valor do contrato; vínculo só é editável/excluível enquanto não houver
  valor realizado.
- **Numeração automática de contrato** por Ano Fiscal (`contadores_contrato_af`
  + RPC atômica `proximo_numero_contrato`), formato
  `EMPRESA + AAAA + MM + sequência`.
- **Pagamento por Nota Fiscal — cabeçalho + itens.** Um pagamento (uma NF)
  pode envolver vários projetos do mesmo contrato: registra-se o valor total
  da NF e o rateio por projeto (Σ itens = total da NF; rateio ≤ saldo do
  vínculo; Σ pagamentos ≤ valor do contrato). Anexo da NF na própria tela.
  "Registro de Valores Realizados" e o lançamento manual passaram a ser **o
  mesmo formulário**; o Fornecedor vem do contrato (consulta), não é digitado.
- **Pendências de Contratos** (staging, módulo FINANCEIRO) — toda entrada
  (lançamento manual, planilha Excel, e-mail) cai como pendente e só vai para
  a base oficial (`contratos_pagamentos` / nova `contratos_propostas`) depois
  de aprovada. Anexo de Nota Fiscal em Supabase Storage, com bloqueio de
  aprovação sem NF (override por justificativa registrada). Trilha de
  auditoria append-only. Nova função de catálogo
  `contratos_pendencias:{consultar,importar,aprovar}`, concedível a qualquer
  perfil.
- **Escalonamento de NF pendente > 5 dias úteis** — uma pendência "NF não
  recebida" que passar de 5 dias úteis gera um e-mail de alerta (uma única
  vez) pela fila de e-mail existente. Novo ponto de disparo
  `PENDÊNCIAS DE CONTRATO / ESCALONAMENTO NF` em *Envio de E-mail — Gestão do
  Fluxo* (nasce inativo; admin define destinatário/remetente e liga).
- **Canal de e-mail padronizado por webhook** — Netlify Function
  `receber-email-contratos` recebe o inbound de um provedor de e-mail, faz o
  parsing do assunto e do corpo (spec §4.2/§4.3) e cria a pendência
  (`origem = 'EMAIL'`), que segue para aprovação como qualquer outra. Anexos
  PDF/JPG/PNG viram Nota Fiscal no Storage; campo obrigatório ausente →
  `ERRO_LEITURA` (nunca descartado). Provedor plugável
  (`netlify/functions/providers/inbound/`), dedupe por `Message-Id`.
  Autenticação por segredo compartilhado (`INBOUND_CONTRATOS_SECRET`);
  identificação da instância pelo campo `Referência`
  (`INBOUND_CONTRATOS_REFERENCIA`). Guia: `docs/CANAL_EMAIL_CONTRATOS.md`.
- **Relatório de Projetos** — permite consultar a Nota Fiscal do pagamento.
- Exemplos de planilha atualizados (`docs/exemplo_pendencias_contratos.xlsx`,
  `docs/exemplo_pagamento_rateio_excel.xlsx`).
- Classificação de anexos (NF / comprovante / outro): pendente de refinamento
  na UI.

### Ferramentas de Dev

- Novo botão **"Zerar Contratos e Fornecedores"** (exclusivo do Proprietário):
  apaga contratos, vínculos, pendências, propostas, pagamentos por NF e anexos
  do bucket, mantendo projetos e o cadastro de Fornecedores; recalcula o
  realizado dos projetos. Equivalente em SQL:
  `sql/2026-09-09_reset_contratos_para_testes.sql`.
- Reset para Fase 1 e as limpezas de base por projeto passam a remover também
  as pendências/propostas de contrato dos projetos afetados.

### Ajustes gerais desde o Release 0

- Cadastro de Produtos, Tipos de Projeto e Cargos: nome/descrição editável
  enquanto não estiver em uso.
- Percentual de Bloqueio de Orçamento: valor vigente + histórico de alteração.
- Detalhamento do Projeto: bloco "Decisão do Comitê" e "Histórico de
  Decisões de Etapa".
- Licenciamento de Módulos: aprovações do Business Case e trava de variação
  de orçamento migradas de FINANCEIRO para WORKFLOW (eram passo obrigatório
  do fluxo).
- Funções: caixa "Ignora Restrição de Área" (exceção por papel, sem Acesso
  Irrestrito).
- Roteiro de Instalação e Primeira Configuração no manual; carga zero
  revisada (auth.users, cargo reservado, área COGNITIONIS).

---

## [1.0.0] - 2026-09-03 — Release 0

Primeira versão versionada. Consolida tudo que já estava em produção mais as
entregas de 03/09/2026.

### Governança de Ano Fiscal
- **Fechamento Ano Fiscal** — tela única com duas abas (avaliação consolidada
  + botão "Fechar Ano Fiscal" com log; decisão projeto a projeto: Carryover
  Desenvolvimento / Carryover Hold / Cancelar / Reverter). Substitui "Projetos
  Carry Over".
- **Período do Ano Fiscal** parametrizável (mês de início configurável, com
  vigência) — antes era abril–março fixo no código.
- Seletor de Ano Fiscal (Dashboard/Roadmap/Financeiro/Consulta) alimentado
  pela configuração de Anos Fiscais, não pela data do dia.
- Abertura do próximo AF passa a exigir o AF anterior formalmente fechado.

### Orçamento
- **Controle Orçamentário** — parâmetro Ano Fiscal / Área / Produto que rege a
  elegibilidade de projetos no trade-off da Demanda Extraordinária.
- **Validação de Trade-off Extraordinário** — fila de aprovação (com motivo e
  log) para simulações que cruzam Área/Produto.
- Quadro de Orçamento com linhas de contagem de projetos e Carry Over separado
  em "Em Andamento" / "Em Hold"; linha de cancelados no quadro de criação do AF.
- Formalizar Demanda: Ano Fiscal vindo da configuração (Normal = AF em
  orçamentação; Extraordinária = AF em andamento).

### Go-Live / Conclusão
- Termo de Aceite como pré-requisito real da conclusão: ao atingir 100% no
  Go-Live o projeto fica "Pendente de Termo de Aceite"; o Termo não pode ser
  registrado antes dos 100%.
- Correções: projeto concluído não fica mais preso em "Pendente Termo de
  Aceite"; projeto cancelado não é contado duas vezes na Consolidação por Fase.

### Licenciamento
- Tabela única `modulo_funcao` (tela → módulo, Núcleo/Licenciável) como fonte
  de verdade do gate de módulo; funções de orçamento agrupadas no Financeiro;
  Abertura/Período do Ano Fiscal são núcleo.
- **Dados da Empresa Licenciada** (menu Proprietário) — CNPJ, identidade
  visual (nome/logo/cor no login, tela inicial e cabeçalho) e vigência da
  licença: setup bloqueante, aviso preventivo de vencimento, tela "Licença
  Expirada" e renovação por código assinado (HMAC validado no servidor).

### Segurança / higiene
- Reescrita do histórico do Git para remover referências ao cliente/sistema
  de origem (código, documentação e histórico).
- Configs de vigência (Controle Orçamentário / Período do AF) com a vigência
  automática no 1º dia do mês.
