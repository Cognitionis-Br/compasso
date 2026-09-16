// =========================================================================
// dev-tools/criar-teste.js
// NOVO (a pedido do usuário 25/08/2026): tela em Ferramentas de Dev pra
// criar um projeto de teste já nascendo em qualquer fase do funil
// (Requerimentos a Go-Live), com Extraordinário/Carryover opcionais —
// evita ter que inserir dados de teste manualmente direto no banco.
//
// AMPLIADO (a pedido do usuário 2026-09-16): passou a ter todos os campos
// de inclusão da tela de Formalizar Demanda / Business Case (Data de
// Solicitação editável, Objetivo, Pilar/Iniciativa Estratégica, Key
// Results, Benefit Result — simplificado pra 1 linha só — e Descrição),
// na mesma ordem/linha daquela tela onde deu pra manter. Proposta explícita
// do usuário: usar este caminho pra uma CARGA INICIAL de projetos já em
// andamento (não só projetos de teste descartáveis).
//
// Por isso, além do "estado de superfície" da tabela `projetos` (que já
// existia), agora TAMBÉM cria as linhas de `projeto_etapas` de toda fase
// ANTERIOR à Fase de Destino escolhida — todas concluídas
// (EXECUCAO_CONCLUIDO), com datas sequenciais a partir da Data de
// Solicitação e responsável tirado do pool de
// obterResponsaveisPorAtividade (fallback: a própria Pessoa Solicitante).
// Sem isso, Roadmap/Detalhamento do Projeto/Cronograma tratavam o projeto
// como "nada planejado ainda" mesmo ele já "estando" numa fase avançada. A
// fase de destino em si continua sem planejamento (nasce "A Planejar",
// pronta pra ser planejada de verdade dali em diante pelo fluxo normal).
// =========================================================================

const DEV_TESTE_FASES_COM_REQUERIMENTOS = ['TECHNICAL', 'EXECUTION', 'UAT', 'GOLIVE'];
const DEV_TESTE_FASES_COM_TECHNICAL = ['EXECUTION', 'UAT', 'GOLIVE'];
// Ordem do funil pra saber quais fases ficam ANTES da Fase de Destino
// escolhida — mesma ordem das options de #devTesteFase.
const DEV_TESTE_ORDEM_FASES = ['REQUIREMENTS', 'TECHNICAL', 'EXECUTION', 'UAT', 'GOLIVE'];

let devTesteBenefitTiposCache = [];

