# Segurança — Controle de Acesso do Compasso

Log das fases do endurecimento de RBAC/RLS pedido em 2026-09-01.
Cada fase só começa depois da anterior aprovada.

---

## Fase 0 — Reconciliação do catálogo (2026-09-01) — **CONCLUÍDA e APROVADA**

- Lida a planilha `docs/CONTROLE DE ACESSO - FUNÇÕES.xlsx` (85 linhas, 81 folhas/atividades).
- Comparada com `catalogo_atividades` ao vivo (84 linhas) e `funcao_atividades` (131 concessões).
- Resultado em [`RECONCILIACAO_CATALOGO.md`](RECONCILIACAO_CATALOGO.md):
  - **0** atividades genuinamente novas na planilha.
  - **3** linhas no catálogo sem correspondente na planilha (`mudanca_orcamento`,
    `percentual_bloqueio_orcamento`, `responsaveis:criar`) — decisão pendente.
  - **8** conflitos com decisões já aplicadas nesta semana (DEPARA) — C1–C8.
  - **~13** renomes de rótulo/subgrupo e **4** de grupo pendentes de decisão.
  - Confirmado: "Cargos" e "Retorno / Benefícios de Projeto" **já existem** no
    catálogo (não são itens novos).
- **Nenhum** `INSERT` / `UPDATE` / `DELETE` executado.
- Colunas `grupo` / `subgrupo`: já existem como `grupo_funcao` / `funcao`;
  proposta de rename registrada (Opção A), pendente de aprovação.

### Pendente para liberar a Fase 1
~~Aprovação das 6 decisões~~ — aprovadas 2026-09-01 (`RECONCILIACAO_CATALOGO.md` §5).

---

## Fase 1 — Reconciliação + colunas grupo/subgrupo (2026-09-01) — **CONCLUÍDA**

- Script [`sql/2026-09-01_reconciliacao_catalogo_fase1.sql`](sql/2026-09-01_reconciliacao_catalogo_fase1.sql) **rodado** — confirmado no banco:
  colunas `grupo` / `subgrupo` no lugar de `grupo_funcao` / `funcao`; R1–R4, R7, R8, M1, M2, M4, G1–G3 aplicados.
  Zero `DELETE`, zero `INSERT`.
- Front: `js/config/funcoes.js` lê `a.grupo ?? a.grupo_funcao` / `a.subgrupo ?? a.funcao`.
  `index.html`: "Usuários & Perfis" → "Usuários".

## Fase 2 — Colunas CRUD em `funcao_atividades` (2026-09-01) — **CÓDIGO PRONTO, aguardando rodar o SQL**

- Script: [`sql/2026-09-01_fase2_crud_funcao_atividades.sql`](sql/2026-09-01_fase2_crud_funcao_atividades.sql)
  - `ADD COLUMN IF NOT EXISTS`: `pode_consultar BOOL NOT NULL DEFAULT true`,
    `pode_incluir` / `pode_alterar` / `pode_deletar BOOL NOT NULL DEFAULT false`.
  - O `DEFAULT true` já migra as 131 concessões atuais com `pode_consultar = true`,
    demais `false`. Idempotente.
- Front (`js/config/funcoes.js`):
  - `renderMatrizPermissoesFormulario` — cada atividade vira uma linha com 4 checkboxes
    (Consultar / Incluir / Alterar / Deletar). Aceita `Map<id,{c,i,a,d}>` (editar) ou `Set` (compat).
  - `editFuncao` monta o `Map` a partir de `funcao_atividades.pode_*`.
  - `saveFuncao` grava `{funcao_id, atividade_id, pode_consultar, pode_incluir, pode_alterar, pode_deletar}`;
    Incluir/Alterar/Deletar forçam `pode_consultar = true`; "pelo menos uma atividade" = pelo menos um Consultar.
  - `carregarPermissoesUsuarioAtual` carrega as flags → `crudUsuarioAtual` (Map, OR entre funções).
  - Helpers `usuarioPodeIncluir/Alterar/Deletar(activityKey)` (admin/irrestrito = true).
- Rodado e verificado (131 concessões → `consultar=true`, resto `false`).

## Fase 2b — CRUD plugado nos botões das telas de lista (2026-09-01) — **CÓDIGO PRONTO (sem SQL)**

Modelo **combinado por tela** (as abas "Cadastrados" também têm Editar/Inativar):
o verbo vale se QUALQUER atividade da tela (`tabId`, `tabId:*`) tiver a flag.
`consultar` continua individual por sub-aba.

- `js/config/funcoes.js`: `atividadesDaTela(tabId)`, `usuarioPodeIncluirTela/AlterarTela/DeletarTela(tabId)`,
  helpers de template `botaoSePodeIncluir/Alterar/Deletar/AtivarInativar(tabId, html)`.
  `aplicarVisibilidadeSubAbas`: sub-aba `*:criar` só aparece se puder incluir OU alterar.
- Botões por linha (Editar / Excluir / Inativar / Reativar) e handlers `salvar*` /
  `alternarAtivo*` gateados. Guarda dupla: esconde o botão E valida no handler
  (novo → incluir; edição → alterar; inativar → deletar).
