# Canal de e-mail padronizado — Contratos e Fornecedores (Release 1, Fase C)

Permite que lançamentos de **Proposta** e **Pagamento** cheguem por e-mail e
virem **pendências** no módulo *Contratos e Fornecedores → Pendências de
Contratos*, exatamente como as entradas manuais e por planilha. Nada entra na
base oficial sem passar pela tela de aprovação.

Referência funcional: `spec-contratos-terceiros.md` §4 (modelo de e-mail) e §6
(bloqueio por NF / escalonamento — Fase B).

---

## 1. Arquitetura

```
Provedor de inbound e-mail  ──POST webhook──▶  Netlify Function
(CloudMailin / SendGrid Inbound Parse /        netlify/functions/
 Mailgun routes / Postmark inbound …)          receber-email-contratos.js
                                                     │
                                    providers/inbound/generic.js  (parser plugável)
                                                     │
                                     Supabase REST (service key) + Storage
                                                     │
                              contratos_pendencias (origem = 'EMAIL')
                              + contratos_pendencias_itens (rateio, 1 projeto)
                              + contratos_pendencias_anexos (NF no bucket)
                              + log_contratos_pendencias (acao = 'IMPORTADA')
```

- **Nenhuma biblioteca** (`@supabase/supabase-js` não é usado) — mesmo padrão
  de `validar-renovacao.js`, com o wrapper `sb(path, init)` sobre `fetch`.
- **Provedor plugável**: `receber-email-contratos.js` só faz
  `require('./providers/inbound/generic.js')`. Para trocar de provedor, crie
  outro arquivo em `netlify/functions/providers/inbound/` exportando
  `parse(event) → { remetente, assunto, corpo, messageId, anexos:[{nome,tipo,base64}] }`
  e ajuste o `require`.
- O `generic.js` entende um **corpo de webhook em JSON** (CloudMailin `json`,
  SendGrid Inbound Parse configurado como JSON, Mailgun store+notify, Postmark
  inbound). Se o provedor mandar `multipart/form-data`, escreva um provider
  específico.

---

## 2. SQL a rodar (Supabase → SQL Editor)

Ordem sugerida (todos idempotentes):

1. `sql/2026-09-08_contratos_pendencias.sql` — staging (já rodado na Fase A).
2. `sql/2026-09-09_pagamento_nf_cabecalho_itens.sql` — itens de rateio (já rodado).
3. `sql/2026-09-09_pendencias_escalonamento_nf.sql` — **Fase B**: coluna
   `escalado_nf_em` + linha de `email_fluxo` `PENDÊNCIAS DE CONTRATO /
   ESCALONAMENTO NF` (nasce **inativa** — ligar em *Envio de E-mail — Gestão do
   Fluxo* e definir destinatário/remetente).
4. `sql/2026-09-09_pendencias_canal_email.sql` — **Fase C**: coluna
   `contratos_pendencias.email_message_id` + índice único parcial
   `ux_contratos_pendencias_email_msgid` (dedupe de retry de webhook).

---

## 3. Variáveis de ambiente na Netlify

*Site settings → Environment variables* (nunca no repositório):

| Variável | Obrigatória | Descrição |
|---|---|---|
| `SUPABASE_URL` | sim | `https://<ref>.supabase.co` |
| `SUPABASE_SERVICE_KEY` | sim | service_role key (ou a publishable — as tabelas de pendência estão com RLS off) |
| `INBOUND_CONTRATOS_SECRET` | sim | segredo compartilhado com o provedor. O webhook só é aceito se vier `?secret=<valor>` na URL **ou** header `X-Webhook-Secret: <valor>`. Sem match → HTTP 401. |
| `INBOUND_CONTRATOS_REFERENCIA` | recomendada | valor esperado do campo **Referência** do corpo (identifica **esta** instância/cliente — a caixa de e-mail não é exclusiva, §4.1). Se vazia, a Referência não é validada. |

---

## 4. Endpoint do webhook

```
POST https://<seu-site>.netlify.app/.netlify/functions/receber-email-contratos?secret=<INBOUND_CONTRATOS_SECRET>
Content-Type: application/json
```

Respostas:

| HTTP | Situação |
|---|---|
| `200 { ok:true, pendencia_id, status, erros:[] }` | pendência criada (`status` = `PENDENTE` ou `ERRO_LEITURA`) |
| `200 { ok:true, duplicado:true, pendencia_id }` | `Message-Id` já processado (retry) — nada novo criado |
| `400` | corpo do webhook ilegível pelo provider |
| `401` | segredo ausente/errado |
| `405` | método ≠ POST |
| `500` | env vars ausentes ou falha ao gravar |

