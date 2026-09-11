# Especificação — Dashboard Analítico do Portfólio (Compasso)

## 1. Objetivo

Consolidar em uma única tela as informações de orçamento e de situação dos projetos que hoje estão dispersas em tabelas separadas, com um conjunto de filtros compartilhado que atualiza todos os componentes simultaneamente, sem reload de página.

## 2. Escopo

Esta especificação cobre as seguintes seções da tela, na ordem em que aparecem:

1. Seletor e Contexto do Ano Fiscal
2. Filtro Global
3. Resumo Orçamentário
4. Farol de Saúde
5. Composição do Portfólio
6. Orçado vs. Realizado por Área/UN
7. Consolidação do Portfólio por Fase
8. Funis de Criação do Ano Fiscal (normal e extraordinário)
9. Funil de Demandas
10. Status Detalhado da Carteira
11. Consolidação de Projetos Carryover

## 3. Perfis de Acesso

[A CONFIRMAR] Esta especificação assume que o dashboard segue o mesmo modelo de visibilidade já usado no módulo FINANCEIRO (`ehAdministrador || ehProprietario` para dados orçamentários sensíveis, conforme já documentado no projeto). Precisa ser confirmado se todas as 10 seções seguem essa mesma regra ou se alguma (ex: Status Detalhado da Carteira) deve ficar visível para um público mais amplo.

## 4. Regras de Negócio

### 4.0 Seletor e Contexto do Ano Fiscal [CONFIRMADO — a partir da tela atual em produção]
- Seletor no canto superior direito da tela, formato **"Ano Fiscal AFxxxx — <situação>"** (ex: "Ano Fiscal AF2026 — em andamento"). Este seletor é o que define qual Ano Fiscal alimenta toda a tela — equivale ao filtro "Ano Fiscal" descrito em 4.1, não é um componente adicional.
- Logo abaixo do título da página, um banner de contexto (ícone + título "Ano Fiscal AFxxxx" + texto descritivo) explica o escopo dos dados exibidos — ex: "Projetos do AF2026 + todos os projetos Carryover. Situação: orçamento fechado, Ano Fiscal em andamento." Esse texto muda conforme a situação do ano fiscal (em andamento / encerrado / em abertura) e deve deixar claro que o escopo inclui os projetos Carryover do(s) ano(s) anterior(es), não apenas os abertos no ano selecionado.
- Na sidebar, um widget fixo "STATUS DO CICLO" mostra o **FY Atual** do sistema (ex: "FY Atual: FY2027 (Q1)") — este valor é global e **independente** do Ano Fiscal selecionado no dashboard: representa o trimestre corrente do calendário fiscal da organização, enquanto o seletor do dashboard permite navegar por qualquer AF já aberto no sistema. Não confundir os dois na implementação.
- [A CONFIRMAR] Lista completa de situações possíveis para um Ano Fiscal (hoje observado: "em andamento"; presumir também "em abertura" e "encerrado" com base no restante da spec, mas precisa confirmação).

### 4.1 Filtro Global [CONFIRMADO — comportamento]
- Filtros disponíveis: **Ano Fiscal** (seletor único), **Área**, **Fase**, **Status**, **Tipo** (GROW/REG/RUN) — os quatro últimos como múltipla seleção (chips).
- Uma "trilha" de chips acima do conteúdo mostra os filtros ativos, removíveis individualmente.
- Botão único "Limpar filtros" reseta todos de uma vez.
- [A CONFIRMAR] Quais das 10 seções reagem ao filtro global. Proposta: seções 3, 5, 6 e 9 são recalculadas a partir do mesmo conjunto de projetos filtrados, porque existe um registro por projeto para sustentar isso. Seções 2, 4, 7, 8 e 10 hoje só existem como totais agregados de portfólio — não há confirmação de que a origem de dados permite recalculá-las por Área/Fase/Status. Enquanto isso não for confirmado, elas devem ser tratadas como painéis estáticos (mostram o total do ano fiscal, independente do filtro).

