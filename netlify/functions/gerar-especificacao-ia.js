// =========================================================================
// netlify/functions/gerar-especificacao-ia.js
// Módulo de Construção de Requerimentos com IA — chama a OpenAI a partir
// do template + dados de entrada gravados em ia_especificacoes. Chamada
// SÍNCRONA (o front-end espera a resposta HTTP) — ver o plano aprovado
// na sessão pra por que (Netlify Function síncrona tem limite de tempo
// curto; GPT-4o cabe nisso, um modelo de raciocínio profundo não
// necessariamente cabe — migração futura descrita no plano).
//
// Fase 2 (2026-09-23): modo de ajuste (instrucaoAjuste no body — a IA
// recebe o histórico de mensagens já trocado e responde com uma nova
// versão) e geração de um .docx a partir do Markdown resultante, salvo no
// bucket ia-documentos-gerados do Supabase Storage.
//
// Variáveis de ambiente exigidas (Netlify → Site settings → Environment):
//   OPENAI_API_KEY        chave de API da OpenAI (o usuário precisa criar
//                          e cadastrar — nunca fica no repositório)
//   SUPABASE_URL           https://<ref>.supabase.co
//   SUPABASE_SERVICE_KEY   service_role key (ou a publishable — as
//                          tabelas ia_* estão com RLS desligado)
// =========================================================================

const {
    Document, Packer, Paragraph, TextRun, HeadingLevel, LevelFormat, AlignmentType
} = require('docx');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

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

// Substituição simples de {{chave}} — sem engine de template, é só o que
// o documento original pede ("esqueleto interpolado").
function interpolar(template, dados) {
    return String(template || '').replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, chave) => {
        const v = dados ? dados[chave] : undefined;
        return (v === undefined || v === null || v === '') ? `(${chave} não informado)` : String(v);
    });
}

