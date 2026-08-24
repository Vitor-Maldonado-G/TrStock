import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";
import { ArrowLeft, MessageCircle } from "lucide-react";

export default function Counting() {
  const { categoria } = useParams();
  const { profile } = useAuth();
  const navigate = useNavigate();

  const [categoryName, setCategoryName] = useState("");
  const [products, setProducts] = useState([]);
  const [entries, setEntries] = useState({}); // product_id -> { quantity, note, noteOpen }

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    load();
  }, [categoria]);

  async function load() {
    setLoading(true);
    setError("");

    const { data: category, error: categoryError } = await supabase
      .from("categories")
      .select("id, name, slug")
      .eq("slug", categoria)
      .single();

    if (categoryError || !category) {
      setError("Categoria não encontrada.");
      setLoading(false);
      return;
    }

    setCategoryName(category.name);

    const { data: prodData, error: prodError } = await supabase
      .from("products")
      .select("id, name, unit, min_quantity, product_categories!inner(category_id)")
      .eq("active", true)
      .eq("product_categories.category_id", category.id)
      .order("name");

    if (prodError) {
      setError("Não foi possível carregar os produtos.");
    } else {
      setProducts(prodData);
    }
    setLoading(false);
  }

  function updateEntry(productId, patch) {
    setEntries((prev) => ({
      ...prev,
      [productId]: { quantity: "", note: "", noteOpen: false, ...prev[productId], ...patch },
    }));
  }

  async function handleSave() {
    setSaveError("");

    const rows = Object.entries(entries)
      .filter(([, v]) => v.quantity !== "" && v.quantity !== undefined)
      .map(([productId, v]) => ({
        product_id: productId,
        quantity: Number(v.quantity),
        note: v.note?.trim() ? v.note.trim() : null,
        counted_by: profile.id,
      }));

    if (rows.length === 0) {
      setSaveError("Preencha a quantidade de pelo menos um item.");
      return;
    }
    if (rows.some((r) => Number.isNaN(r.quantity) || r.quantity < 0)) {
      setSaveError("Tem uma quantidade inválida na lista.");
      return;
    }

    setSaving(true);
    const { error: insertError } = await supabase.from("counts").insert(rows);

    if (insertError) {
      setSaveError("Não foi possível salvar. " + insertError.message);
      setSaving(false);
      return;
    }

    setSaving(false);
    setSaved(true);
    setTimeout(() => navigate("/"), 900);
  }

  const filledCount = Object.values(entries).filter((v) => v.quantity !== "" && v.quantity !== undefined).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={headerStyle}>
        <button onClick={() => navigate("/")} style={iconBtnStyle}>
          <ArrowLeft size={20} color="#fff" />
        </button>
        <span style={{ fontFamily: "var(--font-display)", fontSize: 17, letterSpacing: 1 }}>
          {categoryName ? categoryName.toUpperCase() : "CONTAGEM"}
        </span>
        <div style={{ width: 36 }} />
      </div>

      {loading && (
        <div style={{ padding: 20, fontFamily: "var(--font-body)", color: "var(--tr-ink-soft)" }}>
          carregando…
        </div>
      )}
      {error && (
        <div style={{ padding: 20, fontFamily: "var(--font-body)", color: "var(--tr-alert)" }}>{error}</div>
      )}

      <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px 8px", display: "flex", flexDirection: "column", gap: 10 }}>
        {products.map((p) => {
          const entry = entries[p.id] || { quantity: "", note: "", noteOpen: false };
          return (
            <div key={p.id} style={cardStyle}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: "var(--font-body)", fontWeight: 600, fontSize: 15 }}>{p.name}</div>
                  <div style={{ fontFamily: "var(--font-body)", fontSize: 12, color: "var(--tr-ink-soft)" }}>
                    {p.unit} · mín. {p.min_quantity}
                  </div>
                </div>

                <button
                  onClick={() => updateEntry(p.id, { noteOpen: !entry.noteOpen })}
                  style={noteIconBtnStyle}
                  title="observação"
                >
                  <MessageCircle size={16} color={entry.noteOpen || entry.note ? "var(--tr-orange)" : "var(--tr-ink-soft)"} />
                </button>

                <input
                  type="number"
                  min="0"
                  step="any"
                  placeholder="0"
                  value={entry.quantity}
                  onChange={(e) => updateEntry(p.id, { quantity: e.target.value })}
                  style={quantityInputStyle}
                />
              </div>

              {entry.noteOpen && (
                <textarea
                  value={entry.note}
                  onChange={(e) => updateEntry(p.id, { note: e.target.value })}
                  placeholder="observação (opcional)"
                  style={noteInputStyle}
                  rows={2}
                />
              )}
            </div>
          );
        })}

        {!loading && !error && products.length === 0 && (
          <div style={{ padding: 20, fontFamily: "var(--font-body)", fontSize: 13, color: "var(--tr-ink-soft)", textAlign: "center" }}>
            Nenhum produto ativo nessa categoria.
          </div>
        )}
      </div>

      {!loading && !error && products.length > 0 && (
        <div style={footerStyle}>
          {saveError && (
            <div style={{ color: "var(--tr-alert)", fontSize: 13, fontFamily: "var(--font-body)", marginBottom: 8 }}>
              {saveError}
            </div>
          )}
          {saved ? (
            <div style={{ color: "var(--tr-ok)", fontFamily: "var(--font-body)", fontWeight: 600, textAlign: "center", padding: "12px 0" }}>
              contagem salva ✓
            </div>
          ) : (
            <button onClick={handleSave} disabled={saving} style={{ ...saveBtnStyle, opacity: saving ? 0.6 : 1 }}>
              {saving ? "salvando…" : `salvar contagem${filledCount > 0 ? ` (${filledCount})` : ""}`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ---- estilos ----

const headerStyle = {
  height: 64,
  background: "var(--tr-black)",
  color: "#fff",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "0 12px",
  flexShrink: 0,
  gap: 8,
};

const iconBtnStyle = {
  background: "none",
  border: "none",
  padding: 8,
  cursor: "pointer",
  display: "flex",
};

const cardStyle = {
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
  flexShrink: 0,
};

const quantityInputStyle = {
  width: 68,
  height: 40,
  padding: "0 10px",
  borderRadius: 8,
  border: "1px solid var(--tr-line)",
  fontSize: 14,
  textAlign: "center",
  outline: "none",
  flexShrink: 0,
};

const noteInputStyle = {
  width: "100%",
  marginTop: 8,
  padding: "8px 10px",
  borderRadius: 8,
  border: "1px solid var(--tr-line)",
  fontFamily: "var(--font-body)",
  fontSize: 13,
  outline: "none",
  resize: "none",
};

const footerStyle = {
  padding: "12px 20px 20px",
  borderTop: "1px solid var(--tr-line)",
  background: "var(--tr-paper)",
  flexShrink: 0,
};

const saveBtnStyle = {
  width: "100%",
  padding: "13px 0",
  borderRadius: 8,
  border: "none",
  background: "var(--tr-black)",
  color: "var(--tr-yellow)",
  fontFamily: "var(--font-body)",
  fontWeight: 600,
  fontSize: 14,
  cursor: "pointer",
};