import React, { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { db } from "../lib/firebase";
import { computeTaxes } from "../lib/payroll";
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, deleteDoc, doc } from "firebase/firestore";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Trash2, Plus, UserRound, ArrowLeft } from "lucide-react";

const money = (n) => isFinite(n) ? n.toLocaleString("en-US", { style: "currency", currency: "USD" }) : "—";

// initials helper for avatar
const initials = (name) => {
  if (!name) return "—";
  return name.split(/\s+/).map(s => s[0]).filter(Boolean).slice(0,2).join('').toUpperCase();
}

export default function Paystubs() {
  const navigate = useNavigate();
  const [paystubs, setPaystubs] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openNew, setOpenNew] = useState(false);
  const location = useLocation();
  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const preClient = params.get("client");
  // open new modal if ?new=1
  useEffect(() => {
    if (params.get('new') === '1') setOpenNew(true);
  }, [params]);

  // load clients for filter/select
  useEffect(() => {
    const q = query(collection(db, "clients"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setClients(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => console.error(err));
    return () => unsub();
  }, []);

  // load paystubs (real time)
  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, "paystubs"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setPaystubs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, (err) => { console.error(err); setLoading(false); });
    return () => unsub();
  }, []);

  const filtered = useMemo(() => {
    if (!preClient) return paystubs;
    return paystubs.filter(p => p.clientId === preClient);
  }, [paystubs, preClient]);
  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button type="button" className="btn btn-ghost btn-square btn-sm mr-1" onClick={() => window.history.back()} title="Volver">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <UserRound className="w-6 h-6 text-primary" />
          <h1 className="text-xl font-semibold">Paystubs</h1>
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto">
          <button className="btn btn-sm btn-secondary gap-2 whitespace-nowrap" onClick={() => setOpenNew(true)}>
            <Plus className="w-4 h-4" /> Nuevo Paystub
          </button>
        </div>
      </div>

      {/* Filters / summary card - responsive */}
      <div className="card p-3 bg-base-100">
            <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-6">
          <div className="flex-1">
            <div className="flex flex-col md:flex-row md:items-center md:gap-2">
              <label className="label label-text md:mb-0 md:mr-2">Filtrar por cliente</label>
              <select className="select select-bordered w-full md:w-64" defaultValue={preClient || ""} onChange={(e) => { const v = e.target.value; if (!v) return navigate('/paystubs'); navigate(`/paystubs${v ? `?client=${v}` : ''}`); }}>
                <option value="">— Todos —</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.fullName}</option>)}
              </select>
            </div>
          </div>

          <div className="w-full md:w-auto">
            <label className="label label-text">Resultados</label>
            <div className="text-sm opacity-70">{filtered.length} paystubs</div>
          </div>
        </div>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {loading && <div className="animate-pulse space-y-2"><div className="h-12 bg-base-300 rounded" /><div className="h-12 bg-base-300 rounded" /></div>}

        {!loading && filtered.map(ps => (
          <div key={ps.id} className="card bg-base-100 p-3 rounded-lg shadow-md border border-base-200 hover:shadow-lg transition transform hover:-translate-y-0.5 overflow-hidden min-h-[86px]" onClick={() => navigate(`/clients/${ps.clientId}`)}>
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <div className="flex items-center justify-center w-11 h-11 rounded-full bg-gradient-to-br from-primary to-secondary text-base-100 font-semibold shadow flex-shrink-0">{initials(ps.clientName)}</div>
                <div className="flex-1 min-w-0">
                    <div>
                            <div className="">
                              <div className="text-lg font-semibold leading-tight truncate">{ps.clientName}</div>
                              <div className="text-xs opacity-60 md:whitespace-nowrap mt-1 md:mt-0">{ps.periodStart} → {ps.periodEnd}</div>
                            </div>
                            <div className="text-xs opacity-70 mt-1 truncate">Horas: {ps.hours} · Rate: {ps.rate}</div>
                    </div>
                </div>
              </div>

              <div className="w-full md:w-36 flex-shrink-0 text-right mt-3 md:mt-0">
                <div className="text-lg font-semibold">{money(ps.net)}</div>
                <div className="text-sm opacity-70">Bruto: {money(ps.gross)}</div>
                <div className="text-xs opacity-60 mt-1">Federal: {money(ps.federal)}</div>
                <div className="text-xs opacity-60">State: {money(ps.stateTax)}</div>
                  <div className="flex items-center justify-end gap-2 mt-3">
                  <button onClick={(e)=>{ e.stopPropagation(); navigate(`/clients/${ps.clientId}`); }} className="btn btn-ghost btn-xs" title="Ir a ficha del cliente"><Plus className="w-4 h-4" /></button>
                  <button className="btn btn-ghost btn-xs btn-error" onClick={async (e) => { e.stopPropagation(); if (!confirm('Eliminar este paystub?')) return; await deleteDoc(doc(db, 'paystubs', ps.id)); }}><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            </div>
          </div>
        ))}

        {!loading && filtered.length === 0 && (
          <div className="card p-6 text-center opacity-60">Sin paystubs.</div>
        )}
      </div>

      {/* Desktop cards (grid) - match Dashboard style */}
      <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading && (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card p-4 bg-base-100 rounded shadow-sm animate-pulse">
              <div className="h-4 bg-base-300 rounded w-1/3 mb-2"></div>
              <div className="h-3 bg-base-300 rounded w-1/2"></div>
            </div>
          ))
        )}

        {!loading && filtered.map(ps => (
          <div key={ps.id} className="card bg-base-100 p-4 rounded-lg shadow-md border border-base-200 hover:shadow-lg transition transform hover:-translate-y-0.5 cursor-pointer overflow-hidden" onClick={() => navigate(`/clients/${ps.clientId}`)}>
            <div className="flex items-start justify-between gap-3 min-w-0">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-primary to-secondary text-base-100 font-semibold shadow flex-shrink-0">{initials(ps.clientName)}</div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-start md:items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <Link to={`/clients/${ps.clientId}`} onClick={(e)=>{ e.stopPropagation(); navigate(`/clients/${ps.clientId}`); }} className="text-lg font-semibold block truncate">{ps.clientName}</Link>
                        <div className="text-xs opacity-60 md:whitespace-nowrap mt-1">{ps.periodStart} → {ps.periodEnd}</div>
                      </div>
                    </div>
                    <div className="text-xs opacity-70 mt-2 truncate">Horas: {ps.hours} · Rate: {ps.rate}</div>
                </div>
              </div>

              <div className="w-36 flex-shrink-0 text-right">
                <div className="text-lg font-semibold">{money(ps.net)}</div>
                <div className="text-sm opacity-70">Bruto: {money(ps.gross)}</div>
                <div className="text-xs opacity-60 mt-1">Federal: {money(ps.federal)}</div>
                <div className="text-xs opacity-60">State: {money(ps.stateTax)}</div>
                <div className="flex items-center justify-end gap-2 mt-3">
                  <button onClick={(e)=>{ e.stopPropagation(); navigate(`/clients/${ps.clientId}`); }} className="btn btn-ghost btn-xs" title="Ver cliente y paystubs"><Plus className="w-4 h-4" /></button>
                  <button className="btn btn-ghost btn-xs btn-error" onClick={async (e) => { e.stopPropagation(); if (!confirm('Eliminar este paystub?')) return; await deleteDoc(doc(db, 'paystubs', ps.id)); }}><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            </div>
          </div>
        ))}

        {!loading && filtered.length === 0 && (
          <div className="col-span-full card p-6 text-center opacity-60">Sin paystubs.</div>
        )}
      </div>

      {openNew && <NewPaystubModal clients={clients} onClose={() => setOpenNew(false)} />}
    </div>
  );
}

