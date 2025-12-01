// src/pages/ClientDetail.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { db } from "../lib/firebase";
import {
  doc, getDoc, collection, query, where, onSnapshot,
  addDoc, serverTimestamp, orderBy, updateDoc, deleteDoc
} from "firebase/firestore";
import { useUnsavedContext } from '../providers/UnsavedChangesProvider.jsx';
import {
  FileText, Plus, Settings2, Trash2, Sigma, Info, X, ArrowLeft
} from "lucide-react";

// Helper: initials for avatar
const initials = (name) => {
  if (!name) return "—";
  return name.split(/\s+/).map(s => s[0]).filter(Boolean).slice(0,2).join('').toUpperCase();
}

/* =============== helpers UI =============== */

function _getYtdBaseGross(client, year) {
  const yb = client?.ytdBase;
  if (!yb || Number(yb.year) !== year) return 0;
  // Si existen campos separados, úsales; si no, cae al "gross" clásico
  if (yb.regularGross != null || yb.overtimeGross != null) {
    return num(yb.regularGross) + num(yb.overtimeGross);
  }
  return num(yb.gross);
}


const money = (n) =>
  isFinite(n) ? n.toLocaleString("en-US", { style: "currency", currency: "USD" }) : "—";
const num = (v) => Number(v || 0);
const addDays = (isoYYYYMMDD, days) => {
  const [y, m, d] = isoYYYYMMDD.split("-").map(Number);
  const dt = new Date(y || 1970, (m || 1) - 1, d || 1);
  dt.setDate(dt.getDate() + days);
  const y2 = dt.getFullYear();
  const m2 = String(dt.getMonth() + 1).padStart(2, "0");
  const d2 = String(dt.getDate()).padStart(2, "0");
  return `${y2}-${m2}-${d2}`;
};

/* =============== impuestos (simple, editable) =============== */
const STATE_TAX = {
  TX: 0,
  CO: 4.4,
  UT: 4.85,
  FL: 0,
  NY: 6.33,
  CA: 6.0,
  NJ: 5.5,
};
function computeTaxes({ gross, state, federalPct }) {
  const pctFed   = Math.max(0, Number(federalPct || 0)) / 100;
  const pctState = (STATE_TAX[String(state || "").toUpperCase()] ?? 0) / 100;
  const pctSS    = 0.062;
  const pctMed   = 0.0145;

  const federal  = gross * pctFed;
  const stateTax = gross * pctState;
  const ss       = gross * pctSS;
  const medicare = gross * pctMed;

  const taxes = federal + stateTax + ss + medicare;
  const net   = gross - taxes;

  return { federal, stateTax, ss, medicare, taxes, net };
}

