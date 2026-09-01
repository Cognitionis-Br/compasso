// =========================================================================
// dev-tools/criar-teste.js
// NOVO (a pedido do usuário 25/08/2026): tela em Ferramentas de Dev pra
// criar um projeto de teste já nascendo em qualquer fase do funil
// (Requerimentos a Go-Live), com Extraordinário/Carryover opcionais —
// evita ter que inserir dados de teste manualmente direto no banco.
//
// Escopo confirmado com o usuário: só o "estado de superfície" da tabela
// `projetos` (etapa_atual, sub_status, valores, horas) — o mesmo usado por
// Dashboard, Financeiro, Carry Over, Roadmap e Consolidação por Fase. NÃO
// popula `projeto_etapas` — se o projeto for aberto nas telas de
// planejamento por fase (Execution/UAT/Go-Live), elas vão tratá-lo como
// "nada planejado ainda" mesmo ele já "estando" na fase.
// =========================================================================

const DEV_TESTE_FASES_COM_REQUERIMENTOS = ['TECHNICAL', 'EXECUTION', 'UAT', 'GOLIVE'];
const DEV_TESTE_FASES_COM_TECHNICAL = ['EXECUTION', 'UAT', 'GOLIVE'];

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

    onDevTesteFaseChange();
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
    if (!ehAdministrador) {
        return alert('⛔ Esta ferramenta é restrita a usuários com a função ADMINISTRADOR.');
    }

    const nome = (document.getElementById('devTesteNome').value || '').trim();
    const areaSel = document.getElementById('devTesteArea');
    const area = areaSel.value;
    const areaMnem = areaSel.options[areaSel.selectedIndex] ? areaSel.options[areaSel.selectedIndex].getAttribute('data-mnem') : null;
    const pessoaResp = document.getElementById('devTesteResp').value;
    const anoFiscal = document.getElementById('devTesteAF').value;
    const tipoProjetoId = document.getElementById('devTesteTipoProjeto').value;
    const produtoId = document.getElementById('devTesteProduto') ? document.getElementById('devTesteProduto').value : '';
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

    if (!nome || !area || !pessoaResp || !anoFiscal || !tipoProjetoId) {
        return alert('Preencha Nome, Área, Pessoa Solicitante, Ano Fiscal e Tipo de Projeto!');
    }
    if (!produtoId) {
        return alert('Selecione o Produto! (obrigatório desde o Agrupamento de Orçamento)');
    }
    if (!valBc || valBc <= 0 || !horasBc || horasBc <= 0) {
        return alert('Informe o Orçamento e as Horas de Business Case (sempre obrigatórios — é o checkpoint base de qualquer fase)!');
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

    const hoje = new Date().toISOString().split('T')[0];
    const horasMaisRecentes = horasTech || horasReq || horasBc;
    const porte = (typeof obterPortePorHoras === 'function') ? obterPortePorHoras(horasMaisRecentes) : null;

    const payload = {
        codigo, nome, area, pessoa_solicitante: pessoaResp, data_solicitacao: hoje, ano_fiscal: anoFiscal,
        tipo_projeto_id: Number(tipoProjetoId),
        produto_id: Number(produtoId),
        tipo_qualificacao: tipoQualificacao,
        tipo_orcamento: tipoOrcamento,
        descricao_projeto: 'Projeto de teste criado via Ferramentas de Dev.',
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
        dt_comite: adhocMarcado ? null : hoje,
        dt_aprovacao: adhocMarcado ? null : hoje,
        aprovador_nome: adhocMarcado ? null : (currentUser ? currentUser.nome : 'desconhecido'),
        is_subprojeto: false,
        projeto_concluido: false
    };

    if (carryoverMarcado) {
        const orcamentoDefinido = valTech || valReq || valBc;
        payload.is_carryover = true;
        payload.valor_carryover = Math.max(0, orcamentoDefinido - realizado);
        payload.carryover_marcado_por = currentUser ? currentUser.nome : 'desconhecido';
        payload.carryover_marcado_em = new Date().toISOString();
        payload.carryover_etapa_marcacao = fase;
        payload.carryover_sub_status_marcacao = subStatus;
    }

    const { error } = await _supabase.from('projetos').insert([payload]);
    if (error) {
        return alert('Erro ao criar o projeto de teste: ' + error.message);
    }

    alert(`✅ Projeto de teste criado: ${codigo}`);
    document.getElementById('devTesteNome').value = '';
    document.getElementById('devTesteRealizado').value = '0';
    document.getElementById('devTesteAdhoc').checked = false;
    document.getElementById('devTesteCarryover').checked = false;
    onDevTesteAdhocChange();

    await loadProjects();
    await renderListaProjetosDevTools();
}
