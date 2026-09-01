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
  - Novos helpers `usuarioPodeIncluir/Alterar/Deletar(activityKey)` (admin/irrestrito = true).
    **Ainda não plugados nos botões das telas** — `usuarioTemAtividade` (≥ Consultar) segue governando tudo.
    Plugar os botões Incluir/Editar/Excluir de cada lista é etapa seguinte (Fase 2b), fora deste passo.
- **Pendente:** rodar o SQL no Supabase.

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

## Fase 4 — Habilitar RLS — *não iniciada*

Leitura livre para qualquer usuário autenticado nas 5 tabelas.

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
