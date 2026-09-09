// =========================================================================
// netlify/functions/providers/inbound/generic.js
// Parser de webhook de INBOUND e-mail — padrão plugável (igual aos
// providers de ENVIO em ../). Troque só o require() em
// receber-email-contratos.js por outro arquivo deste diretório para usar
// outro provedor.
//
// parse(event) -> {
//   remetente:  string,          // e-mail do remetente
//   assunto:    string,
//   corpo:      string,          // texto puro do corpo
//   messageId:  string|null,     // Message-ID (dedupe de retry do webhook)
//   anexos:     [{ nome, tipo, base64 }]
// }
//
// Este "generic" entende um corpo JSON no formato comum a vários serviços
// de inbound parse (ex.: CloudMailin "json", SendGrid Inbound Parse com
// content-type json, Mailgun store+notify). Campos aceitos (o primeiro
// que existir):
//   from     : from | sender | envelope.from | headers.from
//   subject  : subject | headers.subject
//   corpo    : plain | text | body-plain | TextBody | body
//   msgId    : message_id | messageId | headers["message-id"] | Message-Id
//   anexos   : attachments[] com { file_name|filename|name,
//              content_type|contentType|type, content|data (base64) }
// Se o provedor mandar multipart/form-data, adapte aqui (ou crie um
// provider próprio) — a Netlify entrega event.body (string) e
// event.isBase64Encoded.
// =========================================================================

function _pick(obj, ...paths) {
    for (const p of paths) {
        const v = p.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);
        if (v !== undefined && v !== null && v !== '') return v;
    }
    return null;
}

function parse(event) {
    let raw = event.body || '';
    if (event.isBase64Encoded) raw = Buffer.from(raw, 'base64').toString('utf8');

    let data;
    try { data = JSON.parse(raw); }
    catch (_) { throw new Error('Corpo do webhook não é JSON — use/adapte um provider inbound específico.'); }

    const headers = data.headers || {};
    const remetente = String(_pick(data, 'from', 'sender', 'envelope.from', 'headers.from', 'From') || '')
        .replace(/^.*<([^>]+)>.*$/, '$1').trim();
    const assunto = String(_pick(data, 'subject', 'Subject', 'headers.subject') || '').trim();
    const corpo = String(_pick(data, 'plain', 'text', 'body-plain', 'TextBody', 'body', 'html') || '');
    const messageId = _pick(data, 'message_id', 'messageId', 'Message-Id', 'headers.message-id', 'headers.Message-Id') || null;

    const rawAnexos = data.attachments || data.Attachments || [];
    const anexos = (Array.isArray(rawAnexos) ? rawAnexos : []).map(a => ({
        nome: _pick(a, 'file_name', 'filename', 'name', 'Name') || 'anexo',
        tipo: _pick(a, 'content_type', 'contentType', 'type', 'ContentType') || 'application/octet-stream',
        base64: _pick(a, 'content', 'data', 'Content', 'ContentBase64') || null
    })).filter(a => a.base64);

    return { remetente, assunto, corpo, messageId: messageId ? String(messageId) : null, anexos };
}

module.exports = { parse };
