# Reconciliação `catalogo_atividades` × `CONTROLE DE ACESSO - FUNÇÕES.xlsx`

**Data:** 2026-09-01
**Escopo:** Compasso apenas (projeto Supabase `fytynjjvzecljmgbtwec`).
**Natureza:** levantamento. **Nenhuma alteração foi aplicada.** Nenhum
`INSERT` / `UPDATE` / `DELETE` roda antes da aprovação explícita deste
documento. Nenhuma linha é removida ou renomeada sem confirmação, porque
`funcao_atividades` (131 concessões) referencia `catalogo_atividades.id`.

---

## 0. Números

| | |
|---|---|
| Linhas no catálogo hoje | **84** (não 77 — cresceu com os splits `:criar`/`:cadastrados` das telas de Parâmetros e do Planejamento Estratégico, migrações de 2026‑08‑31) |
| Folhas (atividades) na planilha | **81** |
| Concessões em `funcao_atividades` | **131**, distribuídas em 32 `atividade_id` distintos |
| Itens **genuinamente novos** na planilha (sem correspondente no catálogo) | **0** |
| Itens no catálogo **sem correspondente** na planilha | **3** (ver §3) |
| Divergências de nomenclatura / grupo / subgrupo | ver §2 |

### Verificações pedidas explicitamente

- **"Cargos"** — **já existe** no catálogo: `cargos:criar` + `cargos:cadastrados`,
  grupo `PARÂMETROS E CADASTRO`, subgrupo `Cargos`. (Estava em `ADMINISTRAÇÃO`
  até a migração `2026-08-31_reorg_menus_cargos_responsaveis.sql`.) **Não é item novo.**
- **"Retorno / Benefícios de Projeto"** — **já existe**: `return_benefit:criar` +
  `return_benefit:cadastrados`. O subgrupo se chamava `Return / Benefit` até a
  migração `2026-08-31_padronizacao_nomenclatura_catalogo.sql`, que o renomeou
  para `Retorno / Benefícios de Projeto`. **Não é item novo.**

> **Conclusão:** a planilha **não introduz nenhuma atividade nova**. Ela
> difere do catálogo só em (a) redação de rótulos, (b) grupo/subgrupo de
> alguns itens, e (c) três itens que o catálogo tem e a planilha não lista.

---

## 1. Colunas `grupo` / `subgrupo`

**Já existem, com outros nomes.** O catálogo **não** codifica a hierarquia
só dentro de `activity_key`:

| Conceito da planilha | Coluna atual em `catalogo_atividades` | Exemplo |
|---|---|---|
| GRUPO | `grupo_funcao` (text) | `BUSINESS CASE` |
| SUBGRUPO | `funcao` (text) | `Orçamentar Demanda` |
| ATIVIDADE | `atividade` (text) | `Planejar Orçamentação` |
| (chave técnica) | `activity_key` (text, único) | `f1_orcamento:a_planejar` |

Ambas são pesquisáveis (`SELECT ... WHERE grupo_funcao = ...`). O que falta
é só o **nome explícito**. Três caminhos possíveis — **decisão sua**:

- **Opção A (recomendada):** renomear `grupo_funcao → grupo` e `funcao → subgrupo`.
  Impacto de código: `js/config/funcoes.js` (`renderMatrizPermissoesFormulario`,
  `renderRestricaoAreaAtividadesView`, `filtrarProjetosPorArea`, `tabIdsDoCatalogo`
  usa `activity_key`, não muda) e `renderRestricaoAreaAtividadesView` — ~8
  referências a `a.grupo_funcao` / `a.funcao`. Migrações futuras passam a usar
  os nomes novos. Feito com `ALTER TABLE ... RENAME COLUMN`, reversível.
- **Opção B:** adicionar colunas novas `grupo` / `subgrupo` como cópia, mantendo
  `grupo_funcao` / `funcao`. Gera redundância e risco de dessincronizar. Não recomendo.
- **Opção C:** não mexer no schema; documentar que `grupo_funcao` = grupo e
  `funcao` = subgrupo.

---

## 2. Divergências (nomenclatura / grupo / subgrupo)

