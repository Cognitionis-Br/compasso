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

### Release 1 — em desenvolvimento (branch `release-1`)

**Módulo Financeiro & Contratos — Recebimento de Pagamentos/Propostas com aprovação**

- **Fase A (em andamento):** área de staging "Pendências de Contratos" —
  toda entrada (lançamento manual, upload de planilha Excel) cai como
  pendente e só vai para a base oficial (`contratos_pagamentos` /
  nova `contratos_propostas`) depois de aprovada. Anexo de Nota Fiscal
  em Supabase Storage, com bloqueio de aprovação sem NF (override por
  justificativa registrada). Trilha de auditoria append-only. Nova
  função de catálogo `contratos_pendencias:{consultar,importar,aprovar}`,
  concedível a qualquer perfil. Tudo dentro do módulo FINANCEIRO.
- **Fase B:** escalonamento de NF pendente > 5 dias úteis — uma pendência
  "NF não recebida" que passar de 5 dias úteis gera um e-mail de alerta
  (uma única vez) pela fila de e-mail existente. Novo ponto de disparo
  `PENDÊNCIAS DE CONTRATO / ESCALONAMENTO NF` em *Envio de E-mail — Gestão
  do Fluxo* (nasce inativo; admin define destinatário/remetente e liga).
  Coluna `contratos_pendencias.escalado_nf_em`.
- **Fase C:** canal de e-mail padronizado por webhook — Netlify Function
  `receber-email-contratos` recebe o inbound de um provedor de e-mail,
  faz o parsing do assunto (§4.2) e do corpo (§4.3) e cria a pendência
  (`origem = 'EMAIL'`), que segue para aprovação como qualquer outra.
  Anexos PDF/JPG/PNG viram Nota Fiscal no Storage; campo obrigatório
  ausente → `ERRO_LEITURA` (nunca descartado). Provedor plugável
  (`providers/inbound/`), dedupe por `Message-Id`. Autenticação por
  segredo compartilhado (`INBOUND_CONTRATOS_SECRET`); identificação da
  instância pelo campo `Referência` (`INBOUND_CONTRATOS_REFERENCIA`).
  Guia de configuração: `docs/CANAL_EMAIL_CONTRATOS.md`.
- Classificação de anexos (NF / comprovante / outro): pendente de
  refinamento na UI.

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
