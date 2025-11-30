import React, { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { db } from "../lib/firebase";
import {
  collection, addDoc, updateDoc, deleteDoc, doc,
  serverTimestamp, onSnapshot, query, orderBy
} from "firebase/firestore";
import { Shield, Plus, Pencil, Trash2, CheckCircle2 } from "lucide-react";

const STATUS = ["active", "expired", "pending", "cancelled"];

export default function Insurance() {
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  // Realtime: trae activas primero y recientes
  useEffect(() => {
    const q = query(
      collection(db, "insurances"),
      orderBy("status"), // active primero por orden alfabético
      orderBy("createdAt", "desc")
    );
    const unsub = onSnapshot(q, snap => {
      setRows(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter(r =>
      [r.holderName, r.carrier, r.policyNumber, r.state, r.status]
        .filter(Boolean)
        .some(v => String(v).toLowerCase().includes(s))
    );
  }, [rows, search]);

  const onAdd = () => { setEditing(null); setOpen(true); };
  const onEdit = (row) => { setEditing(row); setOpen(true); };

  const onDelete = async (row) => {
    if (!confirm(`¿Eliminar póliza ${row.policyNumber || ""}?`)) return;
    await deleteDoc(doc(db, "insurances", row.id));
  };

  const onArchive = async (row) => {
    await updateDoc(doc(db, "insurances", row.id), {
      status: "cancelled",
      updatedAt: serverTimestamp(),
    });
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Shield className="w-6 h-6 text-accent" />
          <h1 className="text-xl font-semibold">Insurance</h1>
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto">
          <input
            className="input input-sm input-bordered w-full md:w-64"
            placeholder="Buscar (titular, carrier, # póliza, estado)"
            value={search}
            onChange={(e)=>setSearch(e.target.value)}
          />
          <button className="btn btn-sm btn-accent gap-2 whitespace-nowrap" onClick={onAdd}>
            <Plus className="w-4 h-4" /> Nueva póliza
          </button>
        </div>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {filtered.map((r) => (
          <div key={r.id} className="card bg-base-100 p-3 rounded shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="font-medium truncate">{r.holderName} {r.status === 'active' ? <span title="Registrado" className="inline-block w-2 h-2 rounded-full bg-green-500 ml-2" /> : null}</div>
                <div className="text-xs opacity-70">{r.carrier} · #{r.policyNumber}</div>
                <div className="text-xs opacity-60 mt-1">{r.year} {r.make} {r.model} · VIN {r.vin}</div>
                <div className="text-xs opacity-60 mt-1 truncate">{r.address}</div>
              </div>
              <div className="text-right">
                <div className="text-sm"><span className="font-semibold">{r.status}</span></div>
                <div className="text-xs opacity-70">{r.startDate} → {r.endDate}</div>
                <div className="text-sm mt-1">${Number(r.premium || 0).toFixed(2)}</div>
                <div className="flex items-center justify-end gap-2 mt-2">
                  {r.status !== "active" ? (
                    <button className="btn btn-xs btn-outline" onClick={()=>updateDoc(doc(db, "insurances", r.id), { status: "active", updatedAt: serverTimestamp() })} title="Marcar activa"><CheckCircle2 className="w-4 h-4" /></button>
                  ) : null}
                  <button className="btn btn-xs" onClick={()=>onEdit(r)}><Pencil className="w-4 h-4" /></button>
                  <button className="btn btn-xs btn-outline" onClick={()=>onArchive(r)}>Archivar</button>
                  <button className="btn btn-xs btn-outline btn-error" onClick={()=>onDelete(r)}><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="card p-6 text-center opacity-60">Sin resultados.</div>
        )}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto bg-base-100 rounded-xl">
        <table className="table">
          <thead>
            <tr>
                <th>Titular</th>
                  <th>Carrier</th>
                  <th># Póliza</th>
                  <th>VIN</th>
                  <th>Auto</th>
                  <th>Dirección</th>
                  <th>Estado (US)</th>
                  <th>Vigencia</th>
                  <th>Status</th>
                  <th>Prima</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="hover">
                <td className="font-medium">{r.holderName} {r.status === 'active' ? <span title="Registrado" className="inline-block w-2 h-2 rounded-full bg-green-500 ml-2" /> : null}</td>
                <td>{r.carrier}</td>
                <td>{r.policyNumber}</td>
                <td>{r.vin}</td>
                <td>{r.year} / {r.make} / {r.model}</td>
                <td style={{maxWidth:220}}>{r.address}</td>
                <td>{r.state}</td>
                <td>{r.startDate} → {r.endDate}</td>
                <td>
                  <span className={`badge ${
                    r.status === "active" ? "badge-success" :
                    r.status === "pending" ? "badge-info" :
                    r.status === "expired" ? "badge-warning" : "badge-ghost"
                  }`}>
                    {r.status}
                  </span>
                </td>
                <td>${Number(r.premium || 0).toFixed(2)}</td>
                <td className="text-right">
                  <div className="flex justify-end gap-2">
                    {r.status !== "active" ? (
                      <button
                        className="btn btn-xs btn-outline"
                        onClick={()=>updateDoc(doc(db, "insurances", r.id), { status: "active", updatedAt: serverTimestamp() })}
                        title="Marcar activa"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                      </button>
                    ) : null}
                    <button className="btn btn-xs" onClick={()=>onEdit(r)}>
                      <Pencil className="w-4 h-4" /> Editar
                    </button>
                    <button className="btn btn-xs btn-outline" onClick={()=>onArchive(r)}>
                      Archivar
                    </button>
                    <button className="btn btn-xs btn-outline btn-error" onClick={()=>onDelete(r)}>
                      <Trash2 className="w-4 h-4" /> Borrar
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={8} className="text-center opacity-60 py-8">Sin resultados.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {open && (
        <PolicyModal
          initial={editing}
          onClose={()=>setOpen(false)}
        />
      )}
    </div>
  );
}

/* ====== Modal crear/editar póliza ====== */
function PolicyModal({ initial, onClose }) {
  const isEdit = !!initial;
  const { register, handleSubmit, formState:{ errors, isSubmitting }, reset } = useForm({
          defaultValues: {
      holderName:  initial?.holderName  ?? "",
      carrier:     initial?.carrier     ?? "",
      policyNumber: initial?.policyNumber?? "",
      vin:          initial?.vin         ?? "",
      year:         initial?.year        ?? "",
      make:         initial?.make        ?? "",
      model:        initial?.model       ?? "",
      address:      initial?.address     ?? "",
      state:       initial?.state       ?? "",
      startDate:   initial?.startDate   ?? "",
      endDate:     initial?.endDate     ?? "",
      premium:     initial?.premium     ?? "",
      status:      initial?.status      ?? "active", // active | expired | pending | cancelled
    }
  });

  const onSubmit = async (v) => {
    const payload = {
      holderName: v.holderName.trim(),
      carrier: v.carrier.trim(),
      policyNumber: v.policyNumber.trim(),
      vin: v.vin?.trim() || "",
      year: v.year || "",
      make: v.make?.trim() || "",
      model: v.model?.trim() || "",
      address: v.address?.trim() || "",
      state: v.state.trim().toUpperCase(),
      startDate: v.startDate,
      endDate: v.endDate,
      premium: Number(v.premium || 0),
      status: v.status,
      updatedAt: serverTimestamp(),
    };

    if (isEdit) {
      await updateDoc(doc(db, "insurances", initial.id), payload);
    } else {
      await addDoc(collection(db, "insurances"), {
        ...payload,
        createdAt: serverTimestamp(),
      });
    }
    reset();
    onClose();
  };

  return (
    <dialog className="modal modal-open">
      <div className="modal-box max-w-2xl">
        <h3 className="font-bold text-lg mb-4">
          {isEdit ? "Editar póliza" : "Nueva póliza"}
        </h3>

        <form className="grid gap-3" onSubmit={handleSubmit(onSubmit)}>
          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <label className="label label-text">Titular</label>
              <input className="input input-bordered w-full"
                {...register("holderName",{ required:"Requerido" })}
              />
              {errors.holderName && <p className="text-error text-xs mt-1">{errors.holderName.message}</p>}
            </div>
            <div>
              <label className="label label-text">Carrier</label>
              <input className="input input-bordered w-full"
                {...register("carrier",{ required:"Requerido" })}
              />
              {errors.carrier && <p className="text-error text-xs mt-1">{errors.carrier.message}</p>}
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-3">
            <div>
              <label className="label label-text"># Póliza</label>
              <input className="input input-bordered w-full"
                {...register("policyNumber",{ required:"Requerido" })}
              />
              {errors.policyNumber && <p className="text-error text-xs mt-1">{errors.policyNumber.message}</p>}
            </div>
            <div>
              <label className="label label-text">Estado (US)</label>
              <input className="input input-bordered w-full uppercase"
                {...register("state",{ required:"Requerido" })}
              />
              {errors.state && <p className="text-error text-xs mt-1">{errors.state.message}</p>}
            </div>
            <div>
              <label className="label label-text">Prima ($)</label>
              <input className="input input-bordered w-full" inputMode="decimal"
                {...register("premium",{ required:"Requerido" })}
              />
              {errors.premium && <p className="text-error text-xs mt-1">{errors.premium.message}</p>}
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-3">
            <div>
              <label className="label label-text">Inicio</label>
              <input className="input input-bordered w-full" placeholder="YYYY-MM-DD"
                {...register("startDate",{ required:"Requerido" })}
              />
              {errors.startDate && <p className="text-error text-xs mt-1">{errors.startDate.message}</p>}
            </div>
            <div>
              <label className="label label-text">Fin</label>
              <input className="input input-bordered w-full" placeholder="YYYY-MM-DD"
                {...register("endDate",{ required:"Requerido" })}
              />
              {errors.endDate && <p className="text-error text-xs mt-1">{errors.endDate.message}</p>}
            </div>
            <div>
              <label className="label label-text">Status</label>
              <select className="select select-bordered w-full" {...register("status")}>
                {STATUS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div className="modal-action">
            <button type="button" className="btn" onClick={onClose}>Cancelar</button>
            <button className="btn btn-accent" disabled={isSubmitting}>
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