> Casing **não** é divergência: a planilha é toda MAIÚSCULA sem acento por
> estilo; o catálogo é *Title Case* com acento. Só listo diferença real de
> palavra/forma/estrutura. `⚠` = a linha tem concessão(ões) em `funcao_atividades`.
> `✋` = conflita com decisão tomada nesta sessão (DEPARA aplicado dias atrás).

### 2.1 Conflitos com decisões já aplicadas — precisam de desempate

| # | `activity_key` | Catálogo hoje | Planilha quer | Concessões | Nota |
|---|---|---|---|---|---|
| C1 ✋⚠ | `aprov_orcamento_af` | `Aprovar Orçamento Ano Fiscal` (subgrupo + atividade) | `Aprovar Orçamento Fiscal Year` | 1 (FINANCEIRO) | O DEPARA (linha 12) mandou trocar p/ "Ano Fiscal" e você confirmou. Esta planilha reverte p/ "Fiscal Year". Qual vale? |
| C2 ✋⚠ | `f1_orcamento:concluidas` | `Orçamentação Concluída` (fem. sing.) | `Orçamentação Concluídos` (masc. pl.) | 1 (GESTOR TI) | Você aprovou "Concluída" na tabela dos 7 itens. Planilha traz "Concluídos". |
| C3 ✋⚠ | `tech_aval_negocio:a_planejar` | `Planejar Especificação - Negócios` | `Planejar Especificação de Requerimentos - Negócios` | 1 (APROVADOR (NEGÓCIOS)) | Você aprovou remover "de Requerimentos" (item L24‑25). Planilha mantém. |
| C4 ✋⚠ | `tech_aval_negocio:execucao` | `Executar Especificação - Negócios` | `Executar Especificação de Requerimentos - Negócios` | 1 (APROVADOR (NEGÓCIOS)) | idem C3 |
| C5 ✋⚠ | `pessoas_solicitantes:cadastrados` | `Pessoas Solicitantes Cadastradas` (pl.) | `Pessoa Solicitante Cadastrada` (sing.) | 1 (GOVERNANÇA) | Você pediu "tudo no plural". Planilha traz singular. |
| C6 ✋⚠ | `portes:cadastrados` | `Portes de Projeto Cadastrados` (pl.) | `Porte de Projeto Cadastrado` (sing.) | 1 (GOVERNANÇA) | idem C5 |
| C7 ✋⚠ | `tipos_projeto:cadastrados` | `Tipos de Projeto Cadastrados` (pl.) | `Tipo de Projeto Cadastrado` (sing.) | 1 (GOVERNANÇA) | idem C5 |
| C8 ✋⚠ | `return_benefit:cadastrados` | `Retornos / Benefícios de Projeto Cadastrados` (pl.) | `Retorno / Benefício de Projeto Cadastrado` (sing.) | 1 (GOVERNANÇA) | idem C5 |

**Recomendação:** manter o que já está aplicado (C1→"Ano Fiscal", C2→"Concluída",
C3/C4 sem "de Requerimentos", C5–C8 no plural), tratando estes pontos da
planilha como desatualizados. Confirme ou inverta caso a caso.

### 2.2 Renomes de atividade que a planilha pede e ainda não foram feitos

