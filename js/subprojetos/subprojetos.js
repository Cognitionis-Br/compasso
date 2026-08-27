// =========================================================================
// subprojetos/subprojetos.js
// Item 2 (mudanças estruturais, sessão de sub-projetos): divide um
// projeto na fase de Execução em subprojetos independentes. Cada
// subprojeto é um projeto de verdade (código próprio, vinculado ao pai
// por projeto_pai_codigo), nascendo direto em EXECUTION — reaproveita
// 100% do Dashboard/Cronograma/Roadmap/farol de saúde já existentes, sem
// tela nova pra nenhum deles.
//
// As 3 etapas (Execução, UAT, Go-Live) são planejadas de uma vez na
// criação. Cada planejamento fica editável (ver botão "Editar
// Planejamento" no motor genérico) até a primeira marcação de evolução
// acima de 0% — a partir daí, trava.
// =========================================================================

// NOVO (melhoria no fluxo de planejamento, a pedido do usuário): ao
// planejar Execução, pergunta primeiro se o projeto terá subprojetos, e
// SEMPRE planeja as 3 etapas do projeto PRINCIPAL de uma vez (antes,
// só planejava Execution isolado — UAT/GoLive só eram planejados depois,
// um de cada vez, quando o projeto chegava lá).
// NOVO (item 11, novos ajustes): helper compartilhado — ao selecionar um
// responsável na lista, preenche automaticamente os campos de nome e
// e-mail (que ficam só leitura), reaproveitado nos 6 seletores dos dois
// modais de planejamento de Execution (projeto principal e subprojeto).
function preencherRespSelecionado(selectEl, idNome, idEmail) {
    const nomeInput = document.getElementById(idNome);
    const emailInput = document.getElementById(idEmail);
    if (!selectEl.value) {
        nomeInput.value = '';
        emailInput.value = '';
        return;
    }
    const nome = selectEl.options[selectEl.selectedIndex].getAttribute('data-nome');
    nomeInput.value = nome || '';
    emailInput.value = selectEl.value;
}

function popularSelectResp(selectId, nomeEtapa, valorAtualEmail) {
    const select = document.getElementById(selectId);
    if (!select) return;
    const permitidos = obterResponsaveisPorAtividade(nomeEtapa);
    select.innerHTML = permitidos.length === 0
        ? '<option value="" disabled selected>-- Nenhum responsável cadastrado para esta função --</option>'
        : ['<option value="">-- Selecione o Responsável --</option>']
            .concat(permitidos.map(r => `<option value="${escapeHtml(r.email)}" data-nome="${escapeHtml(r.nome)}" ${r.email === valorAtualEmail ? 'selected' : ''}>${escapeHtml(r.nome)}</option>`))
            .join('');
}

function abrirModalPlanejamentoExecucaoCompleto(codigo) {
    const proj = projectsData.find(p => p.codigo === codigo);
    if (!proj) return;

    document.getElementById('planExecCompletoNomeDisplay').innerText = `${proj.codigo} - ${proj.nome}`;
    const radioNao = document.querySelector('input[name="planExecTerraSubprojetos"][value="nao"]');
    if (radioNao) radioNao.checked = true;
    ['planExecCompletoExecRespNome', 'planExecCompletoExecRespEmail', 'planExecCompletoExecDtInicio', 'planExecCompletoExecDtTermino',
     'planExecCompletoUatRespNome', 'planExecCompletoUatRespEmail', 'planExecCompletoUatDtInicio', 'planExecCompletoUatDtTermino',
     'planExecCompletoGoliveRespNome', 'planExecCompletoGoliveRespEmail', 'planExecCompletoGoliveDtInicio', 'planExecCompletoGoliveDtTermino'
    ].forEach(id => { document.getElementById(id).value = ''; });

    // AJUSTADO (item 11, novos ajustes): popula os 3 seletores, filtrados
    // pela função certa de cada etapa.
    popularSelectResp('planExecCompletoExecRespSelect', 'EXECUTAR (EXECUTION)', null);
    popularSelectResp('planExecCompletoUatRespSelect', 'EXECUTAR (UAT)', null);
    popularSelectResp('planExecCompletoGoliveRespSelect', 'EXECUTAR (GO-LIVE)', null);

    document.getElementById('modalPlanejamentoExecucaoCompleto').dataset.codigo = codigo;
    document.getElementById('modalPlanejamentoExecucaoCompleto').classList.remove('hidden');
}

