// =========================================================================
// core/empresa-licenciada.js
// FASE 3 do licenciamento (03/09/2026): cadastro da empresa licenciada,
// vigência da licença e renovação por código assinado (HMAC, validado na
// Netlify Function /.netlify/functions/validar-renovacao).
//
// Gate no boot (js/auth/auth.js → entrarNoSistema):
//   - config incompleta         -> tela de SETUP bloqueante (só Proprietário preenche)
//   - hoje > vigência de término -> tela "Licença Expirada" (só Proprietário renova)
//   - dentro da vigência         -> app normal; N dias antes do fim mostra um banner
//
// Fonte: tabela empresa_licenciada (linha única id=1) — RLS off, gravada
// com a chave publishable, mesmo padrão das demais configs.
// =========================================================================

let empresaLicenciadaCache = null;
let bannerVencimentoDispensadoNestaSessao = false;

const COR_EXIBICAO_PADRAO = '#3730A3'; // indigo-800 (a marca do app)

async function carregarEmpresaLicenciada() {
    const { data, error } = await _supabase.from('empresa_licenciada').select('*').eq('id', 1).maybeSingle();
    empresaLicenciadaCache = (error || !data) ? null : data;
    return empresaLicenciadaCache;
}

// ---- validações ------------------------------------------------------------
function validarCNPJ(valor) {
    const c = String(valor || '').replace(/\D/g, '');
    if (c.length !== 14 || /^(\d)\1{13}$/.test(c)) return false;
    const calc = (base) => {
        let soma = 0, peso = base.length - 7;
        for (let i = 0; i < base.length; i++) {
            soma += Number(base[i]) * peso;
            peso = (peso === 2) ? 9 : peso - 1;
        }
        const r = soma % 11;
        return r < 2 ? 0 : 11 - r;
    };
    const d1 = calc(c.slice(0, 12));
    const d2 = calc(c.slice(0, 12) + d1);
    return d1 === Number(c[12]) && d2 === Number(c[13]);
}

function formatarCNPJ(valor) {
    const c = String(valor || '').replace(/\D/g, '').slice(0, 14);
    return c.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2}).*/, '$1.$2.$3/$4-$5');
}

// ---- estado da licença ---------------------------------------------------
function empresaConfigCompleta() {
    const e = empresaLicenciadaCache;
    return !!(e && e.cnpj && e.razao_social && e.nome_fantasia &&
              e.vigencia_inicio && e.vigencia_termino && e.nome_cabecalho);
}

function _hojeISO() { return new Date().toISOString().split('T')[0]; }

function licencaExpirada() {
    const e = empresaLicenciadaCache;
    if (!e || !e.vigencia_termino) return false;
    return _hojeISO() > String(e.vigencia_termino).split('T')[0];
}

function licencaDiasRestantes() {
    const e = empresaLicenciadaCache;
    if (!e || !e.vigencia_termino) return null;
    const fim = new Date(String(e.vigencia_termino).split('T')[0] + 'T00:00:00');
    const hoje = new Date(_hojeISO() + 'T00:00:00');
    return Math.round((fim - hoje) / 86400000);
}

// 'OK' | 'SETUP' | 'EXPIRADA'  — registra log quando nega acesso.
async function verificarGateLicenca() {
    // Se a tabela ainda não foi provisionada (SQL da Fase 3 não rodou),
    // carregarEmpresaLicenciada() deixa o cache null -> NÃO bloqueia
    // (o gate só passa a valer depois que a infra existe).
    if (empresaLicenciadaCache === null) return 'OK';

    if (!empresaConfigCompleta()) {
        await _logVerificacaoLicenca('SEM_CADASTRO');
        return 'SETUP';
    }
    if (licencaExpirada()) {
        await _logVerificacaoLicenca('EXPIRADA');
        return 'EXPIRADA';
    }
    return 'OK';
}

async function _logVerificacaoLicenca(resultado) {
    try {
        await _supabase.from('log_licenca_verificacao').insert([{
            usuario: (typeof currentUser !== 'undefined' && currentUser) ? currentUser.nome : null,
            resultado,
            vigencia_termino: empresaLicenciadaCache ? empresaLicenciadaCache.vigencia_termino : null
        }]);
    } catch (_) { /* log não pode travar o gate */ }
}

