// =========================================================================
// netlify/functions/enviar-email.js
// Camada de envio de e-mail — chamada pelo front-end (Fila de E-mail),
// nunca diretamente pelo navegador ao provedor (evita expor a chave de
// API no cliente).
//
// PARA TROCAR DE PROVEDOR NO FUTURO: troque só a linha do require()
// abaixo por outro arquivo em ./providers/ com a mesma assinatura
// (enviar({...}) -> { sucesso, erro, idExterno }). Nada mais no sistema
// precisa mudar — nem o front-end, nem o banco.
// =========================================================================

const provedor = require('./providers/emailjs.js');

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: JSON.stringify({ erro: 'Método não permitido — use POST.' }) };
    }

    let payload;
    try {
        payload = JSON.parse(event.body || '{}');
    } catch (e) {
        return { statusCode: 400, body: JSON.stringify({ erro: 'Corpo da requisição inválido (JSON esperado).' }) };
    }

    const { destinatarioEmail, destinatarioNome, remetente, assunto, corpo } = payload;

    if (!destinatarioEmail || !assunto || !corpo) {
        return { statusCode: 400, body: JSON.stringify({ erro: 'Preencha destinatarioEmail, assunto e corpo.' }) };
    }

    const resultado = await provedor.enviar({ destinatarioEmail, destinatarioNome, remetente, assunto, corpo });

    return {
        statusCode: resultado.sucesso ? 200 : 502,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(resultado)
    };
};
