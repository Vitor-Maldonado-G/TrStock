import React, { useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";

export default function Login() {
  const { session, profile, loading, signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // já logado? manda pra tela certa conforme o papel
  if (!loading && session && profile) {
    return <Navigate to={profile.role === "gerente" ? "/gerente" : "/"} replace />;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    const { error } = await signIn(email, password);
    setSubmitting(false);
    if (error) {
      setError(
        error.message === "Invalid login credentials"
          ? "E-mail ou senha incorretos."
          : error.message
      );
    }
    // se der certo, o redirecionamento acima cuida do resto
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        padding: "72px 24px 24px",
        background: "var(--tr-paper)",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 40 }}>
        
        <img src="/logo.png" alt="TR Stock" style={{ width: 96, height: 96, marginBottom: 12 }} />
        
        <div style={{ fontFamily: "var(--font-display)", fontSize: 26, letterSpacing: 1 }}>TR STOCK</div>
        <div style={{ fontFamily: "var(--font-body)", fontSize: 13, color: "var(--tr-ink-soft)" }}>controle de estoque</div>
      </div>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <input
          type="email"
          required
          placeholder="e-mail"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={inputStyle}
        />
        <input
          type="password"
          required
          placeholder="senha"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={inputStyle}
        />

        {error && (
          <div style={{ color: "var(--tr-alert)", fontSize: 13, fontFamily: "var(--font-body)" }}>{error}</div>
        )}

        <button
          type="submit"
          disabled={submitting}
          style={{
            marginTop: 8, width: "100%", padding: "12px 0", borderRadius: 8, border: "none",
            background: "var(--tr-black)", color: "var(--tr-yellow)", fontFamily: "var(--font-body)",
            fontWeight: 600, fontSize: 14, opacity: submitting ? 0.6 : 1,
          }}
        >
          {submitting ? "Entrando…" : "Entrar"}
        </button>
      </form>

      <div style={{ marginTop: 12, textAlign: "center", fontSize: 12, color: "var(--tr-ink-soft)", fontFamily: "var(--font-body)" }}>
        Não há cadastro público — sua conta é criada pelo gerente.
      </div>
    </div>
  );
}

const inputStyle = {
  height: 46,
  padding: "0 14px",
  borderRadius: 8,
  border: "1px solid var(--tr-line)",
  fontSize: 14,
  outline: "none",
};
