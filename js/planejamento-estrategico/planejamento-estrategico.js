// =========================================================================
// planejamento-estrategico/planejamento-estrategico.js
// Cadastro de Pilar Estratégico e Iniciativa Estratégica. Iniciativa
// sempre pertence a um Pilar (hierarquia: seleciona o pilar primeiro).
// Os dois carregam auditoria (quem/quando criou/alterou) e só podem ser
// inativados se ainda não estiverem em uso (verificado contra projetos).
//
// Chave de uso (quando a integração com projetos for construída):
// Ano Fiscal + Pilar + Iniciativa — a iniciativa herda o AF do pilar
// dela, não tem AF independente.
// =========================================================================

let pilaresCache = [];
let iniciativasCache = [];

// NOVO: alterna entre as 2 abas de Planejamento Estratégico.
function mudarAbaPlanejamentoEstrategico(aba) {
    ['pilares', 'iniciativas'].forEach(a => {
        const btn = document.getElementById(`planEstBtn-${a}`);
        const painel = document.getElementById(`planEstPainel-${a}`);
        if (btn) btn.className = `plan-est-btn px-4 py-2 rounded-md text-sm font-bold border-2 ${a === aba ? 'bg-red-700 text-white border-red-700' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`;
        if (painel) painel.classList.toggle('hidden', a !== aba);
    });
    aplicarVisibilidadeSubAbas('planejamento_estrategico', 'planEstBtn');
}

async function renderPlanejamentoEstrategicoView() {
    // Popula o select de Ano Fiscal a partir dos AFs já cadastrados.
    const { data: afsData } = await _supabase.from('anos_fiscais_config').select('ano_fiscal').order('ano_fiscal');
    const selectAF = document.getElementById('pilarAnoFiscalSelect');
    if (selectAF) {
        const atual = selectAF.value;
        selectAF.innerHTML = '<option value="">-- Selecione --</option>' +
            (afsData || []).map(a => `<option value="${a.ano_fiscal}" ${a.ano_fiscal === atual ? 'selected' : ''}>${a.ano_fiscal}</option>`).join('');
    }

    await carregarPilares();
    await carregarIniciativas();
}

async function carregarPilares() {
    const { data, error } = await _supabase.from('pilares_estrategicos').select('*').order('ano_fiscal', { ascending: false }).order('nome');
    pilaresCache = error ? [] : (data || []);

    // Popula o select de Pilar (só ativos, pra criação de iniciativa).
    const selectPilar = document.getElementById('iniciativaPilarSelect');
    if (selectPilar) {
        const atual = selectPilar.value;
        const ativos = pilaresCache.filter(p => p.ativo);
        selectPilar.innerHTML = '<option value="">-- Selecione um Pilar --</option>' +
            ativos.map(p => `<option value="${p.id}" ${String(p.id) === atual ? 'selected' : ''}>${p.ano_fiscal} — ${escapeHtml(p.nome)}</option>`).join('');
    }

    const tbody = document.getElementById('pilaresTableBody');
    if (!tbody) return;

    if (pilaresCache.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-gray-400 font-bold">Nenhum pilar cadastrado ainda</td></tr>`;
        return;
    }

    tbody.innerHTML = pilaresCache.map(p => `
        <tr class="${!p.ativo ? 'opacity-50' : ''}">
            <td class="p-3 font-mono font-bold">${p.ano_fiscal}</td>
            <td class="p-3 font-semibold">${escapeHtml(p.nome)}</td>
            <td class="p-3 text-gray-500">${escapeHtml(p.descricao) || '-'}</td>
            <td class="p-3 text-[10px] text-gray-400">${escapeHtml(p.atualizado_por) || '-'} · ${p.atualizado_em ? new Date(p.atualizado_em).toLocaleString('pt-BR') : '-'}</td>
            <td class="p-3 text-center">${p.ativo ? '<span class="bg-green-100 text-green-800 font-bold px-2 py-0.5 rounded text-[10px] uppercase">Ativo</span>' : '<span class="bg-gray-200 text-gray-500 font-bold px-2 py-0.5 rounded text-[10px] uppercase">Inativo</span>'}</td>
            <td class="p-3 text-center space-x-2">
                <button onclick="editarPilar(${p.id})" class="text-indigo-600 hover:text-indigo-800 font-bold"><i class="fa-solid fa-pen-to-square"></i></button>
                <button onclick="alternarAtivoPilar(${p.id})" class="text-amber-600 hover:text-amber-800 font-bold"><i class="fa-solid fa-power-off"></i></button>
            </td>
        </tr>
    `).join('');
}