function NewPaystubModal({ clients, onClose }) {
  const { register, handleSubmit, formState: { isSubmitting }, reset } = useForm({
    defaultValues: { clientId: clients[0]?.id || "", periodStart: "", periodEnd: "", hours: "", rate: "", overtimeHours: "", overtimeRate: "", federalPct: 12 }
  });

  const onSubmit = async (v) => {
    const hours = Number(v.hours || 0);
    const rate = Number(v.rate || 0);
    const otH = Number(v.overtimeHours || 0);
    const otR = Number(v.overtimeRate || 0);
    const gross = hours * rate + otH * otR;

    const client = clients.find(c => c.id === v.clientId);
    const taxes = computeTaxes({ hours, rate, state: client?.state || 'CO', federalPct: Number(v.federalPct || 12) });

    await addDoc(collection(db, 'paystubs'), {
      clientId: v.clientId,
      clientName: client?.fullName || '—',
      periodStart: v.periodStart,
      periodEnd: v.periodEnd,
      hours, rate, overtimeHours: otH, overtimeRate: otR,
      gross,
      ...taxes,
      createdAt: serverTimestamp(),
    });

    reset(); onClose();
  };

  return (
    <dialog className="modal modal-open z-50">
      <div className="modal-box max-w-2xl">
        <h3 className="font-bold text-lg mb-2">Nuevo Paystub</h3>
        <form className="grid gap-3" onSubmit={handleSubmit(onSubmit)}>
          <div>
            <label className="label label-text">Cliente</label>
            <select className="select select-bordered w-full" {...register('clientId', { required: true })}>
              <option value="">Selecciona...</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.fullName}</option>)}
            </select>
          </div>

          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <label className="label label-text">Inicio (YYYY-MM-DD)</label>
              <input className="input input-bordered w-full" {...register('periodStart', { required: true })} />
            </div>
            <div>
              <label className="label label-text">Fin (YYYY-MM-DD)</label>
              <input className="input input-bordered w-full" {...register('periodEnd', { required: true })} />
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-3">
            <div>
              <label className="label label-text">Horas</label>
              <input className="input input-bordered w-full" {...register('hours', { required: true })} />
            </div>
            <div>
              <label className="label label-text">Rate</label>
              <input className="input input-bordered w-full" {...register('rate', { required: true })} />
            </div>
            <div>
              <label className="label label-text">% Federal</label>
              <input className="input input-bordered w-full" {...register('federalPct', { required: true })} />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <label className="label label-text">OT horas</label>
              <input className="input input-bordered w-full" {...register('overtimeHours')} />
            </div>
            <div>
              <label className="label label-text">OT rate</label>
              <input className="input input-bordered w-full" {...register('overtimeRate')} />
            </div>
          </div>

          <div className="modal-action">
            <button type="button" className="btn" onClick={onClose}>Cancelar</button>
            <button className="btn btn-primary" disabled={isSubmitting}>Crear</button>
          </div>
        </form>
      </div>
      <form method="dialog" className="modal-backdrop"><button>close</button></form>
    </dialog>
  );
}

  
