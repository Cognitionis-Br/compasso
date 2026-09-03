# Licença da Empresa (Fase 3)

Cadastro da empresa licenciada, vigência da licença e renovação por código
assinado.

## Tabelas (`sql/2026-09-03_empresa_licenciada.sql`, RLS off)

- **`empresa_licenciada`** — linha única `id=1`: `cnpj`, `razao_social`,
  `nome_fantasia`, `data_aquisicao`, `vigencia_inicio`, `vigencia_termino`,
  `nome_cabecalho` (exibido em MAIÚSCULAS), `cor_exibicao` (hex),
  `logo_data_uri` (PNG/SVG ≤ 2 MB, data URI), `aviso_dias_antes` (default 30).
- **`log_licenca_verificacao`** — toda vez que o boot NEGA acesso
  (`SEM_CADASTRO` / `EXPIRADA`).
- **`log_renovacao_licenca`** — toda tentativa de renovação
  (`OK` / `ASSINATURA_INVALIDA` / `CNPJ_DIVERGENTE` / `CODIGO_INVALIDO` / `ERRO`).

## Gate no boot (`js/auth/auth.js` → `entrarNoSistema`)

Antes de qualquer tela renderizar, `verificarGateLicenca()`
(`js/core/empresa-licenciada.js`):

| Situação | Resultado |
|---|---|
| Cadastro incompleto | Tela **de setup** bloqueante. Proprietário vê o formulário; os demais veem "contate o Proprietário". |
| `hoje > vigencia_termino` | Tela **"Licença Expirada"**. Proprietário vê o campo de código de renovação; os demais só a mensagem. |
| Dentro da vigência, ≤ `aviso_dias_antes` do fim | App normal + **banner** amarelo (Proprietário / Administrador), dispensável por sessão. |
| Dentro da vigência | App normal. |

## Identidade visual

`aplicarIdentidadeEmpresa()` preenche, com `nome_cabecalho` em maiúsculas na
`cor_exibicao` (fallback `#3730A3`) e a `logo`:

- **menu lateral** — linha abaixo da marca "COMPASSO" (todas as telas);
- **tela de login** — abaixo de "Cloud Governance" (carregada em `js/main.js`
  antes do login);
- **tela inicial** — abaixo da logo do Compasso.

## Aba "Dados da Empresa Licenciada"

Menu **Proprietário** → `dados_empresa` (NÚCLEO). Formulário compartilhado com
a tela de setup (`formEmpresaHTML()`). Validações: CNPJ com dígitos
verificadores; início < término; aviso de baixo contraste da cor.

## Renovação — `netlify/functions/validar-renovacao.js`

O front (`enviarCodigoRenovacao`) faz `POST /.netlify/functions/validar-renovacao`
com `{codigo, usuario}`. A função:

1. valida a assinatura HMAC-SHA256 (`LICENSE_HMAC_SECRET`, só no servidor);
2. lê `empresa_licenciada.cnpj` e confere com o CNPJ do código;
3. grava a nova `vigencia_termino` e registra em `log_renovacao_licenca`.

Formato do código: `base64url(payloadJSON).base64url(HMAC)`, payload =
`{cnpj, vigencia_termino, emitido_em}`.

**Variáveis de ambiente da Netlify:** `LICENSE_HMAC_SECRET`, `SUPABASE_URL`,
`SUPABASE_SERVICE_KEY`. O gerador do código (utilitário da Cognitionis) e o
segredo **não ficam no repositório** — ver material entregue à parte.

Se o endpoint não existir (ambiente sem Netlify Functions), o front mostra
"não foi possível contatar o serviço de validação" e nada é alterado.