function fecharModalPlanejamentoExecucaoCompleto() {
    document.getElementById('modalPlanejamentoExecucaoCompleto').classList.add('hidden');
}

async function confirmarPlanejamentoExecucaoCompleto() {
    const codigo = document.getElementById('modalPlanejamentoExecucaoCompleto').dataset.codigo;

    const campos = {
        exec: { respNome: 'planExecCompletoExecRespNome', respEmail: 'planExecCompletoExecRespEmail', dtInicio: 'planExecCompletoExecDtInicio', dtTermino: 'planExecCompletoExecDtTermino', etapaNome: 'EXECUTAR (EXECUTION)' },
        uat: { respNome: 'planExecCompletoUatRespNome', respEmail: 'planExecCompletoUatRespEmail', dtInicio: 'planExecCompletoUatDtInicio', dtTermino: 'planExecCompletoUatDtTermino', etapaNome: 'EXECUTAR (UAT)' },
        golive: { respNome: 'planExecCompletoGoliveRespNome', respEmail: 'planExecCompletoGoliveRespEmail', dtInicio: 'planExecCompletoGoliveDtInicio', dtTermino: 'planExecCompletoGoliveDtTermino', etapaNome: 'EXECUTAR (GO-LIVE)' }
    };

    const dadosEtapas = [];
    for (const chave of ['exec', 'uat', 'golive']) {
        const c = campos[chave];
        const respNome = document.getElementById(c.respNome).value.trim().toUpperCase();
        const respEmail = document.getElementById(c.respEmail).value.trim();
        const dtInicio = document.getElementById(c.dtInicio).value;
        const dtTermino = document.getElementById(c.dtTermino).value;
        if (!respNome || !respEmail || !dtInicio || !dtTermino) {
            return alert(`Preencha todos os campos de planejamento de ${c.etapaNome}!`);
        }
        const etapa = obterEtapaPorNome(c.etapaNome);
        if (!etapa) return alert(`Etapa ${c.etapaNome} não encontrada na configuração de fases!`);
        dadosEtapas.push({ chave, etapa_id: etapa.id, respNome, respEmail, dtInicio, dtTermino });
    }

    // NOVO (item 2 do relatório de testes): datas de início de UAT e
    // Go-Live precisam ser sempre maiores que a data de início da
    // Execução.
    const dtInicioExec = dadosEtapas.find(d => d.chave === 'exec').dtInicio;
    const dtInicioUat = dadosEtapas.find(d => d.chave === 'uat').dtInicio;
    const dtInicioGolive = dadosEtapas.find(d => d.chave === 'golive').dtInicio;
    if (dtInicioUat <= dtInicioExec) {
        return alert('⛔ A data de início do UAT precisa ser maior que a data de início da Execução!');
    }
    if (dtInicioGolive <= dtInicioExec) {
        return alert('⛔ A data de início do Go-Live precisa ser maior que a data de início da Execução!');
    }

    // NOVO (a pedido do usuário): nenhuma das 6 datas pode ultrapassar o
    // AF do projeto, exceto Carryover.
    const projPrincipal = projectsData.find(p => p.codigo === codigo);
    if (projPrincipal) {
        for (const d of dadosEtapas) {
            if (!validarDataDentroDoAF(d.dtInicio, projPrincipal)) return alert(mensagemDataForaDoAF(`A data de início de ${d.etapaNome}`, projPrincipal));
            if (!validarDataDentroDoAF(d.dtTermino, projPrincipal)) return alert(mensagemDataForaDoAF(`A data de término de ${d.etapaNome}`, projPrincipal));
        }
    }

    for (const d of dadosEtapas) {
        const payloadEtapa = {
            projeto_codigo: codigo,
            etapa_id: d.etapa_id,
            situacao: 'EXECUCAO_A_INICIAR',
            responsavel_etapa_nome: d.respNome,
            responsavel_etapa_email: d.respEmail,
            data_inicio_planejamento: d.dtInicio,
            data_termino_planejamento: d.dtTermino,
            evolucao_atualizada_em: new Date().toISOString()
        };
        const { error } = await _supabase.from('projeto_etapas').upsert(payloadEtapa, { onConflict: 'projeto_codigo,etapa_id' });
        if (error) console.error('Erro ao planejar etapa do projeto:', error.message);
    }

    // NOVO (item 1, novos ajustes): disparo de e-mail — pontos 16/18/20
    // ("Após realizar planejamento" de Execution/UAT/Go-Live). As 3
    // etapas são planejadas juntas nesta tela — dispara uma vez pra
    // cada, cada uma com seu próprio responsável.
    for (const d of dadosEtapas) {
        const etapaObj = obterEtapaPorNome(campos[d.chave].etapaNome);
        if (etapaObj) {
            await dispararEmailFluxo(etapaObj.fase, etapaObj.etapa, 'Após realizar planejamento', projPrincipal, {
                responsavelNome: d.respNome,
                responsavelEmail: d.respEmail
            });
        }
    }

    fecharModalPlanejamentoExecucaoCompleto();
    alert('✅ Planejamento concluído! O projeto já aparece em "Em Andamento".');

    // Atualiza a lista A Planejar/Em Andamento da Execução E a seção de
    // Subprojetos — renderExecutionView já chama as duas.
    if (typeof callbackAtualizarViewGenerica === 'function') await callbackAtualizarViewGenerica();
}

