import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";
import { ArrowLeft, MessageCircle, X, Camera } from "lucide-react";

const PHOTO_BUCKET = "fotos-contagem";

export default function Counting() {
  const { categoria } = useParams();
  const { profile } = useAuth();
  const navigate = useNavigate();

  const [categoryName, setCategoryName] = useState("");
  const [products, setProducts] = useState([]);
  const [todayByProduct, setTodayByProduct] = useState({}); // product_id -> última contagem de hoje
  const [entries, setEntries] = useState({}); // product_id -> { quantity, note, noteOpen, photoUrl, uploading }

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
      .select("id, name, unit, min_quantity, count_by_photo, product_categories!inner(category_id)")
      .eq("active", true)
      .eq("product_categories.category_id", category.id)
      .order("name");

    if (prodError) {
      setError("Não foi possível carregar os produtos.");
      setLoading(false);
      return;
    }

    setProducts(prodData);

    // busca se algum desses produtos já foi contado hoje, pra avisar o
    // funcionário e evitar contagem duplicada sem ele perceber
    const productIds = prodData.map((p) => p.id);
    if (productIds.length > 0) {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const { data: todayCounts } = await supabase
        .from("counts")
        .select("product_id, quantity, photo_url, counted_at, profiles(name)")
        .in("product_id", productIds)
        .gte("counted_at", todayStart.toISOString())
        .order("counted_at", { ascending: false });

      if (todayCounts) {
        const latest = {};
        for (const c of todayCounts) {
          if (!(c.product_id in latest)) latest[c.product_id] = c;
        }
        setTodayByProduct(latest);
      }
    }

    setLoading(false);
  }

  function updateEntry(productId, patch) {
    setEntries((prev) => ({
      ...prev,
      [productId]: { quantity: "", note: "", noteOpen: false, photoUrl: null, uploading: false, ...prev[productId], ...patch },
    }));
  }

  async function handlePhotoSelect(productId, file) {
    if (!file) return;
    setSaveError("");
    updateEntry(productId, { uploading: true });

    const safeName = file.name.replace(/[^a-zA-Z0-9.]/g, "-");
    const path = `${productId}/${Date.now()}-${safeName}`;

    const { error: uploadError } = await supabase.storage.from(PHOTO_BUCKET).upload(path, file, {
      upsert: true,
      contentType: file.type || "image/jpeg",
    });

    if (uploadError) {
      updateEntry(productId, { uploading: false });
      setSaveError("Não foi possível enviar a foto. " + uploadError.message);
      return;
    }

    const { data } = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path);
    updateEntry(productId, { photoUrl: data.publicUrl, uploading: false });
  }

  async function handleSave() {
    setSaveError("");

    const productById = Object.fromEntries(products.map((p) => [p.id, p]));

    const rows = Object.entries(entries)
      .filter(([productId, v]) => {
        const product = productById[productId];
        if (product?.count_by_photo) return Boolean(v.photoUrl);
        return v.quantity !== "" && v.quantity !== undefined;
      })
      .map(([productId, v]) => {
        const product = productById[productId];
        if (product?.count_by_photo) {
          return {
            product_id: productId,
            quantity: null,
            photo_url: v.photoUrl,
            note: v.note?.trim() ? v.note.trim() : null,
            counted_by: profile.id,
          };
        }
        return {
          product_id: productId,
          quantity: Number(v.quantity),
          photo_url: null,
          note: v.note?.trim() ? v.note.trim() : null,
          counted_by: profile.id,
        };
      });

    if (rows.length === 0) {
      setSaveError("Preencha ao menos um item (quantidade ou foto).");
      return;
    }
    if (rows.some((r) => r.quantity !== null && (Number.isNaN(r.quantity) || r.quantity < 0))) {
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

  const filledCount = Object.entries(entries).filter(([productId, v]) => {
    const product = products.find((p) => p.id === productId);
    if (product?.count_by_photo) return Boolean(v.photoUrl);
    return v.quantity !== "" && v.quantity !== undefined;
  }).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={headerStyle}>
        <button onClick={() => navigate("/")} style={iconBtnStyle}>
          <ArrowLeft size={20} color="#fff" />
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <img src="/logo.png" alt="TR Stock" style={{ width: 24, height: 24 }} />
          <span style={{ fontFamily: "var(--font-display)", fontSize: 17, letterSpacing: 1 }}>
            {categoryName ? categoryName.toUpperCase() : "CONTAGEM"}
          </span>
        </div>
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
          const entry = entries[p.id] || { quantity: "", note: "", noteOpen: false, photoUrl: null, uploading: false };
          const todayEntry = todayByProduct[p.id];

          return (
            <div key={p.id} style={cardStyle}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: "var(--font-body)", fontWeight: 600, fontSize: 15 }}>{p.name}</div>
                  <div style={{ fontFamily: "var(--font-body)", fontSize: 12, color: "var(--tr-ink-soft)" }}>
                    {p.count_by_photo ? "contagem por foto" : `${p.unit} · mín. ${p.min_quantity}`}
                  </div>
                  {todayEntry && (
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                      {p.count_by_photo && todayEntry.photo_url && (
                        <img src={todayEntry.photo_url} alt="" style={todayThumbStyle} />
                      )}
                      <div style={{ fontFamily: "var(--font-body)", fontSize: 11, color: "var(--tr-orange)" }}>
                        já contado hoje
                        {!p.count_by_photo ? `: ${todayEntry.quantity} ${p.unit}` : ""}
                        {" às "}
                        {new Date(todayEntry.counted_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                        {todayEntry.profiles?.name ? ` por ${todayEntry.profiles.name}` : ""}
                      </div>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => updateEntry(p.id, { noteOpen: !entry.noteOpen })}
                  style={noteIconBtnStyle}
                  title="observação"
                >
                  <MessageCircle size={16} color={entry.noteOpen || entry.note ? "var(--tr-orange)" : "var(--tr-ink-soft)"} />
                </button>

                {p.count_by_photo ? (
                  <>
                    {entry.photoUrl ? (
                      <div style={{ position: "relative", flexShrink: 0 }}>
                        <img src={entry.photoUrl} alt="" style={photoPreviewStyle} />
                        <label htmlFor={`photo-${p.id}`} style={retakeBadgeStyle} title="trocar foto">
                          <Camera size={12} color="#fff" />
                        </label>
                      </div>
                    ) : (
                      <label htmlFor={`photo-${p.id}`} style={{ ...photoBtnStyle, opacity: entry.uploading ? 0.6 : 1 }}>
                        <Camera size={16} />
                        {entry.uploading ? "enviando…" : "tirar foto"}
                      </label>
                    )}
                    <input
                      id={`photo-${p.id}`}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      style={{ display: "none" }}
                      disabled={entry.uploading}
                      onChange={(e) => handlePhotoSelect(p.id, e.target.files[0])}
                    />
                    {entry.photoUrl && (
                      <button
                        onClick={() => updateEntry(p.id, { photoUrl: null })}
                        style={clearBtnStyle}
                        title="remover foto"
                      >
                        <X size={14} color="var(--tr-ink-soft)" />
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      placeholder="0"
                      value={entry.quantity}
                      onChange={(e) => updateEntry(p.id, { quantity: e.target.value })}
                      style={quantityInputStyle}
                    />
                    {entry.quantity !== "" && (
                      <button
                        onClick={() => updateEntry(p.id, { quantity: "" })}
                        style={clearBtnStyle}
                        title="limpar (não contar este item)"
                      >
                        <X size={14} color="var(--tr-ink-soft)" />
                      </button>
                    )}
                  </>
                )}
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

const clearBtnStyle = {
  background: "none",
  border: "none",
  padding: 4,
  cursor: "pointer",
  display: "flex",
  flexShrink: 0,
};

const photoBtnStyle = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  padding: "9px 12px",
  borderRadius: 8,
  border: "1px solid var(--tr-line)",
  background: "#fff",
  fontFamily: "var(--font-body)",
  fontSize: 12,
  color: "var(--tr-black)",
  cursor: "pointer",
  flexShrink: 0,
  whiteSpace: "nowrap",
};

const photoPreviewStyle = {
  width: 44,
  height: 44,
  borderRadius: 8,
  objectFit: "cover",
  border: "1px solid var(--tr-line)",
  display: "block",
};

const todayThumbStyle = {
  width: 28,
  height: 28,
  borderRadius: 6,
  objectFit: "cover",
  border: "1px solid var(--tr-line)",
};

const retakeBadgeStyle = {
  position: "absolute",
  bottom: -4,
  right: -4,
  width: 20,
  height: 20,
  borderRadius: "50%",
  background: "var(--tr-black)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
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