async function carregarIniciativas() {
    const { data, error } = await _supabase.from('iniciativas_estrategicas').select('*').order('nome');
    iniciativasCache = error ? [] : (data || []);

    // NOVO (item 7 do relatório de melhorias): ordena por AF (desc, via o
    // pilar), depois nome do pilar, depois nome da iniciativa — feito no
    // cliente porque o AF vive no pilar, não na própria iniciativa.
    iniciativasCache.sort((a, b) => {
        const pilarA = pilaresCache.find(p => p.id === a.pilar_id) || {};
        const pilarB = pilaresCache.find(p => p.id === b.pilar_id) || {};
        const afA = pilarA.ano_fiscal || '', afB = pilarB.ano_fiscal || '';
        if (afA !== afB) return afB.localeCompare(afA); // desc
        const nomePilarA = pilarA.nome || '', nomePilarB = pilarB.nome || '';
        if (nomePilarA !== nomePilarB) return nomePilarA.localeCompare(nomePilarB, 'pt-BR');
        return (a.nome || '').localeCompare(b.nome || '', 'pt-BR');
    });

    const tbody = document.getElementById('iniciativasTableBody');
    if (!tbody) return;

    if (iniciativasCache.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="p-4 text-center text-gray-400 font-bold">Nenhuma iniciativa cadastrada ainda</td></tr>`;
        return;
    }

    tbody.innerHTML = iniciativasCache.map(ini => {
        const pilar = pilaresCache.find(p => p.id === ini.pilar_id);
        return `
            <tr class="${!ini.ativo ? 'opacity-50' : ''}">
                <td class="p-3 font-mono font-bold">${pilar ? pilar.ano_fiscal : '-'}</td>
                <td class="p-3 text-xs">${pilar ? escapeHtml(pilar.nome) : '(pilar não encontrado)'}</td>
                <td class="p-3 font-semibold">${escapeHtml(ini.nome)}</td>
                <td class="p-3 text-gray-500">${escapeHtml(ini.descricao) || '-'}</td>
                <td class="p-3 text-[10px] text-gray-400">${escapeHtml(ini.atualizado_por) || '-'} · ${ini.atualizado_em ? new Date(ini.atualizado_em).toLocaleString('pt-BR') : '-'}</td>
                <td class="p-3 text-center">${ini.ativo ? '<span class="bg-green-100 text-green-800 font-bold px-2 py-0.5 rounded text-[10px] uppercase">Ativo</span>' : '<span class="bg-gray-200 text-gray-500 font-bold px-2 py-0.5 rounded text-[10px] uppercase">Inativo</span>'}</td>
                <td class="p-3 text-center space-x-2">
                    <button onclick="editarIniciativa(${ini.id})" class="text-indigo-600 hover:text-indigo-800 font-bold"><i class="fa-solid fa-pen-to-square"></i></button>
                    <button onclick="alternarAtivoIniciativa(${ini.id})" class="text-amber-600 hover:text-amber-800 font-bold"><i class="fa-solid fa-power-off"></i></button>
                </td>
            </tr>
        `;
    }).join('');
}

// -------------------------------------------------------------------------
// Pilar Estratégico
// -------------------------------------------------------------------------
function limparFormPilar() {
    document.getElementById('pilarIdHidden').value = '';
    document.getElementById('pilarNomeInput').value = '';
    document.getElementById('pilarDescricaoInput').value = '';
}

function editarPilar(id) {
    const p = pilaresCache.find(x => x.id === id);
    if (!p) return;
    document.getElementById('pilarIdHidden').value = p.id;
    document.getElementById('pilarAnoFiscalSelect').value = p.ano_fiscal;
    document.getElementById('pilarNomeInput').value = p.nome;
    document.getElementById('pilarDescricaoInput').value = p.descricao || '';
}

async function salvarPilarEstrategico() {
    const id = document.getElementById('pilarIdHidden').value;
    const ano_fiscal = document.getElementById('pilarAnoFiscalSelect').value;
    const nome = document.getElementById('pilarNomeInput').value.trim();
    const descricao = document.getElementById('pilarDescricaoInput').value.trim();

    if (!ano_fiscal || !nome) {
        return alert('Selecione o Ano Fiscal e informe o nome do Pilar!');
    }
    if (nome.length > 80) {
        return alert('O nome do Pilar precisa ter no máximo 80 caracteres!');
    }

    const duplicado = pilaresCache.some(p => (!id || p.id !== Number(id)) && p.ano_fiscal === ano_fiscal && p.nome.toUpperCase() === nome.toUpperCase());
    if (duplicado) {
        return alert(`⛔ Já existe um Pilar chamado "${nome}" no ${ano_fiscal}. Escolha outro nome.`);
    }

    const agora = new Date().toISOString();
    const quem = currentUser ? currentUser.nome : 'desconhecido';
    const payload = { ano_fiscal, nome, descricao, atualizado_por: quem, atualizado_em: agora };

    let error;
    if (id) {
        ({ error } = await _supabase.from('pilares_estrategicos').update(payload).eq('id', id));
    } else {
        payload.criado_por = quem;
        payload.criado_em = agora;
        ({ error } = await _supabase.from('pilares_estrategicos').insert([payload]));
    }
    if (error) return alert('Erro ao salvar o Pilar: ' + error.message);

    alert('✅ Pilar salvo com sucesso!');
    limparFormPilar();
    await carregarPilares();
    await carregarIniciativas();
}

async function alternarAtivoPilar(id) {
    const p = pilaresCache.find(x => x.id === id);
    if (!p) return;

    if (p.ativo) {
        // Só pode inativar se ainda não estiver em uso — checa se algum
        // projeto já referencia este pilar, e se não há nenhuma
        // iniciativa ATIVA vinculada a ele (inativar o pai com filho
        // ativo deixaria a iniciativa "órfã" de um pilar desligado).
        const { count: emUsoCount, error: errorUso } = await _supabase.from('projetos').select('codigo', { count: 'exact', head: true }).eq('pilar_estrategico_id', id);
        if (errorUso) return alert('Erro ao checar o uso do Pilar: ' + errorUso.message);
        if (emUsoCount > 0) {
            return alert(`⛔ Este Pilar já está em uso por ${emUsoCount} projeto(s) — não pode ser inativado.`);
        }
        const iniciativasAtivas = iniciativasCache.filter(ini => ini.pilar_id === id && ini.ativo);
        if (iniciativasAtivas.length > 0) {
            return alert(`⛔ Este Pilar tem ${iniciativasAtivas.length} iniciativa(s) ativa(s) vinculada(s) — inative as iniciativas primeiro.`);
        }
        if (!confirm(`Confirma a inativação do Pilar "${p.nome}"?`)) return;
    }

    const payload = { ativo: !p.ativo, atualizado_por: currentUser ? currentUser.nome : 'desconhecido', atualizado_em: new Date().toISOString() };
    const { error } = await _supabase.from('pilares_estrategicos').update(payload).eq('id', id);
    if (error) return alert('Erro ao atualizar o Pilar: ' + error.message);
    await carregarPilares();
    await carregarIniciativas();
}

// -------------------------------------------------------------------------
// Iniciativa Estratégica
// -------------------------------------------------------------------------
function limparFormIniciativa() {
    document.getElementById('iniciativaIdHidden').value = '';
    document.getElementById('iniciativaNomeInput').value = '';
    document.getElementById('iniciativaDescricaoInput').value = '';
}

function editarIniciativa(id) {
    const ini = iniciativasCache.find(x => x.id === id);
    if (!ini) return;
    document.getElementById('iniciativaIdHidden').value = ini.id;
    document.getElementById('iniciativaPilarSelect').value = ini.pilar_id;
    document.getElementById('iniciativaNomeInput').value = ini.nome;
    document.getElementById('iniciativaDescricaoInput').value = ini.descricao || '';
}

async function salvarIniciativaEstrategica() {
    const id = document.getElementById('iniciativaIdHidden').value;
    const pilar_id = document.getElementById('iniciativaPilarSelect').value;
    const nome = document.getElementById('iniciativaNomeInput').value.trim();
    const descricao = document.getElementById('iniciativaDescricaoInput').value.trim();

    if (!pilar_id || !nome) {
        return alert('Selecione o Pilar e informe o nome da Iniciativa!');
    }
    if (nome.length > 80) {
        return alert('O nome da Iniciativa precisa ter no máximo 80 caracteres!');
    }

    const duplicado = iniciativasCache.some(ini => (!id || ini.id !== Number(id)) && String(ini.pilar_id) === pilar_id && ini.nome.toUpperCase() === nome.toUpperCase());
    if (duplicado) {
        return alert(`⛔ Já existe uma Iniciativa chamada "${nome}" para este Pilar. Escolha outro nome.`);
    }

    const agora = new Date().toISOString();
    const quem = currentUser ? currentUser.nome : 'desconhecido';
    const payload = { pilar_id: Number(pilar_id), nome, descricao, atualizado_por: quem, atualizado_em: agora };

    let error;
    if (id) {
        ({ error } = await _supabase.from('iniciativas_estrategicas').update(payload).eq('id', id));
    } else {
        payload.criado_por = quem;
        payload.criado_em = agora;
        ({ error } = await _supabase.from('iniciativas_estrategicas').insert([payload]));
    }
    if (error) return alert('Erro ao salvar a Iniciativa: ' + error.message);

    alert('✅ Iniciativa salva com sucesso!');
    limparFormIniciativa();
    await carregarIniciativas();
}

async function alternarAtivoIniciativa(id) {
    const ini = iniciativasCache.find(x => x.id === id);
    if (!ini) return;

    if (ini.ativo) {
        const { count: emUsoCount, error: errorUso } = await _supabase.from('projetos').select('codigo', { count: 'exact', head: true }).eq('iniciativa_estrategica_id', id);
        if (errorUso) return alert('Erro ao checar o uso da Iniciativa: ' + errorUso.message);
        if (emUsoCount > 0) {
            return alert(`⛔ Esta Iniciativa já está em uso por ${emUsoCount} projeto(s) — não pode ser inativada.`);
        }
        if (!confirm(`Confirma a inativação da Iniciativa "${ini.nome}"?`)) return;
    }

    const payload = { ativo: !ini.ativo, atualizado_por: currentUser ? currentUser.nome : 'desconhecido', atualizado_em: new Date().toISOString() };
    const { error } = await _supabase.from('iniciativas_estrategicas').update(payload).eq('id', id);
    if (error) return alert('Erro ao atualizar a Iniciativa: ' + error.message);
    await carregarIniciativas();
}