// ---- identidade visual (todas as telas) ---------------------------------
function corExibicaoEmpresa() {
    const c = empresaLicenciadaCache && empresaLicenciadaCache.cor_exibicao;
    return /^#[0-9a-fA-F]{6}$/.test(c || '') ? c : COR_EXIBICAO_PADRAO;
}
function nomeCabecalhoEmpresaUpper() {
    const n = empresaLicenciadaCache && empresaLicenciadaCache.nome_cabecalho;
    return n ? String(n).toUpperCase() : '';
}

// Preenche os pontos fixos: linha abaixo da marca "COMPASSO" no menu
// lateral, e (nome + logo) no login e na tela home.
function aplicarIdentidadeEmpresa() {
    const nome = nomeCabecalhoEmpresaUpper();
    const cor = corExibicaoEmpresa();
    const logo = empresaLicenciadaCache && empresaLicenciadaCache.logo_data_uri;

    const elSidebar = document.getElementById('empresaMarcaSidebar');
    if (elSidebar) {
        elSidebar.textContent = nome;
        elSidebar.style.color = cor;
        elSidebar.classList.toggle('hidden', !nome);
    }
    [['empresaMarcaLogin', 'empresaLogoLogin'], ['empresaMarcaHome', 'empresaLogoHome']].forEach(([idNome, idLogo]) => {
        const eN = document.getElementById(idNome);
        if (eN) { eN.textContent = nome; eN.style.color = cor; eN.classList.toggle('hidden', !nome); }
        const eL = document.getElementById(idLogo);
        if (eL) {
            if (logo) { eL.src = logo; eL.classList.remove('hidden'); }
            else { eL.classList.add('hidden'); eL.removeAttribute('src'); }
        }
    });
}

// ---- telas bloqueantes -------------------------------------------------
function _ehProprietarioBoot() {
    return (typeof ehProprietario !== 'undefined' && ehProprietario === true);
}

function mostrarTelaSetupLicenca() {
    document.getElementById('appContainer').classList.add('hidden');
    document.getElementById('loginScreen').classList.add('hidden');
    const tela = document.getElementById('setupLicencaScreen');
    if (!tela) return;
    tela.classList.remove('hidden');
    const form = document.getElementById('setupLicencaForm');
    const aviso = document.getElementById('setupLicencaSemPermissao');
    if (_ehProprietarioBoot()) {
        if (form) form.classList.remove('hidden');
        if (aviso) aviso.classList.add('hidden');
        const cont = document.getElementById('empresaFormCampos');
        if (cont) cont.innerHTML = formEmpresaHTML();
        preencherFormEmpresa();
    } else {
        if (form) form.classList.add('hidden');
        if (aviso) aviso.classList.remove('hidden');
    }
}

function mostrarTelaLicencaExpirada() {
    document.getElementById('appContainer').classList.add('hidden');
    document.getElementById('loginScreen').classList.add('hidden');
    const tela = document.getElementById('licencaExpiradaScreen');
    if (!tela) return;
    tela.classList.remove('hidden');
    const e = empresaLicenciadaCache || {};
    const elInfo = document.getElementById('licencaExpiradaInfo');
    if (elInfo) elInfo.textContent = e.vigencia_termino
        ? `Vigência encerrada em ${new Date(String(e.vigencia_termino).split('T')[0] + 'T00:00:00').toLocaleDateString('pt-BR')}.`
        : '';
    const bloco = document.getElementById('licencaExpiradaRenovacao');
    const semPerm = document.getElementById('licencaExpiradaSemPermissao');
    if (_ehProprietarioBoot()) {
        if (bloco) bloco.classList.remove('hidden');
        if (semPerm) semPerm.classList.add('hidden');
    } else {
        if (bloco) bloco.classList.add('hidden');
        if (semPerm) semPerm.classList.remove('hidden');
    }
}