let subprojetosDataCache = [];

let subprojetoPaiSelecionado = null;

async function renderSubprojetosSection() {
    // AJUSTADO (novo pedido do usuário): só entram projetos que JÁ têm a
    // Execução planejada (existe registro em projeto_etapas pra
    // EXECUTAR (EXECUTION)), estão na fase EXECUTION de verdade, não
    // cancelados, e ainda sem conclusão final. Requerimentos/Business
    // Case/Especificação NUNCA aparecem aqui.
    const { data, error } = await _supabase.from('projetos').select('*').eq('is_subprojeto', true);
    subprojetosDataCache = error ? [] : (data || []);

    const etapaExecPlanejamento = obterEtapaPorNome('EXECUTAR (EXECUTION)');
    let codigosComExecucaoPlanejada = new Set();
    if (etapaExecPlanejamento) {
        const { data: execData } = await _supabase.from('projeto_etapas').select('projeto_codigo').eq('etapa_id', etapaExecPlanejamento.id);
        codigosComExecucaoPlanejada = new Set((execData || []).map(r => r.projeto_codigo));
    }

    const elegiveis = projectsData
        .filter(p => {
            if (p.is_subprojeto) return false;
            if (p.projeto_concluido === true) return false;
            if ((p.sub_status || '').toUpperCase() === 'CANCELADO') return false;
            if (p.etapa_atual !== 'EXECUTION') return false;
            if (!codigosComExecucaoPlanejada.has(p.codigo)) return false;
            return true;
        })
        .sort((a, b) => a.codigo.localeCompare(b.codigo) || (a.sub_status || '').localeCompare(b.sub_status || ''));

    const listaContainer = document.getElementById('subprojListaProjetosBody');
    if (listaContainer) {
        if (elegiveis.length === 0) {
            listaContainer.innerHTML = `<div class="p-4 text-center text-gray-400 font-bold text-sm">Nenhum projeto com Execução planejada disponível pra criar subprojeto no momento</div>`;
        } else {
            listaContainer.innerHTML = elegiveis.map(p => {
                const subsDoProjeto = subprojetosDataCache.filter(sp => sp.projeto_pai_codigo === p.codigo);
                return `
                    <button onclick="abrirModalCriarSubprojeto('${escapeJsAttr(p.codigo)}')" class="w-full text-left p-3 rounded-lg border-2 border-gray-200 bg-white hover:border-cyan-400 hover:bg-cyan-50 transition">
                        <div class="flex justify-between items-center">
                            <div>
                                <span class="font-mono font-bold text-cyan-700">${p.codigo}</span>
                                <span class="font-semibold text-gray-800 ml-2">${escapeHtml(p.nome)}</span>
                                <span class="text-[10px] text-gray-500 ml-2">${p.sub_status || '-'}</span>
                            </div>
                            <span class="text-[10px] font-bold text-cyan-700"><i class="fa-solid fa-plus"></i> Criar Subprojeto</span>
                        </div>
                        ${subsDoProjeto.length > 0 ? `<div class="text-[10px] text-gray-500 mt-1">Subprojetos existentes: ${subsDoProjeto.map(sp => sp.codigo).join(', ')}</div>` : ''}
                    </button>
                `;
            }).join('');
        }
    }

    const codigos = subprojetosDataCache.map(s => s.codigo);
    let etapasSubprojetos = [];
    if (codigos.length > 0) {
        const { data: etapasData } = await _supabase.from('projeto_etapas').select('*').in('projeto_codigo', codigos);
        etapasSubprojetos = etapasData || [];
    }

    const tbody = document.getElementById('subprojetosTableBody');
    if (!tbody) return;

    if (subprojetosDataCache.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-gray-400 font-bold">Nenhum subprojeto criado ainda</td></tr>`;
        return;
    }

    const etapaExec = obterEtapaPorNome('EXECUTAR (EXECUTION)');
    const etapaUat = obterEtapaPorNome('EXECUTAR (UAT)');
    const etapaGolive = obterEtapaPorNome('EXECUTAR (GO-LIVE)');

    const badgeSituacao = (pe) => {
        if (!pe) return '<span class="text-gray-400">-</span>';
        if (pe.situacao === 'EXECUCAO_CONCLUIDO') return '<span class="text-emerald-700 font-bold">Concluído</span>';
        if (pe.percentual_evolucao > 0) return `<span class="text-blue-700 font-bold">${pe.percentual_evolucao}%</span>`;
        return '<span class="text-gray-500">A iniciar</span>';
    };

    tbody.innerHTML = subprojetosDataCache
        .sort((a, b) => a.codigo.localeCompare(b.codigo))
        .map(s => {
            const pe = (etapaObj) => etapaObj ? etapasSubprojetos.find(e => e.projeto_codigo === s.codigo && e.etapa_id === etapaObj.id) : null;
            return `
                <tr>
                    <td class="p-3 font-mono font-bold text-cyan-700">${s.codigo}</td>
                    <td class="p-3 font-semibold">${escapeHtml(s.nome)}</td>
                    <td class="p-3 font-mono text-xs">${s.projeto_pai_codigo}</td>
                    <td class="p-3">${badgeSituacao(pe(etapaExec))}</td>
                    <td class="p-3">${badgeSituacao(pe(etapaUat))}</td>
                    <td class="p-3">${badgeSituacao(pe(etapaGolive))}</td>
                </tr>
            `;
        }).join('');
}

