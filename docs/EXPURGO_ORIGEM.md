# Expurgo de referências ao cliente / sistema de origem

**Data:** 03/09/2026 · **Termos:** `cliente de origem`, `cliente de origem`,
`Compasso`, `Compasso`, `BTB`, `Compasso`.

Objetivo (spec §2): não deixar nenhum registro dessas referências no
Compasso — código, documentação, banco e histórico do Git.

---

## 1. Levantamento (working tree) e o que foi feito

| Arquivo | Ocorrência | Ação |
|---|---|---|
| `js/core/supabase-client.js:11` | comentário "separado do projeto usado pelo Compasso (cliente original)" | reescrito para "separado de qualquer outro ambiente" |
| `js/core/licenca.js:12` | "não existe/não é usado no Compasso" | "Recurso exclusivo do Compasso." |
| `js/auth/auth.js:120` | `const CHAVE_RECUPERACAO_SENHA_ATIVA = 'Compasso_recuperacao_senha_ativa'` | chave renomeada para `'compasso_recuperacao_senha_ativa'` (localStorage; TTL 10 min, sem impacto prático) |
| `index.html:10-11` | comentário "o vermelho da cliente de origem" | "cuja cor de marca era vermelha" |
| `.gitignore:21` | "the wrong (Compasso) project" | "the wrong project" |
| `CLAUDE.md` (6 pontos) | "Compasso" como nome do fork de origem | reescrito para "the upstream engine" / "predate the fork" |
| `docs/README.md` (4 pontos) | seção "Históricos (Compasso / Compasso)", "Dashboard Compasso", entradas `*_Compasso.docx` | seção removida (os `.docx` já não estão no working tree); refs reescritas; versão do manual atualizada p/ v6.0 |
| `MATRIZ_PERMISSOES.md:4` | "não cobre Compasso" | "não cobre o motor de origem" |
| `sql/*.sql` (9 arquivos) | cabeçalho "não roda contra a base do Compasso" | "SÓ Compasso (projeto Supabase fytynjjvzecljmgbtwec)" |
| `scratchpad/build_manual.py` (2 pontos) | "evolução do sistema Compasso / Compasso" nos manuais gerados | removido; `docs/Manual_Funcional_COMPASSO.docx` e `docs/Documento_Lacunas_COMPASSO.docx` regenerados (0 ocorrências confirmado) |

**Verificação:** `grep -rniE '(cliente de origem|Compasso|one[ _-]?btb|\botb\b|\bbtb\b)'` no
working tree (exceto `.git` e binários) → **0 ocorrências**. Manuais `.docx`
regenerados → 0 ocorrências no XML interno.

### Pendências de arquivo binário (revisar no Excel — não edito binário às cegas)

- `docs/DEPARA.xlsx` — 1 ocorrência no XML interno. Abrir, localizar e trocar
  a célula (provável menção a "Compasso" no de-para de nomenclatura), salvar.
- `docs/CONTROLE DE ACESSO - FUNÇÕES.xlsx` — não foi possível ler (arquivo
  aberto/bloqueado). Conferir manualmente por `cliente de origem`/`Compasso`/`Compasso`.

---

## 2. Banco de dados

Rodar `sql/2026-09-03_expurgo_referencias_origem.sql` no Supabase → SQL Editor:

1. **Etapa 1 (diagnóstico, só leitura):** varre todas as colunas de texto de
   `public.*` e lista `tabela.coluna` + nº de linhas com ocorrência (via
   `RAISE NOTICE`, aba *Messages*).
2. **Revisar** o resultado — decidir se alguma ocorrência é contexto legítimo a
   preservar (improvável em log/auditoria).
3. **Etapa 2 (escrita):** preencher `p_alvos` com os pares da Etapa 1 e rodar.
   Substitui `cliente de origem`→"cliente de origem", `Compasso`/`Compasso`→"Compasso" nos campos
   livres, **sem apagar linhas**. Grava o resumo em
   `log_expurgo_referencias_origem`.
4. Re-rodar a Etapa 1 → deve listar 0 tabelas.

---

## 3. Histórico do Git — reescrita (autorizada, executar após o item 1–2)

`git filter-repo` **não está instalado** neste ambiente. Instalar como
script standalone (sem dependências além de Python 3):

```bash
curl -sSL https://raw.githubusercontent.com/newren/git-filter-repo/main/git-filter-repo -o "$(git --exec-path)/git-filter-repo"
# (ou: pip install --user git-filter-repo)
git filter-repo --version
```

### 3.1 Backup obrigatório (antes de tudo)

```bash
cd /c/Users/sergi/OneDrive/Documents
git clone --mirror "C:/Users/sergi/OneDrive/Documents/Compasso" Compasso-backup-pre-expurgo.git
```

Guardar `Compasso-backup-pre-expurgo.git` fora do repo ativo.

### 3.2 Arquivo de regras `expurgo-replacements.txt`

```
cliente de origem==>cliente de origem
literal:cliente de origem==>cliente de origem
literal:cliente de origem==>CLIENTE DE ORIGEM
regex:(?i)Compasso==>Compasso
regex:\bCompasso\b==>Compasso
regex:\bOTB\b==>Compasso
regex:\bOtb\b==>Compasso
```

### 3.3 Rodar o filter-repo

```bash
cd "C:/Users/sergi/OneDrive/Documents/Compasso"
git filter-repo \
  --replace-text expurgo-replacements.txt \
  --path docs/Manual_Funcional_Compasso.docx --path docs/Documento_Lacunas_Compasso.docx --invert-paths \
  --replace-message expurgo-replacements.txt
```

- `--replace-text` troca o texto em **todos os blobs** de **todo o histórico**.
- `--path ... --invert-paths` remove por completo os 2 `.docx` de origem de
  toda a história (não só do HEAD).
- `--replace-message` aplica as mesmas trocas nas mensagens de commit
  (`fe9225a "Fork inicial do Compasso a partir do motor Compasso"`,
  `ed35378`, `4d005ab "... (Compasso/cliente de origem) ..."`, etc.).

### 3.4 Reconectar o remote e forçar

`git filter-repo` remove o `origin` de propósito. Reconferir e forçar:

```bash
git remote add origin https://github.com/Cognitionis-Br/compasso.git
git push --force --all origin
git push --force --tags origin
```

> ⚠️ **Passo irreversível e outward-facing.** Invalida todos os clones/forks
> existentes (precisam re-clonar) e **dispara um rebuild completo no Netlify**.
> Confirmar explicitamente antes de rodar o `push --force`.

### 3.5 Validação final

```bash
git grep -iE "cliente de origem|Compasso|\botb\b" $(git rev-list --all) -- . ; echo "esperado: vazio"
git log --all --oneline | grep -iE "cliente de origem|Compasso|compasso" ; echo "esperado: vazio"
```

E no GitHub: confirmar que a UI não mostra mais os commits antigos (o provedor
pode manter cache de refs órfãs por alguns dias — abrir chamado se persistir).
