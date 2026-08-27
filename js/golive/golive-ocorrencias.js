// =========================================================================
// golive/golive-ocorrencias.js
// NOVO (a pedido do usuário 25/08/2026): controle de Ocorrências de Erro
// na etapa EXECUTAR (GO-LIVE). Ciclo de vida de cada ocorrência:
// ABERTA (registrada) -> EM_SOLUCAO (solução descrita, aguardando
// confirmação) -> RESOLVIDA (confirmada). A mesma pessoa pode registrar a
// solução e confirmar — sem exigência de segregação de função.
//
// Usada tanto na tela de Go-Live (projeto ainda em EXECUTAR (GO-LIVE))
// quanto na tela de Conclusão de Projeto (projeto já com o Go-Live 100%
// concluído, aguardando baixa final) — mesmo modal, mesmas funções.
// =========================================================================

// Botões "Ocorrências"/"Termo de Aceite" — reaproveitado tanto na tela de
// Go-Live (js/phases/generic-workflow-ui.js) quanto na tela de Conclusão
// de Projeto (js/conclusao/conclusao-projeto.js), mesmo par de botões nos
// dois lugares.
function renderBotoesGoliveOcorrenciasTermo(codigo) {
    return `
        <button onclick="abrirModalGoliveOcorrencias('${codigo}')" class="ml-1 bg-red-100 hover:bg-red-200 text-red-800 font-bold text-[10px] px-2 py-1.5 rounded"><i class="fa-solid fa-triangle-exclamation"></i> Ocorrências</button>
        <button onclick="abrirModalGoliveTermoAceite('${codigo}')" class="ml-1 bg-blue-100 hover:bg-blue-200 text-blue-800 font-bold text-[10px] px-2 py-1.5 rounded"><i class="fa-solid fa-file-signature"></i> Termo de Aceite</button>
    `;
}

// NOVO (a pedido do usuário 25/08/2026): reaproveitada tanto pelo Termo
// de Aceite (js/golive/golive-termo-aceite.js — bloqueia aceitar com
// ocorrência aberta) quanto pela Conclusão de Projeto
// (js/conclusao/conclusao-projeto.js).
async function obterOcorrenciasAbertas(codigo) {
    const { data } = await _supabase.from('golive_ocorrencias').select('*').eq('projeto_codigo', codigo).neq('status', 'RESOLVIDA');
    return data || [];
}

// NOVO (a pedido do usuário 25/08/2026): projetos em andamento no Go-Live
// (etapa_atual='GOLIVE', fora Cancelado/Reprovado/Hold) já com a linha de
// projeto_etapas correspondente — base reaproveitada por
// renderListaGoliveOcorrencias e renderListaGoliveTermoAceite (ambas em
// js/golive/) pra montar suas listas.
async function obterProjetosEmAndamentoGolive() {
    const etapa = obterEtapaPorNome('EXECUTAR (GO-LIVE)');
    if (!etapa) return [];

    const projetosGolive = projectsData.filter(p => {
        const et = (p.etapa_atual || '').toUpperCase();
        const sub = (p.sub_status || '').toUpperCase();
        return et === 'GOLIVE' && sub !== 'CANCELADO' && sub !== 'REPROVADO' && sub !== 'HOLD';
    }).sort((a, b) => a.codigo.localeCompare(b.codigo));

    const { data: etapasData } = await _supabase.from('projeto_etapas').select('*').eq('etapa_id', etapa.id);
    const projetoEtapasGolive = etapasData || [];

    return projetosGolive.map(p => ({ projeto: p, etapa: projetoEtapasGolive.find(pe => pe.projeto_codigo === p.codigo) || null }));
}

// NOVO (a pedido do usuário 25/08/2026): tela própria "Gestão de
// Ocorrências" — antes era um botão embutido na lista de "Em Andamento"
// do Go-Live. Mesmo modal de sempre (abrirModalGoliveOcorrencias), só
// muda o ponto de entrada.
async function renderListaGoliveOcorrencias(tbodyId) {
    const tbody = document.getElementById(tbodyId);
    if (!tbody) return;

    const lista = await obterProjetosEmAndamentoGolive();
    tbody.innerHTML = lista.length === 0
        ? `<tr><td colspan="5" class="p-4 text-center text-gray-400 font-bold">Nenhum projeto em andamento no Go-Live</td></tr>`
        : lista.map(({ projeto: p, etapa: pe }) => `
            <tr>
                <td class="p-3 font-mono font-bold text-cyan-700">${p.codigo}</td>
                <td class="p-3 font-semibold">${escapeHtml(p.nome)}</td>
                <td class="p-3 text-xs uppercase">${pe ? (escapeHtml(pe.responsavel_etapa_nome) || '-') : '-'}</td>
                <td class="p-3 text-xs">${pe ? `${pe.data_inicio_planejamento || '-'} a ${pe.data_termino_planejamento || '-'}` : '-'}</td>
                <td class="p-3 text-center">
                    <button onclick="abrirModalGoliveOcorrencias('${escapeJsAttr(p.codigo)}')" class="bg-red-600 hover:bg-red-700 text-white font-bold text-xs px-3 py-1.5 rounded shadow"><i class="fa-solid fa-triangle-exclamation"></i> Ver Ocorrências</button>
                </td>
            </tr>
        `).join('');
}

