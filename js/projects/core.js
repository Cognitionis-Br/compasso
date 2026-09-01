// =========================================================================
// projects/core.js
// Núcleo do Business Case: geração de código, carregar/salvar demandas,
// tela de Formalizadas/Canceladas e fluxo de cancelamento.
//
// GAPS JÁ CONHECIDOS (ver Auditoria_Tecnica.md):
// - CORRIGIDO (a pedido do usuário 26/08/2026 — item 6/7 da auditoria):
//   loadProjects caía silenciosamente para localStorage se o Supabase
//   falhasse, mascarando erro de rede/permissão sem avisar o usuário —
//   e nada no sistema atual grava nesse localStorage, então o fallback
//   só poderia mostrar dado morto de uma versão antiga do app. Removido:
//   agora um erro real avisa claramente, sem fingir que os dados estão
//   atualizados.
// - confirmarCancelamento tem um fallback que tenta de novo só com
//   sub_status/status se o update completo falhar (item 8): mascara qual
//   coluna pode estar causando erro. Preservado como estava — não
//   corrigido aqui de propósito.
//
// REESCRITO (Fase 2 — Formalizar Demanda V2): o checkbox "Marcar como
// Extraordinária" deixou de existir. Agora o Ano Fiscal é escolhido num
// select — que mostra as duas opções possíveis quando ambas existem
// (o AF aberto pra demandas normais, e/ou o AF corrente já fechado, que
// só aceita demanda Extraordinária). Ao escolher a opção "Extraordinária",
// aparece um aviso + confirmação Sim/Não — só libera os campos do
// formulário depois do Sim.
// =========================================================================

// Popula o select de Ano Fiscal com as opções válidas no momento: o AF
// aberto pra demandas normais (se houver) e/ou o AF corrente já fechado
// (que só aceita Demanda Extraordinária, se houver).
async function popularOpcoesAFDemanda() {
    const select = document.getElementById('bcAnoFiscalSelect');
    if (!select) return;

    const infoAF = getInfoAnoFiscal();
    const { data: configAtual } = await _supabase.from('anos_fiscais_config').select('orcamento_fechado').eq('ano_fiscal', infoAF.afAtualStr).maybeSingle();
    const afAtualFechado = configAtual ? configAtual.orcamento_fechado === true : false;
    let afAberto = await obterAFAbertoParaDemandas();

    // CORRIGIDO (bug reportado pelo usuário: sistema deixou passar
    // demanda comum pra um AF com orçamento já fechado): blindagem
    // extra — mesmo que "recebimento_demandas_aberto" esteja
    // (indevidamente) true pra um AF que já tem orcamento_fechado=true,
    // nunca oferece esse AF como opção "normal". Confere de novo direto
    // no banco, não confia só no resultado de obterAFAbertoParaDemandas.
    if (afAberto) {
        const { data: configAberto } = await _supabase.from('anos_fiscais_config').select('orcamento_fechado').eq('ano_fiscal', afAberto).maybeSingle();
        if (configAberto && configAberto.orcamento_fechado === true) {
            afAberto = null;
        }
    }

    const opcoes = [];
    if (afAberto) opcoes.push({ af: afAberto, tipo: 'normal' });
    if (afAtualFechado && infoAF.afAtualStr !== afAberto) opcoes.push({ af: infoAF.afAtualStr, tipo: 'extraordinaria' });

    if (opcoes.length === 0) {
        select.innerHTML = '<option value="">Nenhum AF disponível no momento</option>';
    } else {
        select.innerHTML = opcoes.map(o => `<option value="${o.af}" data-tipo="${o.tipo}">${o.af}${o.tipo === 'extraordinaria' ? ' — Demanda Extraordinária' : ''}</option>`).join('');
    }

    await onChangeAnoFiscalDemanda();
}

// Reage à escolha do Ano Fiscal: se for a opção "Extraordinária", mostra
// o aviso + trava os campos até confirmar Sim; senão, libera direto.
async function onChangeAnoFiscalDemanda() {
    const select = document.getElementById('bcAnoFiscalSelect');
    const fieldset = document.getElementById('bcCamposDemanda');
    const avisoBox = document.getElementById('bcAvisoAFFechado');
    if (!select || !fieldset || !avisoBox) return;

    const opt = select.options[select.selectedIndex];
    const tipo = opt ? opt.getAttribute('data-tipo') : null;
    const af = select.value;

    if (tipo === 'extraordinaria') {
        document.getElementById('bcAvisoAFFechadoTexto').innerText =
            `Ano Fiscal ${af} já está com o orçamento fechado, a realizar ou em realização. As novas demandas incluídas nessa situação deverão ter o processo de aprovação através do menu "Aprovar Demanda Extraordinária".`;
        avisoBox.classList.remove('hidden');
        const radioNao = document.querySelector('input[name="bcConfirmaExtraordinaria"][value="nao"]');
        if (radioNao) radioNao.checked = true;
        fieldset.disabled = true;
    } else {
        avisoBox.classList.add('hidden');
        fieldset.disabled = false;
    }

    await atualizarCodigoProjetoAutomatico();
    await popularPilaresParaDemanda();
}