// Conversão simples de Markdown -> parágrafos docx. Não cobre 100% da
// sintaxe — só o suficiente pro que o modelo normalmente gera (títulos,
// listas, blocos de código/mermaid como texto monoespaçado, parágrafos).
function markdownParaDocxParagrafos(markdown) {
    const linhas = String(markdown || '').split(/\r?\n/);
    const paragrafos = [];
    let dentroCodigo = false;

    for (const linhaBruta of linhas) {
        const linha = linhaBruta.replace(/\s+$/, '');

        if (/^```/.test(linha.trim())) {
            dentroCodigo = !dentroCodigo;
            continue;
        }
        if (dentroCodigo) {
            paragrafos.push(new Paragraph({
                children: [new TextRun({ text: linha || ' ', font: 'Consolas', size: 18 })]
            }));
            continue;
        }
        if (!linha.trim()) {
            paragrafos.push(new Paragraph({ text: '' }));
            continue;
        }

        const heading3 = linha.match(/^###\s+(.*)/);
        const heading2 = linha.match(/^##\s+(.*)/);
        const heading1 = linha.match(/^#\s+(.*)/);
        const bullet = linha.match(/^[-*]\s+(.*)/);

        if (heading3) {
            paragrafos.push(new Paragraph({ text: heading3[1], heading: HeadingLevel.HEADING_3 }));
        } else if (heading2) {
            paragrafos.push(new Paragraph({ text: heading2[1], heading: HeadingLevel.HEADING_2 }));
        } else if (heading1) {
            paragrafos.push(new Paragraph({ text: heading1[1], heading: HeadingLevel.HEADING_1 }));
        } else if (bullet) {
            paragrafos.push(new Paragraph({ text: bullet[1], numbering: { reference: 'ia-bullet-list', level: 0 } }));
        } else {
            paragrafos.push(new Paragraph({ children: [new TextRun(linha)] }));
        }
    }
    return paragrafos;
}

async function gerarDocxBuffer(markdown) {
    const doc = new Document({
        numbering: {
            config: [{
                reference: 'ia-bullet-list',
                levels: [{
                    level: 0,
                    format: LevelFormat.BULLET,
                    text: '•',
                    alignment: AlignmentType.LEFT,
                    style: { paragraph: { indent: { left: 720, hanging: 360 } } }
                }]
            }]
        },
        sections: [{ children: markdownParaDocxParagrafos(markdown) }]
    });
    return Packer.toBuffer(doc);
}

async function salvarAnexoDocx(especificacao, novaVersao, markdown) {
    const buffer = await gerarDocxBuffer(markdown);
    const codigoSanitizado = String(especificacao.projeto_codigo).replace(/[^a-zA-Z0-9_-]/g, '_');
    const nomeArquivo = `${codigoSanitizado}_v${novaVersao}.docx`;
    const storagePath = `${codigoSanitizado}/${nomeArquivo}`;

    const upload = await fetch(`${SUPABASE_URL}/storage/v1/object/ia-documentos-gerados/${storagePath}`, {
        method: 'POST',
        headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        },
        body: buffer
    });
    if (!upload.ok) {
        console.error('Falha ao subir o .docx pro Storage:', await upload.text());
        return;
    }

    await sb('ia_especificacoes_anexos', {
        method: 'POST',
        body: JSON.stringify([{
            especificacao_id: especificacao.id,
            versao: novaVersao,
            storage_path: storagePath,
            nome_original: nomeArquivo,
            tamanho_bytes: buffer.length
        }])
    });
}

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return resp(405, { erro: 'Use POST.' });
    }
    if (!SUPABASE_URL || !SUPABASE_KEY) {
        return resp(500, { erro: 'Serviço não configurado (variáveis do Supabase ausentes).' });
    }
    if (!OPENAI_API_KEY) {
        return resp(500, { erro: 'Serviço de IA não configurado — falta a variável de ambiente OPENAI_API_KEY no Netlify.' });
    }

    let especificacaoId, instrucaoAjuste;
    try {
        const b = JSON.parse(event.body || '{}');
        especificacaoId = b.especificacaoId;
        instrucaoAjuste = (b.instrucaoAjuste || '').trim() || null;
    } catch (_) {
        return resp(400, { erro: 'Corpo inválido.' });
    }
    if (!especificacaoId) {
        return resp(400, { erro: 'especificacaoId é obrigatório.' });
    }

    // 1. chave geral
    const cfg = await sb('ia_config_geral?id=eq.1&select=ativo,modelo');
    if (!cfg.ok || !Array.isArray(cfg.json) || !cfg.json[0]) {
        return resp(500, { erro: 'Configuração de IA não encontrada no banco.' });
    }
    if (cfg.json[0].ativo !== true) {
        return resp(403, { erro: 'A Chave Geral de IA está desligada (Configuração de IA). Ligue-a antes de gerar.' });
    }
    const modelo = cfg.json[0].modelo || 'gpt-4o';

    // 2. especificação + template
    const esp = await sb(`ia_especificacoes?id=eq.${especificacaoId}&select=*`);
    if (!esp.ok || !Array.isArray(esp.json) || !esp.json[0]) {
        return resp(404, { erro: 'Especificação não encontrada.' });
    }
    const especificacao = esp.json[0];
    if (!especificacao.template_id) {
        return resp(400, { erro: 'Especificação sem template selecionado.' });
    }
    const tpl = await sb(`ia_templates_prompt?id=eq.${especificacao.template_id}&select=*`);
    if (!tpl.ok || !Array.isArray(tpl.json) || !tpl.json[0]) {
        return resp(404, { erro: 'Template não encontrado.' });
    }
    const template = tpl.json[0];

    // 3. monta as mensagens — geração inicial (só template+dados) ou
    // ajuste (histórico salvo + a nova instrução).
    let mensagensParaOpenAI, mensagemUsuarioParaSalvar, promptMontado;

    if (instrucaoAjuste) {
        if (especificacao.status !== 'CONCLUIDO' || !especificacao.resultado_ia) {
            return resp(400, { erro: 'Ainda não há um documento gerado pra ajustar — gere a versão inicial primeiro.' });
        }
        const historico = await sb(`ia_especificacoes_mensagens?especificacao_id=eq.${especificacaoId}&select=papel,conteudo&order=id.asc`);
        const mensagensAnteriores = (historico.ok && Array.isArray(historico.json)) ? historico.json : [];
        mensagensParaOpenAI = [
            { role: 'system', content: template.system_prompt },
            ...mensagensAnteriores.map(m => ({ role: m.papel, content: m.conteudo })),
            { role: 'user', content: instrucaoAjuste }
        ];
        mensagemUsuarioParaSalvar = instrucaoAjuste;
        promptMontado = instrucaoAjuste;
    } else {
        promptMontado = interpolar(template.user_prompt_template, especificacao.dados_entrada);
        mensagensParaOpenAI = [
            { role: 'system', content: template.system_prompt },
            { role: 'user', content: promptMontado }
        ];
        mensagemUsuarioParaSalvar = promptMontado;
    }

    // 4. chama a OpenAI
    let resultado, erroOpenAI;
    try {
        const r = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${OPENAI_API_KEY}`
            },
            body: JSON.stringify({ model: modelo, messages: mensagensParaOpenAI })
        });
        const corpo = await r.json();
        if (!r.ok) {
            erroOpenAI = (corpo && corpo.error && corpo.error.message) || `Erro HTTP ${r.status} da OpenAI.`;
        } else {
            resultado = corpo.choices && corpo.choices[0] && corpo.choices[0].message && corpo.choices[0].message.content;
            if (!resultado) erroOpenAI = 'A OpenAI respondeu sem conteúdo.';
        }
    } catch (e) {
        erroOpenAI = 'Falha ao contatar a OpenAI: ' + e.message;
    }

    const agora = new Date().toISOString();

    // 5. grava resultado (sucesso ou erro) + histórico + mensagens
    if (erroOpenAI) {
        await sb(`ia_especificacoes?id=eq.${especificacaoId}`, {
            method: 'PATCH',
            headers: { Prefer: 'return=minimal' },
            body: JSON.stringify({ status: 'ERRO', erro_detalhe: erroOpenAI, prompt_montado: promptMontado, atualizado_em: agora })
        });
        return resp(502, { sucesso: false, erro: erroOpenAI });
    }

    const novaVersao = (especificacao.versao || 1) + (especificacao.status === 'CONCLUIDO' ? 1 : 0);
    await sb(`ia_especificacoes?id=eq.${especificacaoId}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({
            status: 'CONCLUIDO',
            resultado_ia: resultado,
            prompt_montado: promptMontado,
            erro_detalhe: null,
            versao: novaVersao,
            atualizado_em: agora
        })
    });
    await sb('ia_especificacoes_historico', {
        method: 'POST',
        body: JSON.stringify([{
            especificacao_id: Number(especificacaoId),
            versao: novaVersao,
            prompt_montado: promptMontado,
            resultado_ia: resultado,
            status: 'CONCLUIDO',
            gerado_por: especificacao.criado_por || null,
            gerado_em: agora
        }])
    });
    await sb('ia_especificacoes_mensagens', {
        method: 'POST',
        body: JSON.stringify([
            { especificacao_id: Number(especificacaoId), papel: 'user', conteudo: mensagemUsuarioParaSalvar, criado_por: especificacao.criado_por || null, criado_em: agora },
            { especificacao_id: Number(especificacaoId), papel: 'assistant', conteudo: resultado, criado_em: agora }
        ])
    });

    try {
        await salvarAnexoDocx(especificacao, novaVersao, resultado);
    } catch (e) {
        console.error('Falha ao gerar/salvar o .docx (documento em Markdown segue disponível):', e.message);
    }

    return resp(200, { sucesso: true, resultado, versao: novaVersao });
};

function resp(statusCode, obj) {
    return { statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(obj) };
}
