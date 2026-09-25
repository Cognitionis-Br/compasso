// =========================================================================
// calendario/calendario-global.js
// Compasso 2.0 — V2 do Plano de Evolução, fecha SCR-05 (Calendário Global).
//
// Unifica, numa lista cronológica só, os objetos que o Documento 03 pede
// pra essa tela: TASK, APPROVAL, MILESTONE e GATE — cada um projetado
// aqui, nunca duplicado (clicar sempre leva pro objeto de origem, mesmo
// princípio do WORK_ITEM do V1). WORKFLOW_ACTION do catálogo oficial não
// entra: não existe esse objeto no Compasso hoje (mesma decisão pendente,
// G5, já registrada no filtro "Atividades" de Meu Trabalho).
//
// APPROVAL não tem uma data própria no modelo atual (v_approvals não
// carrega nenhuma coluna de data) — em vez de inventar uma, aprovações
// pendentes aparecem numa seção "Sem data definida" à parte, no topo,
// honesto sobre essa lacuna real (mesma raiz do gap WF-03/FY-01 já
// documentado). Sem grid mensal nesta 1ª versão: lista cronológica simples
// (mesmo padrão de "Próximos Compromissos" da Home), por não haver
// referência visual específica pra esta tela ainda.
// =========================================================================

async function renderCalendarioGlobalView() {
    const wrapper = document.getElementById('calendarioGlobalLista');
    if (!wrapper || !currentUser) return;
    wrapper.innerHTML = renderLoadingState();

    const hoje = new Date().toISOString().split('T')[0];
    const limite = new Date();
    limite.setDate(limite.getDate() + 30);
    const limiteStr = limite.toISOString().split('T')[0];

    const [tarefasResp, etapasResp, gatesResp, aprovacoes] = await Promise.all([
        _supabase.from('tasks').select('id, titulo, prazo, projeto_codigo')
            .or(`assigned_user_id.eq.${currentUser.id},criado_por.eq.${currentUser.id}`)
            .neq('status', 'CONCLUIDO').not('prazo', 'is', null).gte('prazo', hoje).lte('prazo', limiteStr),
        (currentUser.email)
            ? _supabase.from('projeto_etapas').select('projeto_codigo, etapa, data_termino_planejamento')
                .ilike('responsavel_etapa_email', currentUser.email)
                .gte('data_termino_planejamento', hoje).lte('data_termino_planejamento', limiteStr)
            : Promise.resolve({ data: [] }),
        _supabase.from('gates').select('id, projeto_codigo, tipo, severidade, criado_em').eq('resultado', 'BLOCKED'),
        (typeof obterMinhasAprovacoes === 'function') ? obterMinhasAprovacoes() : Promise.resolve([])
    ]);

    const itens = [
        ...(tarefasResp.data || []).map(t => ({ data: t.prazo, icone: 'fa-list-check', cor: 'text-blue-600', texto: t.titulo, sub: t.projeto_codigo || 'Pessoal', tab: 'meu_trabalho' })),
        ...(etapasResp.data || []).map(e => ({ data: e.data_termino_planejamento, icone: 'fa-flag-checkered', cor: 'text-purple-600', texto: e.etapa, sub: e.projeto_codigo, tab: 'meus_projetos' })),
        ...(gatesResp.data || []).map(g => ({ data: (g.criado_em || '').split('T')[0], icone: 'fa-triangle-exclamation', cor: 'text-danger-600', texto: `Gate bloqueado — ${g.tipo}`, sub: g.projeto_codigo, tab: 'meus_projetos' }))
    ].filter(i => i.data).sort((a, b) => new Date(a.data) - new Date(b.data));

    const linhasAprovacoes = aprovacoes.map(({ p, origem, tab }) => `
        <div class="flex items-center gap-3 text-xs border-b border-gray-50 pb-1.5 cursor-pointer hover:bg-gray-50" onclick="switchTab('${tab}')">
            <i class="fa-solid fa-stamp text-indigo-500 w-6 text-center"></i>
            <div class="min-w-0 flex-1">
                <div class="font-bold text-gray-700 truncate">${escapeHtml(p.codigo)} — ${escapeHtml(p.nome || '')}</div>
                <div class="text-[10px] text-gray-400">${escapeHtml(origem)}</div>
            </div>
        </div>`).join('');

    const linhasData = itens.map(i => `
        <div class="flex items-center gap-3 text-xs border-b border-gray-50 pb-1.5 cursor-pointer hover:bg-gray-50" onclick="switchTab('${i.tab}')">
            <div class="w-10 text-center flex-shrink-0">
                <div class="text-[9px] font-bold uppercase text-gray-400">${new Date(i.data + 'T00:00:00').toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')}</div>
                <div class="text-sm font-black text-gray-700">${new Date(i.data + 'T00:00:00').getDate()}</div>
            </div>
            <i class="fa-solid ${i.icone} ${i.cor} w-6 text-center"></i>
            <div class="min-w-0 flex-1">
                <div class="font-bold text-gray-700 truncate">${escapeHtml(i.texto)}</div>
                <div class="text-[10px] text-gray-400">${escapeHtml(i.sub || '')}</div>
            </div>
        </div>`).join('');

    if (!linhasAprovacoes && !linhasData) {
        wrapper.innerHTML = '<p class="text-xs text-gray-400 italic py-8 text-center">Nada nos próximos 30 dias.</p>';
        return;
    }

    wrapper.innerHTML = `
        ${aprovacoes.length > 0 ? `
            <div class="mb-3">
                <h3 class="text-[10px] font-black uppercase text-gray-400 mb-2">Sem data definida — aprovações pendentes</h3>
                <div class="space-y-2">${linhasAprovacoes}</div>
            </div>` : ''}
        ${itens.length > 0 ? `
            <div>
                <h3 class="text-[10px] font-black uppercase text-gray-400 mb-2">Próximos 30 dias</h3>
                <div class="space-y-2">${linhasData}</div>
            </div>` : ''}
    `;
}
