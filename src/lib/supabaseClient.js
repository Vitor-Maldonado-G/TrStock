import { createClient } from "@supabase/supabase-js";

// Essas duas variáveis vêm do projeto Supabase que seu amigo vai criar.
// Ficam num arquivo .env local (nunca commitado) — veja .env.example.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    "[TR Stock] Variáveis VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY não configuradas. " +
    "Copie .env.example para .env e preencha com os dados do projeto Supabase."
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
