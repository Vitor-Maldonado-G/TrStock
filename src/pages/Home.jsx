import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";
import { UtensilsCrossed, Sandwich, CupSoda, Package, LogOut } from "lucide-react";

const CATEGORY_ICONS = {
  "pizza-esfiha": UtensilsCrossed,
  "lanches": Sandwich,
  "bebidas": CupSoda,
  "diversos": Package,
};

const CATEGORY_ORDER = ["pizza-esfiha", "lanches", "bebidas", "diversos"];

export default function Home() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase.from("categories").select("id, name, slug");
      if (error) {
        setError("Não foi possível carregar as categorias.");
      } else {
        const sorted = [...data].sort(
          (a, b) => CATEGORY_ORDER.indexOf(a.slug) - CATEGORY_ORDER.indexOf(b.slug)
        );
        setCategories(sorted);
      }
      setLoading(false);
    }
    load();
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={headerStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <img src="/logo.png" alt="TR Stock" style={{ width: 28, height: 28 }} />
          <span style={{ fontFamily: "var(--font-display)", fontSize: 18, letterSpacing: 1 }}>TR STOCK</span>
        </div>
        <button onClick={signOut} style={logoutBtnStyle}>
          <LogOut size={16} /> sair
        </button>
      </div>

      <div style={{ padding: "20px 20px 8px" }}>
        <div style={{ fontFamily: "var(--font-body)", fontSize: 13, color: "var(--tr-ink-soft)" }}>
          Olá, {profile?.name?.split(" ")[0] || ""}
        </div>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 21 }}>O que vamos contar hoje?</div>
      </div>

      {loading && (
        <div style={{ padding: 20, fontFamily: "var(--font-body)", color: "var(--tr-ink-soft)" }}>
          carregando…
        </div>
      )}
      {error && (
        <div style={{ padding: 20, fontFamily: "var(--font-body)", color: "var(--tr-alert)" }}>{error}</div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, padding: "12px 20px" }}>
        {categories.map((c, i) => {
          const Icon = CATEGORY_ICONS[c.slug] || Package;
          const accent = i % 2 === 0 ? "var(--tr-orange)" : "var(--tr-yellow)";
          return (
            <button key={c.id} onClick={() => navigate(`/contagem/${c.slug}`)} style={cardStyle}>
              <div style={{ ...iconBadgeStyle, background: accent }}>
                <Icon size={20} color="#fff" />
              </div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 15, lineHeight: 1.15, color: "var(--tr-black)" }}>
                {c.name}
              </div>
            </button>
          );
        })}
      </div>

      {!loading && !error && categories.length === 0 && (
        <div style={{ padding: 20, fontFamily: "var(--font-body)", fontSize: 13, color: "var(--tr-ink-soft)", textAlign: "center" }}>
          Nenhuma categoria cadastrada ainda.
        </div>
      )}
    </div>
  );
}

const headerStyle = {
  height: 64,
  background: "var(--tr-black)",
  color: "#fff",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "0 20px",
  flexShrink: 0,
};

const logoutBtnStyle = {
  background: "none",
  border: "none",
  color: "var(--tr-yellow)",
  fontFamily: "var(--font-body)",
  fontSize: 13,
  display: "flex",
  alignItems: "center",
  gap: 4,
  cursor: "pointer",
};

const cardStyle = {
  textAlign: "left",
  background: "#fff",
  border: "1px solid var(--tr-line)",
  borderRadius: 10,
  padding: "20px 14px",
  minHeight: 118,
  cursor: "pointer",
};

const iconBadgeStyle = {
  width: 40,
  height: 40,
  borderRadius: 10,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  marginBottom: 12,
};