// Resposta ao "Confirma esse pedido? Sim/Não" — só libera os campos do
// formulário quando confirmado.
function onConfirmaExtraordinaria() {
    const radioSim = document.querySelector('input[name="bcConfirmaExtraordinaria"]:checked');
    const confirmou = radioSim && radioSim.value === 'sim';
    const fieldset = document.getElementById('bcCamposDemanda');
    if (fieldset) fieldset.disabled = !confirmou;
    atualizarCodigoProjetoAutomatico();
}

// Tipo de Projeto (item 0) — só os ativos.
async function popularTiposProjetoParaDemanda() {
    const select = document.getElementById('bcTipoProjeto');
    if (!select) return;
    const { data } = await _supabase.from('tipos_projeto').select('*').eq('ativo', true).order('codigo');
    select.innerHTML = '<option value="" selected disabled>-- SELECIONE --</option>' +
        (data || []).map(t => `<option value="${t.id}">${escapeHtml(t.codigo)} - ${escapeHtml(t.descricao)}</option>`).join('');
}

// NOVO (Agrupamento de Orçamento por Produto — item 2): Produto é
// obrigatório em toda demanda nova. O sentinela NAO_CLASSIFICADO NÃO
// aparece aqui (só existe como valor histórico dos projetos antigos).
async function popularProdutosParaDemanda() {
    const select = document.getElementById('bcProduto');
    if (!select) return;
    if (typeof carregarProdutosData === 'function') await carregarProdutosData();
    const lista = (typeof produtosSelecionaveis === 'function')
        ? produtosSelecionaveis()
        : (produtosCache || []).filter(p => p.ativo && p.codigo !== 'NAO_CLASSIFICADO');
    select.innerHTML = '<option value="" selected disabled>-- SELECIONE --</option>' +
        lista.map(p => `<option value="${p.id}">${escapeHtml(p.codigo)} - ${escapeHtml(p.nome)}</option>`).join('');
}

// -------------------------------------------------------------------------
// Benefit Results (quadro da demanda) — cada linha escolhe um Return/Benefit
// (Tabela 1, ver js/tipos-projeto/return-benefit.js) e, se esse tipo
// permitir valor, informa NPV ou ROI. Acumulado localmente durante o
// preenchimento do formulário, porque a tabela projeto_benefit_results
// referencia projeto_codigo — que só existe depois que a demanda é salva
// (ver saveBusinessCase).
// -------------------------------------------------------------------------
let returnBenefitParaDemandaCache = [];
let beneficiosDemandaAtual = [];

async function popularTiposReturnBenefitParaDemanda() {
    const select = document.getElementById('bcBenefitTipo');
    if (!select) return;
    const { data } = await _supabase.from('tipos_return_benefit').select('*').eq('ativo', true).order('nome');
    returnBenefitParaDemandaCache = data || [];
    select.innerHTML = '<option value="">-- Selecione --</option>' +
        returnBenefitParaDemandaCache.map(rb => `<option value="${rb.id}">${escapeHtml(rb.nome)}</option>`).join('');

    beneficiosDemandaAtual = [];
    onChangeBenefitTipoDemanda();
    renderTabelaBeneficiosDemanda();
}

// Mostra/esconde a escolha de métrica (NPV/ROI) e o campo de valor
// conforme o parâmetro "permite_valor" do tipo escolhido.
function onChangeBenefitTipoDemanda() {
    const tipoId = document.getElementById('bcBenefitTipo').value;
    const metricaWrapper = document.getElementById('bcBenefitMetricaWrapper');
    const valorWrapper = document.getElementById('bcBenefitValorWrapper');
    if (!metricaWrapper || !valorWrapper) return;

    const tipo = returnBenefitParaDemandaCache.find(rb => String(rb.id) === tipoId);
    const permiteValor = !!(tipo && tipo.permite_valor);

    metricaWrapper.classList.toggle('hidden', !permiteValor);
    valorWrapper.classList.toggle('hidden', !permiteValor);
    if (!permiteValor) {
        document.querySelectorAll('input[name="bcBenefitMetrica"]').forEach(r => r.checked = false);
        document.getElementById('bcBenefitValor').value = '';
    }
}

