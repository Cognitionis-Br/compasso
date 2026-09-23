// =========================================================================
// workspace-projeto/calendario-projeto.js
// Compasso 2.0 — Release 2, aba Calendário do Workspace. Primeiro grid de
// mês do Compasso (JS puro, sem lib nova) — mostra prazos de tarefas
// (`tasks.prazo`) e término planejado das etapas do projeto
// (`projeto_etapas.data_termino_planejamento`) no mês corrente.
// =========================================================================

let _calProjetoCodigo = null;
let _calWrapperElId = null;
let _calMesAtual = null; // Date, dia 1 do mês exibido

const _CAL_DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

async function renderCalendarioProjeto(projetoCodigo, wrapperElId) {
    _calProjetoCodigo = projetoCodigo;
    _calWrapperElId = wrapperElId;
    const hoje = new Date();
    _calMesAtual = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    await _calRenderMes();
}

async function calendarioProjetoMudarMes(delta) {
    _calMesAtual = new Date(_calMesAtual.getFullYear(), _calMesAtual.getMonth() + delta, 1);
    await _calRenderMes();
}

async function _calRenderMes() {
    const wrapper = document.getElementById(_calWrapperElId);
    if (!wrapper) return;
    wrapper.innerHTML = renderLoadingState('Carregando calendário...');

    const inicioMes = _calMesAtual;
    const fimMes = new Date(inicioMes.getFullYear(), inicioMes.getMonth() + 1, 0);
    const isoInicio = inicioMes.toISOString().split('T')[0];
    const isoFim = fimMes.toISOString().split('T')[0];

    const [{ data: tarefas }, { data: etapas }] = await Promise.all([
        _supabase.from('tasks').select('id, titulo, prazo, status').eq('projeto_codigo', _calProjetoCodigo).gte('prazo', isoInicio).lte('prazo', isoFim),
        _supabase.from('projeto_etapas').select('etapa, data_termino_planejamento').eq('projeto_codigo', _calProjetoCodigo).gte('data_termino_planejamento', isoInicio).lte('data_termino_planejamento', isoFim)
    ]);

    const itensPorDia = {}; // 'YYYY-MM-DD' -> [{tipo, texto, taskId?}]
    (tarefas || []).forEach(t => {
        (itensPorDia[t.prazo] = itensPorDia[t.prazo] || []).push({ tipo: 'tarefa', texto: t.titulo, taskId: t.id, concluida: t.status === 'CONCLUIDO' });
    });
    (etapas || []).forEach(e => {
        (itensPorDia[e.data_termino_planejamento] = itensPorDia[e.data_termino_planejamento] || []).push({ tipo: 'etapa', texto: e.etapa });
    });

    const primeiroDiaSemana = inicioMes.getDay(); // 0=Dom
    const totalDiasMes = fimMes.getDate();
    const celulas = [];
    for (let i = 0; i < primeiroDiaSemana; i++) celulas.push(null);
    for (let dia = 1; dia <= totalDiasMes; dia++) celulas.push(dia);
    while (celulas.length % 7 !== 0) celulas.push(null);

    const hojeIso = new Date().toISOString().split('T')[0];
    const nomeMes = inicioMes.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

    wrapper.innerHTML = `
        <div class="flex items-center justify-between mb-3">
            <button onclick="calendarioProjetoMudarMes(-1)" class="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded"><i class="fa-solid fa-chevron-left"></i></button>
            <span class="text-sm font-bold text-gray-800 capitalize">${nomeMes}</span>
            <button onclick="calendarioProjetoMudarMes(1)" class="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded"><i class="fa-solid fa-chevron-right"></i></button>
        </div>
        <div class="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-gray-400 uppercase mb-1">
            ${_CAL_DIAS_SEMANA.map(d => `<div>${d}</div>`).join('')}
        </div>
        <div class="grid grid-cols-7 gap-1">
            ${celulas.map(dia => {
                if (!dia) return '<div class="bg-gray-50 rounded min-h-[80px]"></div>';
                const iso = `${inicioMes.getFullYear()}-${String(inicioMes.getMonth() + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
                const itens = itensPorDia[iso] || [];
                const ehHoje = iso === hojeIso;
                return `
                <div class="border border-gray-100 rounded min-h-[80px] p-1 ${ehHoje ? 'bg-indigo-50 border-indigo-200' : 'bg-white'}">
                    <div class="text-[10px] font-bold ${ehHoje ? 'text-indigo-700' : 'text-gray-400'}">${dia}</div>
                    <div class="space-y-0.5 mt-0.5">
                        ${itens.slice(0, 3).map(it => it.tipo === 'tarefa'
                            ? `<div onclick="abrirDrawerTarefa(${it.taskId})" class="text-[9px] px-1 py-0.5 rounded cursor-pointer truncate ${it.concluida ? 'bg-emerald-50 text-emerald-700 line-through' : 'bg-indigo-100 text-indigo-800'}" title="${escapeHtml(it.texto)}"><i class="fa-solid fa-list-check"></i> ${escapeHtml(it.texto)}</div>`
                            : `<div class="text-[9px] px-1 py-0.5 rounded truncate bg-amber-100 text-amber-800" title="${escapeHtml(it.texto)}"><i class="fa-solid fa-flag-checkered"></i> ${escapeHtml(it.texto)}</div>`
                        ).join('')}
                        ${itens.length > 3 ? `<div class="text-[9px] text-gray-400">+${itens.length - 3}</div>` : ''}
                    </div>
                </div>`;
            }).join('')}
        </div>
    `;
}