async function inicializarFormCriarTeste() {
    const selArea = document.getElementById('devTesteArea');
    if (selArea) {
        const options = ['<option value="" selected disabled>-- SELECIONE --</option>'];
        areasAtivas().forEach(a => {
            const nomeUpper = (a.nome || '').toUpperCase();
            options.push(`<option value="${nomeUpper}" data-mnem="${(a.mnemonico || '').toUpperCase()}">${nomeUpper}</option>`);
        });
        selArea.innerHTML = options.join('');
    }

    const selAF = document.getElementById('devTesteAF');
    if (selAF) {
        const { data } = await _supabase.from('anos_fiscais_config').select('ano_fiscal').order('ano_fiscal');
        const options = ['<option value="" selected disabled>-- SELECIONE --</option>'];
        (data || []).forEach(c => options.push(`<option value="${c.ano_fiscal}">${c.ano_fiscal}</option>`));
        selAF.innerHTML = options.join('');
    }

    const selTipoProjeto = document.getElementById('devTesteTipoProjeto');
    if (selTipoProjeto) {
        const { data } = await _supabase.from('tipos_projeto').select('*').eq('ativo', true).order('codigo');
        const options = ['<option value="" selected disabled>-- SELECIONE --</option>'];
        (data || []).forEach(t => options.push(`<option value="${t.id}">${t.codigo} — ${escapeHtml(t.descricao)}</option>`));
        selTipoProjeto.innerHTML = options.join('');
    }

    // NOVO (Agrupamento de Orçamento — itens 1/2): Produto virou atributo
    // obrigatório da demanda. Mesmo tratamento de Tipo de Projeto — só
    // produtos ativos, e o sentinela 'NAO_CLASSIFICADO' fica de fora
    // (é valor histórico dos projetos migrados, não escolhível numa
    // demanda nova).
    const selProduto = document.getElementById('devTesteProduto');
    if (selProduto) {
        const { data } = await _supabase.from('produtos').select('*').eq('ativo', true).order('codigo');
        const options = ['<option value="" selected disabled>-- SELECIONE --</option>'];
        (data || []).filter(p => p.codigo !== 'NAO_CLASSIFICADO')
            .forEach(p => options.push(`<option value="${p.id}">${escapeHtml(p.codigo)} — ${escapeHtml(p.nome)}</option>`));
        selProduto.innerHTML = options.join('');
    }

    // NOVO (2026-09-16): Data de Solicitação passa a ser editável — pré-
    // preenche com hoje só como ponto de partida conveniente (projeto de
    // teste descartável); pra carga de projeto real em andamento, o
    // usuário troca pela data real em que a demanda foi solicitada.
    const inputData = document.getElementById('devTesteDtSolicitacao');
    if (inputData && !inputData.value) inputData.value = new Date().toISOString().split('T')[0];

    // NOVO (2026-09-16): Benefit Result (opcional, 1 linha) — mesma fonte
    // de dados da tela de Formalizar Demanda (tipos_return_benefit).
    const selBenefitTipo = document.getElementById('devTesteBenefitTipo');
    if (selBenefitTipo) {
        const { data } = await _supabase.from('tipos_return_benefit').select('*').eq('ativo', true).order('nome');
        devTesteBenefitTiposCache = data || [];
        selBenefitTipo.innerHTML = '<option value="">-- Nenhum --</option>' +
            devTesteBenefitTiposCache.map(rb => `<option value="${rb.id}">${escapeHtml(rb.nome)}</option>`).join('');
    }

    onDevTesteFaseChange();
}

// NOVO (2026-09-16): Pilar Estratégico é filtrado pelo Ano Fiscal da
// demanda (mesma regra de popularPilaresParaDemanda, js/projects/core.js)
// — repopula sempre que o AF do form muda.
async function onDevTesteAFChange() {
    const af = document.getElementById('devTesteAF').value;
    const pilarSelect = document.getElementById('devTestePilarEstrategico');
    if (!pilarSelect) return;
    if (!af) {
        pilarSelect.innerHTML = '<option value="">-- Selecione o Ano Fiscal primeiro --</option>';
        return;
    }
    const { data } = await _supabase.from('pilares_estrategicos').select('*').eq('ano_fiscal', af).eq('ativo', true).order('nome');
    pilarSelect.innerHTML = '<option value="">-- Selecione --</option>' +
        (data || []).map(p => `<option value="${p.id}">${escapeHtml(p.nome)}</option>`).join('');
    const iniciativaSelect = document.getElementById('devTesteIniciativaEstrategica');
    if (iniciativaSelect) iniciativaSelect.innerHTML = '<option value="">-- Selecione o Pilar primeiro --</option>';
}

function onDevTesteChangeAssociaPilar() {
    const radioSim = document.querySelector('input[name="devTesteAssociaPilar"]:checked');
    const associa = radioSim && radioSim.value === 'sim';
    document.getElementById('devTestePilarIniciativaWrapper').classList.toggle('hidden', !associa);
}

async function onDevTesteChangePilar() {
    const pilarId = document.getElementById('devTestePilarEstrategico').value;
    const iniciativaSelect = document.getElementById('devTesteIniciativaEstrategica');
    if (!iniciativaSelect) return;
    if (!pilarId) {
        iniciativaSelect.innerHTML = '<option value="">-- Selecione o Pilar primeiro --</option>';
        return;
    }
    const { data } = await _supabase.from('iniciativas_estrategicas').select('*').eq('pilar_id', pilarId).eq('ativo', true).order('nome');
    iniciativaSelect.innerHTML = (data && data.length > 0)
        ? '<option value="">-- Selecione --</option>' + data.map(i => `<option value="${i.id}">${escapeHtml(i.nome)}</option>`).join('')
        : '<option value="">-- Nenhuma Iniciativa cadastrada para este Pilar --</option>';
}

