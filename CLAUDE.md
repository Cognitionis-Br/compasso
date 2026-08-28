# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Compasso — a single-page portfolio/project governance app (business case → budget → committee approval →
requirements → technical → execution → UAT → go-live → carryover), in Portuguese (pt-BR). Product of
Cognitionis. Frontend is a static site (no build step, no bundler, no package.json) backed by Supabase
(Postgres + Auth + Edge Functions) and a couple of Netlify Functions for outbound email.

**Origin note**: Compasso started as a fork of a bespoke governance system built for a single client
("Compasso", kept as a separate codebase/deployment). Compasso is the productized version — same engine, own
Supabase project, own Netlify site, own branding. When reading old code comments that mention dates,
"item N do pedido", or a specific past decision, treat them as accurate history of the shared engine, not
as anything client-specific — the two codebases diverge from here forward.

## Running it

There is no build/test/lint tooling in this repo (no `package.json`). This is a plain static site:

- **Local dev**: serve the folder with any static file server (e.g. `npx serve .` or the VS Code "Live
  Server" extension) and open `index.html`. Opening `index.html` directly via `file://` will break Supabase
  calls in some browsers — serve it over `http://localhost`.
- **Deploy**: this repo is connected to Netlify via GitHub (`Cognitionis-Br/compasso`) — pushing to the
  connected branch triggers an automatic deploy. Unlike the Compasso codebase this was forked from, there is no
  manual drag-and-drop step; if a fix doesn't show up live, check whether it was actually pushed/merged and
  whether the Netlify deploy succeeded, before assuming the code itself is wrong.
- **Supabase Edge Function** (`supabase/functions/admin-create-user`): deployed manually via the Supabase
  CLI (`supabase login && supabase link --project-ref <ref> && supabase functions deploy admin-create-user`).
  Not deployed by Netlify or any CI. The project ref is Compasso's own Supabase project — never link this
  to the Compasso project.
- There are no automated tests. Verify changes by loading the app in a browser and exercising the affected
  tab/flow directly.

## Architecture

### Everything is one global scope — classic scripts, not ES modules

`index.html` loads ~50 `<script src="./js/...">` tags in a specific, load-bearing order (see the bottom of
`index.html`, just before `js/main.js`), followed by `js/main.js` last. **None of these files use
`import`/`export`.** Every `function`/top-level `let`/`const` lands in the same global (`window`) scope and
is callable/visible from every other script regardless of which file it physically lives in. This is a
deliberate, acknowledged tech-debt decision (see comments in `js/core/state.js` and `js/main.js`), not an
oversight — do not "fix" it by converting a single file to ES modules, that will break everything else that
references its globals.

Practical implications when editing:
- **Load order matters.** A file that calls a function defined in a script loaded *after* it will fail at
  runtime, not at parse time (since calls happen inside event handlers, not at top level) — but check
  `index.html`'s script order before assuming a new cross-file call will work.
- Global mutable state (`projectsData`, `areasData`, `currentUser`, `abaAtualId`, etc.) lives in
  `js/core/state.js`. The Supabase client (`_supabase`) lives in `js/core/supabase-client.js` and must load
  before everything else that queries the DB.
- `js/phases/stubs.js` holds empty/simple placeholder screens for phases that had no dedicated module yet.
  Several functions have since "graduated" out of it into their own modules (Technical → `js/technical/`,
  Usuários → `js/users/`, Carryover → `js/carryover/`) — the file's own header comment tracks which ones
  moved and when.

### Navigation / rendering model

`switchTab(tabId)` in `js/ui/navigation.js` is the router: it toggles `.tab-content`/`.sidebar-link`
visibility by DOM id convention (`view-{tabId}`, `link-{tabId}`) and then dispatches to that tab's
`render*View()` function via a long if-chain. There is no virtual DOM — render functions rebuild
`innerHTML` of table bodies / containers directly from the in-memory `*Data` arrays. New tabs must be wired
into this if-chain and given matching `view-*`/`link-*` element ids in `index.html`.

### Workflow engine

`js/core/workflow-engine.js` models the phase/step sequence as data (`fases_etapas`, `sla_etapa_porte`
Supabase tables) rather than hardcoded logic: each row has an `ordem` and `proxima_etapa_id` pointer, and
`ativo` flag (soft-delete — inactivating a step splices it out of the chain for new projects without
touching history on projects that already passed through it). `js/phases/generic-workflow-ui.js` renders
the generic "a planejar / execução" UI shared by phases that don't need bespoke screens (Execution, UAT,
Go-Live all call into it — see `js/phases/stubs.js`). "Concluir Requerimentos"/"Concluir Especificação"
have their own dedicated conclusion modal (`abrirModalConcluirFase`/`confirmarConclusaoFaseGenerica` in
`js/requirements/requirements.js`, shared as-is by `js/technical/technical.js`) — this is a separate code
path from the generic evolution modal, not a special case of it.