### 4.2 Consolidação do Portfólio por Fase [CONFIRMADO — correção]
- São 7 fases lineares e independentes: Business Case, Requerimentos, Technical Architecture, Execução, UAT, **Go-Live**, **Concluído**. Go-Live e Concluído são fases distintas — não devem ser combinadas em uma única linha (correção de um comportamento identificado no gráfico atual, que rotulava a linha como "Go-Live & Concluídos").
- Cancelados, Reprovados e Em Hold são desfechos que saem do fluxo linear — não são "mais uma fase". Devem ser exibidos como cards satélite separados do pipeline, nunca como barras dentro da mesma sequência.
- **Regra de validação:** soma das quantidades nas 7 fases lineares + soma dos 3 desfechos satélite (Cancelados + Reprovados + Hold) = Total Geral da Carteira do ano fiscal vigente. Essa soma deve ser validada em tempo de exibição; se não bater, é sinal de inconsistência na origem dos dados, não um estado válido a ser exibido silenciosamente.
- [A CONFIRMAR] Divisão exata de Cancelados/Reprovados/Hold para o ano fiscal vigente — os valores usados nos mockups desta conversa foram ilustrativos e não reflity a carteira real de 2026.
- Ordem de leitura das barras: de cima para baixo, seguindo a ordem 1→7 acima (o gráfico atual do sistema está com a ordem invertida — Business Case aparece embaixo).
- Cada fase exibe: nome, barra proporcional ao seu % do total, quantidade absoluta e percentual lado a lado.
- Cor da barra: ligada ao Status de Saúde da fase (🟢/🟡/🔴), usando os tokens de cor já definidos no sistema para esses três estados — não uma paleta nova.

### 4.3 Resumo Orçamentário [CONFIRMADO — estrutura]
- Estrutura em cadeia: Orçamento Fechado → + Orçamento Extraordinário → + Carryover (Em Andamento) → + Carryover (Em Hold) → = Orçamento Atual → − Valores Já Realizados → = Orçamento a Realizar.
- Cada valor monetário é reportado em 3 colunas: **Total**, **CAPEX**, **OPEX**.
- Apresentação: 4 cards principais no topo (Orçamento Atual, Valores Já Realizados, Orçamento a Realizar, Total de Projetos), cada um com a divisão CAPEX/OPEX como subtexto — não como gráfico separado. As demais 4 linhas (Fechado, Extraordinário, Carryover Andamento, Carryover Hold) ficam em uma tira secundária de estatísticas compactas abaixo dos cards principais.

### 4.4 Farol de Saúde [CONFIRMADO — estrutura]
- 3 contadores (🟢 Saudável / 🟡 Atenção / 🔴 Crítico) + uma barra horizontal proporcional única mostrando a distribuição.
- Recalculado a partir do conjunto de projetos filtrado pelo Filtro Global (ver 4.1).

### 4.5 Composição do Portfólio [CONFIRMADO — estrutura]
- Barra única empilhada a 100%, com 3 segmentos: Incluídos na Abertura do Ano Fiscal, Demandas Extraordinárias, Demandas Carryover.

### 4.6 Orçado vs. Realizado por Área/UN [CONFIRMADO — estrutura]
- Gráfico de barras agrupadas (Orçado x Realizado), uma categoria por Área/UN.
- Recalculado a partir do conjunto de projetos filtrado.

### 4.7 Funis de Criação do Ano Fiscal [CONFIRMADO — estrutura]
- Dois funis independentes, mesma estrutura: Carteira Normal e Carteira Extraordinária.
- Etapas: Para gerar orçamento → Para validar → desfechos (Aprovados / Reprovados / Cancelados), exibidos como ramificações fora da sequência linear, não como próxima etapa.
- Estado vazio: quando todos os valores de um funil são zero, não desenhar o funil — exibir uma mensagem de estado vazio compacta.

### 4.8 Funil de Demandas [A CONFIRMAR — estrutura]
- Etapas reais ainda não fornecidas. Não implementar com etapas assumidas; aguardar confirmação antes de codificar esta seção.

### 4.9 Status Detalhado da Carteira [CONFIRMADO — estrutura]
- Tabela nominal por projeto: Código, Projeto, Tipo, Área, Fase, Status, Previsto, Realizado, Saúde.
- Filtros já existentes (Área, Fase, Status) passam a ser os mesmos filtros do Filtro Global — não uma segunda barra de filtro independente.
- Tags coloridas por Tipo (GROW/REG/RUN), usando as cores já existentes no sistema para essa classificação.
- Esta tabela é a origem de dados que alimenta as seções 4.4, 4.6 e potencialmente 4.2 (ver 4.1 sobre o que ainda precisa ser confirmado).

### 4.10 Consolidação de Projetos Carryover [CONFIRMADO — estrutura]
- Lista nominal (Código, Projeto, Fase/Situação, Saldo, Marcado Por) — mantém-se como tabela, não vira gráfico.
- Estado vazio explícito quando não houver nenhum projeto em Carryover, em vez de tabela em branco.