// Mostra/esconde a escolha de métrica (NPV/ROI) e o campo de valor
// conforme o parâmetro "permite_valor" do tipo escolhido — mesma regra de
// onChangeBenefitTipoDemanda (js/projects/core.js).
function onDevTesteChangeBenefitTipo() {
    const tipoId = document.getElementById('devTesteBenefitTipo').value;
    const metricaWrapper = document.getElementById('devTesteBenefitMetricaWrapper');
    const valorWrapper = document.getElementById('devTesteBenefitValorWrapper');
    if (!metricaWrapper || !valorWrapper) return;

    const tipo = devTesteBenefitTiposCache.find(rb => String(rb.id) === tipoId);
    const permiteValor = !!(tipo && tipo.permite_valor);

    metricaWrapper.classList.toggle('hidden', !permiteValor);
    valorWrapper.classList.toggle('hidden', !permiteValor);
    if (!permiteValor) {
        document.querySelectorAll('input[name="devTesteBenefitMetrica"]').forEach(r => r.checked = false);
        document.getElementById('devTesteBenefitValor').value = '';
    }
}

function onDevTesteAreaChange() {
    const area = document.getElementById('devTesteArea').value;
    const selResp = document.getElementById('devTesteResp');
    if (!selResp) return;
    const pessoas = (typeof pessoasSolicitantesAtivas === 'function' ? pessoasSolicitantesAtivas() : [])
        .filter(p => (p.area || '').toUpperCase() === area);
    const options = ['<option value="" selected disabled>-- SELECIONE --</option>'];
    pessoas.forEach(p => options.push(`<option value="${escapeHtml(p.nome)}">${escapeHtml(p.nome)}</option>`));
    selResp.innerHTML = options.join('') || '<option value="" selected disabled>-- NENHUMA PESSOA CADASTRADA NESTA ÁREA --</option>';
}

function onDevTesteFaseChange() {
    if (document.getElementById('devTesteAdhoc').checked) return; // Extraordinário força os blocos escondidos — ver onDevTesteAdhocChange
    const fase = document.getElementById('devTesteFase').value;
    const blocoReq = document.getElementById('devTesteBlocoRequerimentos');
    const blocoTech = document.getElementById('devTesteBlocoTechnical');
    if (blocoReq) blocoReq.classList.toggle('hidden', !DEV_TESTE_FASES_COM_REQUERIMENTOS.includes(fase));
    if (blocoTech) blocoTech.classList.toggle('hidden', !DEV_TESTE_FASES_COM_TECHNICAL.includes(fase));
}

// NOVO (a pedido do usuário 25/08/2026): Demanda Extraordinária precisa
// nascer em Business Case, com orçamento definido mas ainda PENDENTE de
// aprovação do Comitê (sub_status 'ORÇAMENTO REALIZADO') — é o único jeito
// dela aparecer na fila de "Aprovar Orçamento por Projeto (Comitê)" pra
// testar de verdade os passos de aprovar/reprovar/reavaliar. Por isso,
// enquanto marcada, trava Fase/Requerimentos/Technical/Sub-status/
// Carryover — não fazem sentido combinados com esse estado.
function onDevTesteAdhocChange() {
    const adhocMarcado = document.getElementById('devTesteAdhoc').checked;
    const selFase = document.getElementById('devTesteFase');
    const selSubStatus = document.getElementById('devTesteSubStatus');
    const chkCarryover = document.getElementById('devTesteCarryover');
    const aviso = document.getElementById('devTesteAvisoAdhoc');
    const blocoReq = document.getElementById('devTesteBlocoRequerimentos');
    const blocoTech = document.getElementById('devTesteBlocoTechnical');

    selFase.disabled = adhocMarcado;
    selSubStatus.disabled = adhocMarcado;
    chkCarryover.disabled = adhocMarcado;
    if (aviso) aviso.classList.toggle('hidden', !adhocMarcado);

    if (adhocMarcado) {
        chkCarryover.checked = false;
        if (blocoReq) blocoReq.classList.add('hidden');
        if (blocoTech) blocoTech.classList.add('hidden');
    } else {
        onDevTesteFaseChange();
    }
}

