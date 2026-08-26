// supabase/functions/create-employee/index.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Preflight CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { name, email, password, role } = await req.json();

    // Validação básica de entrada
    if (!name || !email || !password || !role) {
      return jsonResponse(
        { error: "Preencha nome, email, senha e cargo." },
        400,
      );
    }

    // Cliente admin com service role key (só existe no server, nunca no navegador)
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // (Opcional, mas recomendado) checar se quem chamou é um gerente autenticado.
    // Se sua tela já garante isso no frontend/RLS, pode remover este bloco.
    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      const supabaseClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } },
      );
      const {
        data: { user: caller },
      } = await supabaseClient.auth.getUser();

      if (!caller) {
        return jsonResponse({ error: "Não autenticado." }, 401);
      }

      const { data: callerProfile } = await supabaseAdmin
        .from("profiles")
        .select("role")
        .eq("id", caller.id)
        .single();

      if (callerProfile?.role !== "manager" && callerProfile?.role !== "gerente") {
        return jsonResponse(
          { error: "Apenas gerentes podem criar funcionários." },
          403,
        );
      }
    }

    // 1. Criar usuário no Supabase Auth
    const { data: createdUser, error: createUserError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true, // já confirma o email, já que foi o gerente que criou
      });

    if (createUserError) {
      return jsonResponse(
        { error: traduzErroAuth(createUserError.message) },
        400,
      );
    }

    const userId = createdUser.user.id;

    // 2. Criar/atualizar linha em profiles
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .upsert({
        id: userId,
        name,
        role,
        active: true,
      });

    if (profileError) {
      // Se falhar ao criar o profile, desfaz a criação do usuário no Auth
      // para não deixar um usuário "órfão" sem perfil.
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return jsonResponse(
        { error: "Erro ao salvar dados do funcionário: " + profileError.message },
        400,
      );
    }

    // 3. Sucesso
    return jsonResponse({ success: true, id: userId }, 200);
  } catch (err) {
    return jsonResponse(
      { error: "Erro inesperado no servidor: " + (err as Error).message },
      500,
    );
  }
});

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Traduz as mensagens de erro mais comuns do Supabase Auth para PT-BR
function traduzErroAuth(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes("already been registered") || m.includes("already exists")) {
    return "Já existe uma conta com esse email.";
  }
  if (m.includes("password") && (m.includes("weak") || m.includes("least"))) {
    return "A senha é muito fraca (use pelo menos 6 caracteres).";
  }
  if (m.includes("invalid") && m.includes("email")) {
    return "Email inválido.";
  }
  return msg;
}