- **Telas cobertas** (2b + extensão 2026-09-01, todas as telas de gestão da base):
  areas, pessoas_solicitantes, portes, cargos, tipos_projeto, return_benefit,
  planejamento_estrategico, responsaveis, usuarios, empresas_terceirizadas,
  contratos_projeto, contratos_vinculos, registro_valores_contrato, gestao_templates,
  gestao_fluxo_email (+ chave geral de e-mail), workflow_etapas (Fases/Etapas + SLA),
  percentual_bloqueio_orcamento, ano_fiscal (abertura), carry_over, retomar_hold,
  mudanca_orcamento, governanca (cobrança), projetos_adhoc, aprov_comite, aprov_orcamento_af.
- **Também gateados (revisão 2026-09-01):** `deleteFuncao` / `reativarFuncao` /
  `alternarRestricaoAreaAtividade` (guarda `ehAdministrador || ehProprietario` — troca o
  erro cru de RLS por mensagem clara); `processarFilaEmailPendente` (`fila_email` —
  confirmado que só é chamada pelo botão manual "Enviar Fila", nunca pelo auto-envio).
- **Fora do gate de propósito:** telas operacionais de fase (req_*/tech_*/fase_*) — são
  trabalho de workflow, não configuração de base.
- **Nota:** "aprovar" em `aprov_comite` / `aprov_orcamento_af` mapeia para o verbo
  `alterar` (não existe verbo "aprovar") — funções aprovadoras precisam de `alterar`
  marcado nessas atividades.
- Admin / `acesso_irrestrito` / `eh_proprietario`: tudo liberado, sem mudança.

**⚠️ Impacto:** como a Fase 2 migrou todas as concessões com só `consultar`, funções
não-admin (ex.: GOVERNANÇA) passam a **só visualizar** essas telas até um admin marcar
Incluir/Alterar/Deletar em Funções e Permissões. Comportamento pretendido (opt-in de escrita).

## Fase 3 — Remover do catálogo comum os itens de administração (2026-09-01) — **CÓDIGO PRONTO, aguardando rodar o SQL**

- Script: [`sql/2026-09-01_fase3_telas_admin_fora_do_catalogo.sql`](sql/2026-09-01_fase3_telas_admin_fora_do_catalogo.sql)
  - `DELETE` das concessões (`funcao_atividades`) e das 5 linhas de `catalogo_atividades`:
    `funcoes_permissoes:criar`, `funcoes_permissoes:cadastradas`, `atribuicao_funcoes`,
    `restricao_area_atividades`, `licenciamento_modulos`.
  - Único ponto da spec que autoriza `DELETE` nessas linhas. Idempotente.
  - **Impacto:** a função GOVERNANÇA perde as 4 concessões que tinha — usuários
    só com GOVERNANÇA deixam de ver Funções e Permissões / Atribuição / Restrição de Área.
- Front:
  - `js/ui/navigation.js` — `switchTab` das 3 primeiras telas: `usuarioTemAlgumaAtividadeDoTab(...)`
    → `ehAdministrador || ehProprietario`. `licenciamento_modulos` inalterado (`ehProprietario`).
  - `js/config/funcoes.js` — `aplicarVisibilidadeMenu`: como esses tabIds saem de
    `tabIdsDoCatalogo()`, os `link-*` das 3 telas passam a ser escondidos/mostrados
    explicitamente por `ehAdministrador || ehProprietario`. `link-licenciamento_modulos`
    fica dentro de `#grupo-proprietario` (já togglado por `ehProprietario`).
- **Pendente:** rodar o SQL no Supabase.

Estas 4 telas saem de `catalogo_atividades` (deixam de ser concedíveis por
função comum) e passam a ser checadas por *flag* de papel — nos **dois**
pontos: visibilidade no menu lateral **e** bloqueio de rota em `switchTab()`.

| Tela | Regra de visibilidade / acesso |
|---|---|
| `Funções e Permissões` (`funcoes_permissoes`) | `ehAdministrador === true` **OU** `ehProprietario === true` |
| `Atribuição de Funções aos Usuários` (`atribuicao_funcoes`) | `ehAdministrador === true` **OU** `ehProprietario === true` |
| `Restrição de Área por Atividade` (`restricao_area_atividades`) | `ehAdministrador === true` **OU** `ehProprietario === true` |
| `Licenciamento de Módulos` (`licenciamento_modulos`) | **só** `ehProprietario === true` — Administrador **não** vê |

**Hierarquia:** Proprietário é um nível **acima** de Administrador
(superconjunto de poder), não um papel paralelo. Proprietário enxerga e
acessa tudo que Administrador enxerga e acessa — nunca menos. Por isso as
3 primeiras telas usam a checagem combinada `OU`, não `ehAdministrador`
sozinho. (Hoje todo PROPRIETARIO também tem `acesso_irrestrito = true`, mas
o `OU` explícito garante o acesso mesmo que uma função PROPRIETARIO futura
seja criada sem essa flag.)

## Fase 4 — Habilitar RLS (2026-09-01) — **CONCLUÍDA**

