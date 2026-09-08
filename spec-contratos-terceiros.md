# Especificação Funcional — Módulo Contratos e Terceiros
## Recebimento de Informações de Pagamento por Email, Upload em Massa e Aprovação

**Módulo:** Contratos e Terceiros
**Produto:** Compasso (COGNITIONIS)
**Elaborado por:** Gestão de Negócio Financeiro / Análise de Negócio
**Status:** Proposta para validação

---

## 1. Objetivo

Permitir que informações de pagamentos e propostas vinculadas a **contratos** e **projetos** sejam capturadas de duas formas — por **email padronizado** (lido por agente automatizado) e por **upload de planilha Excel** — sem impacto imediato na base oficial. Todo dado capturado por esses dois canais entra como **pendente de aprovação**, garantindo controle e validação antes da integração aos dados oficiais do módulo. Adicionalmente, cada proposta e cada pagamento devem permitir anexar a respectiva **Nota Fiscal**.

## 2. Problema Atual

Hoje o lançamento de valores pagos por contrato/projeto no módulo Contratos e Terceiros depende de lançamento manual direto na base oficial, sem etapa de conciliação, o que gera risco de:

- Lançamentos duplicados ou incorretos sem validação prévia;
- Ausência de rastreabilidade da origem da informação (quem informou, por qual canal, com qual comprovante);
- Falta de padronização na coleta de dados vindos de terceiros/fornecedores ou de áreas internas.

## 3. Visão Geral da Solução

Serão criados **dois canais de entrada** que alimentam a mesma **tabela de staging (pendências)**, e um **fluxo único de aprovação** que promove os registros para a base oficial:

```
Canal 1: Email padronizado  ──┐
                               ├──> Staging (pendente_aprovacao) ──> Aprovação ──> Base Oficial
Canal 2: Upload Excel        ──┘
```

- **Canal 1 — Email:** agente lê caixa de entrada dedicada diariamente, extrai os dados do corpo do email e dos anexos (Nota Fiscal), e grava um registro pendente.
- **Canal 2 — Excel:** usuário autorizado faz upload de planilha com múltiplos lançamentos; cada linha vira um registro pendente, na mesma estrutura do Canal 1.
- **Anexo de Nota Fiscal:** obrigatório poder ser anexado tanto em uma **proposta** quanto em um **pagamento**, em qualquer um dos dois canais, e também posteriormente pela tela (edição manual antes da aprovação).
- **Aprovação:** perfil autorizado revisa cada pendência, pode aprovar, rejeitar (com motivo) ou corrigir campos antes de aprovar. Somente após aprovação o registro é gravado/atualizado na base oficial de Contratos e Terceiros.

## 4. Modelo de Email Padronizado

### 4.1 Caixa de recebimento

**Decisão confirmada:** a caixa de email de origem **não é única** — o agente pode ler mais de uma caixa/remetente, e não há a exigência de uma caixa dedicada por cliente ou instância. Por isso, cada mensagem deve trazer, no próprio corpo, a **referência que identifica a instância/cliente/projeto** a que o lançamento pertence (ver campo "Referência" em 4.3), já que essa identificação não pode ser deduzida apenas pela caixa de recebimento.

### 4.2 Modelo — Assunto

```
[CONTRATOS] {{TIPO}} - Contrato {{NUMERO_CONTRATO}} - Projeto {{NOME_PROJETO}}
```
Onde `{{TIPO}}` é `PROPOSTA` ou `PAGAMENTO`. O padrão de assunto é o principal ponto de parsing do agente — deve ser mantido fixo.

### 4.3 Modelo — Corpo do email (campos obrigatórios)

```
Referência: [identificação da instância/cliente — obrigatório, pois a caixa de recebimento não é exclusiva]
Tipo de Lançamento: [Proposta | Pagamento]
Contrato: [número/identificação do contrato]
Projeto: [nome ou código do projeto vinculado]
Fornecedor/Terceiro: [razão social ou nome]
Valor: [R$ 0.000,00]
Data de Referência: [dd/mm/aaaa]  (data da proposta ou do pagamento)
Descrição/Observações: [texto livre, opcional]

Anexo obrigatório: Nota Fiscal (PDF, JPG ou PNG)
```

O campo **"Referência"** é obrigatório e tratado com o mesmo rigor dos demais campos obrigatórios (item 4.4) — email sem essa informação é marcado como pendente com erro de leitura, pois o agente não tem como determinar a qual instância/cliente o lançamento pertence.

### 4.4 Regras de formato