let goliveOcorrenciaCodigoAtual = null;
let goliveOcorrenciasCache = [];
let goliveOcorrenciaSolucaoAbertaId = null; // id da ocorrência com o form de "Registrar Solução" aberto

async function abrirModalGoliveOcorrencias(codigo) {
    const p = projectsData.find(x => x.codigo === codigo);
    if (!p) return;

    goliveOcorrenciaCodigoAtual = codigo;
    goliveOcorrenciaSolucaoAbertaId = null;
    document.getElementById('goliveOcorrenciasNomeDisplay').innerText = `${p.codigo} - ${p.nome}`;
    fecharFormNovaOcorrencia();

    await recarregarGoliveOcorrencias();
    document.getElementById('modalGoliveOcorrencias').classList.remove('hidden');
}

async function recarregarGoliveOcorrencias() {
    const { data, error } = await _supabase.from('golive_ocorrencias').select('*').eq('projeto_codigo', goliveOcorrenciaCodigoAtual).order('registrado_em', { ascending: false });
    goliveOcorrenciasCache = error ? [] : (data || []);
    renderGoliveOcorrenciasLista();
}

function fecharModalGoliveOcorrencias() {
    document.getElementById('modalGoliveOcorrencias').classList.add('hidden');
    goliveOcorrenciaCodigoAtual = null;
    goliveOcorrenciasCache = [];
}

function abrirFormNovaOcorrencia() {
    document.getElementById('formNovaOcorrencia').classList.remove('hidden');
    document.getElementById('btnAbrirNovaOcorrencia').classList.add('hidden');
    document.getElementById('ocorrenciaNovaDescricao').value = '';
    document.getElementById('ocorrenciaNovaData').value = new Date().toISOString().split('T')[0];
}

function fecharFormNovaOcorrencia() {
    const form = document.getElementById('formNovaOcorrencia');
    const btn = document.getElementById('btnAbrirNovaOcorrencia');
    if (form) form.classList.add('hidden');
    if (btn) btn.classList.remove('hidden');
}

async function salvarNovaOcorrencia() {
    const descricao = document.getElementById('ocorrenciaNovaDescricao').value.trim();
    const data = document.getElementById('ocorrenciaNovaData').value;
    if (!descricao || !data) {
        return alert('Preencha a descrição e a data da ocorrência!');
    }

    const { error } = await _supabase.from('golive_ocorrencias').insert([{
        projeto_codigo: goliveOcorrenciaCodigoAtual,
        descricao_ocorrencia: descricao,
        data_ocorrencia: data,
        registrado_por: currentUser ? currentUser.nome : 'desconhecido',
        status: 'ABERTA'
    }]);
    if (error) return alert('Erro ao registrar a ocorrência: ' + error.message);

    fecharFormNovaOcorrencia();
    await recarregarGoliveOcorrencias();
}

function abrirFormSolucaoOcorrencia(ocorrenciaId) {
    goliveOcorrenciaSolucaoAbertaId = ocorrenciaId;
    renderGoliveOcorrenciasLista();
}

function fecharFormSolucaoOcorrencia() {
    goliveOcorrenciaSolucaoAbertaId = null;
    renderGoliveOcorrenciasLista();
}

async function salvarSolucaoOcorrencia(ocorrenciaId) {
    const descricaoSolucao = (document.getElementById(`ocorrenciaSolucaoInput-${ocorrenciaId}`).value || '').trim();
    if (!descricaoSolucao) {
        return alert('Descreva a solução aplicada!');
    }

    const { error } = await _supabase.from('golive_ocorrencias').update({
        status: 'EM_SOLUCAO',
        descricao_solucao: descricaoSolucao,
        solucao_registrada_por: currentUser ? currentUser.nome : 'desconhecido',
        solucao_registrada_em: new Date().toISOString()
    }).eq('id', ocorrenciaId);
    if (error) return alert('Erro ao registrar a solução: ' + error.message);

    goliveOcorrenciaSolucaoAbertaId = null;
    await recarregarGoliveOcorrencias();
}

