// =========================================================================
// netlify/functions/receber-email-contratos.js   (Release 1 — Fase C)
// Canal de e-mail padronizado do módulo Contratos e Fornecedores
// (spec-contratos-terceiros.md §4). Recebe o webhook de um provedor de
// INBOUND e-mail, faz o parsing do corpo padronizado e grava a pendência
// (origem = 'EMAIL') — que segue para aprovação como qualquer outra.
//
// NUNCA escreve direto na base oficial. Só cria contratos_pendencias
// (+ 1 item de rateio quando o par contrato/projeto resolve) e sobe os
// anexos de NF no bucket contratos-anexos.
//
// Variáveis de ambiente (Netlify → Site settings → Environment):
//   SUPABASE_URL               https://<ref>.supabase.co
//   SUPABASE_SERVICE_KEY       service_role key (ou publishable — RLS off)
//   INBOUND_CONTRATOS_SECRET   segredo compartilhado com o provedor
//                              (?secret=... na URL do webhook, OU header
//                              X-Webhook-Secret)
//   INBOUND_CONTRATOS_REFERENCIA  valor esperado do campo "Referência" do
//                              corpo (identifica ESTA instância — a caixa
//                              de e-mail não é exclusiva por cliente).
//
// Provedor plugável: troque o require() abaixo por outro arquivo em
// ./providers/inbound/ com a mesma assinatura parse(event) -> {...}.
// =========================================================================

const provedor = require('./providers/inbound/generic.js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;
const SECRET = process.env.INBOUND_CONTRATOS_SECRET || '';
const REFERENCIA_ESPERADA = (process.env.INBOUND_CONTRATOS_REFERENCIA || '').trim();
const BUCKET = 'contratos-anexos';

async function sb(path, init) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
        ...init,
        headers: {
            apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json', Prefer: 'return=representation',
            ...(init && init.headers)
        }
    });
    const txt = await r.text();
    let json; try { json = txt ? JSON.parse(txt) : null; } catch (_) { json = txt; }
    return { ok: r.ok, status: r.status, json };
}