async function criarProjetoTeste() {
    if (!ehProprietario) {
        return alert('⛔ Esta ferramenta é restrita ao PROPRIETÁRIO do sistema.');
    }

    const nome = (document.getElementById('devTesteNome').value || '').trim();
    const dtSolicitacao = document.getElementById('devTesteDtSolicitacao').value;
    const areaSel = document.getElementById('devTesteArea');
    const area = areaSel.value;
    const areaMnem = areaSel.options[areaSel.selectedIndex] ? areaSel.options[areaSel.selectedIndex].getAttribute('data-mnem') : null;
    const pessoaResp = document.getElementById('devTesteResp').value;
    const anoFiscal = document.getElementById('devTesteAF').value;
    const tipoProjetoId = document.getElementById('devTesteTipoProjeto').value;
    const produtoId = document.getElementById('devTesteProduto') ? document.getElementById('devTesteProduto').value : '';
    const objetivo = (document.getElementById('devTesteObjetivo').value || '').trim();
    const keyResults = (document.getElementById('devTesteKeyResults').value || '').trim();
    const descricaoProjeto = (document.getElementById('devTesteDescricao').value || '').trim();
    const tipoQualificacao = document.getElementById('devTesteQualificacao').value;
    const tipoOrcamento = document.getElementById('devTesteTipoOrcamento').value;
    const adhocMarcado = document.getElementById('devTesteAdhoc').checked;
    // Extraordinário sempre nasce em Business Case, pendente de aprovação
    // do Comitê — ver onDevTesteAdhocChange (o form já trava os campos
    // pra refletir isso, isto aqui é o cinto de segurança no submit).
    const fase = adhocMarcado ? 'BUSINESS CASE' : document.getElementById('devTesteFase').value;
    const subStatus = adhocMarcado ? 'ORÇAMENTO REALIZADO' : document.getElementById('devTesteSubStatus').value;
    const carryoverMarcado = adhocMarcado ? false : document.getElementById('devTesteCarryover').checked;

    const valBc = Number(document.getElementById('devTesteValBc').value);
    const horasBc = Number(document.getElementById('devTesteHorasBc').value);
    const realizado = Number(document.getElementById('devTesteRealizado').value) || 0;

    if (!nome || !dtSolicitacao || !area || !pessoaResp || !anoFiscal || !tipoProjetoId) {
        return alert('Preencha Nome, Data da Solicitação, Área, Pessoa Solicitante, Ano Fiscal e Tipo de Projeto!');
    }
    if (!produtoId) {
        return alert('Selecione o Produto! (obrigatório desde o Agrupamento de Orçamento)');
    }
    // NOVO (2026-09-16): mesmos campos obrigatórios da tela de Formalizar
    // Demanda (ver saveBusinessCase, js/projects/core.js).
    if (!objetivo) return alert('Preencha o Objetivo!');
    if (!keyResults) return alert('Preencha os Key Results!');
    if (!descricaoProjeto) return alert('Preencha a Descrição Sucinta do Projeto!');
    if (!valBc || valBc <= 0 || !horasBc || horasBc <= 0) {
        return alert('Informe o Orçamento e as Horas de Business Case (sempre obrigatórios — é o checkpoint base de qualquer fase)!');
    }

    // Pilar/Iniciativa Estratégica — obrigatórios só se "Sim" foi marcado
    // (mesma regra de onChangeAssociaPilar/saveBusinessCase).
    const radioAssociaPilar = document.querySelector('input[name="devTesteAssociaPilar"]:checked');
    const associaPilar = radioAssociaPilar && radioAssociaPilar.value === 'sim';
    let pilarId = null, iniciativaId = null;
    if (associaPilar) {
        pilarId = document.getElementById('devTestePilarEstrategico').value;
        const iniciativaSelectSubmit = document.getElementById('devTesteIniciativaEstrategica');
        iniciativaId = iniciativaSelectSubmit.value;
        if (!pilarId) {
            return alert('Selecione o Pilar Estratégico (ou marque "Não" se este projeto não estiver associado a nenhum)!');
        }
        const temIniciativaDisponivel = Array.from(iniciativaSelectSubmit.options).some(o => o.value !== '');
        if (temIniciativaDisponivel && !iniciativaId) {
            return alert('Selecione a Iniciativa Estratégica (ou marque "Não" se este projeto não estiver associado a nenhum Pilar/Iniciativa)!');
        }
    }

    // Benefit Result — opcional; se um tipo foi escolhido, valida os
    // campos dependentes dele (mesma regra de adicionarBeneficioDemanda).
    const benefitTipoId = document.getElementById('devTesteBenefitTipo').value;
    let benefitPayload = null;
    if (benefitTipoId) {
        const tipoBenefit = devTesteBenefitTiposCache.find(rb => String(rb.id) === benefitTipoId);
        let metricaBenefit = null, valorBenefit = null;
        if (tipoBenefit && tipoBenefit.permite_valor) {
            const radioMetricaBenefit = document.querySelector('input[name="devTesteBenefitMetrica"]:checked');
            if (!radioMetricaBenefit) return alert('Selecione se o valor do Benefit Result é NPV ou ROI!');
            metricaBenefit = radioMetricaBenefit.value;
            valorBenefit = parseFloat(document.getElementById('devTesteBenefitValor').value);
            if (isNaN(valorBenefit) || valorBenefit < 0) return alert('Informe um valor válido para o Benefit Result!');
            if (valorBenefit > 999999999.99) return alert('O valor do Benefit Result não pode ultrapassar R$ 999.999.999,99!');
        }
        benefitPayload = { tipo_return_benefit_id: Number(benefitTipoId), metrica: metricaBenefit, valor: valorBenefit };
    }

    let valReq = null, horasReq = null;
    if (DEV_TESTE_FASES_COM_REQUERIMENTOS.includes(fase)) {
        valReq = Number(document.getElementById('devTesteValReq').value);
        horasReq = Number(document.getElementById('devTesteHorasReq').value);
        if (!valReq || valReq <= 0 || !horasReq || horasReq <= 0) {
            return alert('Informe o Orçamento e as Horas de Requerimentos — obrigatórios pra essa fase de destino!');
        }
    }

    let valTech = null, horasTech = null;
    if (DEV_TESTE_FASES_COM_TECHNICAL.includes(fase)) {
        valTech = Number(document.getElementById('devTesteValTech').value);
        horasTech = Number(document.getElementById('devTesteHorasTech').value);
        if (!valTech || valTech <= 0 || !horasTech || horasTech <= 0) {
            return alert('Informe o Orçamento e as Horas de Especificação — obrigatórios pra essa fase de destino!');
        }
    }

    if (!confirm(`Confirma criar o projeto de teste "${nome}" já na fase ${fase}?`)) return;

    const { data: proximoNumero, error: errorNumero } = await _supabase.rpc('proximo_numero_projeto', { p_ano_fiscal: anoFiscal });
    if (errorNumero) {
        return alert('Erro ao gerar o código do projeto: ' + errorNumero.message);
    }
    const aa = anoFiscal.replace('AF20', 'FY').replace('AF', 'FY');
    const codigo = `PRJ-${aa}-${String(proximoNumero).padStart(3, '0')}-${areaMnem || 'DEV'}`;

    const horasMaisRecentes = horasTech || horasReq || horasBc;
    const porte = (typeof obterPortePorHoras === 'function') ? obterPortePorHoras(horasMaisRecentes) : null;

    // AJUSTADO (2026-09-16): data_solicitacao/dt_comite/dt_aprovacao usam a
    // Data da Solicitação informada (não mais "hoje") — pra uma carga de
    // projeto real em andamento, essas datas precisam refletir quando a
    // demanda de fato aconteceu, não a data em que o registro foi digitado
    // no sistema. `agora` continua sendo usado só pra timestamps de AÇÃO
    // tomada nesse instante (marcar carryover, atualizar evolução).
    const agora = new Date().toISOString();

    const payload = {
        codigo, nome, area, pessoa_solicitante: pessoaResp, data_solicitacao: dtSolicitacao, ano_fiscal: anoFiscal,
        tipo_projeto_id: Number(tipoProjetoId),
        produto_id: Number(produtoId),
        tipo_qualificacao: tipoQualificacao,
        tipo_orcamento: tipoOrcamento,
        descricao_projeto: descricaoProjeto,
        objetivo: objetivo,
        key_results: keyResults,
        pilar_estrategico_id: pilarId ? Number(pilarId) : null,
        iniciativa_estrategica_id: iniciativaId ? Number(iniciativaId) : null,
        is_adhoc: adhocMarcado,
        etapa_atual: fase,
        sub_status: subStatus,
        val_bc: valBc, horas_bc: horasBc,
        val_req: valReq, horas_req: horasReq,
        val_tech: valTech, horas_tech: horasTech,
        previsto: valBc,
        realizado: realizado,
        tamanho: porte ? porte.codigo : 'M',
        // Extraordinário fica genuinamente PENDENTE de aprovação (é o
        // ponto todo de forçá-lo em Business Case) — não pré-aprovado
        // como os demais projetos deste form, que já nascem além do BC.
        orcamento_aprovado: adhocMarcado ? 'NÃO' : 'SIM',
        status_orcamento: 'A APROVAR',
        status_comite: adhocMarcado ? null : 'APROVADO',
        dt_comite: adhocMarcado ? null : dtSolicitacao,
        dt_aprovacao: adhocMarcado ? null : dtSolicitacao,
        aprovador_nome: adhocMarcado ? null : (currentUser ? currentUser.nome : 'desconhecido'),
        is_subprojeto: false,
        projeto_concluido: false
    };

    if (carryoverMarcado) {
        const orcamentoDefinido = valTech || valReq || valBc;
        payload.is_carryover = true;
        payload.valor_carryover = Math.max(0, orcamentoDefinido - realizado);
        payload.carryover_marcado_por = currentUser ? currentUser.nome : 'desconhecido';
        payload.carryover_marcado_em = agora;
        payload.carryover_etapa_marcacao = fase;
        payload.carryover_sub_status_marcacao = subStatus;
    }

    const { error } = await _supabase.from('projetos').insert([payload]);
    if (error) {
        return alert('Erro ao criar o projeto de teste: ' + error.message);
    }

    // NOVO (2026-09-16): grava a linha de Benefit Result, se informada
    // (mesmo padrão de saveBusinessCase, js/projects/core.js).
    if (benefitPayload) {
        const { error: errorBenefit } = await _supabase.from('projeto_benefit_results').insert([{
            projeto_codigo: codigo,
            tipo_return_benefit_id: benefitPayload.tipo_return_benefit_id,
            metrica: benefitPayload.metrica,
            valor: benefitPayload.valor,
            criado_por: currentUser ? currentUser.nome : 'desconhecido'
        }]);
        if (errorBenefit) console.error('Erro ao gravar Benefit Result do projeto de teste:', errorBenefit.message);
    }

    // NOVO (2026-09-16, carga inicial de projetos em andamento): backfill de
    // projeto_etapas concluídas pra toda fase anterior à Fase de Destino —
    // ver _devTesteBackfillEtapasAnteriores abaixo.
    if (!adhocMarcado) {
        await _devTesteBackfillEtapasAnteriores(codigo, fase, dtSolicitacao, pessoaResp);
    }

    alert(`✅ Projeto criado: ${codigo}`);
    document.getElementById('devTesteNome').value = '';
    document.getElementById('devTesteObjetivo').value = '';
    document.getElementById('devTesteKeyResults').value = '';
    document.getElementById('devTesteDescricao').value = '';
    document.getElementById('devTesteBenefitTipo').value = '';
    onDevTesteChangeBenefitTipo();
    document.querySelectorAll('input[name="devTesteAssociaPilar"][value="nao"]').forEach(r => r.checked = true);
    onDevTesteChangeAssociaPilar();
    document.getElementById('devTesteRealizado').value = '0';
    document.getElementById('devTesteAdhoc').checked = false;
    document.getElementById('devTesteCarryover').checked = false;
    onDevTesteAdhocChange();

    await loadProjects();
    await renderListaProjetosDevTools();
}