async function confirmarSolucaoOcorrencia(ocorrenciaId) {
    if (!confirm('Confirma que a solução aplicada resolveu esta ocorrência?')) return;

    const { error } = await _supabase.from('golive_ocorrencias').update({
        status: 'RESOLVIDA',
        confirmado_por: currentUser ? currentUser.nome : 'desconhecido',
        confirmado_em: new Date().toISOString()
    }).eq('id', ocorrenciaId);
    if (error) return alert('Erro ao confirmar a ocorrência: ' + error.message);

    await recarregarGoliveOcorrencias();
}

const GOLIVE_OCORRENCIA_STATUS_BADGE = {
    ABERTA: 'bg-red-100 text-red-800',
    EM_SOLUCAO: 'bg-amber-100 text-amber-800',
    RESOLVIDA: 'bg-emerald-100 text-emerald-800'
};
const GOLIVE_OCORRENCIA_STATUS_LABEL = {
    ABERTA: 'Aberta',
    EM_SOLUCAO: 'Em Solução',
    RESOLVIDA: 'Resolvida'
};

function renderGoliveOcorrenciasLista() {
    const container = document.getElementById('goliveOcorrenciasListaBody');
    if (!container) return;

    if (goliveOcorrenciasCache.length === 0) {
        container.innerHTML = `<p class="text-xs text-gray-400 font-bold text-center py-4">Nenhuma ocorrência registrada.</p>`;
        return;
    }

    container.innerHTML = goliveOcorrenciasCache.map(o => {
        const badge = GOLIVE_OCORRENCIA_STATUS_BADGE[o.status] || 'bg-gray-100 text-gray-700';
        const label = GOLIVE_OCORRENCIA_STATUS_LABEL[o.status] || o.status;

        let acoesHtml = '';
        if (o.status === 'ABERTA' && goliveOcorrenciaSolucaoAbertaId !== o.id) {
            acoesHtml = `<button onclick="abrirFormSolucaoOcorrencia(${o.id})" class="bg-amber-600 hover:bg-amber-700 text-white font-bold text-[10px] px-2.5 py-1 rounded shadow"><i class="fa-solid fa-wrench"></i> Registrar Solução</button>`;
        } else if (o.status === 'EM_SOLUCAO') {
            acoesHtml = `<button onclick="confirmarSolucaoOcorrencia(${o.id})" class="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] px-2.5 py-1 rounded shadow"><i class="fa-solid fa-check"></i> Confirmar Resolução</button>`;
        }

        const formSolucaoHtml = (o.status === 'ABERTA' && goliveOcorrenciaSolucaoAbertaId === o.id) ? `
            <div class="mt-2 bg-amber-50 border border-amber-200 rounded p-2 space-y-2">
                <textarea id="ocorrenciaSolucaoInput-${o.id}" rows="2" placeholder="Descreva a solução aplicada..." class="w-full p-2 border border-gray-300 rounded text-xs"></textarea>
                <div class="flex justify-end gap-2">
                    <button onclick="fecharFormSolucaoOcorrencia()" class="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 rounded text-[10px] font-bold text-gray-700">Cancelar</button>
                    <button onclick="salvarSolucaoOcorrencia(${o.id})" class="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded text-[10px] font-bold">Salvar Solução</button>
                </div>
            </div>
        ` : '';

        return `
            <div class="border border-gray-200 rounded-lg p-3">
                <div class="flex justify-between items-start gap-2 mb-1">
                    <span class="${badge} font-bold px-2 py-0.5 rounded text-[10px] uppercase">${label}</span>
                    <span class="text-[10px] text-gray-400">${o.data_ocorrencia || '-'} — registrado por ${escapeHtml(o.registrado_por) || '-'}</span>
                </div>
                <p class="text-xs text-gray-800">${escapeHtml(o.descricao_ocorrencia)}</p>
                ${o.descricao_solucao ? `<div class="mt-2 bg-gray-50 border-l-2 border-amber-400 pl-2 py-1"><p class="text-[10px] text-gray-500 font-bold uppercase">Solução</p><p class="text-xs text-gray-700">${escapeHtml(o.descricao_solucao)}</p><p class="text-[10px] text-gray-400 mt-0.5">${escapeHtml(o.solucao_registrada_por) || '-'}${o.solucao_registrada_em ? ', ' + o.solucao_registrada_em.split('T')[0] : ''}</p></div>` : ''}
                ${o.status === 'RESOLVIDA' ? `<p class="text-[10px] text-emerald-600 font-bold mt-1"><i class="fa-solid fa-check"></i> Confirmada por ${escapeHtml(o.confirmado_por) || '-'}${o.confirmado_em ? ' em ' + o.confirmado_em.split('T')[0] : ''}</p>` : ''}
                ${acoesHtml ? `<div class="mt-2">${acoesHtml}</div>` : ''}
                ${formSolucaoHtml}
            </div>
        `;
    }).join('');
}
