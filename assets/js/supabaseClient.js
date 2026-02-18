/**
 * supabaseClient.js
 * ─────────────────────────────────────────────────────────────
 * Inicializa e exporta o cliente Supabase para toda a aplicação.
 *
 * O Supabase é o backend-as-a-service utilizado neste projeto.
 * Ele fornece:
 *   - Base de dados PostgreSQL (tabelas: candidatos, Vagas, Entrevistas, Entrevistador)
 *   - Autenticação (não utilizada neste projeto)
 *   - Storage (utilizado para armazenar currículos via url_curriculo)
 *
 * A variável `supabaseClient` fica disponível globalmente em todos
 * os outros scripts carregados após este ficheiro.
 *
 * ATENÇÃO: A chave "anon" (pública) é segura para uso no frontend,
 * pois as permissões de acesso são controladas pelas políticas RLS
 * (Row Level Security) configuradas no painel do Supabase.
 * ─────────────────────────────────────────────────────────────
 */
const supabaseClient = window.supabase.createClient(
  "https://lbpwwxallmybllvdrbeh.supabase.co",  // URL do projeto Supabase
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxicHd3eGFsbG15YmxsdmRyYmVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA4ODA2OTEsImV4cCI6MjA3NjQ1NjY5MX0.zGlsIwcH_TPeXffYKEWuDnQGkglNiGfTdSgDClldIr4" // Chave pública anônima (anon key)
);