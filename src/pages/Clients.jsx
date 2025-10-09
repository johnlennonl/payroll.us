// src/pages/Clients.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { db } from "../lib/firebase";
import {
  collection,
  addDoc,
  serverTimestamp,
  onSnapshot,
  query,
  where,
  orderBy,
  updateDoc,
  doc,
} from "firebase/firestore";
import {
  Plus, Pencil, Trash2, UserRound, Download, RotateCcw
} from "lucide-react";
import { Link } from "react-router-dom";

const STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY","DC"
];

// Helper: descargar CSV de la lista filtrada
function downloadCSV(rows, filename = "clientes.csv") {
  const headers = ["Nombre","Direccion","Estado","ZIP","SSN_last4","Cuenta_last4"];
  const lines = rows.map(c => [
    c.fullName, c.address, c.state, c.zip, c.ssnLast4, c.accountLast4
  ]
    .map(v => `"${String(v ?? "").replace(/"/g,'""')}"`)
    .join(",")
  );
  const csv = [headers.join(","), ...lines].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export default function Clients() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [uiError, setUiError] = useState("");

  // cargar en tiempo real (activos o archivados según toggle)
  useEffect(() => {
    setLoading(true);
    setUiError("");
    const q = query(
      collection(db, "clients"),
      where("active", "==", !showArchived),
      orderBy("createdAt", "desc")
    );
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setClients(data);
      setLoading(false);
    }, (err) => {
      console.error(err);
      setUiError(err?.message || "No se pudo cargar clientes.");
      setLoading(false);
    });
    return () => unsub();
  }, [showArchived]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return clients;
    return clients.filter((c) =>
      [c.fullName, c.address, c.state, c.zip, c.ssnLast4, c.accountLast4]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(s))
    );
  }, [clients, search]);

  const onAdd = () => { setEditing(null); setOpen(true); };
  const onEdit = (client) => { setEditing(client); setOpen(true); };

  const onSoftDelete = async (client) => {
    if (!confirm(`¿Seguro que quieres archivar a "${client.fullName}"?`)) return;
    await updateDoc(doc(db, "clients", client.id), {
      active: false,
      updatedAt: serverTimestamp(),
    });
  };

  const onRestore = async (client) => {
    await updateDoc(doc(db, "clients", client.id), {
      active: true,
      updatedAt: serverTimestamp(),
    });
  };

  return (
    <div className="space-y-4">
      {/* header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <UserRound className="w-6 h-6 text-primary" />
          <h1 className="text-xl font-semibold">Clientes</h1>
        </div>

        <div className="flex items-center gap-2">
          <label className="label cursor-pointer mr-1">
            <span className="label-text mr-2 text-sm">Ver archivados</span>
            <input
              type="checkbox"
              className="toggle toggle-sm"
              checked={showArchived}
              onChange={(e)=>setShowArchived(e.target.checked)}
            />
          </label>

          <input
            className="input input-sm input-bordered w-60"
            placeholder="Buscar cliente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <button
            className="btn btn-sm btn-outline gap-2"
            onClick={() => downloadCSV(filtered)}
            disabled={filtered.length === 0}
            title="Exportar CSV"
          >
            <Download className="w-4 h-4" /> Export
          </button>

          <button className="btn btn-sm btn-primary gap-2" onClick={onAdd}>
            <Plus className="w-4 h-4" /> Nuevo
          </button>
        </div>
      </div>

      {uiError && <div className="alert alert-warning">{uiError}</div>}

      {/* tabla */}
        <div className="overflow-x-auto bg-base-100 rounded-xl">
          <table className="table">
            <thead>
          <tr>
            <th>Nombre</th>
            <th>Dirección</th>
            <th>Estado</th>
            <th>ZIP</th>
            <th>SSN (últ. 4)</th>
            <th>Cuenta (últ. 4)</th>
            <th></th>
          </tr>
            </thead>
            <tbody>
          {loading && (
            <tr>
              <td colSpan={7}>
            <div className="p-6 animate-pulse flex gap-6">
              <div className="h-4 bg-base-300 rounded w-1/5"></div>
              <div className="h-4 bg-base-300 rounded w-2/5"></div>
              <div className="h-4 bg-base-300 rounded w-1/6"></div>
            </div>
              </td>
            </tr>
          )}

          {!loading && filtered.map((c) => (
            <tr
              key={c.id}
              className="hover transition-colors duration-150"
              style={{
            cursor: "pointer",
              }}
              onMouseEnter={e => {
            e.currentTarget.style.backgroundColor = "var(--tw-prose-primary, #a78bfa)";
            e.currentTarget.style.color = "#fff";
              }}
              onMouseLeave={e => {
            e.currentTarget.style.backgroundColor = "";
            e.currentTarget.style.color = "";
              }}
            >
              <td className="font-medium">
            <Link to={`/clients/${c.id}`} className="link link-hover">{c.fullName}</Link>
              </td>
              <td>{c.address}</td>
              <td>{c.state}</td>
              <td>{c.zip}</td>
              <td>•••• {c.ssnLast4}</td>
              <td>•••• {c.accountLast4}</td>
              <td className="text-right">
            <div className="flex justify-end gap-2">
              {showArchived ? (
                <button className="btn btn-xs btn-success gap-1" onClick={() => onRestore(c)}>
              <RotateCcw className="w-4 h-4" /> Restaurar
                </button>
              ) : (
                <>
              <button className="btn btn-xs gap-1" onClick={() => onEdit(c)}>
                <Pencil className="w-4 h-4" /> Editar
              </button>
              <button className="btn btn-xs btn-outline btn-error gap-1" onClick={() => onSoftDelete(c)}>
                <Trash2 className="w-4 h-4" /> Archivar
              </button>
                </>
              )}
            </div>
              </td>
            </tr>
          ))}

          {!loading && filtered.length === 0 && (
            <tr>
              <td colSpan={7} className="text-center opacity-60 py-10">
            No hay resultados.
              </td>
            </tr>
          )}
            </tbody>
          </table>
        </div>

        {/* modal */}
      {open && (
        <ClientModal onClose={() => setOpen(false)} initial={editing} />
      )}
    </div>
  );
}