// Banner preventivo (Proprietário/Administrador), N dias antes do fim.
function aplicarBannerVencimentoLicenca() {
    const el = document.getElementById('bannerVencimentoLicenca');
    if (!el) return;
    const dias = licencaDiasRestantes();
    const limite = empresaLicenciadaCache ? (Number(empresaLicenciadaCache.aviso_dias_antes) || 30) : 30;
    const podeVer = _ehProprietarioBoot() || (typeof ehAdministrador !== 'undefined' && ehAdministrador);
    const mostrar = podeVer && !bannerVencimentoDispensadoNestaSessao &&
                    dias !== null && dias >= 0 && dias <= limite;
    el.classList.toggle('hidden', !mostrar);
    if (mostrar) {
        const txt = document.getElementById('bannerVencimentoLicencaTexto');
        if (txt) txt.textContent = dias === 0
            ? 'A licença do Compasso vence HOJE. Solicite a renovação à Cognitionis.'
            : `A licença do Compasso vence em ${dias} dia(s). Solicite a renovação à Cognitionis.`;
    }
}
function dispensarBannerVencimentoLicenca() {
    bannerVencimentoDispensadoNestaSessao = true;
    const el = document.getElementById('bannerVencimentoLicenca');
    if (el) el.classList.add('hidden');
}

// ---- formulário "Dados da Empresa" (compartilhado: setup + aba) -------
// O HTML é gerado por JS e injetado em UM container por vez
// (#empresaFormCampos no setup, ou #dadosEmpresaConteudo na aba) — nunca
// os dois ao mesmo tempo, então os ids não colidem.
function formEmpresaHTML() {
    return `
    <div class="space-y-3 text-left">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label class="block text-[10px] font-bold uppercase text-gray-600 mb-1">CNPJ *</label>
                <input type="text" id="empCnpj" maxlength="18" class="w-full p-2 border border-gray-300 rounded text-sm" placeholder="00.000.000/0000-00"></div>
            <div><label class="block text-[10px] font-bold uppercase text-gray-600 mb-1">Data de Aquisição</label>
                <input type="date" id="empDataAquisicao" class="w-full p-2 border border-gray-300 rounded text-sm"></div>
        </div>
        <div><label class="block text-[10px] font-bold uppercase text-gray-600 mb-1">Razão Social *</label>
            <input type="text" id="empRazaoSocial" class="w-full p-2 border border-gray-300 rounded text-sm"></div>
        <div><label class="block text-[10px] font-bold uppercase text-gray-600 mb-1">Nome Fantasia *</label>
            <input type="text" id="empNomeFantasia" class="w-full p-2 border border-gray-300 rounded text-sm"></div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label class="block text-[10px] font-bold uppercase text-gray-600 mb-1">Início da Vigência *</label>
                <input type="date" id="empVigenciaInicio" class="w-full p-2 border border-gray-300 rounded text-sm"></div>
            <div><label class="block text-[10px] font-bold uppercase text-gray-600 mb-1">Término da Vigência *</label>
                <input type="date" id="empVigenciaTermino" class="w-full p-2 border border-gray-300 rounded text-sm"></div>
        </div>
        <div><label class="block text-[10px] font-bold uppercase text-gray-600 mb-1">Nome para Cabeçalhos * <span class="font-normal normal-case text-gray-400">(exibido em MAIÚSCULAS)</span></label>
            <input type="text" id="empNomeCabecalho" class="w-full p-2 border border-gray-300 rounded text-sm"></div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label class="block text-[10px] font-bold uppercase text-gray-600 mb-1">Cor para Exibição</label>
                <input type="color" id="empCorExibicao" value="${COR_EXIBICAO_PADRAO}" class="w-full h-9 p-0.5 border border-gray-300 rounded"></div>
            <div><label class="block text-[10px] font-bold uppercase text-gray-600 mb-1">Avisar N dias antes do vencimento</label>
                <input type="number" id="empAvisoDiasAntes" min="1" max="180" value="30" class="w-full p-2 border border-gray-300 rounded text-sm"></div>
        </div>
        <div>
            <label class="block text-[10px] font-bold uppercase text-gray-600 mb-1">Logo (PNG ou SVG, até 2 MB, ~300×100 px)</label>
            <input type="file" id="empLogoInput" accept="image/png,image/svg+xml" onchange="onEmpLogoSelecionado(this)" class="text-xs">
            <button type="button" onclick="removerEmpLogo()" class="ml-2 text-[10px] text-red-600 hover:underline">remover logo</button>
            <div class="mt-2"><img id="empLogoPreview" class="hidden max-h-12 object-contain border border-gray-200 rounded bg-gray-50 p-1" alt=""></div>
            <p id="empLogoMsg" class="text-[10px] text-gray-500 mt-1"></p>
        </div>
        <button onclick="salvarEmpresaLicenciada()" class="w-full mt-2 bg-indigo-700 hover:bg-indigo-800 text-white font-bold py-2 rounded text-sm">
            <i class="fa-solid fa-floppy-disk"></i> Salvar Dados da Empresa
        </button>
        <p id="dadosEmpresaStatus" class="text-xs text-gray-500 mt-1"></p>
    </div>`;
}