SQL rodado e verificado: as 5 tabelas retornam vazio para requisição anônima
(`sb_publishable`), `usuario_atual_irrestrito()` responde `false` sem sessão.
Usuário autenticado com função `acesso_irrestrito`/`eh_proprietario` passa nas
escritas; `usuario_funcoes` restrito a linhas próprias fora disso.


- Script: [`sql/2026-09-01_fase4_rls.sql`](sql/2026-09-01_fase4_rls.sql) — transação única.
  - 2 funções `SECURITY DEFINER`: `usuario_atual_irrestrito()` (`acesso_irrestrito OR eh_proprietario`)
    e `usuario_atual_proprietario()` (`eh_proprietario`), resolvendo `auth.uid()` contra
    `usuario_funcoes` + `funcoes`. `SECURITY DEFINER` evita recursão de RLS.
  - Por tabela: `INSERT/UPDATE/DELETE` guardados. `SELECT` livre p/ `authenticated`
    em `funcoes` / `funcao_atividades` / `catalogo_atividades` / `licenca_modulos`;
    em `usuario_funcoes` cada um só vê as próprias (`usuario_id = auth.uid()`)
    e irrestrito/proprietário vê todas. Policies criadas ANTES do `ENABLE RLS`.
  - Confirmado com o usuário: não há fluxo pré-login que toque nessas tabelas.
  - `service_role` (SQL Editor, edge functions) ignora RLS — migrações e
    `admin-create-user` seguem funcionando.
  - Verificado: `usuario_funcoes.usuario_id` é uuid (= `auth.uid()`);
    ADMINISTRADOR tem `acesso_irrestrito=true`, PROPRIETARIO tem os dois.
- Sem mudança de front nesta fase (o app já só escreve nessas tabelas a
  partir de telas de admin/proprietário logados).
- **Pendente:** revisão do SQL de policy e execução.

Leitura livre para qualquer usuário autenticado nas 5 tabelas.

---

## Tarefa — Agrupamento de Orçamento por Área e Produto (2026-09-01) — **EM ANDAMENTO**

Depende da Fase 4 concluída; apoia-se no CRUD granular do catálogo. Doc de regras:
`docs/REGRAS DE TRATAMENTO DE ORÇAMENTO.docx`.

- **Passo 0 (feito):** `INVESTIGACAO_PROJECAO_FINAL.md`. "Projeção Final" = `totR * 1.15`
  (Realizado Total × 1,15), hardcoded, só no Dashboard. **Decisão do usuário: REMOVER**
  (substituída por "Orçamento a Realizar" = Orçamento Atual − Realizado).
- **SQL (escrito, aguardando rodar no SQL Editor):**
  - `sql/2026-09-01_produtos_e_produto_id.sql` — tabela `produtos` (+ sentinela
    `NAO_CLASSIFICADO`), `projetos.produto_id` FK, migração de todos os projetos ao sentinela.
  - `sql/2026-09-01_ajuste_orcamento_autorizacoes.sql` — tabela de log das autorizações
    especiais (item 8).
  - `sql/2026-09-01_catalogo_produtos_ajuste_orcamento.sql` — INSERT das atividades
    `produtos:criar` / `produtos:cadastrados` (GOVERNANÇA, CRUD completo) e
    `ajuste_orcamento` (FINANCEIRO + GOVERNANÇA, CRUD completo). Roda direto no SQL
    Editor (catalogo_atividades/funcao_atividades sob RLS).
- **Código (feito):**
  - Itens 2/3 (`b5dd702`): `js/config/produtos.js` (CRUD, grupo Parâmetros) + campo
    **Produto \*** obrigatório em Formalizar Demanda (sem NAO_CLASSIFICADO).
  - Item 4 (`f0b6ac1`): `js/core/filtro-agrupamento-orcamento.js` — estado isolado
    `modoAgrupamentoOrcamento`/`valorAgrupamentoSelecionado`,
    `filtrarProjetosPorAgrupamento`, `mesmoSubgrupoOrcamento`, `obterAgrupamentoOrcamento`
    (fonte única — trocar aqui pra virar parâmetro persistido).
  - Itens 5/6 (`1e43dd8`): seletor + quadro novo (7 linhas × Total/CAPEX/OPEX) no
    Dashboard e Visão de Orçamento; agrupamento entra como 3º elo da cascata;
    "Projeção Final" removida (linha morta `totR*1.15` também).
  - Itens 7/8 + rename (este commit): check de subgrupo em `alterarAcaoTradeoff`
    (Demanda Extraordinária); tela **Ajuste de Orçamento** (menu ANO FISCAL) +
    relatório de autorizações; `ajuste_orcamento` em TAB_MODULO_MAP (WORKFLOW);
    "Execução - Desenvolvimento" → "Execução" (index.html + `sql/2026-09-01_rename_execucao.sql`).
  - **Carryover:** o fluxo atual (`marcarComoCarryover`) não usa outro projeto como
    compensação — o check de subgrupo do item 7 fica ativo só no trade-off da
    Extraordinária. Se houver mecânica de compensação em Carryover que eu não
    localizei, apontar.