## 5. Estilo Visual [CONFIRMADO — princípios / A CONFIRMAR — tokens exatos]

- Manter o modelo de layout já validado nos protótipos desta conversa: cards com indicador de cor na borda superior, hairline borders (sem sombras pesadas), números em fonte tabular, painéis com título curto + uma linha de contexto.
- **Substituir a paleta de cores usada nos protótipos pela paleta real já em produção**, observada no print da tela atual:

| Elemento | Cor aproximada observada | Uso |
|---|---|---|
| Faixa de cabeçalho de tabela ("VISÃO POR: ...") | Navy quase preto (~#151A33) | Cabeçalho de seções de tabela |
| Valores CAPEX | Azul (~#3B5FC4) | Toda coluna/valor identificado como CAPEX |
| Valores OPEX | Roxo/magenta (~#8B3FA0) | Toda coluna/valor identificado como OPEX |
| Logo "PASSO" / destaques de marca | Laranja (~#E8792A) | Marca, badges de destaque, label "ANO FISCAL" |
| Sidebar | Navy escuro (~#12162B), texto branco | Navegação lateral |
| Widget "Status do Ciclo" | Fundo lilás claro (~#EDEAFB), texto roxo | Card fixo na sidebar |
| Faixas verticais coloridas à esquerda de cada linha da tabela | Azul / laranja / roxo, alternadas por linha | Ainda não confirmado o critério — parece indicar categoria ou origem da linha, não status de saúde |

  Estes valores são uma leitura visual aproximada do print, não os hexadecimais exatos do design system — o time de implementação deve extrair os tokens reais do CSS/tema em produção antes de codificar.
- As cores de 🟢 Saudável / 🟡 Atenção / 🔴 Crítico devem ser exatamente as já usadas em outras telas do sistema para os mesmos status (não aparecem no print enviado — precisa localizar onde já são usadas, provavelmente na tela de Consulta de Projetos ou Cronograma & Evolução).
- Tags de Tipo (GROW/REG/RUN) devem usar cores já existentes na classificação de projetos, se houver.
- [A CONFIRMAR] Critério de cor das faixas verticais à esquerda de cada linha do Resumo Orçamentário (visto no print) — replicar esse mesmo padrão nas novas seções se fizer sentido semântico, ou descartar se for só decorativo.

## 6. Critérios de Aceite

- [ ] Alterar qualquer filtro global (Área/Fase/Status/Tipo) atualiza Farol de Saúde, Orçado x Realizado por UN e Status Detalhado da Carteira sem reload de página.
- [ ] Go-Live e Concluído aparecem como fases distintas na Consolidação por Fase.
- [ ] A soma das 7 fases + os 3 desfechos satélite (Cancelados/Reprovados/Hold) é igual ao Total Geral da Carteira do ano fiscal vigente.
- [ ] Cards de orçamento exibem CAPEX e OPEX como subtexto, sem gráfico adicional dedicado a essa divisão.
- [ ] Nenhuma cor nova é introduzida na tela — todas vêm dos tokens já existentes no sistema.
- [ ] Funis (Criação Normal, Criação Extraordinária) exibem estado vazio em vez de gráfico zerado quando aplicável.
- [ ] Funil de Demandas não é implementado com etapas assumidas — aguarda especificação real.

## 7. Pendências

- Divisão real de Cancelados / Reprovados / Hold para o ano fiscal vigente — **nota:** os mocks desta conversa usaram uma carteira fictícia de 9 projetos; o print real da AF2026 mostra 12 projetos com orçamento fechado (R$ 2.736.000,00 — CAPEX R$ 1.332.000,00 / OPEX R$ 1.404.000,00). Os dados de exemplo usados nos protótipos **não devem** ser usados como referência de valores reais — servem só para validar o layout.
- Etapas reais do Funil de Demandas.
- Confirmação de quais seções (4.3, 4.5, 4.7, 4.10) devem também reagir ao Filtro Global, e se a origem de dados permite isso hoje.
- Tokens de cor exatos do design system (ver tabela na seção 5 — os valores ali são leitura aproximada do print, não os hexadecimais reais).
- Confirmação dos perfis de acesso à tela (seção 3) — o print mostra o usuário logado como "PERFIL: PROPRIETARIO", compatível com a suposição já registrada.
- Critério de cor das faixas verticais à esquerda das linhas do Resumo Orçamentário na tela atual (ver seção 5).
- Lista completa de situações possíveis para o Ano Fiscal, além de "em andamento" (ver seção 4.0).
