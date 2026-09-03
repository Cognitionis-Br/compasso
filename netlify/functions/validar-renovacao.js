// =========================================================================
// netlify/functions/validar-renovacao.js
// FASE 3 do licenciamento — valida um CÓDIGO DE RENOVAÇÃO assinado pela
// Cognitionis e, se válido, estende a vigência da licença no banco.
//
// A assinatura é verificada AQUI (servidor), nunca no navegador. A chave
// secreta vive só como variável de ambiente na Netlify e no utilitário
// gerador da Cognitionis — nunca no repositório nem no front-end.
//
// Variáveis de ambiente exigidas (Netlify → Site settings → Environment):
//   LICENSE_HMAC_SECRET   segredo HMAC-SHA256 (o mesmo do gerador)
//   SUPABASE_URL          https://<ref>.supabase.co
//   SUPABASE_SERVICE_KEY  service_role key (ou a publishable — a tabela
//                         empresa_licenciada está com RLS desligado)
//
// Formato do código:  base64url(payloadJSON) "." base64url(HMAC)
//   payloadJSON = {"cnpj":"00.000.000/0000-00","vigencia_termino":"AAAA-MM-DD","emitido_em":"<ISO>"}
// =========================================================================

const crypto = require('crypto');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;
const HMAC_SECRET = process.env.LICENSE_HMAC_SECRET;

const b64urlDecode = (s) => Buffer.from(String(s).replace(/-/g, '+').replace(/_/g, '/'), 'base64');
const soDigitos = (s) => String(s || '').replace(/\D/g, '');

async function sb(path, init) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
        ...init,
        headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json',
            ...(init && init.headers)
        }
    });
    const txt = await r.text();
    let json; try { json = txt ? JSON.parse(txt) : null; } catch (_) { json = txt; }
    return { ok: r.ok, status: r.status, json };
}

async function logTentativa(row) {
    try { await sb('log_renovacao_licenca', { method: 'POST', body: JSON.stringify([row]) }); } catch (_) {}
}

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return resp(405, { erro: 'Use POST.' });
    }
    if (!HMAC_SECRET || !SUPABASE_URL || !SUPABASE_KEY) {
        return resp(500, { erro: 'Serviço de renovação não configurado (variáveis de ambiente ausentes).' });
    }

    let codigo, usuario;
    try {
        const b = JSON.parse(event.body || '{}');
        codigo = String(b.codigo || '').trim();
        usuario = b.usuario || null;
    } catch (_) {
        return resp(400, { erro: 'Corpo inválido.' });
    }
    if (!codigo || codigo.indexOf('.') < 0) {
        await logTentativa({ usuario, resultado: 'CODIGO_INVALIDO', detalhe: 'formato' });
        return resp(400, { erro: 'Código de renovação em formato inválido.' });
    }

    // 1. assinatura
    const [payloadB64, sigB64] = codigo.split('.');
    const esperado = crypto.createHmac('sha256', HMAC_SECRET).update(payloadB64).digest();
    let recebido;
    try { recebido = b64urlDecode(sigB64); } catch (_) { recebido = Buffer.alloc(0); }
    if (recebido.length !== esperado.length || !crypto.timingSafeEqual(recebido, esperado)) {
        await logTentativa({ usuario, resultado: 'ASSINATURA_INVALIDA' });
        return resp(400, { erro: 'Assinatura do código não confere.' });
    }

    // 2. payload
    let payload;
    try { payload = JSON.parse(b64urlDecode(payloadB64).toString('utf8')); } catch (_) {
        await logTentativa({ usuario, resultado: 'CODIGO_INVALIDO', detalhe: 'payload' });
        return resp(400, { erro: 'Conteúdo do código inválido.' });
    }
    const novaVigencia = String(payload.vigencia_termino || '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(novaVigencia)) {
        await logTentativa({ usuario, resultado: 'CODIGO_INVALIDO', detalhe: 'data' });
        return resp(400, { erro: 'Data de vigência no código é inválida.' });
    }

    // 3. CNPJ bate com o cadastrado
    const atual = await sb('empresa_licenciada?id=eq.1&select=cnpj,vigencia_termino');
    if (!atual.ok || !Array.isArray(atual.json) || !atual.json[0]) {
        await logTentativa({ usuario, resultado: 'ERRO', detalhe: 'empresa nao encontrada' });
        return resp(500, { erro: 'Empresa licenciada não encontrada no banco.' });
    }
    const empresa = atual.json[0];
    if (soDigitos(empresa.cnpj) !== soDigitos(payload.cnpj)) {
        await logTentativa({ usuario, resultado: 'CNPJ_DIVERGENTE' });
        return resp(400, { erro: 'O código não pertence a esta empresa (CNPJ divergente).' });
    }

    // 4. aplica
    const upd = await sb('empresa_licenciada?id=eq.1', {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({
            vigencia_termino: novaVigencia,
            atualizado_por: usuario ? `RENOVACAO (${usuario})` : 'RENOVACAO',
            atualizado_em: new Date().toISOString()
        })
    });
    if (!upd.ok) {
        await logTentativa({ usuario, resultado: 'ERRO', detalhe: `update ${upd.status}`, vigencia_anterior: empresa.vigencia_termino, vigencia_nova: novaVigencia });
        return resp(502, { erro: 'Falha ao gravar a nova vigência.' });
    }

    await logTentativa({ usuario, resultado: 'OK', vigencia_anterior: empresa.vigencia_termino, vigencia_nova: novaVigencia });
    return resp(200, { ok: true, vigencia_nova: novaVigencia });
};

function resp(statusCode, obj) {
    return { statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(obj) };
}