// NOVO (2026-09-16, carga inicial de projetos em andamento): cria, pra
// toda fase ANTERIOR à Fase de Destino escolhida (na ordem
// DEV_TESTE_ORDEM_FASES), uma linha CONCLUÍDA em projeto_etapas por etapa
// dessa fase — sem isso, Roadmap/Detalhamento do Projeto/Cronograma
// tratavam o projeto como "nada planejado ainda" mesmo ele já "estando"
// numa fase avançada (é o mesmo gap documentado desde a criação desta
// ferramenta, 25/08/2026). A fase de destino em si fica de fora — nasce
// "A Planejar", pronta pra ser planejada de verdade pelo fluxo normal.
//
// Etapas vêm de obterEtapasDaFase (fasesEtapasData, já carregado — nunca
// hardcoded, acompanha o que estiver configurado em Administração > Fases
// e Etapas). Datas avançam em passos de 2 dias a partir da Data de
// Solicitação, sempre com término > início da própria etapa e término >
// término da etapa anterior — as mesmas 3 regras de
// validarSequenciaPlanejamento (workflow-engine.js), só que geradas aqui
// em vez de digitadas manualmente etapa por etapa.
async function _devTesteBackfillEtapasAnteriores(codigo, faseDestino, dtBaseStr, pessoaRespNome) {
    const idxDestino = DEV_TESTE_ORDEM_FASES.indexOf(faseDestino);
    if (idxDestino <= 0) return; // Requerimentos (idxDestino 0) não tem fase anterior a preencher
    const fasesAnteriores = DEV_TESTE_ORDEM_FASES.slice(0, idxDestino);

    const emailFallback = (typeof pessoasSolicitantesData !== 'undefined' ? pessoasSolicitantesData : [])
        .find(p => p.nome === pessoaRespNome);

    let cursor = new Date(dtBaseStr + 'T00:00:00');
    const linhas = [];
    for (const faseKey of fasesAnteriores) {
        const etapas = (typeof obterEtapasDaFase === 'function') ? obterEtapasDaFase(faseKey) : [];
        for (const etapa of etapas) {
            const inicio = new Date(cursor);
            const termino = new Date(cursor);
            termino.setDate(termino.getDate() + 2);

            const pool = (typeof obterResponsaveisPorAtividade === 'function') ? obterResponsaveisPorAtividade(etapa.etapa) : [];
            const responsavel = pool[0] || { nome: pessoaRespNome, email: emailFallback ? emailFallback.email : 'dev-tools@local' };

            linhas.push({
                projeto_codigo: codigo,
                etapa_id: etapa.id,
                situacao: 'EXECUCAO_CONCLUIDO',
                responsavel_etapa_nome: responsavel.nome,
                responsavel_etapa_email: responsavel.email,
                data_inicio_planejamento: inicio.toISOString().split('T')[0],
                data_termino_planejamento: termino.toISOString().split('T')[0],
                concluido_em: termino.toISOString(),
                decisao_resultado: 'APROVADO',
                evolucao_atualizada_em: termino.toISOString()
            });

            cursor = termino; // próxima etapa começa onde esta terminou — sempre em sequência
        }
    }

    if (linhas.length === 0) return;
    const { error } = await _supabase.from('projeto_etapas').upsert(linhas, { onConflict: 'projeto_codigo,etapa_id' });
    if (error) alert(`⚠️ Projeto ${codigo} criado, mas houve erro ao preencher o histórico de etapas anteriores: ${error.message}`);
}