function adicionarBeneficioDemanda() {
    const tipoSelect = document.getElementById('bcBenefitTipo');
    const tipoId = tipoSelect.value;
    if (!tipoId) {
        return alert('Selecione um Return / Benefit antes de adicionar!');
    }
    const tipo = returnBenefitParaDemandaCache.find(rb => String(rb.id) === tipoId);
    if (!tipo) return;

    let metrica = null, valor = null;
    if (tipo.permite_valor) {
        const radioMetrica = document.querySelector('input[name="bcBenefitMetrica"]:checked');
        if (!radioMetrica) {
            return alert('Selecione se o valor informado é NPV ou ROI!');
        }
        metrica = radioMetrica.value;

        const valorInput = document.getElementById('bcBenefitValor');
        valor = parseFloat(valorInput.value);
        if (!valorInput.value || isNaN(valor) || valor < 0) {
            return alert('Informe um valor válido para o Benefit Result!');
        }
        if (valor > 999999999.99) {
            return alert('O valor não pode ultrapassar R$ 999.999.999,99!');
        }
    }

    beneficiosDemandaAtual.push({ tipo_return_benefit_id: Number(tipoId), nome: tipo.nome, metrica, valor });
    renderTabelaBeneficiosDemanda();

    tipoSelect.value = '';
    onChangeBenefitTipoDemanda();
}

function removerBeneficioDemanda(indice) {
    beneficiosDemandaAtual.splice(indice, 1);
    renderTabelaBeneficiosDemanda();
}