| Tabela | Escrita (INSERT / UPDATE / DELETE) permitida quando |
|---|---|
| `funcoes` | `acesso_irrestrito = true` **OU** `eh_proprietario = true` |
| `funcao_atividades` | `acesso_irrestrito = true` **OU** `eh_proprietario = true` |
| `usuario_funcoes` | `acesso_irrestrito = true` **OU** `eh_proprietario = true` |
| `catalogo_atividades` | `acesso_irrestrito = true` **OU** `eh_proprietario = true` |
| `licenca_modulos` | **só** `eh_proprietario = true` |

A condição é avaliada via função SQL de apoio (`SECURITY DEFINER`) que
resolve as funções do `auth.uid()` atual contra `usuario_funcoes` +
`funcoes`. Mesma lógica de hierarquia da Fase 3: Proprietário escreve em
tudo que Administrador escreve, e ainda em `licenca_modulos`.

## Correção — função PROPRIETÁRIO só para Proprietário na tela de Funções (2026-09-01)

Falha reportada: logado como **Administrador** (acesso irrestrito, sem
`eh_proprietario`), a tela *Funções e Permissões* mostrava:
- a checkbox da função **PROPRIETÁRIO** na *Atribuição de Funções aos
  Usuários* — dava pra marcar, e só então vinha o erro cru de RLS;
- a própria função PROPRIETÁRIO na lista de *Funções Cadastradas* (com
  Editar/Excluir);
- o box roxo **"É Proprietário"** no formulário de cadastro de função.

Regra: nada relacionado a PROPRIETÁRIO aparece/funciona a não ser que o
usuário logado **seja** Proprietário (`ehProprietario === true`). O RLS já
bloqueava no banco; isto tira a opção da tela e troca o erro por bloqueio
claro. `js/config/funcoes.js` (`podeGerenciarProprietario()` /
`ehFuncaoProprietario()`):
- `renderFuncoesTable`: filtra funções `eh_proprietario` da lista + esconde
  `#funcaoEhProprietarioBox` (novo id no index.html, `hidden` por padrão).
- `renderUsuariosFuncoesTable`: `funcoesAtribuiveis` sem as funções
  Proprietário; botão Salvar idem.
- `salvarFuncoesUsuario`: DELETE escopado com `.not('funcao_id','in',(...))`
  pra **não remover** vínculo Proprietário existente de um usuário, e
  descarta com aviso qualquer id Proprietário que chegue via DOM adulterado.
- `saveFuncao` / `deleteFuncao` / `reativarFuncao`: bloqueiam criar/marcar/
  editar/inativar/reativar função Proprietário quando não é Proprietário.

## Correção — Carryover / Extraordinária fora da aprovação do AF corrente (2026-09-01)

Bug reportado: demandas marcadas como **Carryover** ou **Extraordinária**
apareciam nas filas de aprovação de orçamento do AF corrente, em vez de
ficarem restritas aos seus processos exclusivos (tela Projetos Carry Over /
tela Projetos Extraordinário com simulação de trade-off).

- `js/approvals/comite.js` (`renderAprovComiteView`): a fila "Aprovar
  Orçamento por Projeto (Comitê)" não excluía nem `is_adhoc` nem
  `is_carryover` — agora exclui os dois.
- `js/approvals/orcamento-af.js`: já excluía `is_adhoc` em `projsAprovados`
  (render + fechamento) e na checagem de `pendentes`; passou a excluir
  também `is_carryover` nos 3 pontos.

Extraordinária é promovida a Requerimentos pelo próprio fluxo em
`js/adhoc/tradeoff.js` (`aprovarSimulacaoAdhoc`); Carryover entra no
orçamento do AF seguinte pelo pool (`calcularPoolCarryover`), com o valor
congelado na marcação — nenhum dos dois precisa passar pelo Comitê / pelo
fechamento do AF corrente.

## Menu por perfil + usuário Proprietário oculto abaixo dele (2026-09-01)

1. **Cabeçalho de grupo do menu lateral some quando vazio.**
   `aplicarVisibilidadeMenu` (js/config/funcoes.js) já escondia cada
   `link-<tabId>` sem acesso, mas o título do grupo ("ANO FISCAL",
   "BUSINESS CASE", "PERFIS DE ACESSO"...) continuava aparecendo com o
   submenu vazio. Novo passo final: para cada `.submenu` dentro de
   `#sidebarMenu`, se nenhum `.sidebar-link` filho está visível, esconde o
   `<div>` do grupo inteiro. Baseado na classe `.hidden` real, então vale
   também para links fora do catálogo. `#grupo-proprietario` é pulado (já
   controlado por `ehProprietario`).

2. **Usuário com função de Proprietário é invisível para quem está abaixo.**
   - `js/users/usuarios.js` `renderUsuariosView`: quando `!ehProprietario`,
     busca `usuario_funcoes + funcoes(eh_proprietario)`, monta
     `usuariosIdsProprietario` e filtra esses ids de `usuariosData`.
     `editarPerfilUsuario` já cai no `if (!u) return` (não está mais na
     lista); `inativarUsuario` / `reativarUsuario` ganham
     `usuarioAlvoEhProprietarioProtegido(id)`.
   - `js/config/funcoes.js` `renderUsuariosFuncoesTable`: mesma lista de
     ids (via `usuarioFuncoesData` + `funcoesData`), `usuariosVisiveis`
     exclui os usuários-Proprietário para não-Proprietário.

