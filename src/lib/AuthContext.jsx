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
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session) loadProfile(data.session.user.id);
      else setLoading(false);
    });

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
    const { data, error } = await supabase
      .from("profiles")
      .select("id, name, role, active")
      .eq("id", userId)
      .single();

    if (error) {
      console.error("Erro ao carregar perfil:", error.message);
      setProfile(null);
    } else if (data.active === false) {
      // conta foi desativada enquanto a sessão ainda estava ativa (ex: gerente
      // desativou o funcionário com o app dele já aberto) — desloga na hora
      await supabase.auth.signOut();
      setProfile(null);
    } else {
      setProfile(data);
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