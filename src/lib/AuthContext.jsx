import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

// Guarda a sessão do Supabase Auth + o "perfil" do usuário (nome e papel:
// contador ou gerente), que fica na tabela `profiles` — ver SCHEMA.md.
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // no iOS, um app instalado (PWA) que fica muito tempo em segundo plano
    // pode ter o token de sessão salvo corrompido/inválido quando volta ao
    // primeiro plano. Sem o try/catch, isso derrubava o app inteiro numa
    // tela em branco, sem cair no login — nunca chegava nem no loadProfile.
    async function restoreSession() {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;

        setSession(data.session);
        if (data.session) {
          await loadProfile(data.session.user.id);
        } else {
          setLoading(false);
        }
      } catch (err) {
        console.error("Sessão salva inválida, deslogando:", err?.message || err);
        try {
          await supabase.auth.signOut();
        } catch {
          // se nem o signOut funcionar, ainda assim garante o estado limpo abaixo
        }
        setSession(null);
        setProfile(null);
        setLoading(false);
      }
    }

    restoreSession();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (newSession) loadProfile(newSession.user.id);
      else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  async function loadProfile(userId) {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, name, role, active")
        .eq("id", userId)
        .single();

      if (error) {
        // qualquer falha ao carregar o perfil (token expirado, erro de rede,
        // linha removida, etc) precisa deslogar de verdade — se só limpar o
        // profile e manter a session, o ProtectedRoute fica preso num loop de
        // redirecionamento (nenhuma rota bate o papel de um profile nulo) e a
        // tela trava em branco até a pessoa limpar os dados do navegador na mão
        console.error("Erro ao carregar perfil:", error.message);
        await supabase.auth.signOut();
        setSession(null);
        setProfile(null);
      } else if (data.active === false) {
        // conta foi desativada enquanto a sessão ainda estava ativa (ex: gerente
        // desativou o funcionário com o app dele já aberto) — desloga na hora
        await supabase.auth.signOut();
        setSession(null);
        setProfile(null);
      } else {
        setProfile(data);
      }
    } catch (err) {
      // se a própria chamada lançar uma exceção (ex: rede caiu no meio do
      // caminho), trata igual a um erro normal em vez de deixar subir e
      // travar o app
      console.error("Exceção ao carregar perfil:", err?.message || err);
      try {
        await supabase.auth.signOut();
      } catch {
        // ignora falha ao deslogar, o estado abaixo já garante limpeza
      }
      setSession(null);
      setProfile(null);
    }
    setLoading(false);
  }

  async function signIn(email, password) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error };

    // confere se a conta não foi desativada pelo gerente antes de deixar entrar
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user?.id;
    if (userId) {
      const { data: profileData } = await supabase
        .from("profiles")
        .select("active")
        .eq("id", userId)
        .single();

      if (profileData && profileData.active === false) {
        await supabase.auth.signOut();
        return { error: { message: "Essa conta foi desativada. Fale com o gerente." } };
      }
    }

    return { error: null };
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  return (
    <AuthContext.Provider value={{ session, profile, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}