## Tarefa — Fechamento de Ano Fiscal e Resultado Consolidado (2026-09-02)

Épico "Fechamento de Ano Fiscal e Carryover de Projetos" — 2 telas novas no
grupo **ANO FISCAL**, reaproveitando a base de Projetos Carry Over (sem
estrutura paralela).

**SQL — `sql/2026-09-02_fechamento_af.sql`:**
- `CREATE TABLE fechamento_af_decisoes` (id, ano_fiscal, projeto_codigo, decisao
  'CONTINUAR'|'HOLD'|'CANCELAR', valor_remanescente, observacao, decidido_por,
  decidido_em). **RLS OFF** (mesmo tratamento de `ajuste_orcamento_autorizacoes`
  — o app grava com a publishable key).
- `catalogo_atividades` (+ `funcao_atividades`, sob RLS — roda no SQL Editor):
  atividades `fechamento_projetos` (grupo ANO FISCAL, ordem 4) e `resultado_af`
  (ordem 5).
- Grants: `fechamento_projetos` → GOVERNANÇA e GESTOR TI com incluir/alterar
  (decisão = verbo "alterar"); `resultado_af` → GOVERNANÇA, GESTOR TI, FINANCEIRO
  só consultar. Administrador/Proprietário por bypass de papel.

**Telas / código:**
- `js/ano-fiscal/fechamento-projetos.js` — História 1. Lista projetos em curso
  (`!is_subprojeto && !projeto_concluido && sub_status ∉ CANCELADO/REPROVADO`,
  qualquer AF), botões **Continuar / Hold / Cancelar** embrulhados por
  `botaoSePodeAlterar('fechamento_projetos', …)`; handler reconfere
  `usuarioPodeAlterarTela`. Gravação:
  - CONTINUAR = payload de `marcarComoCarryover` (is_carryover + valor_carryover
    congelado + snapshot).
  - HOLD = idem + `sub_status='HOLD'` + `sub_status_antes_hold` + `tradeoff_*`
    (entra no pool, some das telas operacionais, retomável em "Retomar Projetos
    em Hold").
  - CANCELAR = `sub_status/status='CANCELADO'` + `resp/dt/motivo_cancelamento`,
    limpa `is_carryover`/`carryover_*`.
  - Todas gravam em `fechamento_af_decisoes` (log). CONTINUAR/HOLD reconferem
    `verificarElegibilidadeCarryover` (próximo AF precisa existir aberto/fechado).
- `js/ano-fiscal/resultado-af.js` — História 2. Só consulta. Seletor de AF
  (`anos_fiscais_config`) + seletor de agrupamento compartilhado
  (`modoAgrupamentoOrcamento`/`valorAgrupamentoSelecionado`). Seções: contagem de
  projetos (concluído / em andamento subdividido em carryover-andamento / hold /
  cancelado / reprovado / sem decisão), destaques (orçamento total de Cancelados
  / Hold / Carry Over), orçamento por fase (Aprovado=Σval_bc, Após Req=Σval_req,
  Após Espec=Σval_tech, Realizado, Saldo Final=Aprovado−Realizado) via
  `calcularCapexOpex`, e o quadro consolidado (`renderQuadroOrcamentoAgrupado`).
- `js/core/filtro-agrupamento-orcamento.js` — a linha "Orçamento Carry Over" do
  `renderQuadroOrcamentoAgrupado` virou **duas**: "Carry Over — Em Andamento" e
  "Carry Over — Em Hold". Reflete automaticamente no Dashboard e no Financeiro.
- Wiring: 2 links em `#menu-fy`, 2 `view-*` + modal em `index.html`, 2 `<script>`
  após `ajuste-orcamento.js`, 2 dispatch em `navigation.js`, `TAB_MODULO_MAP`
  (`fechamento_projetos: WORKFLOW`, `resultado_af: FINANCEIRO`).
- `js/projeto-detalhe/projeto-detalhe.js` — `fechamento_projetos` em
  `PROJETO_DETALHE_ORIGENS`; nova seção "Decisões de Fechamento de Ano Fiscal"
  lendo `fechamento_af_decisoes`.

### Ajuste v2 (2026-09-02) — tela única "Fechamento Ano Fiscal" com 2 abas

Reorganização a pedido do usuário:
- "Decisão de Fechamento de Projetos" + "Resultado do Ano Fiscal" viram as
  **2 abas** da tela única **`fechamento_af`**:
  - `fechamento_af:avaliacao` — "Avaliação e Fechamento Ano Fiscal": o
    resultado consolidado + o botão **"Fechar Ano Fiscal"**.
  - `fechamento_af:projetos` — "Avaliação Projetos Fechamento Ano Fiscal":
    a decisão por projeto (Carryover Desenvolvimento / Carryover Hold /
    Cancelar / **Reverter**). Substitui a tela **"Projetos Carry Over"**,
    que deixa de existir.
- **AF alvo** (o que está sendo encerrado): Q4 → AF em curso; Q1/Q2/Q3 →
  AF anterior ao em curso. `fechamentoAfTargetAF()` em `js/ano-fiscal/fechamento-af.js`.
- **Fechamento do ANO FISCAL** (≠ fechamento do ORÇAMENTO):
  `anos_fiscais_config.ano_fiscal_fechado` + `af_fechado_por/_em/_observacao`
  + `log_fechamento_ano_fiscal` (RLS off). Pré-condição: nenhum projeto do
  AF pode estar "em andamento" — todos HOLD, CANCELADO ou carryover.
- **Abertura Ano Fiscal** (`js/config/ano-fiscal.js`): passa a exigir, além
  do orçamento do AF corrente fechado, que o **AF anterior** esteja
  `ano_fiscal_fechado`. `renderAnoFiscalPanel` ganhou o card "Ano Fiscal em
  Andamento"; `abrirRecebimentoProximoAF` reconfere no clique.
- SQL: `sql/2026-09-02_fechamento_ano_fiscal_v2.sql` — colunas em
  `anos_fiscais_config`, `log_fechamento_ano_fiscal`, DELETE das atividades
  `carry_over` / `fechamento_projetos` / `resultado_af` do catálogo, INSERT
  de `fechamento_af:avaliacao` / `fechamento_af:projetos` + grants
  (GOVERNANÇA / GESTOR TI alteram, FINANCEIRO consulta).
- `TAB_MODULO_MAP`: `fechamento_af: 'WORKFLOW'` (removidos `carry_over`,
  `fechamento_projetos`, `resultado_af`). `navigation.js`: 1 dispatch
  (`fechamento_af`) no lugar de 3. `PROJETO_DETALHE_ORIGENS`: `fechamento_af`.

---

## Correção — Go-Live: Termo de Aceite obrigatório antes da Conclusão (2026-09-02)

Bug reportado pelo usuário: um projeto no Go-Live, ao registrar 100% de
evolução, migrava direto para a Conclusão **sem** Termo de Aceite; e a tela
de Termo de Aceite oferecia a ação **antes** dos 100%.

- **`js/phases/generic-workflow-ui.js`** (auto-avanço de fase): quando a
  etapa concluída em 100% é a **última do fluxo** (Go-Live, sem próxima
  etapa global), o projeto **não** vai mais para `etapa_atual='CONCLUIDO'` /
  `sub_status='CONCLUIDO'`. Passa a ficar `etapa_atual='GOLIVE'` +
  `sub_status='PENDENTE TERMO DE ACEITE'`. A baixa final continua sendo só
  pela tela "Concluir Projeto/Subprojeto" (`js/conclusao/conclusao-projeto.js`),
  que já exige Termo de Aceite registrado + zero ocorrências de erro abertas.
- **`js/golive/golive-termo-aceite.js`**: novo helper `goliveEtapaConcluida(codigo)`
  (etapa EXECUTAR (GO-LIVE) com `situacao='EXECUCAO_CONCLUIDO'`).
  `abrirModalGoliveTermoAceite` inclui `!goliveConcluido` em `bloqueado`
  (campos + botão Salvar escondidos) e mostra o aviso
  `#termoAceiteAvisoEvolucao`. `salvarGoliveTermoAceite` reconfere (defesa em
  profundidade). `renderListaGoliveTermoAceite` troca o botão "Abrir Termo"
  por "Aguardando 100%" enquanto a evolução não fechar.
- **`index.html`**: novo aviso `#termoAceiteAvisoEvolucao` no modal do Termo.

---

## Correção — 2 gaps após a mudança do Go-Live/Termo de Aceite (2026-09-02)

Reportados pelo usuário logo após a correção anterior:

1. **Projeto concluído continuava "PENDENTE TERMO DE ACEITE"** (ex.:
   `PRJ-FY26-912-CRD`). `confirmarConclusaoProjeto`
   (`js/conclusao/conclusao-projeto.js`) gravava `projeto_concluido=true`
   mas não mexia em `etapa_atual`/`sub_status` — que ficavam em `'GOLIVE'` /
   `'PENDENTE TERMO DE ACEITE'` (o auto-avanço que antes fazia isso não roda
   mais nesse ponto). Payload da conclusão passou a incluir
   `etapa_atual='CONCLUIDO'` + `sub_status='CONCLUIDO'`. Reparo de dados das
   linhas já concluídas no estado antigo:
   `sql/2026-09-02_fix_conclusao_pendente_termo_aceite.sql`.

2. **Dashboard — Consolidação por Fase contava o projeto CANCELADO duas
   vezes** (na linha da fase real + na linha "Projetos Cancelados"),
   inflando o TOTAL GERAL em relação ao quadro "Portfolio de Projetos do
   Fiscal Year". Só a fase `BC` excluía CANCELADO/REPROVADO
   (`subStatusExclude`); as fases REQ/TECH/EXEC/UAT/GOLIVE não. Em
   `renderTabelaConsolidacaoPortfolio` (`js/dashboards/dashboard.js`) o
   filtro das linhas de fase passou a excluir globalmente
   `sub_status ∈ (CANCELADO, REPROVADO)` e `status = CANCELADO`. Aparece
   agora com o Fechamento Ano Fiscal, que cancela projetos em fases
   avançadas.

---

## Correção — Formalizar Demanda oferecia o Ano Fiscal errado (2026-09-02)

Reportado pelo usuário: a Formalização de Demanda mostrava só o AF do
pipeline (AF2027) e não deixava incluir demanda para o AF em andamento
(AF2026) como Extraordinária.

Causa: `popularOpcoesAFDemanda` (`js/projects/core.js`) montava a opção
"Extraordinária" a partir de `getInfoAnoFiscal().afAtualStr` — cálculo pela
DATA do dia — em vez de ler `anos_fiscais_config`. Como a data de hoje
resolve para AF2027 (que é o pipeline, orçamento não fechado), a condição
nunca era satisfeita e o AF2026 (orçamento fechado, ano ainda não
encerrado) nunca era considerado. Tela não migrada junto com o resto do
app no `de33281`.

Correção:
- Opção **Normal** = AF em orçamentação (`obterAFAbertoParaDemandas()`,
  já com blindagem contra AF de orçamento fechado).
- Opção **Extraordinária** = AF em andamento, via `afEmAndamentoStr()`
  (`js/core/filtro-af-visao.js`): `orcamento_fechado = true` **e**
  `ano_fiscal_fechado ≠ true`. Um AF formalmente encerrado não aparece.
- `saveBusinessCase` passou a rejeitar Extraordinária para AF com
  `ano_fiscal_fechado = true` (antes só checava `orcamento_fechado`).

---

## Correção — Demanda Extraordinária ficava órfã após "Orçamentar Demanda" (2026-09-02)

Reportado: `PRJ-FY26-001-RHU` entrou como Extraordinária de AF2026, teve
"Orçamentar Demanda" concluída (100%) e não apareceu em "Aprovar Demanda
Extraordinária".

Duas causas em `js/adhoc/tradeoff.js`:
1. **AF errado** — a tela mirava `getInfoAnoFiscal().afAtualStr` (AF pela
   data = AF2027). Extraordinárias são registradas contra o **AF em
   andamento** (orçamento fechado = AF2026). Novo helper
   `afAlvoExtraordinaria()` = `afEmAndamentoStr()` com a data só de
   fallback; aplicado em `renderAdhocView`, `carregarSimulacaoAdhoc`,
   `renderTradeoffTable`, `recalcularSaldoSimulado`.
2. **sub_status** — a lista de "aguardando trade-off" exigia
   `sub_status = 'APROVADO'`. Desde o `d1ebf06` a Extraordinária não passa
   mais pelo Comitê, então ela fica em `'ORÇAMENTO REALIZADO'` depois de
   orçada e nunca chegava a `'APROVADO'`. Novo helper
   `subStatusAguardandoTradeoff()` aceita `ORÇAMENTO REALIZADO` **ou**
   `APROVADO`. `renderAdhocView` virou `async` para carregar
   `anosFiscaisListaCache` antes de resolver o AF.

Fluxo correto: Formalizar (Extraordinária) → Orçamentar Demanda (100%,
`ORÇAMENTO REALIZADO`) → **Aprovar Demanda Extraordinária** (trade-off) →
Requerimentos. Não passa por Comitê nem pelo fechamento do AF.

Reparo de dados (só se o projeto tiver sido empurrado a CONCLUIDO por
engano): `sql/2026-09-02_fix_extraordinaria_pos_orcamento.sql` — inclui o
SELECT de diagnóstico. Na maioria dos casos não é necessário: o projeto
volta a aparecer sozinho após o deploy.

---

## Feature — Controle Orçamentário + Período do Ano Fiscal (2026-09-03)

Duas telas novas no módulo ADMINISTRAÇÃO + uma no grupo ANO FISCAL.

### 1.1 — Controle Orçamentário (`controle_orcamento`)

- Tela `menu Administração > Controle Orçamentário`. Parâmetro persistido
  `config_controle_orcamento` (RLS off, append-only): `modo` ∈
  {AF (default), AREA, PRODUTO} + `vigencia_de` + log
  (`alterado_por/_em/modo_anterior`). SQL:
  `sql/2026-09-03_config_controle_orcamento.sql`.
- **Atividade DELEGÁVEL**: entra no catálogo comum
  (`sql/2026-09-03_catalogo_admin_orcamento.sql`, sem grant inicial). Runtime:
  `ehAdministrador || ehProprietario || usuarioTemAtividade('controle_orcamento')`.
  Um Administrador pode conceder a atividade a outro perfil em Funções e
  Permissões.
- Efeito: **só** a elegibilidade de projetos no trade-off da Demanda
  Extraordinária (`js/adhoc/tradeoff.js` → `modoTradeoff()` lê
  `modoControleOrcamentoAtivo()`, não mais `obterAgrupamentoOrcamento()`). O
  seletor "Agrupar orçamento por" do Dashboard/Financeiro **não muda**.
- Trade-off que cruza subgrupo (modo AREA/PRODUTO): não é mais bloqueado na
  tela. Ao aprovar, se `simulacaoForaDeEscopo`, grava
  `tradeoff_validacao_pendencias` (RLS off — `sql/2026-09-03_tradeoff_validacao_pendencias.sql`)
  com a simulação serializada; **nada é aplicado aos projetos**. Trade-off
  dentro do subgrupo (ou modo AF) segue aprovando direto.

### 1.1.d — Validação de Trade-off Extraordinário (`validacao_tradeoff`)

- Tela `menu Ano Fiscal > Validação de Trade-off Extraordinário`
  (`js/ano-fiscal/validacao-tradeoff.js`). **NÃO** altera a tela "Ajuste de
  Orçamento" (`js/ano-fiscal/ajuste-orcamento.js`).
- Catálogo: grants CRUD (consultar+alterar) a GOVERNANÇA e GESTOR TI, além do
  bypass Admin/Proprietário. `TAB_MODULO_MAP.validacao_tradeoff = 'WORKFLOW'`.
- Lista pendências `PENDENTE`; Detalhar mostra os projetos do trade-off + 3
  painéis de situação orçamentária (AF / subgrupo do extraordinário / por
  subgrupo envolvido). **Aprovar** (motivo obrigatório) roda
  `aplicarTradeoffAprovado()` (extraído de `aprovarSimulacaoAdhoc`) e marca
  `APROVADA`; **Rejeitar** (motivo) marca `REJEITADA` sem aplicar nada.

### 1.2 — Período do Ano Fiscal (`periodo_ano_fiscal`)

- Tela `menu Administração > Período do Ano Fiscal`. **Item crítico
  role-gated hardcoded** (`ehAdministrador || ehProprietario`), **fora do
  catálogo** (como Licenciamento de Módulos) — special-case em
  `aplicarVisibilidadeMenu` e em `switchTab`.
- Parâmetro `config_periodo_ano_fiscal` (RLS off, append-only, SEM seed):
  `mes_inicio` (1–12) + `vigencia_de` + log. SQL:
  `sql/2026-09-03_config_periodo_ano_fiscal.sql`.
- `getInfoAnoFiscal()` (`js/core/fiscal-year.js`) e o Gantt do Roadmap
  (`js/roadmap/roadmap.js`), além de `obterLimitesAnoFiscal()`
  (`js/phases/generic-workflow-ui.js`), derivam quarters/rótulos do mês de
  início via `mesInicioAnoFiscal(dataRef)` — que escolhe a linha por vigência
  (datas anteriores à 1ª vigência = abril). Cache carregado em `auth.js`
  antes do 1º `getInfoAnoFiscal()`; a função continua síncrona. Config vazia
  ⇒ comportamento idêntico ao de hoje (abril–março).

---

## Fase 1 — Licenciamento por módulo: fonte única `modulo_funcao` (2026-09-03)

Ver `docs/AUDITORIA_MODULOS_LICENCIAMENTO.md` (mapa completo tela × módulo + as
3 listas de inconsistência).

- **Nova tabela `modulo_funcao`** (`activity_key` PK = tabId, `modulo`, `tipo`
  ∈ {NUCLEO, LICENCIAVEL}, `observacao`), RLS off — SQL
  `sql/2026-09-03_modulo_funcao.sql` (idempotente, `ON CONFLICT DO UPDATE` para
  reconciliar bases antigas).
- **`js/core/licenca.js`:** `carregarLicenca()` agora carrega `modulo_funcao`
  para o cache `moduloPorTab`. `moduloDoTab(tabId)` lê o cache primeiro
  (`NUCLEO` → sem gate) e cai no `TAB_MODULO_MAP` hardcoded só se a tela não
  estiver na tabela (primeiro boot / tabId novo). O `TAB_MODULO_MAP` deixa de
  ser a verdade — vira default de emergência + documentação, mantido em sincronia
  com o SQL.
- **Realocações (decididas com o usuário):**
  - `ano_fiscal` (Abertura Ano Fiscal): WORKFLOW → **NÚCLEO** (pré-requisito
    estrutural). `periodo_ano_fiscal` idem, explícito.
  - `ajuste_orcamento`, `validacao_tradeoff`, `controle_orcamento`,
    `projetos_adhoc` (Aprovar Demanda Extraordinária): → **FINANCEIRO** (todas
    as funções de orçamento no mesmo módulo pago).
  - `workflow_etapas` (Fases e Etapas), `prazos` (SLA): órfãos (núcleo por
    omissão) → **WORKFLOW** (config do motor de fases; era vazamento).
  - Cadastros mestres (`produtos`, `areas`, …), perfis de acesso, `dashboard`,
    `consultas`: NÚCLEO explícito. Produto/Área ficam no NÚCLEO de propósito —
    desacopla FINANCEIRO de PLANEJAMENTO_ESTRATÉGICO (spec 1.3).
- **Fora do escopo da Fase 1:** modelagem de SKU (Essencial/Comunicação/
  Financeiro/Enterprise) no banco — o sistema segue só com os 4 flags
  liga/desliga de `licenca_modulos`.