function preencherFormEmpresa() {
    const e = empresaLicenciadaCache || {};
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v || ''; };
    set('empCnpj', e.cnpj);
    set('empRazaoSocial', e.razao_social);
    set('empNomeFantasia', e.nome_fantasia);
    set('empDataAquisicao', e.data_aquisicao ? String(e.data_aquisicao).split('T')[0] : '');
    set('empVigenciaInicio', e.vigencia_inicio ? String(e.vigencia_inicio).split('T')[0] : '');
    set('empVigenciaTermino', e.vigencia_termino ? String(e.vigencia_termino).split('T')[0] : '');
    set('empNomeCabecalho', e.nome_cabecalho);
    set('empAvisoDiasAntes', e.aviso_dias_antes != null ? e.aviso_dias_antes : 30);
    const cor = document.getElementById('empCorExibicao');
    if (cor) cor.value = /^#[0-9a-fA-F]{6}$/.test(e.cor_exibicao || '') ? e.cor_exibicao : COR_EXIBICAO_PADRAO;
    const prev = document.getElementById('empLogoPreview');
    if (prev) {
        if (e.logo_data_uri) { prev.src = e.logo_data_uri; prev.classList.remove('hidden'); }
        else { prev.classList.add('hidden'); prev.removeAttribute('src'); }
    }
    _empLogoDataUriPendente = null;
}

let _empLogoDataUriPendente = null;

function onEmpLogoSelecionado(input) {
    const f = input.files && input.files[0];
    const msg = document.getElementById('empLogoMsg');
    if (!f) return;
    const okTipo = f.type === 'image/png' || f.type === 'image/svg+xml';
    if (!okTipo) { if (msg) msg.textContent = 'Use um arquivo PNG ou SVG.'; input.value = ''; return; }
    if (f.size > 2 * 1024 * 1024) { if (msg) msg.textContent = 'Máximo 2 MB.'; input.value = ''; return; }
    const reader = new FileReader();
    reader.onload = () => {
        _empLogoDataUriPendente = reader.result;
        const prev = document.getElementById('empLogoPreview');
        if (prev) { prev.src = reader.result; prev.classList.remove('hidden'); }
        if (msg) msg.textContent = 'Logo pronta para salvar (recomendado até 300×100 px).';
    };
    reader.readAsDataURL(f);
}
function removerEmpLogo() {
    _empLogoDataUriPendente = '';
    const prev = document.getElementById('empLogoPreview');
    if (prev) { prev.classList.add('hidden'); prev.removeAttribute('src'); }
    const msg = document.getElementById('empLogoMsg');
    if (msg) msg.textContent = 'Logo será removida ao salvar.';
}

// contraste relativo (WCAG) entre a cor escolhida e o fundo branco do cabeçalho
function _contrasteComBranco(hex) {
    const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex || '');
    if (!m) return 21;
    const lin = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    const L = 0.2126 * lin(parseInt(m[1], 16)) + 0.7152 * lin(parseInt(m[2], 16)) + 0.0722 * lin(parseInt(m[3], 16));
    return 1.05 / (L + 0.05);
}

