import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "./AuthContext";

/**
 * Envolve uma tela e só deixa passar se:
 * - o usuário estiver logado
 * - (opcional) o papel dele bater com `role` (ex: "gerente")
 *
 * Uso: <ProtectedRoute role="gerente"><PainelGerente /></ProtectedRoute>
 */
export default function ProtectedRoute({ children, role }) {
  const { session, profile, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ display: "flex", height: "100%", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-body)", color: "var(--tr-ink-soft)" }}>
        carregando…
      </div>
    );
  }

  if (!session) return <Navigate to="/login" replace />;

  if (role && profile?.role !== role) {
    // logado, mas sem permissão pra essa tela (ex: contador tentando abrir painel do gerente)
    return <Navigate to="/" replace />;
  }

  return children;
}
