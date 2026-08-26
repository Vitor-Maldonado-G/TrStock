import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";
import { ArrowLeft, LogOut, Plus, Pencil, Eye, EyeOff } from "lucide-react";

const ROLE_OPTIONS = ["contador", "gerente"];

export default function GerenteFuncionarios() {
  const { signOut, profile: myProfile } = useAuth();
  const navigate = useNavigate();

  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // null = lista visível; {} = criando; funcionário = editando
  const [formState, setFormState] = useState(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    setError("");

    const { data, error: loadError } = await supabase
      .from("profiles")
      .select("id, name, role, active")
      .order("name");

    if (loadError) {
      setError("Não foi possível carregar os funcionários.");
    } else {
      setEmployees(data);
    }
    setLoading(false);
  }

  async function toggleActive(employee) {
    const { error: toggleError } = await supabase
      .from("profiles")
      .update({ active: !employee.active })
      .eq("id", employee.id);
    if (!toggleError) load();
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
            {formState ? (formState.id ? "EDITAR FUNCIONÁRIO" : "NOVO FUNCIONÁRIO") : "FUNCIONÁRIOS"}
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
        <EmployeeForm
          key={formState.id || "new"}
          employee={formState}
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
              <Plus size={16} /> novo funcionário
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
            {employees.map((emp) => {
              const isSelf = emp.id === myProfile?.id;
              return (
                <div key={emp.id} style={{ ...cardStyle, opacity: emp.active ? 1 : 0.55 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontFamily: "var(--font-body)", fontWeight: 600, fontSize: 15 }}>{emp.name}</span>
                      {!emp.active && <span style={inactiveBadgeStyle}>inativo</span>}
                      {isSelf && <span style={selfBadgeStyle}>você</span>}
                    </div>
                    <div
                      style={{
                        ...roleChipStyle,
                        background: emp.role === "gerente" ? "var(--tr-orange-bg)" : "var(--tr-yellow-bg)",
                        marginTop: 6,
                      }}
                    >
                      {emp.role}
                    </div>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 }}>
                    <button onClick={() => setFormState(emp)} style={rowIconBtnStyle} title="editar">
                      <Pencil size={16} color="var(--tr-black)" />
                    </button>
                    <button
                      onClick={() => toggleActive(emp)}
                      disabled={isSelf}
                      style={{ ...rowIconBtnStyle, opacity: isSelf ? 0.4 : 1, cursor: isSelf ? "not-allowed" : "pointer" }}
                      title={isSelf ? "não é possível desativar sua própria conta" : emp.active ? "desativar" : "reativar"}
                    >
                      {emp.active ? <EyeOff size={16} color="var(--tr-ink-soft)" /> : <Eye size={16} color="var(--tr-ok)" />}
                    </button>
                  </div>
                </div>
              );
            })}

            {!loading && !error && employees.length === 0 && (
              <div style={{ padding: 20, fontFamily: "var(--font-body)", fontSize: 13, color: "var(--tr-ink-soft)", textAlign: "center" }}>
                Nenhum funcionário cadastrado ainda.
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ---- formulário de criar/editar ----

function EmployeeForm({ employee, onCancel, onSaved }) {
  const isEditing = Boolean(employee.id);

  const [name, setName] = useState(employee.name || "");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState(employee.role || ROLE_OPTIONS[0]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Informe o nome.");
      return;
    }

    setSaving(true);

    if (isEditing) {
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ name: trimmedName, role })
        .eq("id", employee.id);
      if (updateError) {
        setError("Não foi possível salvar. " + updateError.message);
        setSaving(false);
        return;
      }
      setSaving(false);
      onSaved();
      return;
    }

    // criação: precisa da Edge Function (usa a service role key no servidor,
    // não dá pra criar login direto do frontend).
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setError("Informe e-mail e senha provisória.");
      setSaving(false);
      return;
    }
    if (password.length < 6) {
      setError("A senha precisa ter pelo menos 6 caracteres.");
      setSaving(false);
      return;
    }

    const { data, error: invokeError } = await supabase.functions.invoke("create-employee", {
      body: { name: trimmedName, email: trimmedEmail, password, role },
    });

    if (invokeError) {
      // quando a função devolve status de erro (400/401/403/500), o corpo JSON
      // não vem em "data" — precisa ler de invokeError.context pra pegar a
      // mensagem específica que a Edge Function mandou
      let message = invokeError.message;
      try {
        const body = await invokeError.context.json();
        if (body?.error) message = body.error;
      } catch {
        // se não der pra ler o corpo, fica com a mensagem genérica mesmo
      }
      setError("Não foi possível criar. " + message);
      setSaving(false);
      return;
    }

    if (data?.error) {
      setError("Não foi possível criar. " + data.error);
      setSaving(false);
      return;
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
          placeholder="ex: Maria Silva"
          style={inputStyle}
          autoFocus
        />
      </div>

      {!isEditing && (
        <>
          <div>
            <label style={labelStyle}>e-mail de login</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="funcionario@exemplo.com"
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>senha provisória</label>
            <input
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="mínimo 6 caracteres"
              style={inputStyle}
            />
          </div>
        </>
      )}

      <div>
        <label style={labelStyle}>papel</label>
        <select value={role} onChange={(e) => setRole(e.target.value)} style={inputStyle}>
          {ROLE_OPTIONS.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
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

const selfBadgeStyle = {
  fontFamily: "var(--font-body)",
  fontSize: 10,
  fontWeight: 600,
  textTransform: "uppercase",
  color: "var(--tr-black)",
  background: "var(--tr-yellow)",
  borderRadius: 4,
  padding: "1px 5px",
};

const roleChipStyle = {
  display: "inline-block",
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