async function salvarEmpresaLicenciada() {
    if (!_ehProprietarioBoot()) return alert('Apenas o PROPRIETÁRIO pode alterar os dados da empresa licenciada.');

    const v = id => (document.getElementById(id) || {}).value || '';
    const cnpj = v('empCnpj').trim();
    const razao = v('empRazaoSocial').trim();
    const fantasia = v('empNomeFantasia').trim();
    const dtAquisicao = v('empDataAquisicao') || null;
    const vigIni = v('empVigenciaInicio');
    const vigFim = v('empVigenciaTermino');
    const nomeCab = v('empNomeCabecalho').trim();
    const cor = v('empCorExibicao') || COR_EXIBICAO_PADRAO;
    const avisoDias = Number(v('empAvisoDiasAntes')) || 30;

    if (!razao || !fantasia || !nomeCab) return alert('Razão Social, Nome Fantasia e Nome para Cabeçalhos são obrigatórios.');
    if (!validarCNPJ(cnpj)) return alert('CNPJ inválido — verifique os 14 dígitos e os dígitos verificadores.');
    if (!vigIni || !vigFim) return alert('Informe o início e o término da vigência.');
    if (vigIni >= vigFim) return alert('O início da vigência deve ser anterior ao término.');
    if (_contrasteComBranco(cor) < 3 &&
        !confirm('A cor escolhida tem baixo contraste com o fundo claro do cabeçalho — o nome pode ficar difícil de ler. Salvar mesmo assim?')) return;

    const payload = {
        id: 1,
        cnpj: formatarCNPJ(cnpj),
        razao_social: razao,
        nome_fantasia: fantasia,
        data_aquisicao: dtAquisicao,
        vigencia_inicio: vigIni,
        vigencia_termino: vigFim,
        nome_cabecalho: nomeCab,
        cor_exibicao: cor,
        aviso_dias_antes: avisoDias,
        atualizado_por: (typeof currentUser !== 'undefined' && currentUser) ? currentUser.nome : 'desconhecido',
        atualizado_em: new Date().toISOString()
    };
    if (_empLogoDataUriPendente !== null) payload.logo_data_uri = _empLogoDataUriPendente || null;

    const { error } = await _supabase.from('empresa_licenciada').upsert(payload, { onConflict: 'id' });
    if (error) return alert('Erro ao salvar: ' + error.message);

    await carregarEmpresaLicenciada();
    aplicarIdentidadeEmpresa();
    alert('✅ Dados da empresa licenciada salvos. Recarregue a página para o sistema aplicar a checagem de vigência.');
    if (typeof renderDadosEmpresaView === 'function') renderDadosEmpresaView();
}

// aba "Dados da Empresa" (menu Proprietário)
async function renderDadosEmpresaView() {
    const restrito = document.getElementById('dadosEmpresaRestrito');
    const conteudo = document.getElementById('dadosEmpresaConteudo');
    const pode = _ehProprietarioBoot();
    if (restrito) restrito.classList.toggle('hidden', pode);
    if (conteudo) conteudo.classList.toggle('hidden', !pode);
    if (!pode || !conteudo) return;
    await carregarEmpresaLicenciada();
    conteudo.innerHTML = formEmpresaHTML();
    preencherFormEmpresa();
    const dias = licencaDiasRestantes();
    const st = document.getElementById('dadosEmpresaStatus');
    if (st) {
        st.textContent = dias === null ? 'Vigência não configurada.'
            : dias < 0 ? `Licença EXPIRADA há ${-dias} dia(s).`
            : `Licença ativa — ${dias} dia(s) restantes.`;
        st.className = 'text-xs font-bold mt-1 ' + (dias === null || dias < 0 ? 'text-red-700' : dias <= 30 ? 'text-amber-700' : 'text-emerald-700');
    }
}

// ---- renovação (código assinado -> Netlify Function) -----------------
async function enviarCodigoRenovacao() {
    if (!_ehProprietarioBoot()) return alert('Apenas o PROPRIETÁRIO pode aplicar um código de renovação.');
    const campo = document.getElementById('licencaCodigoRenovacao');
    const codigo = (campo && campo.value || '').trim();
    const msg = document.getElementById('licencaRenovacaoMsg');
    if (!codigo) { if (msg) msg.textContent = 'Cole o código de renovação.'; return; }
    if (msg) { msg.textContent = 'Validando…'; msg.className = 'text-xs text-gray-500 mt-2'; }

    let res, body;
    try {
        res = await fetch('/.netlify/functions/validar-renovacao', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ codigo, usuario: (typeof currentUser !== 'undefined' && currentUser) ? currentUser.nome : null })
        });
        body = await res.json().catch(() => ({}));
    } catch (e) {
        if (msg) { msg.textContent = 'Não foi possível contatar o serviço de validação neste ambiente.'; msg.className = 'text-xs text-red-700 mt-2'; }
        return;
    }
    if (res.ok && body && body.ok) {
        if (msg) { msg.textContent = `✅ Licença renovada até ${body.vigencia_nova}. Recarregando…`; msg.className = 'text-xs text-emerald-700 mt-2'; }
        setTimeout(() => window.location.reload(), 1500);
    } else {
        if (msg) { msg.textContent = '⛔ ' + ((body && body.erro) || 'Código inválido.'); msg.className = 'text-xs text-red-700 mt-2'; }
    }
}