// AJUSTADO (novo pedido do usuário): marcar o projeto na lista já abre o
// modal completo direto (nome + os 3 planejamentos) — o quadro
// separado de "selecionar depois preencher nome e clicar em criar"
// deixou de existir.
function abrirModalCriarSubprojeto(codigo) {
    const p = projectsData.find(x => x.codigo === codigo);
    if (!p) return;

    subprojetoPaiSelecionado = codigo;
    document.getElementById('subprojModalNomeDisplay').innerText = `Novo subprojeto de: ${p.codigo} - ${p.nome}`;
    document.getElementById('subprojNome').value = '';
    ['subprojExecRespNome', 'subprojExecRespEmail', 'subprojExecDtInicio', 'subprojExecDtTermino',
     'subprojUatRespNome', 'subprojUatRespEmail', 'subprojUatDtInicio', 'subprojUatDtTermino',
     'subprojGoliveRespNome', 'subprojGoliveRespEmail', 'subprojGoliveDtInicio', 'subprojGoliveDtTermino'
    ].forEach(id => { document.getElementById(id).value = ''; });

    // AJUSTADO (item 11, novos ajustes): popula os 3 seletores, filtrados
    // pela função certa de cada etapa.
    popularSelectResp('subprojExecRespSelect', 'EXECUTAR (EXECUTION)', null);
    popularSelectResp('subprojUatRespSelect', 'EXECUTAR (UAT)', null);
    popularSelectResp('subprojGoliveRespSelect', 'EXECUTAR (GO-LIVE)', null);

    document.getElementById('modalCriarSubprojeto').classList.remove('hidden');
}

function fecharModalCriarSubprojeto() {
    document.getElementById('modalCriarSubprojeto').classList.add('hidden');
}