async function storagePut(pathNoBucket, buffer, contentType) {
    const r = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${pathNoBucket}`, {
        method: 'POST',
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': contentType || 'application/octet-stream', 'x-upsert': 'false' },
        body: buffer
    });
    return r.ok;
}

// extrai "Rótulo: valor" tolerando maiúsc/minúsc e espaçamento (§4.4)
function campo(corpo, rotulo) {
    const re = new RegExp('^\\s*' + rotulo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*:\\s*(.+?)\\s*$', 'im');
    const m = re.exec(corpo || '');
    return m ? m[1].trim() : null;
}
function parseValor(v) {
    if (!v) return null;
    const n = Number(String(v).replace(/[^\d.,-]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'));
    return isNaN(n) ? null : n;
}
function parseData(v) {
    if (!v) return null;
    let m = /(\d{2})\/(\d{2})\/(\d{4})/.exec(v);
    if (m) return `${m[3]}-${m[2]}-${m[1]}`;
    m = /(\d{4})-(\d{2})-(\d{2})/.exec(v);
    return m ? m[0] : null;
}
function resp(code, obj) {
    return { statusCode: code, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(obj) };
}

// §4.2 — o assunto é o ponto de parsing principal; serve de fallback quando
// um rótulo do corpo não é lido.
// [CONTRATOS] {{TIPO}} - Contrato {{NUMERO_CONTRATO}} - Projeto {{NOME_PROJETO}}
function parseAssunto(assunto) {
    const m = /\[CONTRATOS\]\s*(PROPOSTA|PAGAMENTO)\s*-\s*Contrato\s+(.+?)\s*-\s*Projeto\s+(.+?)\s*$/i.exec(assunto || '');
    if (!m) return {};
    return { tipo: m[1].toUpperCase(), contratoRef: m[2].trim(), projetoRef: m[3].trim() };
}

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') return resp(405, { erro: 'Use POST.' });
    if (!SUPABASE_URL || !SUPABASE_KEY) return resp(500, { erro: 'SUPABASE_URL / SUPABASE_SERVICE_KEY não configuradas.' });

    // autenticação do webhook
    const secretRecebido = (event.queryStringParameters && event.queryStringParameters.secret) ||
        (event.headers && (event.headers['x-webhook-secret'] || event.headers['X-Webhook-Secret'])) || '';
    if (!SECRET || secretRecebido !== SECRET) return resp(401, { erro: 'Segredo do webhook inválido.' });

    let email;
    try { email = provedor.parse(event); }
    catch (e) { return resp(400, { erro: 'Falha ao ler o e-mail: ' + e.message }); }

    // dedupe por Message-ID (retry do provedor não duplica)
    if (email.messageId) {
        const dup = await sb(`contratos_pendencias?email_message_id=eq.${encodeURIComponent(email.messageId)}&select=id`, { headers: { Prefer: 'count=none' } });
        if (dup.ok && Array.isArray(dup.json) && dup.json.length) return resp(200, { ok: true, duplicado: true, pendencia_id: dup.json[0].id });
    }

    const corpo = email.corpo || '';
    const doAssunto = parseAssunto(email.assunto);
    const referencia = campo(corpo, 'Referência') || campo(corpo, 'Referencia');
    const tipoRaw = (campo(corpo, 'Tipo de Lançamento') || campo(corpo, 'Tipo de Lancamento') || '').toUpperCase();
    const tipo = tipoRaw.startsWith('PROP') ? 'PROPOSTA' : tipoRaw.startsWith('PAG') ? 'PAGAMENTO' : (doAssunto.tipo || null);
    const contratoRef = campo(corpo, 'Contrato') || doAssunto.contratoRef || null;
    const projetoRef = campo(corpo, 'Projeto') || doAssunto.projetoRef || null;
    const valor = parseValor(campo(corpo, 'Valor'));
    const data = parseData(campo(corpo, 'Data de Referência') || campo(corpo, 'Data de Referencia'));
    const descricao = campo(corpo, 'Descrição/Observações') || campo(corpo, 'Descrição') || campo(corpo, 'Observações') || null;

    const erros = [];
    if (REFERENCIA_ESPERADA && (!referencia || referencia.toUpperCase() !== REFERENCIA_ESPERADA.toUpperCase()))
        erros.push({ campo: 'Referência', motivo: referencia ? `"${referencia}" não corresponde a esta instância` : 'ausente (obrigatório — a caixa não é exclusiva)' });
    if (!tipo) erros.push({ campo: 'Tipo de Lançamento', motivo: 'ausente ou inválido (Proposta/Pagamento)' });
    if (!contratoRef) erros.push({ campo: 'Contrato', motivo: 'ausente' });
    if (!projetoRef) erros.push({ campo: 'Projeto', motivo: 'ausente' });
    if (!(valor > 0)) erros.push({ campo: 'Valor', motivo: 'ausente ou inválido' });
    if (!data) erros.push({ campo: 'Data de Referência', motivo: 'ausente ou fora do formato dd/mm/aaaa' });

    // resolve contrato / projeto (best-effort — mesmo com erro de leitura,
    // a pendência é criada sinalizada, nunca descartada — §4.4)
    let contrato = null, projeto = null;
    if (contratoRef) {
        const alvo = encodeURIComponent(contratoRef.trim());
        const c = await sb(`contratos_projeto?numero_contrato=ilike.${alvo}&select=id,numero_contrato,valor_total`);
        contrato = (c.ok && Array.isArray(c.json) && c.json[0]) || null;
        if (!contrato) erros.push({ campo: 'Contrato', motivo: `"${contratoRef}" não localizado no cadastro` });
    }
    if (projetoRef) {
        const alvo = encodeURIComponent(projetoRef.trim());
        const pr = await sb(`projetos?or=(codigo.ilike.${alvo},nome.ilike.${alvo})&select=codigo,nome`);
        projeto = (pr.ok && Array.isArray(pr.json) && pr.json[0]) || null;
        if (!projeto) erros.push({ campo: 'Projeto', motivo: `"${projetoRef}" não localizado no cadastro` });
    }

    const status = erros.length ? 'ERRO_LEITURA' : 'PENDENTE';
    const nfStatus = email.anexos.length ? 'RECEBIDA' : 'NAO_RECEBIDA';

    const ins = await sb('contratos_pendencias', {
        method: 'POST',
        body: JSON.stringify([{
            tipo: tipo || 'PAGAMENTO', origem: 'EMAIL', referencia: referencia || null,
            contrato_ref: contratoRef || null, contrato_id: contrato ? contrato.id : null,
            projeto_ref: projetoRef || null, projeto_codigo: projeto ? projeto.codigo : null,
            valor: valor || null, data_referencia: data, descricao,
            status, nf_status: nfStatus,
            erros_leitura: erros.length ? erros : null,
            email_message_id: email.messageId || null,
            criado_por: `e-mail: ${email.remetente || 'desconhecido'}`
        }])
    });
    if (!ins.ok) return resp(500, { erro: 'Falha ao gravar a pendência.', detalhe: ins.json });
    const pend = Array.isArray(ins.json) ? ins.json[0] : ins.json;
    const pendId = pend && pend.id;

    // item de rateio (1 projeto — e-mail é single-project por §4.3)
    if (pendId && tipo === 'PAGAMENTO') {
        let vinculoId = null;
        if (contrato && projeto) {
            const v = await sb(`contratos_vinculos_projeto?contrato_id=eq.${contrato.id}&projeto_codigo=eq.${encodeURIComponent(projeto.codigo)}&select=id`);
            if (v.ok && Array.isArray(v.json) && v.json.length === 1) vinculoId = v.json[0].id;
        }
        await sb('contratos_pendencias_itens', {
            method: 'POST',
            body: JSON.stringify([{ pendencia_id: pendId, vinculo_id: vinculoId, projeto_ref: projetoRef || null, projeto_codigo: projeto ? projeto.codigo : null, valor: valor || 0 }])
        });
    }

    // anexos de NF -> Storage + tabela
    if (pendId) {
        for (const a of email.anexos) {
            const okTipo = /pdf|jpe?g|png/i.test(a.tipo) || /\.(pdf|jpe?g|png)$/i.test(a.nome);
            if (!okTipo) continue;
            const nomeSan = String(a.nome).replace(/[^\w.\-]+/g, '_');
            const path = `pendencias/${pendId}/${Date.now()}-${nomeSan}`;
            const ok = await storagePut(path, Buffer.from(a.base64, 'base64'), a.tipo);
            if (ok) {
                await sb('contratos_pendencias_anexos', {
                    method: 'POST',
                    body: JSON.stringify([{ pendencia_id: pendId, storage_path: path, nome_original: a.nome, tipo_mime: a.tipo, classificacao: 'NOTA_FISCAL', enviado_por: 'e-mail' }])
                });
            }
        }
    }

    if (pendId) {
        await sb('log_contratos_pendencias', {
            method: 'POST',
            body: JSON.stringify([{ pendencia_id: pendId, acao: 'IMPORTADA', por: `e-mail: ${email.remetente || '-'}`, detalhe: { origem: 'EMAIL', messageId: email.messageId, status, anexos: email.anexos.length, erros: erros.length } }])
        });
    }

    return resp(200, { ok: true, pendencia_id: pendId, status, erros });
};