- Campos devem seguir o rótulo exato ("Contrato:", "Projeto:", etc.) para permitir extração confiável — o agente deve tolerar variações simples de maiúsculas/minúsculas e espaçamento, mas não a ausência do rótulo.
- Caso um campo obrigatório não seja identificado, o email é marcado como **pendente com erro de leitura** (não descartado) para tratamento manual, e não devem ser criadas pendências parciais/incompletas na base de staging sem sinalização.
- Se o email não tiver anexo de Nota Fiscal, o registro ainda é criado como pendência, porém sinalizado com alerta "**NF não recebida**" — a ausência de NF não deve bloquear a criação do registro pendente, mas deve bloquear a aprovação final até regularização (ver seção 6).
- Múltiplos anexos: apenas arquivos PDF/JPG/PNG são considerados como candidatos a Nota Fiscal; demais formatos são ignorados pelo agente e registrados em log.

## 5. Canal 2 — Upload via Planilha Excel

### 5.1 Objetivo

Permitir carga em lote de múltiplos lançamentos (propostas e/ou pagamentos) sem depender de um email por lançamento — útil para regularização de histórico ou grandes volumes.

### 5.2 Estrutura mínima da planilha (colunas)

| Coluna | Obrigatório | Observação |
|---|---|---|
| Tipo de Lançamento | Sim | "Proposta" ou "Pagamento" |
| Contrato | Sim | Deve existir no cadastro de contratos, ou ser sinalizado como "contrato não localizado" |
| Projeto | Sim | Deve existir no cadastro de projetos |
| Fornecedor/Terceiro | Sim | |
| Valor | Sim | Numérico, positivo |
| Data de Referência | Sim | Formato dd/mm/aaaa |
| Observações | Não | |
| Nome do Arquivo da NF | Não | Nome do arquivo de NF a ser associado, caso o usuário faça upload dos PDFs/imagens de NF junto com a planilha (upload múltiplo casado pelo nome do arquivo) |

### 5.3 Regras de negócio do upload

- O upload gera **uma pendência por linha válida** na mesma tabela de staging usada pelo Canal 1 — mesma estrutura de dados, campo adicional de **origem** (`EMAIL` ou `UPLOAD_EXCEL`).
- Antes de gravar, o sistema valida linha a linha: contrato existe, projeto existe, valor numérico válido, data válida. Linhas com erro **não bloqueiam as demais** — são listadas em um relatório de erros de importação (linha, coluna, motivo) apresentado ao usuário ao final do processamento.
- Não há gravação direta na base oficial neste canal — mesmo estando o usuário autorizado a fazer upload, o dado permanece pendente de aprovação, garantindo consistência de controle entre os dois canais.
- Upload de NF em lote (arquivos anexados junto com a planilha) é vinculado à pendência pelo nome do arquivo informado na coluna correspondente; arquivos sem correspondência ficam disponíveis para associação manual posterior na tela de aprovação.

## 6. Anexo de Nota Fiscal em Propostas e Pagamentos

- Tanto uma **Proposta** quanto um **Pagamento** — em qualquer contrato, de qualquer projeto — devem ter campo próprio para anexar a Nota Fiscal correspondente (PDF/JPG/PNG).
- O anexo pode chegar por três vias: (1) anexo no email, (2) upload casado com a planilha Excel, (3) anexação manual direta na tela, antes ou depois da criação da pendência, mas sempre antes da aprovação final.
- **Regra de bloqueio de aprovação:** um registro pendente sem Nota Fiscal associada pode ser **visualizado e triado**, mas não pode ser **aprovado** para a base oficial sem que o aprovador confirme uma justificativa explícita de dispensa (ex.: "NF em processamento pelo fornecedor"), a qual fica registrada no histórico do lançamento.
- Cada NF fica vinculada ao registro (proposta ou pagamento) de forma 1:N — é permitido mais de um arquivo por lançamento (ex.: NF + comprovante de pagamento), mas deve haver ao menos um arquivo classificado como "Nota Fiscal" para liberar a aprovação.
- **Prazo de escalonamento (confirmado):** uma pendência sinalizada como "NF não recebida" que permanecer sem NF por **mais de 5 dias úteis** a partir da data de criação do registro deve gerar um **alerta de escalonamento** (ex.: destaque visual na lista de pendências e/ou notificação ao responsável), sem, no entanto, alterar a regra de bloqueio de aprovação já definida acima.

## 7. Fluxo de Aprovação

1. Registro chega via Email ou Upload Excel → status inicial **Pendente**.
2. Pendência aparece em tela própria de "Pendências de Contratos e Terceiros", com filtros por: origem (email/upload), contrato, projeto, status da NF (recebida/pendente), período.
3. Aprovador acessa o registro, pode:
   - **Aprovar** → grava/atualiza na base oficial do módulo Contratos e Terceiros;
   - **Corrigir e Aprovar** → permite ajuste de campos (ex.: contrato incorreto, valor com erro de digitação) antes de gravar;
   - **Rejeitar** → exige motivo obrigatório; registro permanece no histórico de pendências como "Rejeitado", sem afetar a base oficial.