/* ============================== PAGE ============================== */
export default function ClientDetail() {
  const { id } = useParams();
  const [client, setClient] = useState(null);
  const [loadingClient, setLoadingClient] = useState(true);

  const [paystubs, setPaystubs] = useState([]);            // lista tiempo real
  const [openNew, setOpenNew] = useState(false);           // modal 1 paystub
  const [openYTD, setOpenYTD] = useState(false);           // modal YTD base
  const [openBulk, setOpenBulk] = useState(false);         // modal 4 paystubs
  const [drawer, setDrawer] = useState(null);              // detalle paystub

  // carga cliente
  useEffect(() => {
    (async () => {
      const snap = await getDoc(doc(db, "clients", id));
      setClient(snap.exists() ? { id: snap.id, ...snap.data() } : null);
      setLoadingClient(false);
    })();
  }, [id]);

  // paystubs del cliente (tiempo real) => requiere índice (clientId + createdAt desc)
  useEffect(() => {
    const q = query(
      collection(db, "paystubs"),
      where("clientId", "==", id),
      orderBy("createdAt", "desc")
    );
    const unsub = onSnapshot(q, (snap) => {
      setPaystubs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => console.error(err));
    return () => unsub();
  }, [id]);

  // ===== YTD resumen del AÑO ACTUAL =====
  //   1) Calcula YTD BRUTO: base.gross (si year coincide) + suma de brutos talones del año
  //   2) Recalcula impuestos/neto a partir de ese bruto (NO suma talón por talón)
  // YTD del año actual (YTD base + suma de paystubs año) con Regular/OT
const currentYearYTD = useMemo(() => {
  if (!client) return null;
  const y = new Date().getFullYear();

  // Totales
  let gross = 0, taxes = 0, net = 0, federal = 0, stateTax = 0, ss = 0, medicare = 0;
  // Desglose bruto
  let reg = 0, ot = 0;

  // Base del año
  if (client?.ytdBase && Number(client.ytdBase.year) === y) {
    if (client.ytdBase.regularGross != null || client.ytdBase.overtimeGross != null) {
      reg += num(client.ytdBase.regularGross);
      ot  += num(client.ytdBase.overtimeGross);
      gross += reg + ot;
    } else {
      // compatibilidad: si sólo hay "gross", lo contamos como Regular
      reg += num(client.ytdBase.gross);
      gross += num(client.ytdBase.gross);
    }
    taxes    += num(client.ytdBase.taxes);
    net      += num(client.ytdBase.net);
    federal  += num(client.ytdBase.federal);
    stateTax += num(client.ytdBase.stateTax);
    ss       += num(client.ytdBase.ss);
    medicare += num(client.ytdBase.medicare);
  }

  // Paystubs del año
  for (const ps of paystubs) {
    const t = ps.createdAt?.toDate?.();
    if (!t || t.getFullYear() !== y) continue;

    // bruto por talón
    const r = num(ps.hours) * num(ps.rate);
    const o = num(ps.overtimeHours) * num(ps.overtimeRate);
    reg += r;
    ot  += o;

    gross    += num(ps.gross ?? (r + o));  // por si no existiera "gross", usamos r+o
    taxes    += num(ps.taxes);
    net      += num(ps.net);
    federal  += num(ps.federal);
    stateTax += num(ps.stateTax);
    ss       += num(ps.ss);
    medicare += num(ps.medicare);
  }

  return { gross, taxes, net, federal, stateTax, ss, medicare, reg, ot };
}, [client, paystubs]);


  if (loadingClient) return <div className="p-6">Cargando…</div>;
  if (!client) return <div className="p-6">Cliente no encontrado</div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button type="button" className="btn btn-ghost btn-square btn-sm" onClick={() => window.history.back()} title="Volver">
          <ArrowLeft className="w-4 h-4" />
        </button>
        {/* migas */}
        <div className="breadcrumbs text-sm">
          <ul>
            <li><Link to="/clients">Clientes</Link></li>
            <li>{client.fullName}</li>
          </ul>
        </div>
      </div>

      {/* Ficha - header potente */}
      <div className="w-full bg-base-100 rounded-2xl shadow-2xl p-6 ring-1 ring-black/10">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="flex items-start gap-5 min-w-0 w-full">
            <div className="bg-base-200 p-4 rounded-xl shadow-2xl w-full flex items-center gap-4">
              <div className="flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-primary to-secondary text-base-100 font-extrabold shadow-2xl flex-shrink-0 text-xl ring-1 ring-black/20">{initials(client.fullName)}</div>
              <div className="min-w-0">
                <h2 className="text-3xl md:text-4xl font-extrabold leading-tight truncate">{client.fullName}</h2>
                <p className="mt-2 text-sm opacity-80 truncate max-w-[70ch]">{client.address}</p>
                <p className="mt-2 text-sm opacity-70">Estado: <b className="font-semibold">{client.state}</b> — ZIP: <b className="font-semibold">{client.zip}</b></p>
              </div>
            </div>
          </div>

          <div className="flex-shrink-0 hidden md:flex items-center gap-3">
            <button type="button" className="btn btn-sm w-full sm:w-auto gap-2" onClick={() => setOpenYTD(true)}>
              <Settings2 className="w-4 h-4" /> Ajustar YTD
            </button>
            <button type="button" className="btn btn-sm btn-accent w-full sm:w-auto gap-2" onClick={() => setOpenBulk(true)}>
              <Sigma className="w-4 h-4" /> Crear 4 paystubs
            </button>
            <button type="button" className="btn btn-sm btn-secondary w-full sm:w-auto gap-2" onClick={() => setOpenNew(true)} aria-label="Nuevo paystub">
              <Plus className="w-4 h-4" /> <span className="hidden md:inline">Nuevo paystub</span>
            </button>
          </div>
        </div>
      </div>

      {/* Header Paystubs */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-secondary" />
          <h3 className="text-lg font-semibold">Paystubs</h3>
        </div>

        <div className="w-full md:w-auto relative z-20">
          {/* Mobile: icon-only row centered */}
          <div className="flex items-center justify-center gap-3 md:hidden mb-2">
            <button type="button" className="btn btn-ghost btn-circle" onClick={() => setOpenYTD(true)} aria-label="Ajustar YTD">
              <Settings2 className="w-5 h-5" />
            </button>
            <button type="button" className="btn btn-ghost btn-circle btn-accent" onClick={() => setOpenBulk(true)} aria-label="Crear 4 paystubs">
              <Sigma className="w-5 h-5" />
            </button>
            <button type="button" className="btn btn-ghost btn-circle btn-secondary" onClick={() => setOpenNew(true)} aria-label="Nuevo paystub">
              <Plus className="w-5 h-5" />
            </button>
          </div>

          {/* Desktop buttons ahora están dentro del header principal (ver arriba) */}
        </div>
      </div>

      {/* YTD actual (resumen desde BRUTO) */}
      {currentYearYTD && (
  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
    {/* Total */}
    <div className="stat bg-base-100 shadow p-4 rounded-lg">
      <div className="stat-title">YTD Bruto (Total)</div>
      <div className="stat-value text-primary">{money(currentYearYTD.gross)}</div>
      <div className="stat-desc">Bruto acumulado total</div>
    </div>

    {/* Impuestos */}
    <div className="stat bg-base-100 shadow p-4 rounded-lg">
      <div className="stat-title">YTD Impuestos</div>
      <div className="stat-value text-secondary">{money(currentYearYTD.taxes)}</div>
      <div className="stat-desc">Deducciones totales</div>
    </div>

    {/* Neto */}
    <div className="stat bg-base-100 shadow p-4 rounded-lg">
      <div className="stat-title">YTD Neto</div>
      <div className="stat-value text-success">{money(currentYearYTD.net)}</div>
      <div className="stat-desc">Ganancia después de impuestos</div>
    </div>

    {/* Regular */}
    <div className="stat bg-base-100 shadow p-4 rounded-lg">
      <div className="stat-title">YTD Regular</div>
      <div className="stat-value text-info">{money(currentYearYTD.reg)}</div>
      <div className="stat-desc">Pagos regulares sin OT</div>
    </div>

    {/* OT */}
    <div className="stat bg-base-100 shadow p-4 rounded-lg">
      <div className="stat-title">YTD OT</div>
      <div className="stat-value text-warning">{money(currentYearYTD.ot)}</div>
      <div className="stat-desc">Horas extra acumuladas</div>
    </div>
  </div>
)}


      {/* Tabla paystubs (desktop) and cards (mobile) */}
      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {paystubs.length === 0 && (
          <div className="card p-6 text-center opacity-60">Sin paystubs.</div>
        )}
        {paystubs.map(ps => (
          <div key={ps.id} className="card bg-base-100 p-3 rounded-lg shadow-sm border border-base-200">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <div className="font-medium truncate">{ps.periodStart} → {ps.periodEnd}</div>
                  <div className="text-sm font-semibold">{money(ps.net)}</div>
                </div>
                <div className="text-xs opacity-70 mt-2 truncate">Horas: {ps.hours} · Rate: {ps.rate}</div>
                <div className="text-xs opacity-60 mt-1">Bruto: {money(ps.gross)} · Impuestos: {money(ps.taxes)}</div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <button className="btn btn-ghost btn-xs" onClick={() => setDrawer(ps)} title="Detalle">Ver</button>
                <button className="btn btn-ghost btn-xs btn-error" onClick={async () => { const ok = await confirmAction({ title: 'Eliminar paystub', text: '¿Eliminar este paystub?', confirmText: 'Eliminar', cancelText: 'Cancelar', icon: 'warning' }); if (!ok) return; await deleteDoc(doc(db,'paystubs',ps.id)); }}>Borrar</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="hidden md:block overflow-x-auto bg-base-100 rounded-xl">
        <table className="table">
          <thead>
            <tr>
              <th>Periodo</th>
              <th className="text-right">Horas</th>
              <th className="text-right">Rate</th>
              <th className="text-right">OT (h)</th>
              <th className="text-right">OT rate</th>
              <th className="text-right">Bruto</th>
              <th className="text-right">Impuestos</th>
              <th className="text-right">Neto</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {paystubs.map(ps => (
              <tr key={ps.id} className="hover">
                <td>
                  <button
                    className="link link-hover flex items-center gap-1"
                    title="Ver detalle/YTD hasta este talón"
                    onClick={() => setDrawer(ps)}
                  >
                    <Info className="w-4 h-4 opacity-70" />
                    {ps.periodStart} → {ps.periodEnd}
                  </button>
                </td>
                <td className="text-right">{ps.hours}</td>
                <td className="text-right">{money(ps.rate)}</td>
                <td className="text-right">{ps.overtimeHours || 0}</td>
                <td className="text-right">{ps.overtimeRate ? money(ps.overtimeRate) : "—"}</td>
                <td className="text-right">{money(ps.gross)}</td>
                <td className="text-right">{money(ps.taxes)}</td>
                <td className="text-right font-semibold">{money(ps.net)}</td>
                <td className="text-right">
                  <button
                    className="btn btn-ghost btn-xs text-error gap-1"
                    onClick={async () => {
                      {
                        const ok = await confirmAction({ title: 'Eliminar paystub', text: '¿Eliminar este paystub?', confirmText: 'Eliminar', cancelText: 'Cancelar', icon: 'warning' });
                        if (!ok) return;
                      }
                      await deleteDoc(doc(db, "paystubs", ps.id));
                    }}
                    title="Eliminar"
                  >
                    <Trash2 className="w-4 h-4" /> Borrar
                  </button>
                </td>
              </tr>
            ))}
            {paystubs.length === 0 && (
              <tr><td colSpan={9} className="text-center opacity-60 py-8">Sin paystubs.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modales / Drawer */}
      {openNew   && <PaystubModal client={client} onClose={() => setOpenNew(false)} />}
      {openYTD   && <AdjustYTDModal client={client} onClose={() => setOpenYTD(false)} />}
      {openBulk  && <Bulk4Modal   client={client} onClose={() => setOpenBulk(false)} />}
      {drawer    && <PaystubDrawer client={client} paystubs={paystubs} ps={drawer} onClose={() => setDrawer(null)} />}
    </div>
  );
}

/* ========================== MODALS =========================== */

/** Crear 1 paystub (con OT y % federal por talón) */
function PaystubModal({ client, onClose }) {
  const { markDirty, clearDirty, confirmIfDirty } = useUnsavedContext();
  const { register, handleSubmit, formState:{ errors, isSubmitting }, reset } = useForm({
    defaultValues: {
      periodStart: "", periodEnd: "",
      hours: "", rate: "",
      overtimeHours: "", overtimeRate: "",
      federalPct: 12,
    }
  });

  const onSubmit = async (v) => {
    const hours = num(v.hours);
    const rate  = num(v.rate);
    const otH   = num(v.overtimeHours);
    const otR   = num(v.overtimeRate);
    const federalPct = num(v.federalPct);

    const gross = hours * rate + otH * otR;
    const t = computeTaxes({ gross, state: client.state, federalPct });

    await addDoc(collection(db, "paystubs"), {
      clientId: client.id,
      clientName: client.fullName,
      periodStart: v.periodStart,
      periodEnd: v.periodEnd,
      hours, rate,
      overtimeHours: otH,
      overtimeRate: otR,
      ...t, gross,
      createdAt: serverTimestamp(),
    });

    reset(); onClose();
  };

  return (
    <dialog className="modal modal-open z-50">
      <div className="modal-box max-w-3xl p-6 rounded-2xl">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-secondary text-base-100 flex items-center justify-center text-lg shadow-2xl ring-1 ring-black/20">
              <FileText className="w-6 h-6" />
            </div>
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-2xl">Nuevo paystub</h3>
            <div className="text-sm opacity-70">{client.fullName}</div>
          </div>
        </div>

        <form className="grid gap-4 mt-4" onSubmit={handleSubmit(onSubmit)} onChange={() => markDirty(true)}>
          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <label className="label label-text">Inicio (YYYY-MM-DD)</label>
              <input className="input input-bordered w-full" {...register("periodStart",{required:"Requerido"})} />
              {errors.periodStart && <p className="text-error text-xs">{errors.periodStart.message}</p>}
            </div>
            <div>
              <label className="label label-text">Fin (YYYY-MM-DD)</label>
              <input className="input input-bordered w-full" {...register("periodEnd",{required:"Requerido"})} />
              {errors.periodEnd && <p className="text-error text-xs">{errors.periodEnd.message}</p>}
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-3">
            <div>
              <label className="label label-text">Horas</label>
              <input className="input input-bordered w-full" inputMode="decimal"
                {...register("hours",{required:"Requerido", min:{value:0,message:"Inválido"}})} />
            </div>
            <div>
              <label className="label label-text">Rate ($/h)</label>
              <input className="input input-bordered w-full" inputMode="decimal"
                {...register("rate",{required:"Requerido", min:{value:0,message:"Inválido"}})} />
            </div>
            <div>
              <label className="label label-text">% Federal</label>
              <input className="input input-bordered w-full" inputMode="decimal"
                {...register("federalPct",{required:"Requerido", min:{value:0,message:"Inválido"}})} />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <label className="label label-text">Horas extra (OT)</label>
              <input className="input input-bordered w-full" inputMode="decimal"
                {...register("overtimeHours",{ min:{value:0,message:"Inválido"} })} />
            </div>
            <div>
              <label className="label label-text">Rate OT ($/h)</label>
              <input className="input input-bordered w-full" inputMode="decimal"
                {...register("overtimeRate",{ min:{value:0,message:"Inválido"} })} />
            </div>
          </div>

          <div className="modal-action mt-4 flex flex-col md:flex-row gap-3 justify-end">
            <button type="button" className="btn w-full md:w-auto btn-ghost" onClick={async () => { const ok = await confirmIfDirty(); if (ok) onClose(); }}>Cancelar</button>
            <button className="btn btn-secondary w-full md:w-auto" disabled={isSubmitting}>Crear</button>
          </div>
        </form>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button onClick={onClose}>close</button>
      </form>
    </dialog>
  );
}

/** Ajustar YTD base (año + bruto acumulado => calcula impuestos y neto con desglose) */
/** Ajustar YTD base (Regular + OT => Total) */
function AdjustYTDModal({ client, onClose }) {
  const { register, handleSubmit, formState: { isSubmitting }, reset, watch } = useForm({
    defaultValues: {
      year:          client?.ytdBase?.year  ?? new Date().getFullYear(),
      regularGross:  client?.ytdBase?.regularGross ?? (client?.ytdBase?.gross ?? 0),
      overtimeGross: client?.ytdBase?.overtimeGross ?? 0,
      federalPct:    client?.ytdBase?.federalPct ?? 12,
    }
  });

  const regularGross  = num(watch("regularGross"));
  const overtimeGross = num(watch("overtimeGross"));
  const federalPct    = num(watch("federalPct"));

  const totalGross = regularGross + overtimeGross;

  // Previsualización del TOTAL con desglose
  const preview = computeTaxes({
    gross: totalGross,
    state: client.state,
    federalPct
  });

  const onSubmit = async (v) => {
    const reg = num(v.regularGross);
    const ot  = num(v.overtimeGross);
    const tot = reg + ot;

    const calc = computeTaxes({
      gross: tot,
      state: client.state,
      federalPct: num(v.federalPct)
    });

    await updateDoc(doc(db, "clients", client.id), {
      ytdBase: {
        year: Number(v.year),
        // guardamos separado + total por compatibilidad
        regularGross: reg,
        overtimeGross: ot,
        gross: tot,

        taxes:    calc.taxes,
        net:      calc.net,
        federal:  calc.federal,
        stateTax: calc.stateTax,
        ss:       calc.ss,
        medicare: calc.medicare,

        federalPct: num(v.federalPct),
      }
    });

    reset();
    clearDirty();
    onClose();
  };

  return (
    <dialog className="modal modal-open z-50">
      <div className="modal-box max-w-3xl p-6 rounded-2xl">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-secondary text-base-100 flex items-center justify-center text-lg shadow-2xl ring-1 ring-black/20">
              <Settings2 className="w-6 h-6" />
            </div>
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-2xl">Ajustar YTD</h3>
            <div className="text-sm opacity-70">{client.fullName}</div>
          </div>
        </div>

        <p className="text-sm opacity-70 mt-3 mb-2">
          Divide el YTD bruto entre <b>Regular</b> y <b>Overtime</b>. El sistema calcula impuestos del <b>Total</b>.
        </p>

        <form className="grid gap-4" onSubmit={handleSubmit(onSubmit)} onChange={() => markDirty(true)}>
          <div className="grid md:grid-cols-3 gap-3">
            <div>
              <label className="label label-text">Año</label>
              <input className="input input-bordered w-full" {...register("year")} />
            </div>

            <div>
              <label className="label label-text">% Federal</label>
              <input className="input input-bordered w-full" inputMode="decimal" {...register("federalPct")} />
            </div>

            <div className="flex items-end">
              <span className="text-xs opacity-70">Estado: <b>{client.state}</b></span>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-3">
            <div>
              <label className="label label-text">YTD Regular ($)</label>
              <input className="input input-bordered w-full" inputMode="decimal" {...register("regularGross")} />
            </div>
            <div>
              <label className="label label-text">YTD Overtime ($)</label>
              <input className="input input-bordered w-full" inputMode="decimal" {...register("overtimeGross")} />
            </div>
            <div>
              <label className="label label-text">Total (auto)</label>
              <input
                className="input input-bordered w-full"
                value={totalGross}
                readOnly
                tabIndex={-1}
              />
            </div>
          </div>

          {/* Previsualización detallada del TOTAL */}
          <div className="rounded-xl border border-base-300 bg-base-200 p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold">Previsualización (Total)</span>
              <span className="badge badge-ghost">
                Efectiva: {((preview.taxes / (totalGross || 1)) * 100).toFixed(2)}%
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-sm mb-2">
              <div>— Regular</div><div className="text-right">{money(regularGross)}</div>
              <div>— Overtime</div><div className="text-right">{money(overtimeGross)}</div>
              <div className="font-semibold">Total bruto</div><div className="text-right font-semibold">{money(totalGross)}</div>
            </div>

            <div className="overflow-x-auto">
              <table className="table table-zebra">
                <thead>
                  <tr>
                    <th>Componente</th>
                    <th className="text-right">Monto</th>
                  </tr>
                </thead>
                <tbody>
                  <tr><td>Federal</td><td className="text-right">{money(preview.federal)}</td></tr>
                  <tr><td>State</td><td className="text-right">{money(preview.stateTax)}</td></tr>
                  <tr><td>Social Security</td><td className="text-right">{money(preview.ss)}</td></tr>
                  <tr><td>Medicare</td><td className="text-right">{money(preview.medicare)}</td></tr>
                </tbody>
                <tfoot>
                  <tr><th>Impuestos totales</th><th className="text-right">{money(preview.taxes)}</th></tr>
                  <tr><th>Neto (Total – Impuestos)</th><th className="text-right">{money(preview.net)}</th></tr>
                </tfoot>
              </table>
            </div>
          </div>

          <div className="modal-action mt-4 flex flex-col md:flex-row gap-3 justify-end">
            <button type="button" className="btn btn-ghost w-full md:w-auto" onClick={async () => { const ok = await confirmIfDirty(); if (ok) onClose(); }}>Cancelar</button>
            <button className="btn btn-primary w-full md:w-auto" disabled={isSubmitting}>Guardar</button>
          </div>
        </form>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button onClick={onClose}>close</button>
      </form>
    </dialog>
  );
}


/** Crear 4 paystubs consecutivos (weekly/biweekly) */
function Bulk4Modal({ client, onClose }) {
  const { markDirty, clearDirty, confirmIfDirty } = useUnsavedContext();
  const { register, handleSubmit, formState:{ isSubmitting }, reset, watch } = useForm({
    defaultValues: {
      start: "",
      length: "weekly",
      hours: "", rate: "",
      overtimeHours: "", overtimeRate: "",
      federalPct: 12,
    }
  });
  const lenDays = watch("length") === "biweekly" ? 14 : 7;

  const onSubmit = async (v) => {
    const baseStart = v.start;
    if (!baseStart) return;

    const hours = num(v.hours), rate = num(v.rate);
    const otH = num(v.overtimeHours), otR = num(v.overtimeRate);
    const federalPct = num(v.federalPct);

    const batch = [];
    for (let i = 0; i < 4; i++) {
      const s = addDays(baseStart, i * lenDays);
      const e = addDays(s, lenDays - 1);
      const gross = hours * rate + otH * otR;
      const t = computeTaxes({ gross, state: client.state, federalPct });

      batch.push(addDoc(collection(db, "paystubs"), {
        clientId: client.id,
        clientName: client.fullName,
        periodStart: s,
        periodEnd: e,
        hours, rate,
        overtimeHours: otH, overtimeRate: otR,
        ...t, gross,
        createdAt: serverTimestamp(),
      }));
    }

    await Promise.all(batch);
    reset();
    clearDirty();
    onClose();
  };

  return (
    <dialog className="modal modal-open z-50">
      <div className="modal-box max-w-3xl p-6 rounded-2xl">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-secondary text-base-100 flex items-center justify-center text-lg shadow-2xl ring-1 ring-black/20">
              <Sigma className="w-6 h-6" />
            </div>
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-2xl">Crear 4 paystubs</h3>
            <div className="text-sm opacity-70">{client.fullName}</div>
          </div>
        </div>

        <form className="grid gap-4 mt-4" onSubmit={handleSubmit(onSubmit)} onChange={() => markDirty(true)}>
          <div className="grid md:grid-cols-3 gap-3">
            <div>
              <label className="label label-text">Primer inicio (YYYY-MM-DD)</label>
              <input className="input input-bordered w-full" {...register("start", { required: true })} />
            </div>
            <div>
              <label className="label label-text">Frecuencia</label>
              <select className="select select-bordered w-full" {...register("length")}>
                <option value="weekly">Semanal (7 días)</option>
                <option value="biweekly">Quincenal (14 días)</option>
              </select>
            </div>
            <div className="flex items-end">
              <span className="text-xs opacity-70">Cada período termina {lenDays - 1} días después</span>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-3">
            <div>
              <label className="label label-text">Horas</label>
              <input className="input input-bordered w-full" inputMode="decimal" {...register("hours", { required: true })} />
            </div>
            <div>
              <label className="label label-text">Rate ($/h)</label>
              <input className="input input-bordered w-full" inputMode="decimal" {...register("rate", { required: true })} />
            </div>
            <div>
              <label className="label label-text">% Federal</label>
              <input className="input input-bordered w-full" inputMode="decimal" {...register("federalPct", { required: true })} />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <label className="label label-text">Horas extra (OT)</label>
              <input className="input input-bordered w-full" inputMode="decimal" {...register("overtimeHours")} />
            </div>
            <div>
              <label className="label label-text">Rate OT ($/h)</label>
              <input className="input input-bordered w-full" inputMode="decimal" {...register("overtimeRate")} />
            </div>
          </div>

          <div className="modal-action mt-4 flex flex-col md:flex-row gap-3 justify-end">
            <button type="button" className="btn btn-ghost w-full md:w-auto" onClick={async () => { const ok = await confirmIfDirty(); if (ok) onClose(); }}>Cancelar</button>
            <button className="btn btn-accent w-full md:w-auto" disabled={isSubmitting}>Crear 4</button>
          </div>
        </form>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button onClick={onClose}>close</button>
      </form>
    </dialog>
  );
}

/** Drawer de detalle + YTD hasta este paystub (desde BRUTO YTD) */
function PaystubDrawer({ client, paystubs, ps, onClose }) {
  // YTD HASTA ESTE TALÓN:
  //   1) Determina año del talón
  //   2) YTD BRUTO: base.gross (si es mismo año) + brutos de talones del año hasta e incluyendo este
  //   3) Recalcula impuestos/neto con computeTaxes a partir de ese BRUTO
  const ytdAtThis = useMemo(() => {
    const t = ps.createdAt?.toDate?.();
    if (!t) return null;
    const year = t.getFullYear();

    let ytdGross = 0;

    if (client?.ytdBase && Number(client.ytdBase.year) === year) {
      ytdGross += num(client.ytdBase.gross);
    }

    const psTime = ps.createdAt?.seconds ?? 0;
    for (const row of [...paystubs].reverse()) {
      const rowT = row.createdAt?.toDate?.();
      if (!rowT || rowT.getFullYear() !== year) continue;
      const secs = row.createdAt?.seconds ?? 0;
      if (secs > psTime) continue; // solo hasta éste
      ytdGross += num(row.gross);
    }

    const federalPct = client?.ytdBase?.federalPct ?? 12;
    const calc = computeTaxes({ gross: ytdGross, state: client.state, federalPct });
    return { gross: ytdGross, ...calc };
  }, [client, paystubs, ps]);

  return (
    <div
      className="
        fixed right-0 top-16 lg:top-20 z-50
        h-[calc(100vh-4rem)] lg:h-[calc(100vh-5rem)]
        w-full max-w-md bg-base-100 shadow-2xl
        overflow-y-auto rounded-tl-2xl border-l border-base-300
      "
      role="dialog"
      aria-modal="true"
    >
      <div className="p-4 sticky top-0 bg-base-100 border-b border-base-300 z-10 flex items-center justify-between">
        <h3 className="text-lg font-bold">Detalle paystub</h3>
        <button className="btn btn-sm btn-ghost" onClick={onClose}>
          <X className="w-4 h-4" /> Cerrar
        </button>
      </div>

      <div className="p-4 space-y-4">
        {/* Talón */}
        <div className="card bg-base-100 shadow">
          <div className="card-body">
            <div className="font-semibold">{ps.periodStart} → {ps.periodEnd}</div>
            <div className="text-sm opacity-70">{client.fullName}</div>
            <div className="divider my-2"></div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>Horas</div><div className="text-right">{ps.hours}</div>
              <div>Rate</div><div className="text-right">{money(ps.rate)}</div>
              <div>OT (h)</div><div className="text-right">{ps.overtimeHours || 0}</div>
              <div>OT rate</div><div className="text-right">{ps.overtimeRate ? money(ps.overtimeRate) : "—"}</div>
              <div>Bruto</div><div className="text-right">{money(ps.gross)}</div>
              <div>Federal</div><div className="text-right">{money(ps.federal)}</div>
              <div>State</div><div className="text-right">{money(ps.stateTax)}</div>
              <div>SS</div><div className="text-right">{money(ps.ss)}</div>
              <div>Medicare</div><div className="text-right">{money(ps.medicare)}</div>
              <div>Impuestos</div><div className="text-right">{money(ps.taxes)}</div>
              <div className="font-semibold">Neto</div><div className="text-right font-semibold">{money(ps.net)}</div>
            </div>
          </div>
        </div>

        {/* YTD hasta este talón (desde BRUTO YTD) */}
        {ytdAtThis && (
          <div className="card bg-base-100 shadow">
            <div className="card-body">
              <div className="font-semibold mb-1">YTD hasta este talón</div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>Bruto</div><div className="text-right">{money(ytdAtThis.gross)}</div>
                <div>Impuestos</div><div className="text-right">{money(ytdAtThis.taxes)}</div>
                <div>— Federal</div><div className="text-right">{money(ytdAtThis.federal)}</div>
                <div>— State</div><div className="text-right">{money(ytdAtThis.stateTax)}</div>
                <div>— SS</div><div className="text-right">{money(ytdAtThis.ss)}</div>
                <div>— Medicare</div><div className="text-right">{money(ytdAtThis.medicare)}</div>
                <div className="font-semibold">Neto</div><div className="text-right font-semibold">{money(ytdAtThis.net)}</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