/** Modal crear/editar cliente */
function ClientModal({ onClose, initial }) {
  const isEdit = !!initial;
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    setValue,
  } = useForm({
    defaultValues: {
      fullName: initial?.fullName ?? "",
      address: initial?.address ?? "",
      state: initial?.state ?? "",
      zip: initial?.zip ?? "",
      ssnLast4: initial?.ssnLast4 ?? "",
      accountLast4: initial?.accountLast4 ?? "",
    },
  });

  useEffect(() => {
    if (initial?.state) setValue("state", String(initial.state).toUpperCase());
  }, [initial, setValue]);

  const onSubmit = async (values) => {
    const payload = {
      fullName: values.fullName.trim(),
      address: values.address.trim(),
      state: values.state.trim().toUpperCase(),
      zip: values.zip.trim(),
      ssnLast4: values.ssnLast4.trim(),
      accountLast4: values.accountLast4.trim(),
      updatedAt: serverTimestamp(),
    };

    if (isEdit) {
      await updateDoc(doc(db, "clients", initial.id), payload);
    } else {
      await addDoc(collection(db, "clients"), {
        ...payload,
        active: true,
        createdAt: serverTimestamp(),
      });
    }
    reset();
    onClose();
  };

  return (
    <dialog className="modal modal-open">
      <div className="modal-box">
        <h3 className="font-bold text-lg mb-4">
          {isEdit ? "Editar cliente" : "Nuevo cliente"}
        </h3>

        <form className="grid gap-3" onSubmit={handleSubmit(onSubmit)}>
          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <label className="label label-text">Nombre completo</label>
              <input
                className="input input-bordered w-full"
                {...register("fullName", {
                  required: "Nombre requerido",
                  minLength: { value: 3, message: "Mínimo 3 caracteres" },
                })}
              />
              {errors.fullName && <p className="text-error text-xs mt-1">{errors.fullName.message}</p>}
            </div>

            <div>
              <label className="label label-text">Estado (US)</label>
              <select
                className="select select-bordered w-full"
                {...register("state", {
                  required: "Estado requerido",
                  validate: (v) => STATES.includes(v.toUpperCase()) || "Estado inválido",
                })}
                onChange={(e)=> e.target.value = e.target.value.toUpperCase()}
              >
                <option value="" disabled>Selecciona…</option>
                {STATES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              {errors.state && <p className="text-error text-xs mt-1">{errors.state.message}</p>}
            </div>
          </div>

          <div>
            <label className="label label-text">Dirección</label>
            <input
              className="input input-bordered w-full"
              {...register("address", { required: "Dirección requerida" })}
            />
            {errors.address && <p className="text-error text-xs mt-1">{errors.address.message}</p>}
          </div>

          <div className="grid md:grid-cols-3 gap-3">
            <div>
              <label className="label label-text">ZIP</label>
              <input
                className="input input-bordered w-full"
                {...register("zip", {
                  required: "ZIP requerido",
                  pattern: { value: /^\d{5}$/, message: "ZIP debe ser 5 dígitos" },
                })}
                inputMode="numeric"
                maxLength={5}
                onInput={(e)=> e.target.value = e.target.value.replace(/\D/g,"").slice(0,5)}
              />
              {errors.zip && <p className="text-error text-xs mt-1">{errors.zip.message}</p>}
            </div>

            <div>
              <label className="label label-text">SSN (últimos 4)</label>
              <input
                className="input input-bordered w-full"
                {...register("ssnLast4", {
                  required: "Requerido",
                  pattern: { value: /^\d{4}$/, message: "Debe ser 4 dígitos" },
                })}
                inputMode="numeric"
                maxLength={4}
                onInput={(e)=> e.target.value = e.target.value.replace(/\D/g,"").slice(0,4)}
              />
              {errors.ssnLast4 && <p className="text-error text-xs mt-1">{errors.ssnLast4.message}</p>}
            </div>

            <div>
              <label className="label label-text">Cuenta (últimos 4)</label>
              <input
                className="input input-bordered w-full"
                {...register("accountLast4", {
                  required: "Requerido",
                  pattern: { value: /^\d{4}$/, message: "Debe ser 4 dígitos" },
                })}
                inputMode="numeric"
                maxLength={4}
                onInput={(e)=> e.target.value = e.target.value.replace(/\D/g,"").slice(0,4)}
              />
              {errors.accountLast4 && <p className="text-error text-xs mt-1">{errors.accountLast4.message}</p>}
            </div>
          </div>

          <div className="modal-action">
            <button type="button" className="btn" onClick={onClose}>Cancelar</button>
            <button className="btn btn-primary" disabled={isSubmitting}>
              {isEdit ? "Guardar" : "Crear"}
            </button>
          </div>
        </form>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button onClick={onClose}>close</button>
      </form>
    </dialog>
  );
}
