// =========================================================================
// core/supabase-client.js
// Conexão com o Supabase — única fonte de verdade para URL/KEY/client.
//
// Script clássico (ainda não é ES Module): precisa ser carregado no
// index.html ANTES dos demais módulos, depois do CDN do @supabase/supabase-js.
// As constantes abaixo ficam visíveis para os scripts carregados na
// sequência, pois compartilham o mesmo escopo léxico de topo de página.
//
// Projeto Supabase próprio do Compasso — separado de qualquer outro
// ambiente. Nunca aponte isto para outro projeto Supabase.
// =========================================================================
const SUPABASE_URL = "https://fytynjjvzecljmgbtwec.supabase.co";
const SUPABASE_KEY = "sb_publishable_RQCJQjbqePcwl7qO-D7sxg_e1_KQstp";
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