### Auth

Real Supabase Auth (`js/auth/auth.js`). Session persists via Supabase's own token persistence;
`checarSessaoAtiva()` (called once from `js/main.js`) re-enters the app on page reload if a session is
already active. `currentUser` does not carry role/permission info directly — RBAC is layered on top via
`perfis_usuarios`/`usuario_funcoes`/`funcoes` tables, loaded separately (`carregarPermissoesUsuarioAtual`,
`aplicarVisibilidadeMenu`, `ehAdministrador` gating in `switchTab`). Access control is activity-based
(`js/config/funcoes.js`): `catalogo_atividades` catalogs every tab/sub-tab/button in the system
(`activity_key` = `tabId` or `tabId:subtab`), `funcao_atividades` grants a função access to a set of them,
and `funcoes.acesso_irrestrito` (true for ADMINISTRADOR) bypasses the catalog entirely.
`usuarioTemAtividade(activityKey)`/`botaoSeTemAtividade(...)` are the check points; `aplicarVisibilidadeSubAbas(tabId, btnPrefix)`
runs at the end of every `mudarAba<Screen>(...)` to hide ungranted sub-tab buttons and auto-switch off an
ungranted active panel. **RLS is off** on the app's Supabase tables — access control is enforced only in the
client's UI logic and in the one Edge Function that needs a service-role key.

Password self-service (forgot password / voluntary change) lives in `js/auth/auth.js`
(`monitorarRecuperacaoSenha`, `confirmarNovaSenhaRecuperacao`, `cancelarRecuperacaoSenha`) and
`js/users/usuarios.js` (`abrirModalTrocaSenhaVoluntaria`). The recovery flow uses a cross-tab
`localStorage` flag (`CHAVE_RECUPERACAO_SENHA_ATIVA`, with a 10-minute expiry) to stop `checarSessaoAtiva()`
from treating a just-established recovery session as a normal login in a *different* browser tab — this was
a real bug found in production, not defensive over-engineering; don't remove it without understanding why
it's there.

### Email

Two independent layers, don't confuse them:
- `js/email-gestao/*` + `js/notifications/email-outbox.js` — in-app template/flow management and a
  Supabase-backed outbox queue (`emails_pendentes`) that the UI reads/writes. `config_email_geral` (a
  single-row table) is a master on/off switch that supersedes each `email_fluxo` row's own `ativo` flag —
  checked live (not cached) at both enqueue time (`dispararEmailFluxo`) and send time
  (`processarFilaEmailPendente`), since email settings can change mid-session in another tab.
- `netlify/functions/enviar-email.js` — the only thing allowed to actually call an email provider API
  (keeps API keys off the client). It's a thin dispatcher to `netlify/functions/providers/{emailjs,brevo,resend}.js`;
  each provider module implements `enviar({...}) -> { sucesso, erro, idExterno }`. To switch providers,
  change the single `require()` in `enviar-email.js` — no other file needs to change. Provider credentials
  are Netlify environment variables (e.g. `EMAILJS_PUBLIC_KEY`), configured per-deployment, never committed.

