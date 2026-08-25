import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";
import { LogOut, Package, Users, MessageCircle } from "lucide-react";

const CATEGORY_ORDER = ["pizza-esfiha", "lanches", "bebidas", "diversos"];

export default function GerenteDashboard() {
  const { signOut } = useAuth();
  const navigate = useNavigate();

  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [latestByProduct, setLatestByProduct] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [filterSlug, setFilterSlug] = useState("todos");
  const [openNoteId, setOpenNoteId] = useState(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    setError("");

    const [
      { data: catData, error: catError },
      { data: prodData, error: prodError },
      { data: countsData, error: countsError },
    ] = await Promise.all([
      supabase.from("categories").select("id, name, slug"),
      supabase
        .from("products")
        .select("id, name, unit, min_quantity, active, product_categories(category_id)")
        .eq("active", true)
        .order("name"),
      // pega tudo ordenado por mais recente; a contagem mais recente de cada
      // produto é a primeira ocorrência do product_id nessa lista já ordenada
      // (equivalente ao DISTINCT ON do SCHEMA.md, feito no cliente)
      supabase
      .from("counts")
      .select("id, product_id, quantity, note, counted_at, profiles(name)")
      .order("counted_at", { ascending: false }),
    ]);

    if (catError || prodError || countsError) {
      setError("Não foi possível carregar o painel.");
    } else {
      const sortedCats = [...catData].sort(
        (a, b) => CATEGORY_ORDER.indexOf(a.slug) - CATEGORY_ORDER.indexOf(b.slug)
      );
      const latest = {};
      for (const c of countsData) {
        if (!(c.product_id in latest)) latest[c.product_id] = c;
      }
      setCategories(sortedCats);
      setProducts(prodData);
      setLatestByProduct(latest);
    }
    setLoading(false);
  }

  function productsForCategory(categoryId) {
    return products.filter((p) =>
      (p.product_categories || []).some((pc) => pc.category_id === categoryId)
    );
  }

  const belowMinCount = products.filter((p) => {
    const latest = latestByProduct[p.id];
    return latest && Number(latest.quantity) < Number(p.min_quantity);
  }).length;

  const categoriesToShow =
    filterSlug === "todos" ? categories : categories.filter((c) => c.slug === filterSlug);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={headerStyle}>
        <span style={{ fontFamily: "var(--font-display)", fontSize: 17, letterSpacing: 1 }}>PAINEL</span>
        <button onClick={signOut} style={logoutBtnStyle}>
          <LogOut size={16} /> sair
        </button>
      </div>

      <div style={{ display: "flex", gap: 10, padding: "16px 20px 0" }}>
        <button onClick={() => navigate("/gerente/produtos")} style={navBtnStyle}>
          <Package size={16} /> produtos
        </button>
        <button onClick={() => navigate("/gerente/funcionarios")} style={navBtnStyle}>
          <Users size={16} /> funcionários
        </button>
      </div>

      {!loading && !error && (
        <div style={{ padding: "14px 20px 0", fontFamily: "var(--font-body)", fontSize: 13 }}>
          {belowMinCount > 0 ? (
            <span style={{ color: "var(--tr-alert)", fontWeight: 600 }}>
              {belowMinCount} {belowMinCount === 1 ? "item abaixo" : "itens abaixo"} do mínimo
            </span>
          ) : (
            <span style={{ color: "var(--tr-ok)", fontWeight: 600 }}>tudo dentro do mínimo</span>
          )}
        </div>
      )}

      <div style={{ display: "flex", gap: 8, padding: "12px 20px 4px", overflowX: "auto" }}>
        <button onClick={() => setFilterSlug("todos")} style={filterSlug === "todos" ? chipActiveStyle : chipStyle}>
          todos
        </button>
        {categories.map((c) => (
          <button
            key={c.id}
            onClick={() => setFilterSlug(c.slug)}
            style={filterSlug === c.slug ? chipActiveStyle : chipStyle}
          >
            {c.name}
          </button>
        ))}
      </div>

      {loading && (
        <div style={{ padding: 20, fontFamily: "var(--font-body)", color: "var(--tr-ink-soft)" }}>
          carregando…
        </div>
      )}
      {error && (
        <div style={{ padding: 20, fontFamily: "var(--font-body)", color: "var(--tr-alert)" }}>{error}</div>
      )}

      <div style={{ flex: 1, overflowY: "auto", padding: "8px 20px 20px" }}>
        {categoriesToShow.map((cat) => {
          const catProducts = productsForCategory(cat.id);
          if (catProducts.length === 0) return null;
          return (
            <div key={cat.id} style={{ marginBottom: 18 }}>
              <div style={sectionTitleStyle}>{cat.name}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {catProducts.map((p) => {
                  const latest = latestByProduct[p.id];
                  const belowMin = latest && Number(latest.quantity) < Number(p.min_quantity);
                  const hasNote = latest && latest.note;
                  const noteOpen = latest && openNoteId === latest.id;

                  return (
                    <div key={p.id} style={rowCardStyle}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontFamily: "var(--font-body)", fontWeight: 600, fontSize: 15 }}>{p.name}</div>
                          <div style={{ fontFamily: "var(--font-body)", fontSize: 12, color: "var(--tr-ink-soft)" }}>
                            {latest
                              ? `contado ${timeAgo(latest.counted_at)}${latest.profiles?.name ? ` por ${latest.profiles.name}` : ""}`
                              : "sem contagem ainda"}
                          </div>
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                          {hasNote && (
                            <button
                              onClick={() => setOpenNoteId(noteOpen ? null : latest.id)}
                              style={noteIconBtnStyle}
                              title="observação"
                            >
                              <MessageCircle size={16} color={noteOpen ? "var(--tr-orange)" : "var(--tr-ink-soft)"} />
                            </button>
                          )}
                          <div
                            style={{
                              ...quantityBadgeStyle,
                              ...(latest ? (belowMin ? belowMinStyle : okStyle) : neutralBadgeStyle),
                            }}
                          >
                            {latest ? `${latest.quantity} ${p.unit}` : "—"}
                          </div>
                        </div>
                      </div>

                      {noteOpen && <div style={noteBoxStyle}>{latest.note}</div>}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {!loading && !error && categoriesToShow.every((cat) => productsForCategory(cat.id).length === 0) && (
          <div style={{ padding: 20, fontFamily: "var(--font-body)", fontSize: 13, color: "var(--tr-ink-soft)", textAlign: "center" }}>
            Nenhum produto ativo nessa categoria.
          </div>
        )}
      </div>
    </div>
  );
}

function timeAgo(dateStr) {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "agora";
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours}h`;
  const days = Math.floor(hours / 24);
  return `há ${days}d`;
}

// ---- estilos ----

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

const navBtnStyle = {
  flex: 1,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  padding: "10px 0",
  borderRadius: 8,
  border: "1px solid var(--tr-line)",
  background: "#fff",
  color: "var(--tr-black)",
  fontFamily: "var(--font-body)",
  fontWeight: 600,
  fontSize: 13,
  cursor: "pointer",
};

const chipStyle = {
  flexShrink: 0,
  padding: "6px 14px",
  borderRadius: 20,
  border: "1px solid var(--tr-line)",
  background: "#fff",
  color: "var(--tr-black)",
  fontFamily: "var(--font-body)",
  fontSize: 13,
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const chipActiveStyle = {
  ...chipStyle,
  background: "var(--tr-black)",
  borderColor: "var(--tr-black)",
  color: "var(--tr-yellow)",
};

const sectionTitleStyle = {
  fontFamily: "var(--font-display)",
  fontSize: 13,
  textTransform: "uppercase",
  letterSpacing: 0.6,
  color: "var(--tr-ink-soft)",
  margin: "4px 0 8px",
};

const rowCardStyle = {
  background: "#fff",
  border: "1px solid var(--tr-line)",
  borderRadius: 10,
  padding: "12px 14px",
};

const noteIconBtnStyle = {
  background: "none",
  border: "none",
  padding: 4,
  cursor: "pointer",
  display: "flex",
};

const quantityBadgeStyle = {
  fontFamily: "var(--font-body)",
  fontWeight: 700,
  fontSize: 13,
  borderRadius: 8,
  padding: "6px 10px",
  whiteSpace: "nowrap",
};

const belowMinStyle = {
  background: "var(--tr-alert-bg)",
  color: "var(--tr-alert)",
};

const okStyle = {
  background: "var(--tr-ok-bg)",
  color: "var(--tr-ok)",
};

const neutralBadgeStyle = {
  background: "var(--tr-paper)",
  color: "var(--tr-ink-soft)",
  border: "1px solid var(--tr-line)",
};

const noteBoxStyle = {
  marginTop: 8,
  padding: "8px 10px",
  background: "var(--tr-paper)",
  borderRadius: 8,
  fontFamily: "var(--font-body)",
  fontSize: 13,
  color: "var(--tr-black)",
};