| # | `activity_key` | Catálogo hoje (atividade) | Planilha quer | Concessões |
|---|---|---|---|---|
| R1 ⚠ | `contratos_vinculos` | `Contratos por Projeto` | `Vincular Contratos` | 2 (GESTOR TI, GOVERNANÇA) |
| R2 ⚠ | `registro_valores_contrato` | `Registro de Valores Realizados` | `Registrar Pagamento` | 2 (GESTOR TI, GOVERNANÇA) |
| R3 ⚠ | `usuarios:criar` | subgrupo `Usuários e Perfis` / atividade `Cadastrar Novos Usuários` | subgrupo `Cadastrar Novo Usuário` / atividade `Criar Usuário` | 1 (GOVERNANÇA) |
| R4 ⚠ | `usuarios:cadastrados` | subgrupo `Usuários e Perfis` | subgrupo `Cadastrar Novo Usuário` | 1 (GOVERNANÇA) |
| R5 ⚠ | `restricao_area_atividades` | subgrupo `Restrição de Área` / atividade `Consultar/Alterar Restrição de Área` | `Restrição de Área por Atividade` | 1 (GOVERNANÇA) — **item marcado p/ remoção na fase (b)** |
| R6 ⚠ | `atribuicao_funcoes` | `Atribuição de Função aos Usuários` | `Atribuição de Funções aos Usuários` (plural; planilha tem typo "ATRIIBUIÇÃO") | 1 (GOVERNANÇA) — **marcado p/ remoção na fase (b)** |
| R7 ⚠ | `responsaveis:cadastrados` | `Responsáveis Cadastrados` | `Atribuições Cadastradas` | 1 (GOVERNANÇA) |
| R8 ⚠ | `fase_golive:termo_aceite` | `Termo de Aceite de Projeto` | `Termo de Aceite` | 1 (GESTOR TI) |

### 2.3 Diferenças menores (plural↔singular / grafia; provavelmente aceitar a planilha)

| # | `activity_key` | Catálogo hoje | Planilha |
|---|---|---|---|
| M1 | `empresas_terceirizadas:criar` | `Cadastrar Novas Empresas` | `Cadastrar Nova Empresa` |
| M2 | `contratos_projeto:criar` | `Novos Contratos` | `Novo Contrato` |
| M3 | `funcoes_permissoes:criar` | `Cadastrar Novas Funções` | `Cadastrar Nova Função` — **marcado p/ remoção na fase (b)** |
| M4 | `gestao_templates:incluir` | `Incluir Templates` | `Incluir Template` |
| M5 | `fase_golive:em_andamento` | `Executar Go-Live` | `Executar Golive` (grafia — manter `Go-Live`?) |

### 2.4 Renomes de GRUPO

| # | `grupo_funcao` hoje | Planilha quer | Linhas afetadas | Concessões afetadas |
|---|---|---|---|---|
| G1 ⚠ | `CONTRATO E TERCEIROS` | `CONTRATOS E TERCEIROS` (plural) | 7 (`empresas_terceirizadas:*`, `contratos_projeto:*`, `contratos_vinculos`, `registro_valores_contrato`, `relatorio_projetos_contratos`) | 13 |
| G2 ⚠ | `PARÂMETROS E CADASTRO` | `Parâmetros e Cadastros` (plural) | 16 (todas as telas de Parâmetros + Planejamento Estratégico + Cargos) | 13 |
| G3 | `FERRAMENTAS DO DEV` / subgrupo `Ferramentas do Dev` | `Ferramentas Dev` | 1 (`dev_tools`) | 0 |
| G4 ⚠ | `licenciamento_modulos`: grupo `ADMINISTRAÇÃO` | grupo `Proprietário` | 1 | 0 — **item vai sair do catálogo comum na fase (b)** |

> Só renomeiam a coluna de texto — não quebram nada, pois `funcao_atividades`
> aponta por `id`. Mas são `UPDATE`, então entram na aprovação.

### 2.5 Typos na planilha (catálogo já está certo — nenhuma ação)

- L51 `ATRIIBUIÇÃO` (II duplicado) — catálogo: `Atribuição`.
- L66 `PILATES ESTRATEGICOS` — catálogo: `Pilares Estratégicos`.
- L68 ` INICIATIVAS ...` (espaço no início) — catálogo já sem espaço.

---

## 3. Itens no catálogo que a planilha NÃO lista

**Não remover sem sua confirmação.** Os três têm **0 concessões** hoje,
mas removê-los tira a tela do controle por atividade.

