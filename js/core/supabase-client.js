// =========================================================================
// core/supabase-client.js
// Conexão com o Supabase — única fonte de verdade para URL/KEY/client.
//
// Script clássico (ainda não é ES Module): precisa ser carregado no
// index.html ANTES dos demais módulos, depois do CDN do @supabase/supabase-js.
// As constantes abaixo ficam visíveis para os scripts carregados na
// sequência, pois compartilham o mesmo escopo léxico de topo de página.
//
// Projeto Supabase próprio do Compasso — separado do projeto usado pelo
// Compasso (cliente original). Nunca aponte isto de volta pro projeto do Compasso.
// =========================================================================
const SUPABASE_URL = "https://fytynjjvzecljmgbtwec.supabase.co";
const SUPABASE_KEY = "sb_publishable_RQCJQjbqePcwl7qO-D7sxg_e1_KQstp";
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