async function confirmarCriarSubprojeto() {
    const paiCodigo = subprojetoPaiSelecionado;
    const nome = document.getElementById('subprojNome').value.trim();
    const projPai = projectsData.find(p => p.codigo === paiCodigo);
    if (!projPai) return alert('Projeto pai não encontrado!');
    if (!nome) return alert('Informe o nome do subprojeto!');

    const campos = {
        exec: { respNome: 'subprojExecRespNome', respEmail: 'subprojExecRespEmail', dtInicio: 'subprojExecDtInicio', dtTermino: 'subprojExecDtTermino', etapaNome: 'EXECUTAR (EXECUTION)' },
        uat: { respNome: 'subprojUatRespNome', respEmail: 'subprojUatRespEmail', dtInicio: 'subprojUatDtInicio', dtTermino: 'subprojUatDtTermino', etapaNome: 'EXECUTAR (UAT)' },
        golive: { respNome: 'subprojGoliveRespNome', respEmail: 'subprojGoliveRespEmail', dtInicio: 'subprojGoliveDtInicio', dtTermino: 'subprojGoliveDtTermino', etapaNome: 'EXECUTAR (GO-LIVE)' }
    };

    const dadosEtapas = [];
    for (const chave of ['exec', 'uat', 'golive']) {
        const c = campos[chave];
        const respNome = document.getElementById(c.respNome).value.trim().toUpperCase();
        const respEmail = document.getElementById(c.respEmail).value.trim();
        const dtInicio = document.getElementById(c.dtInicio).value;
        const dtTermino = document.getElementById(c.dtTermino).value;
        if (!respNome || !respEmail || !dtInicio || !dtTermino) {
            return alert(`Preencha todos os campos de planejamento de ${c.etapaNome}!`);
        }
        const etapa = obterEtapaPorNome(c.etapaNome);
        if (!etapa) return alert(`Etapa ${c.etapaNome} não encontrada na configuração de fases!`);
        dadosEtapas.push({ chave, etapa_id: etapa.id, respNome, respEmail, dtInicio, dtTermino });
    }

    // Mesma regra do planejamento de Execução do projeto principal:
    // UAT e Go-Live sempre começam depois da Execução.
    const dtInicioExecSub = dadosEtapas.find(d => d.chave === 'exec').dtInicio;
    const dtInicioUatSub = dadosEtapas.find(d => d.chave === 'uat').dtInicio;
    const dtInicioGoliveSub = dadosEtapas.find(d => d.chave === 'golive').dtInicio;
    if (dtInicioUatSub <= dtInicioExecSub) {
        return alert('⛔ A data de início do UAT precisa ser maior que a data de início da Execução!');
    }
    if (dtInicioGoliveSub <= dtInicioExecSub) {
        return alert('⛔ A data de início do Go-Live precisa ser maior que a data de início da Execução!');
    }

    // NOVO (a pedido do usuário): valida contra o AF do PAI, já que o
    // subprojeto herda o mesmo ano fiscal — exceto Carryover.
    for (const d of dadosEtapas) {
        if (!validarDataDentroDoAF(d.dtInicio, projPai)) return alert(mensagemDataForaDoAF(`A data de início de ${d.etapaNome}`, projPai));
        if (!validarDataDentroDoAF(d.dtTermino, projPai)) return alert(mensagemDataForaDoAF(`A data de término de ${d.etapaNome}`, projPai));
    }

    // Gera o código do subprojeto: próximo número sequencial pra esse pai.
    const existentes = projectsData.filter(p => p.projeto_pai_codigo === paiCodigo);
    const proximoNumero = existentes.length + 1;
    const codigoSub = `${paiCodigo}-SUB${String(proximoNumero).padStart(2, '0')}`;

    const payloadProjeto = {
        codigo: codigoSub,
        nome,
        area: projPai.area,
        ano_fiscal: projPai.ano_fiscal,
        etapa_atual: 'EXECUTION',
        sub_status: 'A PLANEJAR',
        is_subprojeto: true,
        projeto_pai_codigo: paiCodigo,
        tipo_qualificacao: projPai.tipo_qualificacao,
        tamanho: projPai.tamanho
    };

    const { error: errorProjeto } = await _supabase.from('projetos').insert([payloadProjeto]);
    if (errorProjeto) return alert('Erro ao criar o subprojeto: ' + errorProjeto.message);

    for (const d of dadosEtapas) {
        const payloadEtapa = {
            projeto_codigo: codigoSub,
            etapa_id: d.etapa_id,
            situacao: 'EXECUCAO_A_INICIAR',
            responsavel_etapa_nome: d.respNome,
            responsavel_etapa_email: d.respEmail,
            data_inicio_planejamento: d.dtInicio,
            data_termino_planejamento: d.dtTermino,
            evolucao_atualizada_em: new Date().toISOString()
        };
        const { error: errorEtapa } = await _supabase.from('projeto_etapas').upsert(payloadEtapa, { onConflict: 'projeto_codigo,etapa_id' });
        if (errorEtapa) console.error('Erro ao planejar etapa do subprojeto:', errorEtapa.message);
    }

    projectsData.push(payloadProjeto);

    alert(`✅ Subprojeto ${codigoSub} criado com as 3 etapas já planejadas!`);
    fecharModalCriarSubprojeto();
    document.getElementById('subprojNome').value = '';
    await renderSubprojetosSection();
}