| `activity_key` | Grupo > Subgrupo > Atividade | Concessões | Observação |
|---|---|---|---|
| `mudanca_orcamento` | `GOVERNANÇA` > `Mudança de Orçamento` | 0 | Tela real e ativa (`switchTab('mudanca_orcamento')`, `js/governanca/mudanca-orcamento.js`). A planilha lista em GOVERNANÇA só "Cobrança de Ajustes" e "Retomar Projetos em Hold". **Manter? Adicionar à planilha? Remover do catálogo?** |
| `percentual_bloqueio_orcamento` | `ADMINISTRAÇÃO` > `Percentual de Bloqueio de Orçamento` | 0 | Tela real e ativa. Não aparece na planilha. Mesma decisão. |
| `responsaveis:criar` | `ADMINISTRAÇÃO` > `Responsáveis por Atividades` > `Cadastrar Novos Responsáveis` | 1 (GOVERNANÇA) | A planilha (L71) mostra só **uma** folha em "Responsáveis por Atividades": "Atribuições Cadastradas". O catálogo tem duas (`:criar` + `:cadastrados`). **A planilha quer só 1 tela (sem sub-aba de cadastro) ou é omissão?** |

---

## 4. Decisões necessárias antes da Fase 1

1. **Colunas grupo/subgrupo:** Opção A (renomear), B (adicionar) ou C (só documentar)? — §1
2. **Conflitos C1–C8:** manter o aplicado (recomendado) ou seguir a planilha? — §2.1
3. **Renomes R1–R8 e menores M1–M5:** aplicar todos? algum não? — §2.2 / §2.3
4. **Grupos G1–G4:** aplicar os renomes de grupo? (`Parâmetros e Cadastros`, `Contratos e Terceiros`, `Ferramentas Dev`) — §2.4
5. **Itens órfãos §3:** `mudanca_orcamento` e `percentual_bloqueio_orcamento` — manter no catálogo (e eu adiciono à planilha por completude) ou remover? `responsaveis:criar` — manter as duas folhas?
6. **Casing:** o catálogo fica em *Title Case* (como está) e a planilha MAIÚSCULA é só estilo de documento — confirma?

Nada roda até você responder. Depois disso eu gero **um** script SQL
idempotente com só os `UPDATE`s aprovados (zero `DELETE`; `INSERT` só se
você decidir adicionar `mudanca_orcamento`/`percentual_bloqueio_orcamento`
à hierarquia), e sigo para as colunas CRUD de `funcao_atividades`.

---

## 5. Decisões (2026-09-01) — "ok, segue com o sql"

| Item | Decisão |
|---|---|
| 1. Colunas | **Opção A** — `grupo_funcao → grupo`, `funcao → subgrupo`. Front lê as duas formas (`a.grupo ?? a.grupo_funcao`) durante a transição. |
| 2. C1–C8 | **Manter o aplicado.** Planilha desatualizada nesses pontos. Nenhum statement. |
| 3. R1, R2, R7, R8 | **Aplicar.** |
| 3. R3, R4 (`usuarios`) | **Aplicar** — planilha corrigida pelo usuário 2026-09-01: subgrupo = **"Usuários"** (era slip); `usuarios:criar` atividade → "Cadastrar Novo Usuário"; `usuarios:cadastrados` fica "Usuários Cadastrados". Item de menu e `<h2>` "Usuários & Perfis" → **"Usuários"**. |
| 3. R5, R6 | **Não aplicar** — `restricao_area_atividades` e `atribuicao_funcoes` saem do catálogo comum na Fase 3. |
| 4. M1, M2, M4 | **Aplicar.** |
| 4. M3 | **Não aplicar** — `funcoes_permissoes` sai na Fase 3. |
| 4. M5 ("Golive") | **Não aplicar** — mantém "Go-Live". |
| 5. G1, G2, G3 | **Aplicar** só a diferença substantiva (`CONTRATOS E TERCEIROS`, `PARÂMETROS E CADASTROS`, `FERRAMENTAS DEV`). Grupo segue MAIÚSCULO. |
| 5. G4 | **Não aplicar** — `licenciamento_modulos` sai na Fase 3. |
| 6. Casing | Grupo MAIÚSCULO, subgrupo/atividade Title Case — como está. |
| §3 órfãos | **Manter** `mudanca_orcamento`, `percentual_bloqueio_orcamento`, `responsaveis:criar`. Zero `DELETE`. |

Script: [`sql/2026-09-01_reconciliacao_catalogo_fase1.sql`](sql/2026-09-01_reconciliacao_catalogo_fase1.sql).
