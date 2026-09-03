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

_(nada pendente)_

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
