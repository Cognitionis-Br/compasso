# Expurgo de referências ao cliente / sistema de origem

**Data:** 03/09/2026.

Objetivo (spec §2): não deixar nenhum registro dessas referências no
Compasso — código, documentação, banco e histórico do Git. Os termos exatos
e o script de remoção ficam **fora do repositório** (com a equipe), para que
o próprio processo não reintroduza as referências no histórico.

---

## 1. Código, documentação e SQL (concluído — commit `47487e2`)

Todas as ocorrências no *working tree* (comentários, um nome de chave em
`localStorage`, cabeçalhos de `sql/*.sql`, `CLAUDE.md`, `docs/README.md`,
`MATRIZ_PERMISSOES.md`) foram reescritas para termos neutros ("cliente de
origem", "sistema/motor de origem", "marca antiga"). Os dois manuais `.docx`
foram regenerados (`build_manual.py` — título/introdução reescritos) e os dois
`.docx` da marca antiga saíram do *working tree*.

**Verificação:** varredura por regex no *working tree* (exceto `.git` e
binários) → **0 ocorrências**.

### Pendências de arquivo binário (revisar no Excel — binário não é editado às cegas)

- `docs/DEPARA.xlsx` — 1 ocorrência no XML interno. Abrir, localizar a célula,
  trocar, salvar.
- `docs/CONTROLE DE ACESSO - FUNÇÕES.xlsx` — estava aberto/bloqueado na
  varredura. Conferir manualmente.

---

## 2. Banco de dados

`sql/2026-09-03_expurgo_referencias_origem.sql` — rodar no Supabase → SQL Editor:

1. **Etapa 1 (diagnóstico, só leitura):** varre todas as colunas de texto de
   `public.*` e lista `tabela.coluna` + nº de linhas com ocorrência.
2. **Revisar** o resultado.
3. **Etapa 2 (escrita):** preencher `p_alvos` com os pares da Etapa 1 e rodar —
   substitui o texto nos campos livres **sem apagar linhas de log**; grava o
   resumo em `log_expurgo_referencias_origem`.
4. Re-rodar a Etapa 1 → deve listar 0 tabelas.

---

## 3. Histórico do Git — reescrita

**Autorizada.** Executar depois dos itens 1 e 2. O procedimento (ferramenta,
backup espelho, arquivo de regras com os termos, comandos exatos e
validação) foi **entregue à parte** (não versionado, para não recolocar os
termos no histórico).

Pontos-chave já validados num *dry-run* sobre uma cópia espelho:

- `git filter-repo` (instalado como script standalone) reescreve texto em
  todos os *blobs* e mensagens de commit de todo o histórico; **arquivos
  binários (`.docx`/`.xlsx`) são ignorados pela substituição de texto** —
  confirmado: 48 *blobs* de planilha checados, 0 corrompidos.
- `--invert-paths` remove por completo os dois `.docx` da marca antiga de toda
  a história.
- Depois do *dry-run*, restaram **0 ocorrências** em código/texto (fora o
  próprio arquivo de regras, que é transitório e não entra no repo).

> ⚠️ O passo final — `git push --force` para `Cognitionis-Br/compasso` — é
> **irreversível**, invalida todos os clones existentes e **dispara um rebuild
> completo no Netlify**. Exige confirmação explícita e deve ser feito com a
> equipe ciente (ninguém dando `push` durante a janela).

### Backup

`C:/Users/sergi/OneDrive/Documents/Compasso-backup-pre-expurgo.git` (clone
`--mirror` de 03/09/2026, antes da reescrita). Guardar fora do repo ativo até
a validação final no GitHub.
