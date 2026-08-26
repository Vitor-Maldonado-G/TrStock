import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";
import { ArrowLeft, LogOut, Plus, Pencil, Eye, EyeOff } from "lucide-react";

const CATEGORY_ORDER = ["pizza-esfiha", "lanches", "bebidas", "diversos"];
const UNIT_OPTIONS = ["unidades", "kg", "litros", "pacotes", "rolos", "peças"];

export default function GerenteProdutos() {
  const { signOut } = useAuth();
  const navigate = useNavigate();

  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // null = lista visível; {} = criando; produto = editando
  const [formState, setFormState] = useState(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    setError("");

    const [{ data: catData, error: catError }, { data: prodData, error: prodError }] = await Promise.all([
      supabase.from("categories").select("id, name, slug"),
      supabase
        .from("products")
        .select("id, name, unit, min_quantity, active, product_categories(category_id)")
        .order("name"),
    ]);

    if (catError || prodError) {
      setError("Não foi possível carregar os produtos.");
    } else {
      const sortedCats = [...catData].sort(
        (a, b) => CATEGORY_ORDER.indexOf(a.slug) - CATEGORY_ORDER.indexOf(b.slug)
      );
      setCategories(sortedCats);
      setProducts(prodData);
    }
    setLoading(false);
  }

  async function toggleActive(product) {
    const { error } = await supabase
      .from("products")
      .update({ active: !product.active })
      .eq("id", product.id);
    if (!error) load();
  }

  function categoriesFor(product) {
    const ids = new Set((product.product_categories || []).map((pc) => pc.category_id));
    return categories.filter((c) => ids.has(c.id));
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={headerStyle}>
        <button onClick={() => (formState ? setFormState(null) : navigate("/gerente"))} style={iconBtnStyle}>
          <ArrowLeft size={20} color="#fff" />
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <img src="/logo.png" alt="TR Stock" style={{ width: 24, height: 24 }} />
          <span style={{ fontFamily: "var(--font-display)", fontSize: 17, letterSpacing: 1 }}>
            {formState ? (formState.id ? "EDITAR PRODUTO" : "NOVO PRODUTO") : "PRODUTOS"}
          </span>
        </div>
        {formState ? (
          <div style={{ width: 20 }} />
        ) : (
          <button onClick={signOut} style={logoutBtnStyle}>
            <LogOut size={16} /> sair
          </button>
        )}
      </div>

      {formState ? (
        <ProductForm
          key={formState.id || "new"}
          product={formState}
          categories={categories}
          onCancel={() => setFormState(null)}
          onSaved={() => {
            setFormState(null);
            load();
          }}
        />
      ) : (
        <>
          <div style={{ padding: "16px 20px 8px" }}>
            <button onClick={() => setFormState({})} style={newBtnStyle}>
              <Plus size={16} /> novo produto
            </button>
          </div>

          {loading && (
            <div style={{ padding: 20, fontFamily: "var(--font-body)", color: "var(--tr-ink-soft)" }}>
              carregando…
            </div>
          )}
          {error && (
            <div style={{ padding: 20, fontFamily: "var(--font-body)", color: "var(--tr-alert)" }}>{error}</div>
          )}

          <div style={{ flex: 1, overflowY: "auto", padding: "8px 20px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
            {products.map((p) => {
              const cats = categoriesFor(p);
              return (
                <div key={p.id} style={{ ...cardStyle, opacity: p.active ? 1 : 0.55 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontFamily: "var(--font-body)", fontWeight: 600, fontSize: 15 }}>{p.name}</span>
                      {!p.active && <span style={inactiveBadgeStyle}>inativo</span>}
                    </div>
                    <div style={{ fontFamily: "var(--font-body)", fontSize: 12, color: "var(--tr-ink-soft)", marginTop: 2 }}>
                      {p.unit} · mín. {p.min_quantity}
                    </div>
                    {cats.length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
                        {cats.map((c, i) => (
                          <span
                            key={c.id}
                            style={{ ...chipStyle, background: i % 2 === 0 ? "var(--tr-orange-bg)" : "var(--tr-yellow-bg)" }}
                          >
                            {c.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 }}>
                    <button onClick={() => setFormState(p)} style={rowIconBtnStyle} title="editar">
                      <Pencil size={16} color="var(--tr-black)" />
                    </button>
                    <button onClick={() => toggleActive(p)} style={rowIconBtnStyle} title={p.active ? "desativar" : "reativar"}>
                      {p.active ? <EyeOff size={16} color="var(--tr-ink-soft)" /> : <Eye size={16} color="var(--tr-ok)" />}
                    </button>
                  </div>
                </div>
              );
            })}

            {!loading && !error && products.length === 0 && (
              <div style={{ padding: 20, fontFamily: "var(--font-body)", fontSize: 13, color: "var(--tr-ink-soft)", textAlign: "center" }}>
                Nenhum produto cadastrado ainda.
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ---- formulário de criar/editar ----

function ProductForm({ product, categories, onCancel, onSaved }) {
  const isEditing = Boolean(product.id);

  const [name, setName] = useState(product.name || "");
  const [unit, setUnit] = useState(product.unit || UNIT_OPTIONS[0]);
  const [minQuantity, setMinQuantity] = useState(
    product.min_quantity !== undefined ? String(product.min_quantity) : "0"
  );
  const [categoryIds, setCategoryIds] = useState(
    new Set((product.product_categories || []).map((pc) => pc.category_id))
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function toggleCategory(id) {
    setCategoryIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    const trimmedName = name.trim();
    const parsedMin = Number(minQuantity);

    if (!trimmedName) {
      setError("Informe o nome do produto.");
      return;
    }
    if (Number.isNaN(parsedMin) || parsedMin < 0) {
      setError("Quantidade mínima inválida.");
      return;
    }

    setSaving(true);

    let productId = product.id;

    if (isEditing) {
      const { error: updateError } = await supabase
        .from("products")
        .update({ name: trimmedName, unit, min_quantity: parsedMin })
        .eq("id", productId);
      if (updateError) {
        setError("Não foi possível salvar. " + updateError.message);
        setSaving(false);
        return;
      }
      // remove vínculos antigos pra refazer do zero com a seleção atual
      await supabase.from("product_categories").delete().eq("product_id", productId);
    } else {
      const { data, error: insertError } = await supabase
        .from("products")
        .insert({ name: trimmedName, unit, min_quantity: parsedMin })
        .select("id")
        .single();
      if (insertError) {
        setError("Não foi possível criar. " + insertError.message);
        setSaving(false);
        return;
      }
      productId = data.id;
    }

    if (categoryIds.size > 0) {
      const rows = [...categoryIds].map((categoryId) => ({ product_id: productId, category_id: categoryId }));
      const { error: linkError } = await supabase.from("product_categories").insert(rows);
      if (linkError) {
        setError("Produto salvo, mas houve erro ao vincular categorias. " + linkError.message);
        setSaving(false);
        return;
      }
    }

    setSaving(false);
    onSaved();
  }

  return (
    <form onSubmit={handleSubmit} style={{ flex: 1, overflowY: "auto", padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
      <div>
        <label style={labelStyle}>nome</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="ex: Muçarela fatiada"
          style={inputStyle}
          autoFocus
        />
      </div>

      <div>
        <label style={labelStyle}>unidade de medida</label>
        <select value={unit} onChange={(e) => setUnit(e.target.value)} style={inputStyle}>
          {UNIT_OPTIONS.map((u) => (
            <option key={u} value={u}>{u}</option>
          ))}
        </select>
      </div>

      <div>
        <label style={labelStyle}>quantidade mínima</label>
        <input
          type="number"
          min="0"
          step="any"
          value={minQuantity}
          onChange={(e) => setMinQuantity(e.target.value)}
          style={inputStyle}
        />
      </div>

      <div>
        <label style={labelStyle}>categorias</label>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 6 }}>
          {categories.map((c) => (
            <label key={c.id} style={checkboxRowStyle}>
              <input
                type="checkbox"
                checked={categoryIds.has(c.id)}
                onChange={() => toggleCategory(c.id)}
                style={{ width: 18, height: 18 }}
              />
              <span style={{ fontFamily: "var(--font-body)", fontSize: 14 }}>{c.name}</span>
            </label>
          ))}
        </div>
      </div>

      {error && (
        <div style={{ color: "var(--tr-alert)", fontSize: 13, fontFamily: "var(--font-body)" }}>{error}</div>
      )}

      <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
        <button type="button" onClick={onCancel} style={cancelBtnStyle}>
          cancelar
        </button>
        <button type="submit" disabled={saving} style={{ ...saveBtnStyle, opacity: saving ? 0.6 : 1 }}>
          {saving ? "salvando…" : "salvar"}
        </button>
      </div>
    </form>
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

const newBtnStyle = {
  width: "100%",
  padding: "12px 0",
  borderRadius: 8,
  border: "none",
  background: "var(--tr-orange)",
  color: "#fff",
  fontFamily: "var(--font-body)",
  fontWeight: 600,
  fontSize: 14,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  cursor: "pointer",
};

const cardStyle = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 10,
  background: "#fff",
  border: "1px solid var(--tr-line)",
  borderRadius: 10,
  padding: "12px 14px",
};

const inactiveBadgeStyle = {
  fontFamily: "var(--font-body)",
  fontSize: 10,
  fontWeight: 600,
  textTransform: "uppercase",
  color: "var(--tr-ink-soft)",
  border: "1px solid var(--tr-line)",
  borderRadius: 4,
  padding: "1px 5px",
};

const chipStyle = {
  fontFamily: "var(--font-body)",
  fontSize: 11,
  color: "var(--tr-black)",
  borderRadius: 20,
  padding: "2px 8px",
};

const rowIconBtnStyle = {
  background: "none",
  border: "1px solid var(--tr-line)",
  borderRadius: 6,
  padding: 6,
  cursor: "pointer",
  display: "flex",
};

const labelStyle = {
  display: "block",
  fontFamily: "var(--font-body)",
  fontSize: 12,
  color: "var(--tr-ink-soft)",
  marginBottom: 4,
  textTransform: "uppercase",
  letterSpacing: 0.4,
};

const inputStyle = {
  width: "100%",
  height: 46,
  padding: "0 14px",
  borderRadius: 8,
  border: "1px solid var(--tr-line)",
  fontSize: 14,
  outline: "none",
  background: "#fff",
};

const checkboxRowStyle = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  cursor: "pointer",
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

const saveBtnStyle = {
  flex: 2,
  padding: "12px 0",
  borderRadius: 8,
  border: "none",
  background: "var(--tr-black)",
  color: "var(--tr-yellow)",
  fontFamily: "var(--font-body)",
  fontWeight: 600,
  fontSize: 14,
  cursor: "pointer",
};