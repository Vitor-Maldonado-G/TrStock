import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";
import { attachSignedPhotoUrls } from "../lib/countPhotos";
import { LogOut, Package, Users, History, MessageCircle, Camera } from "lucide-react";

const CATEGORY_ORDER = ["pizza-esfiha", "lanches", "bebidas", "diversos", "produtos-limpeza"];

export default function GerenteDashboard() {
  const { signOut } = useAuth();
  const navigate = useNavigate();

  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [latestByProduct, setLatestByProduct] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [filterSlug, setFilterSlug] = useState("todos");
  const [onlyBelowMin, setOnlyBelowMin] = useState(false);
  const [onlyMarketItems, setOnlyMarketItems] = useState(false);
  const [openNoteId, setOpenNoteId] = useState(null);
  const [openPhotoId, setOpenPhotoId] = useState(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    setError("");

    try {
      const [
        { data: catData, error: catError },
        { data: prodData, error: prodError },
        { data: countsData, error: countsError },
      ] = await Promise.all([
      supabase.from("categories").select("id, name, slug"),
      supabase
        .from("products")
        .select("id, name, unit, min_quantity, active, count_by_photo, is_market_item, product_categories(category_id)")
        .eq("active", true)
        .order("name"),
      supabase
        .from("counts")
        .select("id, product_id, quantity, photo_path, note, counted_at, profiles(name)")
        .order("counted_at", { ascending: false }),
      ]);

      const failedRequest = catError || prodError || countsError;
      if (failedRequest) {
        setError(`Não foi possível carregar o painel: ${failedRequest.message}`);
        return;
      }

      const sortedCats = [...catData].sort(
        (a, b) => CATEGORY_ORDER.indexOf(a.slug) - CATEGORY_ORDER.indexOf(b.slug)
      );
      const countsWithPhotoUrls = await attachSignedPhotoUrls(countsData);
      const latest = {};
      for (const c of countsWithPhotoUrls) {
        if (!(c.product_id in latest)) latest[c.product_id] = c;
      }
      setCategories(sortedCats);
      setProducts(prodData);
      setLatestByProduct(latest);
    } catch (unexpectedError) {
      setError(`Não foi possível carregar o painel: ${unexpectedError.message}`);
    } finally {
      setLoading(false);
    }
  }

  function productsForCategory(categoryId) {
    return products.filter((p) =>
      (p.product_categories || []).some((pc) => pc.category_id === categoryId)
    );
  }

  function passesExtraFilters(p) {
    if (onlyBelowMin) {
      const latest = latestByProduct[p.id];
      const isBelowMin = latest && latest.quantity != null && Number(latest.quantity) < Number(p.min_quantity);
      if (!isBelowMin) return false;
    }
    if (onlyMarketItems && !p.is_market_item) return false;
    return true;
  }

  const belowMinCount = products.filter((p) => {
    const latest = latestByProduct[p.id];
    return latest && latest.quantity != null && Number(latest.quantity) < Number(p.min_quantity);
  }).length;

  const categoriesToShow =
    filterSlug === "todos" ? categories : categories.filter((c) => c.slug === filterSlug);

  return (
    <div className="app-page">
      <div className="app-header" style={{ padding: "0 20px" }}>
        <div className="app-header-brand">
          <img src="/logo.png" alt="TR Stock" style={{ width: 24, height: 24 }} />
          <span className="app-header-title">PAINEL</span>
        </div>
        <button onClick={signOut} className="logout-button">
          <LogOut size={16} /> sair
        </button>
      </div>

      <div style={{ display: "flex", gap: 6, padding: "16px 20px 0" }}>
        <button onClick={() => navigate("/gerente/produtos")} style={navBtnStyle}>
          <Package size={16} /> produtos
        </button>
        <button onClick={() => navigate("/gerente/funcionarios")} style={navBtnStyle}>
          <Users size={16} /> funcionários
        </button>
        <button onClick={() => navigate("/gerente/historico")} style={navBtnStyle}>
          <History size={16} /> histórico
        </button>
      </div>

      {!loading && !error && (
        <div style={{ padding: "14px 20px 0", fontFamily: "var(--font-body)", fontSize: 13 }}>
          {belowMinCount > 0 ? (
            <button
              onClick={() => setOnlyBelowMin((v) => !v)}
              style={{
                ...belowMinToggleStyle,
                ...(onlyBelowMin ? belowMinToggleActiveStyle : {}),
              }}
            >
              {belowMinCount} {belowMinCount === 1 ? "item abaixo" : "itens abaixo"} do mínimo
              {onlyBelowMin ? " · mostrando só esses" : " · toque pra filtrar"}
            </button>
          ) : (
            <span style={{ color: "var(--tr-ok)", fontWeight: 600 }}>Tudo dentro do mínimo</span>
          )}
        </div>
      )}

      <div className="filter-row" style={{ padding: "12px 20px 4px" }}>
        <button onClick={() => setFilterSlug("todos")} className={`filter-chip${filterSlug === "todos" ? " filter-chip--active" : ""}`}>
          Todos
        </button>
        {categories.map((c) => (
          <button
            key={c.id}
            onClick={() => setFilterSlug(c.slug)}
            className={`filter-chip${filterSlug === c.slug ? " filter-chip--active" : ""}`}
          >
            {c.name}
          </button>
        ))}
        <button
          onClick={() => setOnlyMarketItems((v) => !v)}
          className={`filter-chip${onlyMarketItems ? " filter-chip--active" : ""}`}
        >
          Mercado
        </button>
      </div>

      {loading && (
        <div className="screen-message screen-message--muted">
          carregando…
        </div>
      )}
      {error && (
        <div className="screen-message screen-message--error">{error}</div>
      )}

      <div style={{ flex: 1, overflowY: "auto", padding: "8px 20px 20px" }}>
        {categoriesToShow.map((cat) => {
          const catProducts = productsForCategory(cat.id).filter(passesExtraFilters);
          if (catProducts.length === 0) return null;
          return (
            <div key={cat.id} style={{ marginBottom: 18 }}>
              <div style={sectionTitleStyle}>{cat.name}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {catProducts.map((p) => {
                  const latest = latestByProduct[p.id];
                  const belowMin = latest && latest.quantity != null && Number(latest.quantity) < Number(p.min_quantity);
                  const hasNote = latest && latest.note;
                  const noteOpen = latest && openNoteId === latest.id;
                  const hasPhoto = latest && latest.photoPreviewUrl;
                  const photoOpen = latest && openPhotoId === latest.id;

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
                          {hasPhoto && (
                            <button
                              onClick={() => setOpenPhotoId(photoOpen ? null : latest.id)}
                              style={photoToggleBtnStyle}
                              title="ver foto"
                            >
                              <Camera size={14} />
                              ver foto
                            </button>
                          )}
                          <div
                            style={{
                              ...quantityBadgeStyle,
                              ...(latest
                                ? latest.quantity != null
                                  ? belowMin
                                    ? belowMinStyle
                                    : okStyle
                                  : neutralBadgeStyle
                                : neutralBadgeStyle),
                            }}
                          >
                            {latest
                              ? latest.quantity != null
                                ? `${latest.quantity} ${p.unit}`
                                : "📷 só foto"
                              : "—"}
                          </div>
                        </div>
                      </div>

                      {noteOpen && <div style={noteBoxStyle}>{latest.note}</div>}
                      {photoOpen && (
                        <div style={photoBoxStyle}>
                          <img src={latest.photoPreviewUrl} alt={`foto da contagem de ${p.name}`} style={photoImgStyle} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {!loading &&
          !error &&
          categoriesToShow.every((cat) => productsForCategory(cat.id).filter(passesExtraFilters).length === 0) && (
            <div style={{ padding: 20, fontFamily: "var(--font-body)", fontSize: 13, color: "var(--tr-ink-soft)", textAlign: "center" }}>
              {onlyBelowMin && onlyMarketItems
                ? "Nenhum item de mercado abaixo do mínimo nessa categoria."
                : onlyBelowMin
                ? "Nenhum item abaixo do mínimo nessa categoria."
                : onlyMarketItems
                ? "Nenhum item de mercado nessa categoria."
                : "Nenhum produto ativo nessa categoria."}
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

const navBtnStyle = {
  flex: 1,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 4,
  padding: "10px 0",
  borderRadius: 8,
  border: "1px solid var(--tr-line)",
  background: "#fff",
  color: "var(--tr-black)",
  fontFamily: "var(--font-body)",
  fontWeight: 600,
  fontSize: 11,
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const belowMinToggleStyle = {
  background: "none",
  border: "none",
  padding: 0,
  color: "var(--tr-alert)",
  fontWeight: 600,
  fontFamily: "var(--font-body)",
  fontSize: 13,
  cursor: "pointer",
  textAlign: "left",
};

const belowMinToggleActiveStyle = {
  textDecoration: "underline",
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

const photoToggleBtnStyle = {
  display: "flex",
  alignItems: "center",
  gap: 4,
  background: "none",
  border: "1px solid var(--tr-line)",
  borderRadius: 6,
  padding: "5px 8px",
  cursor: "pointer",
  fontFamily: "var(--font-body)",
  fontSize: 11,
  color: "var(--tr-black)",
  whiteSpace: "nowrap",
};

const photoBoxStyle = {
  marginTop: 8,
};

const photoImgStyle = {
  width: "100%",
  maxHeight: 260,
  objectFit: "contain",
  borderRadius: 8,
  border: "1px solid var(--tr-line)",
  background: "var(--tr-paper)",
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
