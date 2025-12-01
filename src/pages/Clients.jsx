// src/pages/Clients.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useUnsavedContext } from '../providers/UnsavedChangesProvider.jsx';
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
  Plus, Pencil, Trash2, UserRound, Download, RotateCcw, ArrowLeft, MoreHorizontal
} from "lucide-react";
import { Link } from "react-router-dom";
import Brand from "../components/Brand.jsx";

const STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY","DC"
];

// Helper: iniciales para avatar
const initials = (name) => {
  if (!name) return "—";
  return name.split(/\s+/).map(s => s[0]).filter(Boolean).slice(0,2).join('').toUpperCase();
}

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
  const [openMenuFor, setOpenMenuFor] = useState(null);
  const longPressTimers = React.useRef({});
  React.useEffect(() => {
    const onDocClick = (e) => {
      // if click outside any dropdown, close open menu
      const inside = e.target.closest && e.target.closest('.dropdown');
      if (!inside) setOpenMenuFor(null);
    };
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, []);
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
    const ok = await confirmAction({ title: 'Archivar cliente', text: `¿Seguro que quieres archivar a "${client.fullName}"?`, confirmText: 'Archivar', cancelText: 'Cancelar', icon: 'warning' });
    if (!ok) return;
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
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button type="button" className="btn btn-ghost btn-square btn-sm mr-1" onClick={() => window.history.back()} title="Volver">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <UserRound className="w-6 h-6 text-primary" />
          <h1 className="text-xl font-semibold">Clientes</h1>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <label className="label cursor-pointer mr-1 flex-shrink-0">
            <span className="label-text mr-2 text-sm">Ver archivados</span>
            <input
              type="checkbox"
              className="toggle toggle-sm"
              checked={showArchived}
              onChange={(e)=>setShowArchived(e.target.checked)}
            />
          </label>

          <input
            className="input input-sm input-bordered w-full md:w-60"
            placeholder="Buscar cliente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <button
            className="btn btn-sm btn-outline gap-2 whitespace-nowrap"
            onClick={() => downloadCSV(filtered)}
            disabled={filtered.length === 0}
            title="Exportar CSV"
          >
            <Download className="w-4 h-4" /> Export
          </button>

          <button className="btn btn-sm btn-primary gap-2 whitespace-nowrap" onClick={onAdd} aria-label="Nuevo cliente">
            <Plus className="w-4 h-4" /> <span className="hidden md:inline">Nuevo</span>
          </button>
        </div>
      </div>

      {uiError && <div className="alert alert-warning">{uiError}</div>}

      {/* Responsive list: cards for mobile, table for desktop */}
      <div className="md:hidden space-y-3">
        {loading && (
          <div className="animate-pulse space-y-2">
            <div className="h-12 bg-base-300 rounded" />
            <div className="h-12 bg-base-300 rounded" />
          </div>
        )}

        {!loading && filtered.map((c) => (
          <div key={c.id} className="card bg-base-100 p-3 rounded-lg shadow-md border border-base-300 hover:shadow-lg hover:ring-1 hover:ring-primary/10 transition transform hover:-translate-y-0.5 relative overflow-hidden">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-primary to-secondary text-base-100 font-semibold shadow flex-shrink-0">{initials(c.fullName)}</div>
                <div className="min-w-0">
                  <Link to={`/clients/${c.id}`} className="text-lg font-semibold block truncate">{c.fullName}</Link>
                  <div className="text-xs opacity-60 mt-1">{c.state} · ZIP {c.zip}</div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {c.active ? (
                  <span className="badge badge-sm badge-success">Activo</span>
                ) : (
                  <span className="badge badge-sm badge-ghost">Archivado</span>
                )}

                <div className={`dropdown dropdown-end ${openMenuFor === c.id ? 'dropdown-open' : ''}`}>
                  <label
                    tabIndex={0}
                    className="btn btn-ghost btn-xs btn-circle"
                    aria-label="Acciones"
                    onClick={(e) => { e.stopPropagation(); setOpenMenuFor(prev => prev === c.id ? null : c.id); }}
                    onPointerDown={() => {
                      // start long-press only on mobile widths
                      if (typeof window === 'undefined' || window.innerWidth >= 768) return;
                      longPressTimers.current[c.id] = setTimeout(() => setOpenMenuFor(c.id), 600);
                    }}
                    onPointerUp={() => {
                      if (longPressTimers.current[c.id]) { clearTimeout(longPressTimers.current[c.id]); delete longPressTimers.current[c.id]; }
                    }}
                    onPointerLeave={() => {
                      if (longPressTimers.current[c.id]) { clearTimeout(longPressTimers.current[c.id]); delete longPressTimers.current[c.id]; }
                    }}
                  >
                    <MoreHorizontal className="w-4 h-4" />
                  </label>
                  <ul tabIndex={0} className="dropdown-content menu p-2 shadow bg-base-100 rounded-box w-44">
                    {!showArchived && (
                      <li><Link to={`/paystubs?client=${c.id}`}><UserRound className="w-4 h-4 mr-2 inline-block"/>Ver paystubs</Link></li>
                    )}
                    {!showArchived && (
                      <li><button onClick={() => onEdit(c)}><Pencil className="w-4 h-4 mr-2 inline-block"/>Editar</button></li>
                    )}
                    {showArchived ? (
                      <li><button onClick={() => onRestore(c)}><RotateCcw className="w-4 h-4 mr-2 inline-block"/>Restaurar</button></li>
                    ) : (
                      <li><button className="text-error" onClick={() => onSoftDelete(c)}><Trash2 className="w-4 h-4 mr-2 inline-block"/>Archivar</button></li>
                    )}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        ))}

        {!loading && filtered.length === 0 && (
          <div className="card p-6 text-center opacity-80">
            <div className="flex flex-col items-center gap-3">
              <Brand variant="undraw" size="md" className="max-w-[160px]" />
              <div className="text-sm">No hay resultados.</div>
            </div>
          </div>
        )}
      </div>

      {/* Desktop cards (grid) */}
      <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading && (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card p-4 bg-base-100 rounded-lg shadow-sm animate-pulse border border-base-300">
              <div className="h-4 bg-base-300 rounded w-1/3 mb-2"></div>
              <div className="h-3 bg-base-300 rounded w-1/2"></div>
            </div>
          ))
        )}

        {!loading && filtered.map((c) => (
          <div key={c.id} className="card bg-base-100 p-4 rounded-lg shadow-sm border border-base-300 hover:shadow-lg hover:ring-1 hover:ring-primary/10 transition flex items-start justify-between">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-primary to-secondary text-base-100 font-semibold shadow flex-shrink-0">{initials(c.fullName)}</div>
              <div className="flex-1 min-w-0">
                <Link to={`/clients/${c.id}`} className="text-lg font-semibold block truncate">{c.fullName}</Link>
                <div className="text-xs opacity-70 truncate mt-1">{c.address}</div>
                <div className="text-xs opacity-60 mt-2">{c.state} · ZIP {c.zip}</div>
              </div>
            </div>
            <div className="text-right ml-4 flex flex-col items-end">
              <div className="text-sm opacity-80">•••• {c.ssnLast4}</div>
              <div className="text-sm opacity-80">•••• {c.accountLast4}</div>
              <div className="flex items-center justify-end gap-2 mt-3">
                {/* Desktop: show inline icon actions */}
                <div className="hidden md:flex items-center gap-2">
                  {!showArchived && (
                    <div className="tooltip" data-tip="Ver paystubs">
                      <Link to={`/paystubs?client=${c.id}`} className="btn btn-ghost btn-xs btn-circle" aria-label="Ver paystubs"><UserRound className="w-4 h-4" /></Link>
                    </div>
                  )}

                  {!showArchived && (
                    <div className="tooltip" data-tip="Editar">
                      <button className="btn btn-ghost btn-xs btn-circle" onClick={() => onEdit(c)} aria-label="Editar cliente"><Pencil className="w-4 h-4" /></button>
                    </div>
                  )}

                  {showArchived ? (
                    <div className="tooltip" data-tip="Restaurar">
                      <button className="btn btn-ghost btn-xs btn-circle btn-success" onClick={() => onRestore(c)} aria-label="Restaurar cliente"><RotateCcw className="w-4 h-4" /></button>
                    </div>
                  ) : (
                    <div className="tooltip" data-tip="Archivar">
                      <button className="btn btn-ghost btn-xs btn-circle text-error" onClick={() => onSoftDelete(c)} aria-label="Archivar cliente"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  )}
                </div>

                {/* Mobile/tablet: keep dropdown compact */}
                <div className="md:hidden">
                  <div className="dropdown dropdown-end">
                    <label tabIndex={0} className="btn btn-ghost btn-xs btn-circle" aria-label="Acciones">
                      <MoreHorizontal className="w-4 h-4" />
                    </label>
                    <ul tabIndex={0} className="dropdown-content menu p-2 shadow bg-base-100 rounded-box w-48">
                      <li><Link to={`/paystubs?client=${c.id}`}>Ver paystubs</Link></li>
                      <li><button onClick={() => onEdit(c)}>Editar</button></li>
                      {showArchived ? (
                        <li><button onClick={() => onRestore(c)}>Restaurar</button></li>
                      ) : (
                        <li><button className="text-error" onClick={() => onSoftDelete(c)}>Archivar</button></li>
                      )}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}

        {!loading && filtered.length === 0 && (
          <div className="col-span-full card p-6 text-center opacity-80 border border-base-300 rounded-lg">
            <div className="flex flex-col items-center gap-3">
              <Brand variant="undraw" size="lg" className="max-w-xs" />
              <div className="text-sm">No hay resultados.</div>
            </div>
          </div>
        )}
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
  const { markDirty, clearDirty, confirmIfDirty } = useUnsavedContext();
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
    clearDirty();
    onClose();
  };
  const handleClose = async () => {
    const ok = await confirmIfDirty();
    if (ok) onClose();
  };

  return (
    <dialog className="modal modal-open">
      <div className="modal-box">
        <h3 className="font-bold text-lg mb-4">
          {isEdit ? "Editar cliente" : "Nuevo cliente"}
        </h3>

        <form className="grid gap-3" onSubmit={handleSubmit(onSubmit)} onChange={() => markDirty(true)}>
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
            <button type="button" className="btn" onClick={handleClose}>Cancelar</button>
            <button className="btn btn-primary" disabled={isSubmitting}>
              {isEdit ? "Guardar" : "Crear"}
            </button>
          </div>
        </form>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button onClick={handleClose}>close</button>
      </form>
    </dialog>
  );
}
