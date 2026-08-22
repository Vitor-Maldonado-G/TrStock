import React from "react";
import { useAuth } from "../lib/AuthContext";

/**
 * Tela temporária — será substituída por uma etapa futura de construção.
 * Mantém login/logout e navegação funcionando de ponta a ponta enquanto
 * as telas de verdade ainda não foram implementadas.
 */
export default function PlaceholderScreen({ title }) {
  const { profile, signOut } = useAuth();

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div
        style={{
          height: 64, background: "var(--tr-black)", color: "#fff",
          display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px",
        }}
      >
        <span style={{ fontFamily: "var(--font-display)", fontSize: 17, textTransform: "uppercase" }}>{title}</span>
        <button onClick={signOut} style={{ background: "none", border: "none", color: "var(--tr-yellow)", fontSize: 13, fontFamily: "var(--font-body)" }}>
          sair
        </button>
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, padding: 24, textAlign: "center" }}>
        <div style={{ fontFamily: "var(--font-body)", fontSize: 14, color: "var(--tr-ink-soft)" }}>
          Logado como <b>{profile?.name || "…"}</b> ({profile?.role})
        </div>
        <div style={{ fontFamily: "var(--font-body)", fontSize: 13, color: "var(--tr-ink-soft)" }}>
          Esta tela ainda vai ser construída na próxima etapa.
        </div>
      </div>
    </div>
  );
}
