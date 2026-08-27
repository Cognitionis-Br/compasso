// =========================================================================
// supabase/functions/admin-create-user/index.ts
//
// Cadastro de Usuários (Especificacao_Workflow_v4.md, seção 4.4 — G3).
//
// Por que isso precisa ser uma Edge Function (e não pode rodar direto no
// navegador): criar um usuário com senha provisória exige a Admin API do
// Supabase Auth (auth.admin.createUser), que só funciona com a SERVICE
// ROLE KEY — uma credencial que nunca pode ser exposta no cliente (dá
// acesso total ao banco, sem RLS). Esta função roda no servidor da
// Supabase, recebe a chamada do navegador com o token do usuário logado,
// confirma que quem está chamando é ADMINISTRADOR, e só então usa a
// service role key (que fica só aqui, nunca no navegador) pra criar o
// usuário.
//
// DEPLOY (você precisa fazer isso pelo terminal, uma vez):
//   1. Instale a Supabase CLI, se ainda não tiver: https://supabase.com/docs/guides/cli
//   2. supabase login
//   3. supabase link --project-ref <seu-project-ref>   (o ref está na URL do projeto)
//   4. supabase functions deploy admin-create-user
//
// Não precisa configurar SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY manualmente
// — a Supabase já injeta essas variáveis automaticamente em toda Edge
// Function do projeto.
// =========================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function jsonResponse(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
}

Deno.serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const { nome, email, area, senha_provisoria } = await req.json();

        if (!nome || !email || !senha_provisoria) {
            return jsonResponse({ error: 'Nome, e-mail e senha provisória são obrigatórios.' }, 400);
        }
        if (String(senha_provisoria).length < 6) {
            return jsonResponse({ error: 'A senha provisória precisa ter pelo menos 6 caracteres.' }, 400);
        }

        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
            return jsonResponse({ error: 'Não autenticado.' }, 401);
        }

        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

        // Cliente com o token de quem está chamando — só pra confirmar a
        // identidade de quem fez a requisição.
        const supabaseCaller = createClient(supabaseUrl, anonKey, {
            global: { headers: { Authorization: authHeader } },
        });
        const { data: { user: callerUser }, error: callerError } = await supabaseCaller.auth.getUser();
        if (callerError || !callerUser) {
            return jsonResponse({ error: 'Sessão inválida ou expirada.' }, 401);
        }

        // Cliente com a service role key — só a partir daqui, e só pra
        // checar permissão e criar o usuário. Nunca volta pro navegador.
        const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

        const { data: funcoesDoChamador, error: errorFuncoes } = await supabaseAdmin
            .from('usuario_funcoes')
            .select('funcoes(nome)')
            .eq('usuario_id', callerUser.id);

        if (errorFuncoes) {
            return jsonResponse({ error: 'Erro ao verificar permissões: ' + errorFuncoes.message }, 500);
        }

        const ehAdministrador = (funcoesDoChamador || []).some(
            (f: any) => f.funcoes && f.funcoes.nome === 'ADMINISTRADOR'
        );
        if (!ehAdministrador) {
            return jsonResponse({ error: 'Apenas usuários com a função ADMINISTRADOR podem criar novos usuários.' }, 403);
        }

        // Cria o usuário de verdade no Supabase Auth, com a senha provisória.
        const { data: criado, error: createError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password: senha_provisoria,
            email_confirm: true,
            user_metadata: { full_name: nome },
        });

        if (createError) {
            return jsonResponse({ error: createError.message }, 400);
        }

        // O trigger on_auth_user_created (schema_perfis_usuarios.sql) já
        // criou a linha básica em perfis_usuarios — completamos os campos
        // que ele não preenche (área, senha provisória, quem criou).
        const { error: updateError } = await supabaseAdmin
            .from('perfis_usuarios')
            .update({
                nome,
                area: area || null,
                senha_provisoria: true,
                criado_por: callerUser.user_metadata?.full_name || callerUser.email,
            })
            .eq('id', criado.user.id);

        if (updateError) {
            return jsonResponse({
                error: 'Usuário criado no Auth, mas houve erro ao salvar o perfil: ' + updateError.message,
                usuario_id: criado.user.id,
            }, 500);
        }

        return jsonResponse({ success: true, usuario_id: criado.user.id });
    } catch (err) {
        return jsonResponse({ error: (err as Error).message }, 500);
    }
});