### Licenciamento de Módulos (28/08/2026, Compasso-only — doesn't exist in Compasso)

`js/core/licenca.js` gates whole blocks of the system behind a per-module on/off flag
(`licenca_modulos` table: `WORKFLOW`, `EMAIL`, `FINANCEIRO`, `PLANEJAMENTO_ESTRATEGICO`), meant to reflect
what a customer actually contracted. `TAB_MODULO_MAP` in that file is the single source of truth for which
`tabId` belongs to which module — a tabId absent from the map is NÚCLEO (auth, cadastros base, RBAC screens,
dashboard) and is never blocked. Two independent enforcement points read the same map, and both need to stay
in sync with it: `aplicarVisibilidadeMenu()` (`js/config/funcoes.js`) hides the sidebar/top-bar link, and
`switchTab()` (`js/ui/navigation.js`) refuses to load the view even if reached directly (shows
`view-modulo-bloqueado` instead) — this second check exists specifically so a forced/stale link can't bypass
licensing. `carregarLicenca()` is called once at login (`js/auth/auth.js:entrarNoSistema`), right alongside
the other config loads (funções, cargos, e-mail geral) — cache it like those, don't query
`licenca_modulos` ad hoc elsewhere.

The admin screen (`Administração > Licenciamento de Módulos`, `renderLicenciamentoModulosView` in
`js/core/licenca.js`) is restricted to `ehAdministrador` with the same double layer as Ferramentas de Dev:
it's in `catalogo_atividades` (so it *could* be granted to another role) but the view itself re-checks
`ehAdministrador` before showing real content — don't treat the catalog grant alone as sufficient
authorization if you ever touch this screen.

Mudança de Orçamento (`js/requirements/requirements.js:confirmarConclusaoFaseGenerica`,
`js/config/bloqueio-orcamento.js`) now depends on the `FINANCEIRO` module being active *and* a single
`config_bloqueio_orcamento.percentual_bloqueio_variacao` value (one number, applied to both horas and valor,
both Requerimentos and Technical) — the older four separate columns (`req_percentual_horas` etc.) still exist
in the DB as history but are no longer read or written by the app.

### Privileged operations requiring the Supabase service role key

Never do these from client-side code with the anon key. The one existing example,
`supabase/functions/admin-create-user/index.ts`, is the template to follow: it takes the caller's JWT,
verifies caller identity with the anon key, checks the caller has the `ADMINISTRADOR` role by querying with
the *service role* client, and only then performs the privileged action (`auth.admin.createUser`).

## Known gaps / in-repo signals to trust

- Comments throughout the codebase reference external docs (`ARQUITETURA_ALVO.md`, `GAPS_FUNCIONAIS.md`,
  `Auditoria_Tecnica.md`, `Especificacao_Workflow_v2.md`/`v4.md`, `schema_motor_workflow.sql`,
  `schema_perfis_usuarios.sql`). **None of these files exist in this repository** — they're either kept
  outside version control, specific to the original Compasso engagement, or lost. Don't spend time searching for
  them; treat in-code comments as the primary source of truth for *why* something is the way it is.
- Comments dated `dd/mm/2026` (e.g. "CORRIGIDO 10/08/2026", "AJUSTADO 10/08/2026") are a deliberate in-repo
  changelog convention inherited from the Compasso engine — when editing a function that has one, check whether
  your change would re-break the specific bug/decision the comment documents.
- `resetarBaseParaFase1` (`js/dev-tools/reset.js`) and other dev-tools writes directly to production
  Supabase with no access control beyond `ehAdministrador`-gated tab visibility — treat as dangerous/manual
  tools, not something to call programmatically or loosen further without being asked.
- RLS is off (see Auth section above) — every table is readable/writable by any authenticated anon-key
  client. Fine for a single-tenant deployment; **a hard blocker if Compasso ever becomes a shared
  multi-tenant instance serving more than one company's data from the same Supabase project** — don't
  assume that's safe without RLS being designed and turned on first.
