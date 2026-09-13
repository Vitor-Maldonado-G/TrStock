import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";
import { signedPhotoUrl } from "../lib/countPhotos";
import { ArrowLeft, MessageCircle, X, Camera } from "lucide-react";

const PHOTO_BUCKET = "fotos-contagem";

export default function Counting() {
  const { categoria } = useParams();
  const { profile } = useAuth();
  const navigate = useNavigate();

  const [categoryName, setCategoryName] = useState("");
  const [products, setProducts] = useState([]);
  const [todayByProduct, setTodayByProduct] = useState({}); // product_id -> última contagem de hoje
  const [entries, setEntries] = useState({}); // product_id -> { quantity, note, noteOpen, photoPath, photoPreviewUrl, uploading }

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saved, setSaved] = useState(false);
  const uploadedPhotoPaths = useRef(new Set());

  useEffect(() => {
    load();
  }, [categoria]);

  useEffect(() => () => {
    const paths = [...uploadedPhotoPaths.current];
    if (paths.length > 0) supabase.storage.from(PHOTO_BUCKET).remove(paths);
  }, []);

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

      const { data: todayCounts, error: todayCountsError } = await supabase.rpc(
        "today_counts_for_products",
        {
          p_product_ids: productIds,
          p_from: todayStart.toISOString(),
        },
      );

      if (todayCountsError) {
        setError("Não foi possível verificar as contagens de hoje.");
      } else if (todayCounts) {
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
      [productId]: { quantity: "", note: "", noteOpen: false, photoPath: null, photoPreviewUrl: null, uploading: false, ...prev[productId], ...patch },
    }));
  }

  async function handlePhotoSelect(productId, file) {
    if (!file) return;
    setSaveError("");
    updateEntry(productId, { uploading: true });

    const safeName = file.name.replace(/[^a-zA-Z0-9.]/g, "-");
    const path = `${profile.id}/${productId}/${Date.now()}-${safeName}`;
    const previousPath = entries[productId]?.photoPath;

    const { error: uploadError } = await supabase.storage.from(PHOTO_BUCKET).upload(path, file, {
      upsert: false,
      contentType: file.type || "image/jpeg",
    });

    if (uploadError) {
      updateEntry(productId, { uploading: false });
      setSaveError("Não foi possível enviar a foto. " + uploadError.message);
      return;
    }

    const previewUrl = await signedPhotoUrl(path);
    if (!previewUrl) {
      await supabase.storage.from(PHOTO_BUCKET).remove([path]);
      updateEntry(productId, { uploading: false });
      setSaveError("Não foi possível preparar a foto para visualização.");
      return;
    }

    uploadedPhotoPaths.current.add(path);
    if (previousPath && uploadedPhotoPaths.current.has(previousPath)) {
      await supabase.storage.from(PHOTO_BUCKET).remove([previousPath]);
      uploadedPhotoPaths.current.delete(previousPath);
    }
    updateEntry(productId, { photoPath: path, photoPreviewUrl: previewUrl, uploading: false });
  }

  async function handlePhotoRemove(productId) {
    const path = entries[productId]?.photoPath;
    if (path && uploadedPhotoPaths.current.has(path)) {
      const { error: removeError } = await supabase.storage.from(PHOTO_BUCKET).remove([path]);
      if (removeError) {
        setSaveError("Não foi possível remover a foto. " + removeError.message);
        return;
      }
      uploadedPhotoPaths.current.delete(path);
    }
    updateEntry(productId, { photoPath: null, photoPreviewUrl: null });
  }

  async function handleSave() {
    setSaveError("");

    const rows = Object.entries(entries)
      .filter(([, v]) => v.quantity !== "" || Boolean(v.photoPath))
      .map(([productId, v]) => {
        return {
          product_id: productId,
          quantity: v.quantity !== "" ? Number(v.quantity) : null,
          photo_path: v.photoPath || null,
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
      const paths = [...uploadedPhotoPaths.current];
      if (paths.length > 0) await supabase.storage.from(PHOTO_BUCKET).remove(paths);
      uploadedPhotoPaths.current.clear();
      setEntries((prev) => Object.fromEntries(
        Object.entries(prev).map(([productId, entry]) => [productId, { ...entry, photoPath: null, photoPreviewUrl: null }]),
      ));
      setSaveError("Não foi possível salvar. " + insertError.message);
      setSaving(false);
      return;
    }

    setSaving(false);
    uploadedPhotoPaths.current.clear();
    setSaved(true);
    setTimeout(() => navigate("/"), 900);
  }

  const filledCount = Object.entries(entries).filter(([, v]) => {
    return v.quantity !== "" || Boolean(v.photoPath);
  }).length;

  return (
    <div className="app-page">
      <div className="app-header">
        <button onClick={() => navigate("/")} className="icon-button">
          <ArrowLeft size={20} color="#fff" />
        </button>
        <div className="app-header-brand">
          <img src="/logo.png" alt="TR Stock" style={{ width: 24, height: 24 }} />
          <span className="app-header-title">
            {categoryName ? categoryName.toUpperCase() : "CONTAGEM"}
          </span>
        </div>
        <div style={{ width: 36 }} />
      </div>

      {loading && (
        <div className="screen-message screen-message--muted">
          carregando…
        </div>
      )}
      {error && (
        <div className="screen-message screen-message--error">{error}</div>
      )}

      <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px 8px", display: "flex", flexDirection: "column", gap: 10 }}>
        {products.map((p) => {
          const entry = entries[p.id] || { quantity: "", note: "", noteOpen: false, photoPath: null, photoPreviewUrl: null, uploading: false };
          const todayEntry = todayByProduct[p.id];

          return (
            <div key={p.id} style={cardStyle}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: "var(--font-body)", fontWeight: 600, fontSize: 15 }}>{p.name}</div>
                  <div style={{ fontFamily: "var(--font-body)", fontSize: 12, color: "var(--tr-ink-soft)" }}>
                    {`${p.unit} · mín. ${p.min_quantity}${p.count_by_photo ? " · foto recomendada" : ""}`}
                  </div>
                  {todayEntry && (
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                      <div style={{ fontFamily: "var(--font-body)", fontSize: 11, color: "var(--tr-orange)" }}>
                        já contado hoje
                        {todayEntry.quantity != null ? `: ${todayEntry.quantity} ${p.unit}` : ": foto"}
                        {" às "}
                        {new Date(todayEntry.counted_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                        {todayEntry.counter_name ? ` por ${todayEntry.counter_name}` : ""}
                      </div>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => updateEntry(p.id, { noteOpen: !entry.noteOpen })}
                  style={noteIconBtnStyle}
                  title="observação"
                >
                  <MessageCircle size={16} color={entry.noteOpen || entry.note || entry.photoPath ? "var(--tr-orange)" : "var(--tr-ink-soft)"} />
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
                {entry.quantity !== "" && (
                  <button
                    onClick={() => updateEntry(p.id, { quantity: "" })}
                    style={clearBtnStyle}
                    title="limpar (não contar este item)"
                  >
                    <X size={14} color="var(--tr-ink-soft)" />
                  </button>
                )}
              </div>

              {entry.noteOpen && (
                <div style={noteAreaStyle}>
                  <textarea
                    value={entry.note}
                    onChange={(e) => updateEntry(p.id, { note: e.target.value })}
                    placeholder="observação (opcional)"
                    style={noteInputStyle}
                    rows={2}
                  />
                  <div style={noteAttachmentStyle}>
                    {entry.photoPath ? (
                      <>
                        <div style={{ position: "relative" }}>
                          <img src={entry.photoPreviewUrl} alt="foto da contagem" style={photoPreviewStyle} />
                          <label htmlFor={`photo-${p.id}`} style={retakeBadgeStyle} title="trocar foto">
                            <Camera size={12} color="#fff" />
                          </label>
                        </div>
                        <button
                          onClick={() => handlePhotoRemove(p.id)}
                          style={clearBtnStyle}
                          title="remover foto"
                        >
                          <X size={14} color="var(--tr-ink-soft)" />
                        </button>
                      </>
                    ) : (
                      <label htmlFor={`photo-${p.id}`} style={{ ...notePhotoBtnStyle, opacity: entry.uploading ? 0.6 : 1 }}>
                        <Camera size={16} />
                        {entry.uploading ? "enviando…" : "adicionar foto"}
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
                  </div>
                </div>
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

const photoPreviewStyle = {
  width: 44,
  height: 44,
  borderRadius: 8,
  objectFit: "cover",
  border: "1px solid var(--tr-line)",
  display: "block",
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
  padding: "8px 10px",
  borderRadius: 8,
  border: "1px solid var(--tr-line)",
  fontFamily: "var(--font-body)",
  fontSize: 13,
  outline: "none",
  resize: "none",
};

const noteAreaStyle = {
  marginTop: 8,
};

const noteAttachmentStyle = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  marginTop: 8,
};

const notePhotoBtnStyle = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  padding: "7px 10px",
  borderRadius: 7,
  border: "1px solid var(--tr-line)",
  background: "#fff",
  fontFamily: "var(--font-body)",
  fontSize: 12,
  color: "var(--tr-black)",
  cursor: "pointer",
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