4. Toda decisão de aprovação gera registro de auditoria (quem, quando, ação, valores antes/depois em caso de correção) — consistente com o padrão de idempotência e auditoria já adotado no restante do produto.
5. Nenhuma gravação na base oficial é feita fora deste fluxo — os dois canais de entrada (email e upload) **nunca escrevem diretamente** na tabela oficial de Contratos e Terceiros.

## 8. Perfis de Acesso (confirmado)

| Ação | Perfil |
|---|---|
| Fazer upload de planilha Excel | Gestor de Contratos / perfil habilitado no módulo |
| Anexar NF manualmente | Gestor de Contratos, ou quem tiver acesso de edição à pendência |
| Aprovar/Rejeitar pendência | Nova função **"Aprovação de Contratos e Terceiros"** (ver 8.1) |
| Configurar/monitorar a leitura das caixas de email de origem | PROPRIETARIO/ADMINISTRADOR |

### 8.1 Nova função de aprovação — decisão confirmada

- Será criada uma **nova função** (item de permissão) específica para a aprovação deste fluxo, registrada no catálogo unificado `modulo_funcao` já usado como fonte única de verdade para liberação de acesso no Compasso — mesmo padrão usado pelas demais funções do produto.
- Essa função **não é hardcoded** e **não fica restrita a um perfil fixo** (diferente das exceções administrativas já existentes, como Licenciamento de Módulos): ela fica disponível no catálogo de funções para ser **conectada a qualquer perfil já existente** (ex.: ADMINISTRADOR, ou um perfil de negócio como "Financeiro"), a critério de quem administra os perfis.
- Isso mantém consistência com o modelo atual de permissões: a decisão de quem aprova é uma configuração de perfil, não uma regra fixa no código.

## 9. Critérios de Aceite

- [ ] Email recebido no formato padrão gera pendência com todos os campos corretamente extraídos.
- [ ] Email com campo obrigatório ausente ou fora do padrão não gera pendência silenciosa — é sinalizado para tratamento manual.
- [ ] Email sem NF anexada gera pendência sinalizada como "NF não recebida", sem impedir a criação do registro.
- [ ] Upload de planilha Excel válida gera uma pendência por linha, com origem marcada como "Upload Excel".
- [ ] Upload de planilha com linhas inválidas gera relatório de erros linha a linha, sem interromper o processamento das linhas válidas.
- [ ] Tanto Propostas quanto Pagamentos permitem anexar um ou mais arquivos de Nota Fiscal.
- [ ] Nenhum registro é gravado na base oficial sem passar pela tela de aprovação.
- [ ] Aprovação sem NF exige justificativa explícita registrada.
- [ ] Toda ação de aprovação/rejeição/correção gera trilha de auditoria.

## 10. Decisões Confirmadas e Ponto Técnico Ainda em Validação

Os pontos abaixo, antes em aberto, foram decididos:

1. **Perfil de aprovação:** confirmado — nova função de aprovação registrada no catálogo `modulo_funcao`, conectável a qualquer perfil existente (item 8.1). Não é um perfil fixo/hardcoded.
2. **Caixa de email de origem:** confirmado — não é única. O agente pode ler múltiplas caixas/remetentes, e cada mensagem deve trazer o campo "Referência" identificando a instância/cliente (item 4.1 e 4.3).
3. **Prazo de tolerância de NF pendente:** confirmado em **5 dias úteis** para escalonamento de alerta (item 6).
4. **Provedor de leitura de email:** decisão de direção confirmada — **trabalhar dentro do padrão já existente** de provedores plugáveis (`providers/emailjs.js`, `providers/brevo.js`, `providers/resend.js`), **desde que tecnicamente viável**. Como o padrão atual foi desenhado para **envio** e não para **leitura de caixa de entrada**, este ponto requer uma validação técnica (prova de conceito) antes da implementação:
   - Verificar se algum dos provedores já usados (EmailJS, Brevo, Resend) oferece API de leitura/consulta de caixa de entrada compatível com o padrão de arquivo único por provedor (`require()` trocável) já adotado no produto.
   - Caso nenhum ofereça leitura nativa nesse padrão, avaliar acréscimo de um novo módulo de leitura (ex.: IMAP) seguindo a **mesma convenção arquitetural** (arquivo de provider isolado, troca por uma linha de `require()`), para não quebrar o padrão de swappable provider já estabelecido — mesmo que a leitura em si não venha do mesmo provedor usado para envio.
   - Resultado dessa validação deve ser registrado como decisão técnica confirmada antes do início da implementação do agente de leitura.
