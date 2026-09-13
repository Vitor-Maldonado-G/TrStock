import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { ArrowLeft, MessageCircle, Trash2 } from "lucide-react";

const CATEGORY_ORDER = ["pizza-esfiha", "lanches", "bebidas", "diversos", "produtos-limpeza"];

function isoDate(date) {
  return date.toISOString().slice(0, 10); // yyyy-mm-dd
}

function computeRange(quick) {
  const today = new Date();
  if (quick === "hoje") return { from: isoDate(today), to: isoDate(today) };
  if (quick === "7d") {
    const from = new Date(today);
    from.setDate(from.getDate() - 6);
    return { from: isoDate(from), to: isoDate(today) };
  }
  if (quick === "30d") {
    const from = new Date(today);
    from.setDate(from.getDate() - 29);
    return { from: isoDate(from), to: isoDate(today) };
  }
  return { from: "", to: "" }; // tudo
}

function dayHeaderLabel(dateObj) {
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const sameDay = (a, b) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

  if (sameDay(dateObj, today)) return "hoje";
  if (sameDay(dateObj, yesterday)) return "ontem";
  return dateObj.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
}

export default function GerenteHistorico() {
  const navigate = useNavigate();

  const [categories, setCategories] = useState([]);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [filterSlug, setFilterSlug] = useState("todos");
  const [quickRange, setQuickRange] = useState("7d");
  const [fromDate, setFromDate] = useState(() => computeRange("7d").from);
  const [toDate, setToDate] = useState(() => computeRange("7d").to);
  const [openNoteId, setOpenNoteId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null); // entry aguardando confirmação
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [voidReason, setVoidReason] = useState("");

  useEffect(() => {
    load();
  }, [fromDate, toDate]);

  useEffect(() => {
    loadCategories();
  }, []);

  async function loadCategories() {
    const { data } = await supabase.from("categories").select("id, name, slug");
    if (data) {
      setCategories([...data].sort((a, b) => CATEGORY_ORDER.indexOf(a.slug) - CATEGORY_ORDER.indexOf(b.slug)));
    }
  }

  async function load() {
    setLoading(true);
    setError("");

    let query = supabase
      .from("counts")
      .select("id, quantity, note, counted_at, profiles!counts_counted_by_fkey(name), products(name, unit, product_categories(category_id))")
      .is("voided_at", null)
      .order("counted_at", { ascending: false })
      .limit(500);

    if (fromDate) query = query.gte("counted_at", `${fromDate}T00:00:00`);
    if (toDate) query = query.lte("counted_at", `${toDate}T23:59:59`);

    const { data, error: loadError } = await query;

    if (loadError) {
      setError("Não foi possível carregar o histórico.");
    } else {
      setEntries(data);
    }
    setLoading(false);
  }

  function selectQuick(key) {
    setQuickRange(key);
    const range = computeRange(key);
    setFromDate(range.from);
    setToDate(range.to);
  }

  function onCustomDateChange(which, value) {
    setQuickRange(null); // sai do modo "rápido" assim que mexe manualmente
    if (which === "from") setFromDate(value);
    else setToDate(value);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    if (!voidReason.trim()) {
      setDeleteError("Informe o motivo da anulação.");
      return;
    }
    setDeleting(true);
    setDeleteError("");

    const { error: deleteErr } = await supabase
      .from("counts")
      .update({ voided_at: new Date().toISOString(), void_reason: voidReason.trim() })
      .eq("id", deleteTarget.id);

    if (deleteErr) {
      setDeleteError("Não foi possível anular. " + deleteErr.message);
      setDeleting(false);
      return;
    }

    setDeleting(false);
    setDeleteTarget(null);
    setVoidReason("");
    load();
  }

  const filteredEntries = entries.filter((e) => {
    if (filterSlug === "todos") return true;
    const cats = e.products?.product_categories || [];
    const category = categories.find((c) => c.slug === filterSlug);
    return category && cats.some((pc) => pc.category_id === category.id);
  });

  // agrupa por dia (a lista já vem ordenada por counted_at desc, então dias ficam contíguos)
  const groups = [];
  for (const entry of filteredEntries) {
    const entryDate = new Date(entry.counted_at);
    const label = dayHeaderLabel(entryDate);
    const lastGroup = groups[groups.length - 1];
    if (lastGroup && lastGroup.label === label) {
      lastGroup.items.push(entry);
    } else {
      groups.push({ label, items: [entry] });
    }
  }

  return (
    <div className="app-page">
      <div className="app-header">
        <button onClick={() => navigate("/gerente")} className="icon-button">
          <ArrowLeft size={20} color="#fff" />
        </button>
        <div className="app-header-brand">
          <img src="/logo.png" alt="TR Stock" style={{ width: 24, height: 24 }} />
          <span className="app-header-title">HISTÓRICO</span>
        </div>
        <div style={{ width: 36 }} />
      </div>

      <div className="filter-row" style={{ padding: "14px 20px 4px" }}>
        <button onClick={() => setFilterSlug("todos")} className={`filter-chip${filterSlug === "todos" ? " filter-chip--active" : ""}`}>
          todos
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
      </div>

      <div className="filter-row" style={{ padding: "8px 20px 4px" }}>
        {[
          { key: "hoje", label: "hoje" },
          { key: "7d", label: "7 dias" },
          { key: "30d", label: "30 dias" },
          { key: "tudo", label: "tudo" },
        ].map((opt) => (
          <button
            key={opt.key}
            onClick={() => selectQuick(opt.key)}
            className={`filter-chip${quickRange === opt.key ? " filter-chip--active" : ""}`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, padding: "8px 20px 4px", alignItems: "center" }}>
        <input
          type="date"
          value={fromDate}
          onChange={(e) => onCustomDateChange("from", e.target.value)}
          style={dateInputStyle}
        />
        <span style={{ fontFamily: "var(--font-body)", fontSize: 12, color: "var(--tr-ink-soft)" }}>até</span>
        <input
          type="date"
          value={toDate}
          onChange={(e) => onCustomDateChange("to", e.target.value)}
          style={dateInputStyle}
        />
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
        {groups.map((group) => (
          <div key={group.label + group.items[0].id} style={{ marginBottom: 18 }}>
            <div style={sectionTitleStyle}>{group.label}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {group.items.map((entry) => {
                const time = new Date(entry.counted_at).toLocaleTimeString("pt-BR", {
                  hour: "2-digit",
                  minute: "2-digit",
                });
                const noteOpen = openNoteId === entry.id;
                return (
                  <div key={entry.id} style={rowCardStyle}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontFamily: "var(--font-body)", fontWeight: 600, fontSize: 15 }}>
                          {entry.products?.name || "produto removido"}
                        </div>
                        <div style={{ fontFamily: "var(--font-body)", fontSize: 12, color: "var(--tr-ink-soft)" }}>
                          {time}
                          {entry.profiles?.name ? ` · por ${entry.profiles.name}` : ""}
                        </div>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                        {entry.note && (
                          <button
                            onClick={() => setOpenNoteId(noteOpen ? null : entry.id)}
                            style={noteIconBtnStyle}
                            title="observação"
                          >
                            <MessageCircle size={16} color={noteOpen ? "var(--tr-orange)" : "var(--tr-ink-soft)"} />
                          </button>
                        )}
                        <div style={quantityBadgeStyle}>
                          {entry.quantity} {entry.products?.unit || ""}
                        </div>
                        <button
                          onClick={() => {
                            setDeleteError("");
                            setVoidReason("");
                            setDeleteTarget(entry);
                          }}
                          style={noteIconBtnStyle}
                          title="anular contagem"
                        >
                          <Trash2 size={16} color="var(--tr-ink-soft)" />
                        </button>
                      </div>
                    </div>

                    {noteOpen && <div style={noteBoxStyle}>{entry.note}</div>}
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {!loading && !error && groups.length === 0 && (
          <div style={{ padding: 20, fontFamily: "var(--font-body)", fontSize: 13, color: "var(--tr-ink-soft)", textAlign: "center" }}>
            Nenhuma contagem encontrada nesse período.
          </div>
        )}
      </div>

      {deleteTarget && (
        <div style={overlayStyle} onClick={() => !deleting && setDeleteTarget(null)}>
          <div style={confirmCardStyle} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 16, marginBottom: 8 }}>
              Anular essa contagem?
            </div>
            <div style={{ fontFamily: "var(--font-body)", fontSize: 13, color: "var(--tr-ink-soft)", marginBottom: 16 }}>
              {deleteTarget.products?.name || "produto"} — {deleteTarget.quantity} {deleteTarget.products?.unit || ""}
              {deleteTarget.profiles?.name ? ` · contado por ${deleteTarget.profiles.name}` : ""}
              <br />
              A contagem sairá da lista, mas ficará registrada para auditoria.
            </div>

            <textarea
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
              placeholder="motivo da anulação"
              rows={2}
              style={{ ...dateInputStyle, height: "auto", padding: "10px", marginBottom: 12, resize: "vertical" }}
            />

            {deleteError && (
              <div style={{ color: "var(--tr-alert)", fontSize: 13, fontFamily: "var(--font-body)", marginBottom: 12 }}>
                {deleteError}
              </div>
            )}

            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => { setDeleteTarget(null); setVoidReason(""); }}
                disabled={deleting}
                style={cancelBtnStyle}
              >
                cancelar
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleting}
                style={{ ...confirmDeleteBtnStyle, opacity: deleting ? 0.6 : 1 }}
              >
                {deleting ? "anulando…" : "anular"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---- estilos ----

const dateInputStyle = {
  flex: 1,
  height: 38,
  padding: "0 8px",
  borderRadius: 8,
  border: "1px solid var(--tr-line)",
  fontFamily: "var(--font-body)",
  fontSize: 13,
  outline: "none",
  background: "#fff",
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
  background: "var(--tr-paper)",
  color: "var(--tr-black)",
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

const overlayStyle = {
  position: "fixed",
  inset: 0,
  background: "rgba(0, 0, 0, 0.5)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 20,
  zIndex: 50,
};

const confirmCardStyle = {
  background: "#fff",
  borderRadius: 12,
  padding: 20,
  width: "100%",
  maxWidth: 360,
};

const cancelBtnStyle = {
  flex: 1,
  padding: "12px 0",
  borderRadius: 8,
  border: "1px solid var(--tr-line)",
  background: "#fff",
  color: "var(--tr-black)",
  fontFamily: "var(--font-body)",
  fontWeight: 600,
  fontSize: 14,
  cursor: "pointer",
};

const confirmDeleteBtnStyle = {
  flex: 1,
  padding: "12px 0",
  borderRadius: 8,
  border: "none",
  background: "var(--tr-alert)",
  color: "#fff",
  fontFamily: "var(--font-body)",
  fontWeight: 600,
  fontSize: 14,
  cursor: "pointer",
};