function renderTabelaBeneficiosDemanda() {
    const tbody = document.getElementById('bcBenefitTableBody');
    if (!tbody) return;

    if (beneficiosDemandaAtual.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="p-2 text-center text-gray-400 italic">Nenhum Benefit Result adicionado</td></tr>`;
        return;
    }

    tbody.innerHTML = beneficiosDemandaAtual.map((b, idx) => `
        <tr class="border-b border-gray-100">
            <td class="p-2">${escapeHtml(b.nome)}</td>
            <td class="p-2">${b.metrica || '-'}</td>
            <td class="p-2 text-right font-mono">${b.valor !== null ? 'R$ ' + b.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '-'}</td>
            <td class="p-2 text-center"><button type="button" onclick="removerBeneficioDemanda(${idx})" class="text-red-600 hover:text-red-800"><i class="fa-solid fa-trash"></i></button></td>
        </tr>
    `).join('');
}

// Pilar/Iniciativa Estratégica — sempre filtrados pelo AF da demanda e
// só os ativos, conforme pedido.
async function popularPilaresParaDemanda() {
    const selectAF = document.getElementById('bcAnoFiscalSelect');
    const pilarSelect = document.getElementById('bcPilarEstrategico');
    if (!pilarSelect) return;
    const af = selectAF ? selectAF.value : null;
    if (!af) {
        pilarSelect.innerHTML = '<option value="">-- Selecione --</option>';
        return;
    }
    const { data } = await _supabase.from('pilares_estrategicos').select('*').eq('ano_fiscal', af).eq('ativo', true).order('nome');
    pilarSelect.innerHTML = '<option value="">-- Selecione --</option>' +
        (data || []).map(p => `<option value="${p.id}">${escapeHtml(p.nome)}</option>`).join('');
    const iniciativaSelect = document.getElementById('bcIniciativaEstrategica');
    iniciativaSelect.innerHTML = '<option value="">-- Selecione o Pilar primeiro --</option>';
    iniciativaSelect.required = false;
}

function onChangeAssociaPilar() {
    const radioSim = document.querySelector('input[name="bcAssociaPilar"]:checked');
    const associa = radioSim && radioSim.value === 'sim';
    document.getElementById('bcPilarIniciativaWrapper').classList.toggle('hidden', !associa);
    document.getElementById('bcPilarEstrategico').required = associa;

    // CORRIGIDO (bug reportado: Pilar sem nenhuma Iniciativa cadastrada
    // travava o cadastro de demanda, pedindo uma Iniciativa que não existe):
    // Iniciativa só é obrigatória se estivermos associando a um Pilar E esse
    // Pilar tiver ao menos uma Iniciativa disponível no select (ver
    // onChangePilarDemanda, que mantém isso atualizado a cada troca de Pilar).
    const iniciativaSelect = document.getElementById('bcIniciativaEstrategica');
    const temIniciativaDisponivel = Array.from(iniciativaSelect.options).some(o => o.value !== '');
    iniciativaSelect.required = associa && temIniciativaDisponivel;
}

async function onChangePilarDemanda() {
    const pilarId = document.getElementById('bcPilarEstrategico').value;
    const iniciativaSelect = document.getElementById('bcIniciativaEstrategica');
    if (!iniciativaSelect) return;
    if (!pilarId) {
        iniciativaSelect.innerHTML = '<option value="">-- Selecione o Pilar primeiro --</option>';
        iniciativaSelect.required = false;
        return;
    }
    const { data } = await _supabase.from('iniciativas_estrategicas').select('*').eq('pilar_id', pilarId).eq('ativo', true).order('nome');

    // CORRIGIDO (bug reportado: Pilar Estratégico sem nenhuma Iniciativa
    // cadastrada não deixava salvar a demanda, mesmo escolhendo "Sim" pra
    // associar só ao Pilar): quando o Pilar escolhido não tem Iniciativa
    // ativa nenhuma, o campo deixa de ser obrigatório — ver
    // onChangeAssociaPilar e a validação equivalente em saveBusinessCase.
    if (!data || data.length === 0) {
        iniciativaSelect.innerHTML = '<option value="">-- Nenhuma Iniciativa cadastrada para este Pilar --</option>';
        iniciativaSelect.required = false;
        return;
    }

    iniciativaSelect.innerHTML = '<option value="">-- Selecione --</option>' +
        data.map(i => `<option value="${i.id}">${escapeHtml(i.nome)}</option>`).join('');

    const radioAssocia = document.querySelector('input[name="bcAssociaPilar"]:checked');
    iniciativaSelect.required = !!(radioAssocia && radioAssocia.value === 'sim');
}

// CORRIGIDO (bug reportado: numeração "somando diferente por área" em vez
// de sequencial por Ano Fiscal): esta função só gera uma PRÉVIA do código,
// chamada a cada troca de Área/Ano Fiscal no formulário — mas até aqui ela
// chamava a mesma RPC atômica (proximo_numero_projeto) usada pra atribuir
// o número de verdade, que INCREMENTA o contador a cada chamada. Resultado:
// cada vez que o usuário trocava de área (ou de AF) só pra ver a prévia,
// um número de sequência era consumido de vez, mesmo sem salvar nada —
// dava a impressão de números "pulando" por área. Agora a prévia só faz
// uma LEITURA (sem incrementar); o número real e definitivo só é obtido
// uma vez, no momento do salvamento de verdade (ver saveBusinessCase).
async function atualizarCodigoProjetoAutomatico() {
    const select = document.getElementById('bcAnoFiscalSelect');
    const afStr = select ? select.value : null;
    if (!afStr) {
        if (document.getElementById('bcCodigo')) document.getElementById('bcCodigo').value = '';
        return;
    }

    const aa = afStr.replace('AF20', 'FY').replace('AF', 'FY');

    const areaSelect = document.getElementById('bcArea');
    const selectedOption = areaSelect ? areaSelect.options[areaSelect.selectedIndex] : null;
    let areaClean = selectedOption ? selectedOption.getAttribute('data-mnem') : 'TII';
    if (!areaClean || areaClean.length < 3) areaClean = 'TII';

    const { data: contador, error } = await _supabase.from('contadores_codigo_projeto').select('ultimo_numero').eq('ano_fiscal', afStr).maybeSingle();
    if (error) {
        console.error('Erro ao consultar prévia do código do projeto:', error.message);
        alert('Erro ao gerar prévia do código automático do projeto: ' + error.message);
        return;
    }

    const proximoNumero = (contador ? contador.ultimo_numero : 0) + 1;
    const seq3Digitos = String(proximoNumero).padStart(3, '0');

    const codigoGerado = `PRJ-${aa}-${seq3Digitos}-${areaClean}`;
    if (document.getElementById('bcCodigo')) document.getElementById('bcCodigo').value = codigoGerado;
}

async function loadProjects() {
    const { data, error } = await _supabase.from('projetos').select('*');
    if (!error && data) {
        projectsData = data;
    } else {
        console.error('Erro ao carregar projetos do Supabase:', error ? error.message : 'resposta vazia');
        projectsData = [];
        alert('⛔ Não foi possível carregar os projetos do banco de dados. Verifique sua conexão com a internet e recarregue a página — os dados exibidos podem estar incompletos até isso ser resolvido.');
    }
}

async function saveBusinessCase(e) {
    e.preventDefault();

    const selectAF = document.getElementById('bcAnoFiscalSelect');
    const optAF = selectAF ? selectAF.options[selectAF.selectedIndex] : null;
    const tipoAF = optAF ? optAF.getAttribute('data-tipo') : null;
    const anoFiscal = selectAF ? selectAF.value : '';
    const isAdhoc = tipoAF === 'extraordinaria';

    if (!anoFiscal) {
        return alert('Selecione o Ano Fiscal desta demanda!');
    }

    // Reconfere a confirmação Sim/Não no momento de salvar (não só a
    // trava do fieldset) — segurança extra contra manipulação do form.
    if (isAdhoc) {
        const radioSim = document.querySelector('input[name="bcConfirmaExtraordinaria"]:checked');
        if (!radioSim || radioSim.value !== 'sim') {
            return alert('⛔ Confirme "Sim" no aviso de Demanda Extraordinária antes de salvar.');
        }
        // Reconfere de novo contra o banco — evita salvar Extraordinária
        // se algo mudou nesse meio tempo (AF reaberto, etc.).
        const { data: configAtual } = await _supabase.from('anos_fiscais_config').select('orcamento_fechado').eq('ano_fiscal', anoFiscal).maybeSingle();
        if (!configAtual || !configAtual.orcamento_fechado) {
            return alert(`⛔ Só é possível registrar uma demanda Extraordinária depois que o orçamento do ${anoFiscal} estiver fechado.`);
        }
    } else {
        // Reconfere que o AF normal ainda está mesmo aberto — e que ele
        // NÃO está com o orçamento fechado (mesma blindagem de
        // popularOpcoesAFDemanda, reconferida aqui por segurança).
        const afAberto = await obterAFAbertoParaDemandas();
        if (afAberto !== anoFiscal) {
            return alert('⛔ A situação do Ano Fiscal mudou nesse meio tempo. Atualize a página e tente novamente.');
        }
        const { data: configAbertoSave } = await _supabase.from('anos_fiscais_config').select('orcamento_fechado').eq('ano_fiscal', anoFiscal).maybeSingle();
        if (configAbertoSave && configAbertoSave.orcamento_fechado === true) {
            return alert(`⛔ O orçamento do ${anoFiscal} já está fechado — esta demanda só pode ser registrada como Extraordinária. Atualize a página e tente novamente.`);
        }
    }

    const nome = document.getElementById('bcNome').value;
    const area = document.getElementById('bcArea').value;
    const pessoaResp = document.getElementById('bcPessoaResp').value;
    const dtSolicitacao = document.getElementById('bcDtSolicitacao').value;
    const tipoProjetoId = document.getElementById('bcTipoProjeto').value;
    const produtoId = document.getElementById('bcProduto') ? document.getElementById('bcProduto').value : '';
    const tipoQualificacao = document.getElementById('bcTipoQualificacao').value;
    const descricaoProjeto = document.getElementById('bcDescricao').value.trim();
    const objetivo = document.getElementById('bcObjetivo').value.trim();
    const keyResults = document.getElementById('bcKeyResults').value.trim();

    if (!tipoProjetoId) {
        return alert('Selecione o Tipo de Projeto!');
    }
    if (!produtoId) {
        return alert('Selecione o Produto!');
    }
    // NOVO (a pedido do usuário 24/08/2026): campo voltou pra esta tela —
    // tinha sumido numa refatoração anterior (Formalizar Demanda V2) e
    // nunca mais era alimentado em lugar nenhum, apesar de ser exibido em
    // várias telas com fallback 'REG'.
    if (!['GROW', 'REG', 'RUN'].includes(tipoQualificacao)) {
        return alert('Selecione uma Qualificação da Demanda válida (GROW, REG ou RUN)!');
    }
    if (!descricaoProjeto) {
        return alert('Preencha a Descrição Sucinta do Projeto!');
    }
    // NOVO (a pedido do usuário 2026-09-01): Objetivo, Key Results e ao
    // menos um Benefit Result passam a ser obrigatórios na inclusão da
    // demanda.
    if (!objetivo) {
        return alert('Preencha o Objetivo!');
    }
    if (!keyResults) {
        return alert('Preencha os Key Results!');
    }
    if (beneficiosDemandaAtual.length === 0) {
        return alert('Adicione pelo menos um Benefit Result!');
    }

    // Pilar/Iniciativa Estratégica — obrigatórios só se "Sim" foi marcado.
    const radioAssocia = document.querySelector('input[name="bcAssociaPilar"]:checked');
    const associaPilar = radioAssocia && radioAssocia.value === 'sim';
    let pilarId = null, iniciativaId = null;
    if (associaPilar) {
        pilarId = document.getElementById('bcPilarEstrategico').value;
        const iniciativaSelectSave = document.getElementById('bcIniciativaEstrategica');
        iniciativaId = iniciativaSelectSave.value;
        if (!pilarId) {
            return alert('Selecione o Pilar Estratégico (ou marque "Não" se este projeto não estiver associado a nenhum)!');
        }
        // CORRIGIDO (bug reportado): só exige Iniciativa se o Pilar
        // escolhido de fato tiver alguma cadastrada — reflete o mesmo
        // estado de `required` mantido por onChangePilarDemanda.
        if (iniciativaSelectSave.required && !iniciativaId) {
            return alert('Selecione a Iniciativa Estratégica (ou marque "Não" se este projeto não estiver associado a nenhum Pilar/Iniciativa)!');
        }
    }

    // NOVO 10/08/2026 (G16, Especificacao_Workflow_v4.md, seção 5.1):
    // valida que a data de solicitação é >= data de abertura do AF
    // correspondente — evita registrar demandas com data anterior ao
    // início do próprio AF.
    const { data: configAF } = await _supabase.from('anos_fiscais_config').select('aberto_em').eq('ano_fiscal', anoFiscal).maybeSingle();
    if (configAF && configAF.aberto_em) {
        const dataAberturaStr = configAF.aberto_em.split('T')[0];
        if (dtSolicitacao < dataAberturaStr) {
            return alert(`⛔ A data de solicitação (${dtSolicitacao}) é anterior à data de abertura do ${anoFiscal} (${dataAberturaStr}).\n\nCorrija a data de solicitação para uma data igual ou posterior à abertura do Ano Fiscal.`);
        }
    }

    // CORRIGIDO (bug reportado: numeração "somando diferente por área"):
    // o número de sequência definitivo só é obtido aqui, no exato momento
    // do salvamento — única chamada à RPC atômica proximo_numero_projeto
    // neste fluxo inteiro. Tudo que veio antes (troca de Área/AF, validações)
    // só lia/mostrava prévia, sem consumir número nenhum (ver
    // atualizarCodigoProjetoAutomatico). O valor mostrado em bcCodigo é
    // só uma prévia e é descartado aqui — pode não bater com o número
    // final se outra demanda foi salva nesse meio tempo.
    const areaSelectSave = document.getElementById('bcArea');
    const areaOptSave = areaSelectSave ? areaSelectSave.options[areaSelectSave.selectedIndex] : null;
    let areaCleanSave = areaOptSave ? areaOptSave.getAttribute('data-mnem') : 'TII';
    if (!areaCleanSave || areaCleanSave.length < 3) areaCleanSave = 'TII';
    const aaSave = anoFiscal.replace('AF20', 'FY').replace('AF', 'FY');

    const { data: proximoNumero, error: errorNumero } = await _supabase.rpc('proximo_numero_projeto', { p_ano_fiscal: anoFiscal });
    if (errorNumero) {
        return alert('Erro ao gerar o código definitivo do projeto: ' + errorNumero.message);
    }
    const codigo = `PRJ-${aaSave}-${String(proximoNumero).padStart(3, '0')}-${areaCleanSave}`;

    // AJUSTADO (a pedido do usuário 24/08/2026): Porte saiu de vez desta
    // etapa (passa a ser calculado a partir de horas, lá na frente do
    // fluxo — ver js/core/workflow-engine.js `obterPortePorHoras`).
    // Qualificação voltou a ser pedida aqui.
    const novoProjeto = {
        codigo, nome, area, pessoa_solicitante: pessoaResp, data_solicitacao: dtSolicitacao, ano_fiscal: anoFiscal,
        tipo_projeto_id: Number(tipoProjetoId),
        produto_id: Number(produtoId),
        tipo_qualificacao: tipoQualificacao,
        descricao_projeto: descricaoProjeto,
        objetivo: objetivo || null,
        key_results: keyResults || null,
        pilar_estrategico_id: pilarId ? Number(pilarId) : null,
        iniciativa_estrategica_id: iniciativaId ? Number(iniciativaId) : null,
        is_adhoc: isAdhoc, etapa_atual: 'BUSINESS CASE', sub_status: 'A PLANEJAR'
    };

    const { error } = await _supabase.from('projetos').insert([novoProjeto]);
    if (error) {
        alert('Erro ao salvar no Supabase: ' + error.message);
        return;
    }

    // Grava as linhas do quadro Benefit Results, agora que o código
    // definitivo do projeto existe — ver adicionarBeneficioDemanda/
    // beneficiosDemandaAtual, acumulados localmente durante o preenchimento
    // do formulário (a tabela projeto_benefit_results referencia
    // projeto_codigo, que só existe depois do insert acima).
    if (beneficiosDemandaAtual.length > 0) {
        const linhasBeneficio = beneficiosDemandaAtual.map(b => ({
            projeto_codigo: codigo,
            tipo_return_benefit_id: b.tipo_return_benefit_id,
            metrica: b.metrica,
            valor: b.valor,
            criado_por: currentUser ? currentUser.nome : 'desconhecido'
        }));
        const { error: errorBeneficio } = await _supabase.from('projeto_benefit_results').insert(linhasBeneficio);
        if (errorBeneficio) {
            alert(`⚠️ Demanda ${codigo} foi salva, mas houve erro ao gravar o quadro Benefit Results: ${errorBeneficio.message}`);
        }
    }

    await loadProjects();
    renderF1Formalizadas();

    // NOVO (item 12, relatório de melhorias): ponto de disparo de e-mail
    // #1 da lista fixa — "Após salvar a demanda". Só dispara de verdade
    // se essa linha estiver ATIVA em Gestão do Fluxo de E-mail, com
    // destinatário/remetente/template configurados (a função já checa
    // tudo isso sozinha — aqui só avisamos QUAL ponto foi atingido).
    const projetoRecemCriado = projectsData.find(p => p.codigo === codigo) || novoProjeto;
    await dispararEmailFluxo('BUSINESS CASE', 'FORMALIZAÇÃO DEMANDA', 'Após salvar a demanda', projetoRecemCriado, {
        responsavelNome: pessoaResp,
        responsavelEmail: (pessoasSolicitantesData.find(p => p.nome === pessoaResp) || {}).email
    });

    alert('Demanda registrada com sucesso!');
    e.target.reset();
    document.getElementById('bcPilarIniciativaWrapper').classList.add('hidden');
    beneficiosDemandaAtual = [];
    renderTabelaBeneficiosDemanda();
    await popularOpcoesAFDemanda();
    await popularTiposProjetoParaDemanda();
    await popularTiposReturnBenefitParaDemanda();

    if (typeof renderDashboardMetrics === 'function') renderDashboardMetrics();

    switchTab('f1_formalizacao');
}

// Cor do badge de status, pra facilitar a leitura visual da lista de
// demandas formalizadas (ajuste apontado pelo usuário).
function corBadgeStatusFormalizada(sub) {
    const s = (sub || 'A PLANEJAR').toUpperCase();
    const mapa = {
        'A PLANEJAR': 'bg-gray-100 text-gray-800',
        'PLANEJADO': 'bg-blue-100 text-blue-800',
        'ORÇAMENTO REALIZADO': 'bg-amber-100 text-amber-800',
        'APROVADO': 'bg-green-100 text-green-800',
        'REPROVADO': 'bg-red-100 text-red-800',
        'HOLD': 'bg-orange-100 text-orange-800'
    };
    return mapa[s] || 'bg-gray-100 text-gray-800';
}

// NOVO: alterna entre as 4 abas de Formalizar Demanda (Criar / A
// Planejar / Em Andamento / Canceladas) — proposição V2.
function mudarAbaFormalizarDemanda(aba) {
    ['criar', 'a_planejar', 'em_andamento', 'canceladas'].forEach(a => {
        const btn = document.getElementById(`formDemandaBtn-${a}`);
        const painel = document.getElementById(`formDemandaPainel-${a}`);
        if (btn) btn.className = `form-demanda-btn px-4 py-2 rounded-md text-sm font-bold border-2 ${a === aba ? 'bg-red-700 text-white border-red-700' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`;
        if (painel) painel.classList.toggle('hidden', a !== aba);
    });
    aplicarVisibilidadeSubAbas('f1_formalizacao', 'formDemandaBtn');
}

function renderF1Formalizadas() {
    // AJUSTADO (Controle de acesso por atividade, Fase 4): cadastrar nova
    // demanda -> activity_key "f1_formalizacao:criar" (era etapa
    // "FORMALIZAÇÃO DEMANDA"/ação "planejar").
    const formCadastro = document.getElementById('formCadastroDemanda');
    if (formCadastro) {
        formCadastro.classList.toggle('hidden', !usuarioTemAtividade('f1_formalizacao:criar'));
    }

    // AJUSTADO: agora em DUAS listas separadas (uma aba pra cada),
    // conforme a proposição V2 — antes era uma lista única combinada.
    const SITUACOES_A_PLANEJAR = ['A PLANEJAR', 'A PLANEJAR - EM REVISÃO'];
    const SITUACOES_EM_ANDAMENTO = ['PLANEJADO', 'ORÇAMENTO REALIZADO'];

    const linhaDemanda = (p) => {
        const qualif = (p.tipo_qualificacao || 'REG').toUpperCase();
        const badgeQualif = qualif === 'GROW' ? 'bg-purple-100 text-purple-800' : qualif === 'RUN' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800';
        return `
            <tr>
                <td class="p-3 font-mono font-bold"><button onclick="abrirDetalheDemanda('${p.codigo}')" class="text-red-700 hover:text-red-900 hover:underline">${p.codigo}</button></td>
                <td class="p-3 font-semibold">${escapeHtml(p.nome)} <br><span class="text-[10px] px-1.5 py-0.5 rounded font-bold ${badgeQualif}">${qualif}</span></td>
                <td class="p-3 text-xs">${escapeHtml(p.pessoa_solicitante) || '-'} (${p.area || '-'})</td>
                <td class="p-3 text-xs font-mono font-bold text-blue-900">${p.ano_fiscal || '-'}</td>
                <td class="p-3 text-xs font-mono">${p.data_solicitacao || '-'}</td>
                <td class="p-3 text-xs"><span class="${corBadgeStatusFormalizada(p.sub_status)} font-bold px-2 py-1 rounded">${p.sub_status || 'A PLANEJAR'}</span></td>
                <td class="p-3 text-center">
                    <!-- AJUSTADO (Controle de acesso por atividade, Fase 4):
                         essa linha é usada tanto na lista "a_planejar"
                         quanto "em_andamento" (mesmo template) — mostra o
                         botão se o usuário tiver acesso a qualquer uma
                         das duas. -->
                    ${(usuarioTemAtividade('f1_formalizacao:a_planejar') || usuarioTemAtividade('f1_formalizacao:em_andamento')) ? `
                        <button onclick="abrirModalCancelamento('${p.codigo}', '${escapeJsAttr(p.nome)}')" class="bg-gray-700 hover:bg-red-700 text-white font-bold text-xs px-2.5 py-1 rounded shadow transition-all">
                            <i class="fa-solid fa-ban"></i> Cancelar
                        </button>
                    ` : '<span class="text-gray-400 italic text-[10px]">Sem permissão</span>'}
                </td>
            </tr>
        `;
    };

    const ordenar = (lista) => lista.sort((a, b) => (a.codigo || '').localeCompare(b.codigo || '', 'pt-BR'));

    // NOVO (Controle de acesso por atividade, Fase 5): restrição de área.
    const aPlanejar = filtrarProjetosPorArea(ordenar(projectsData.filter(p => {
        const etapa = (p.etapa_atual || 'BUSINESS CASE').toUpperCase();
        const sub = (p.sub_status || 'A PLANEJAR').toUpperCase();
        return (etapa === 'BUSINESS CASE' || etapa === '') && SITUACOES_A_PLANEJAR.includes(sub);
    })), 'f1_formalizacao:a_planejar');
    const emAndamento = filtrarProjetosPorArea(ordenar(projectsData.filter(p => {
        const etapa = (p.etapa_atual || 'BUSINESS CASE').toUpperCase();
        const sub = (p.sub_status || 'A PLANEJAR').toUpperCase();
        return (etapa === 'BUSINESS CASE' || etapa === '') && SITUACOES_EM_ANDAMENTO.includes(sub);
    })), 'f1_formalizacao:em_andamento');

    const tbodyAPlanejar = document.getElementById('f1APlanejarTableBody');
    if (tbodyAPlanejar) {
        tbodyAPlanejar.innerHTML = aPlanejar.length === 0
            ? `<tr><td colspan="7" class="p-4 text-center text-gray-400 font-bold">Nenhuma demanda a planejar</td></tr>`
            : aPlanejar.map(linhaDemanda).join('');
    }

    const tbodyEmAndamento = document.getElementById('f1EmAndamentoTableBody');
    if (tbodyEmAndamento) {
        tbodyEmAndamento.innerHTML = emAndamento.length === 0
            ? `<tr><td colspan="7" class="p-4 text-center text-gray-400 font-bold">Nenhuma demanda em andamento</td></tr>`
            : emAndamento.map(linhaDemanda).join('');
    }

    const tbodyCancel = document.getElementById('f1CanceladasTableBody');
    const canceladas = filtrarProjetosPorArea(projectsData.filter(p => (p.sub_status || '').toUpperCase() === 'CANCELADO' || (p.status || '').toUpperCase() === 'CANCELADO'), 'f1_formalizacao:canceladas');
    if (tbodyCancel) {
        tbodyCancel.innerHTML = canceladas.length === 0
            ? `<tr><td colspan="6" class="p-4 text-center text-gray-400 font-bold">Nenhuma demanda cancelada</td></tr>`
            : canceladas.map(p => `
                <tr class="bg-gray-50">
                    <td class="p-3 font-mono font-bold text-gray-500">${p.codigo}</td>
                    <td class="p-3 font-semibold text-gray-600 line-through">${escapeHtml(p.nome)}</td>
                    <td class="p-3 text-xs text-gray-500">${p.area || '-'}</td>
                    <td class="p-3 text-xs font-bold text-gray-700 uppercase">${escapeHtml(p.resp_cancelamento) || '-'}</td>
                    <td class="p-3 text-xs font-mono text-gray-600">${p.dt_cancelamento || '-'}</td>
                    <td class="p-3 text-xs text-red-700 italic">${escapeHtml(p.motivo_cancelamento) || '-'}</td>
                </tr>
            `).join('');
    }
}

function abrirModalCancelamento(codigo, nome) {
    document.getElementById('cancelCodigoHidden').value = codigo;
    document.getElementById('cancelNomeDisplay').value = `${codigo} - ${nome}`;
    document.getElementById('cancelRespInput').value = '';
    document.getElementById('cancelDataInput').value = new Date().toISOString().split('T')[0];
    document.getElementById('cancelMotivoInput').value = '';
    document.getElementById('modalCancelamento').classList.remove('hidden');
}

function fecharModalCancelamento() {
    document.getElementById('modalCancelamento').classList.add('hidden');
}

async function confirmarCancelamento() {
    const codigo = document.getElementById('cancelCodigoHidden').value;
    const resp_cancelamento = document.getElementById('cancelRespInput').value.trim().toUpperCase();
    const dt_cancelamento = document.getElementById('cancelDataInput').value;
    const motivo_cancelamento = document.getElementById('cancelMotivoInput').value.trim().toUpperCase();

    if (!resp_cancelamento || !dt_cancelamento || !motivo_cancelamento) {
        return alert("Por favor, preencha todos os campos obrigatórios para o cancelamento!");
    }

    let { error } = await _supabase.from('projetos').update({
        sub_status: 'CANCELADO', status: 'CANCELADO',
        resp_cancelamento, dt_cancelamento, motivo_cancelamento
    }).eq('codigo', codigo);

    if (error) {
        const resFallback = await _supabase.from('projetos').update({ sub_status: 'CANCELADO', status: 'CANCELADO' }).eq('codigo', codigo);
        if (resFallback.error) return alert("Erro ao cancelar no banco: " + resFallback.error.message);
    }

    const prj = projectsData.find(p => p.codigo === codigo);
    if (prj) {
        prj.sub_status = 'CANCELADO'; prj.status = 'CANCELADO';
        prj.resp_cancelamento = resp_cancelamento; prj.dt_cancelamento = dt_cancelamento; prj.motivo_cancelamento = motivo_cancelamento;
    }

    alert(`✅ Demanda ${codigo} marcada como CANCELADA com sucesso!`);
    fecharModalCancelamento();
    await loadProjects();
    renderF1Formalizadas();
}