> Sempre responда 2xx para o provedor **quando a pendência foi criada**, mesmo
> com `status = ERRO_LEITURA` — o e-mail não deve ser reenviado; o tratamento é
> manual na tela de Pendências (§4.4 da spec).

---

## 5. Formato do e-mail (o que o remetente deve enviar)

### Assunto (§4.2) — ponto de parsing principal, fixo
```
[CONTRATOS] PAGAMENTO - Contrato ACME20260900001 - Projeto PRJ-0042
```
`PROPOSTA` ou `PAGAMENTO`. Serve de fallback quando um rótulo do corpo falha.

### Corpo (§4.3) — rótulos exatos, tolerância só a maiúsc./minúsc. e espaço
```
Referência: ACME-PROD
Tipo de Lançamento: Pagamento
Contrato: ACME20260900001
Projeto: PRJ-0042
Fornecedor/Terceiro: ACME Serviços Ltda
Valor: R$ 12.500,00
Data de Referência: 09/09/2026
Descrição/Observações: NF 12345 - sprint 7

Anexo: Nota Fiscal em PDF, JPG ou PNG
```

- **`Fornecedor/Terceiro`** é ignorado na leitura — o fornecedor vem do
  contrato (consulta), não do e-mail.
- Campos obrigatórios: `Referência` (se `INBOUND_CONTRATOS_REFERENCIA` estiver
  setada), `Tipo de Lançamento`, `Contrato`, `Projeto`, `Valor`,
  `Data de Referência`. Faltando/ilegível → a pendência é criada como
  **`ERRO_LEITURA`** com a lista em `erros_leitura` (nunca descartada, nunca
  parcial silenciosa — §4.4).
- Sem anexo PDF/JPG/PNG → pendência criada com `nf_status = 'NAO_RECEBIDA'`
  (destaque na lista; **bloqueia a aprovação** até anexar ou dispensar — §6).
  Anexos de outros formatos são ignorados.
- E-mail é **single-project**: gera 1 item de rateio (`contratos_pendencias_itens`)
  com o valor total. Rateio entre vários projetos continua sendo pelo canal
  Excel ou pela correção manual da pendência antes de aprovar.

### Dedupe
O `Message-Id` do e-mail é gravado em `contratos_pendencias.email_message_id`
(índice único parcial). Retry do provedor com o mesmo `Message-Id` devolve
`duplicado:true` e não cria nada.

---

## 6. Configuração por provedor (resumo)

Aponte o webhook para a URL do item 4. O corpo precisa chegar como JSON.

- **CloudMailin** — target format **JSON (normalized)**. Campos `envelope.from`,
  `headers.subject`, `plain`, `attachments[].content` (base64) já são
  reconhecidos pelo `generic.js`.
- **SendGrid Inbound Parse** — marque **POST the raw... / Send JSON**; se só
  houver `multipart/form-data`, escreva um provider específico.
- **Mailgun** — rota `store()` + `notify` com `Content-type: application/json`,
  ou webhook de mensagens; campos `body-plain`, `attachments`.
- **Postmark Inbound** — JSON nativo (`From`, `Subject`, `TextBody`,
  `Attachments[].Content`), já coberto pelo `generic.js`.

Coloque o segredo em `?secret=` na URL cadastrada no provedor **ou** configure o
header `X-Webhook-Secret`.

---

## 7. Teste rápido (curl)

```bash
curl -s -X POST \
  "https://<seu-site>.netlify.app/.netlify/functions/receber-email-contratos?secret=<SECRET>" \
  -H "Content-Type: application/json" \
  -d '{
    "from": "financeiro@acme.com",
    "subject": "[CONTRATOS] PAGAMENTO - Contrato ACME20260900001 - Projeto PRJ-0042",
    "plain": "Referência: ACME-PROD\nTipo de Lançamento: Pagamento\nContrato: ACME20260900001\nProjeto: PRJ-0042\nFornecedor/Terceiro: ACME Ltda\nValor: R$ 12.500,00\nData de Referência: 09/09/2026\nDescrição/Observações: NF 12345\n",
    "message_id": "<teste-001@acme.com>",
    "attachments": []
  }'
```

Depois confira em *Contratos e Fornecedores → Pendências de Contratos* (ou
`SELECT id, origem, status, nf_status, erros_leitura FROM contratos_pendencias
WHERE origem = 'EMAIL' ORDER BY criado_em DESC;`).
