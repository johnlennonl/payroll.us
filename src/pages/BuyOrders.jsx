import React, { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { useForm } from "react-hook-form";
import { db } from "../lib/firebase";
import {
  collection, addDoc, updateDoc, deleteDoc, doc,
  serverTimestamp, onSnapshot, query, orderBy, getDoc
} from "firebase/firestore";
import { ShoppingCart, Plus, Pencil, Trash2, CheckCircle2, Info, FileText } from "lucide-react";
// helper: initials for avatar
const initials = (name) => {
  if (!name) return "—";
  return name.split(/\s+/).map(s => s[0]).filter(Boolean).slice(0,2).join('').toUpperCase();
}
import { computeBuyOrder, CITY_TAX_RATES } from "../lib/buyorders";
import { fillBuyOrderPDF } from "../lib/fillBuyOrderPDF";

export default function BuyOrders() {
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [selected, setSelected] = useState(null);
  const [ratesMap, setRatesMap] = useState(CITY_TAX_RATES);

  useEffect(() => {
    const q = query(
      collection(db, "buyOrders"),
      orderBy("createdAt", "desc")
    );
    const unsub = onSnapshot(q, snap => {
      setRows(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  // Si la URL contiene ?id=..., cargar ese buy order y abrir detalles
  const location = useLocation();
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const id = params.get("id");
    if (!id) return;
    (async () => {
      try {
        const d = await getDoc(doc(db, "buyOrders", id));
        if (d.exists()) {
          setSelected({ id: d.id, ...d.data() });
        }
      } catch (err) {
        console.error("Error cargando buy order desde id param:", err);
      }
    })();
  }, [location.search]);

  // load persisted rates from Firestore (doc: settings/taxRates)
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const d = await getDoc(doc(db, "settings", "taxRates"));
        if (d.exists() && mounted) {
          const data = d.data();
          if (data && data.rates) setRatesMap(data.rates);
        }
      } catch (err) {
        console.error("Error loading tax rates:", err);
      }
    })();
    return () => { mounted = false };
  }, []);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter(r =>
      [r.buyerName, r.address, r.vin, r.city, r.status]
        .filter(Boolean)
        .some(v => String(v).toLowerCase().includes(s))
    );
  }, [rows, search]);

  const onAdd = () => { setEditing(null); setOpen(true); };
  const onEdit = (row) => { setEditing(row); setOpen(true); };

  const onDelete = async (row) => {
    if (!confirm(`¿Eliminar buy order para ${row.buyerName || ''}?`)) return;
    await deleteDoc(doc(db, "buyOrders", row.id));
  };

  const onMarkRegistered = async (row) => {
    await updateDoc(doc(db, "buyOrders", row.id), {
      status: "registered",
      updatedAt: serverTimestamp(),
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ShoppingCart className="w-6 h-6 text-primary" />
          <h1 className="text-xl font-semibold">Buy Orders</h1>
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto">
          <input
            className="input input-sm input-bordered w-full md:w-64"
            placeholder="Buscar (nombre, VIN, ciudad)"
            value={search}
            onChange={(e)=>setSearch(e.target.value)}
          />
          <button className="btn btn-sm btn-primary gap-2 whitespace-nowrap" onClick={onAdd}>
            <Plus className="w-4 h-4" /> Nuevo
          </button>
        </div>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {filtered.map(r => (
          <div key={r.id} className="bg-base-100 p-2 rounded-xl shadow-xl border border-base-200">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary to-secondary text-base-100 font-semibold flex items-center justify-center text-lg shadow-2xl ring-1 ring-black/20">{initials(r.buyerName)}</div>
              </div>

              <div className="flex-1 min-w-0">
                <div className="bg-base-200 p-2 rounded-lg shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <div className="font-semibold truncate">{r.buyerName}</div>
                      <div className="text-xs opacity-70 truncate">{r.address}</div>
                    </div>
                    <div className="text-right ml-3">
                      <div className="text-sm opacity-70">Total</div>
                      <div className="font-semibold">${Number(r.totalWithFees || 0).toFixed(2)}</div>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-2 justify-end">
                    <button className="btn btn-xs btn-ghost" onClick={()=>setSelected(r)} title="Ver detalles"><Info className="w-4 h-4"/></button>
                    {r.status !== 'registered' && <button className="btn btn-xs btn-ghost" onClick={()=>onMarkRegistered(r)} title="Marcar registrado"><CheckCircle2 className="w-4 h-4"/></button>}
                    <button className="btn btn-xs btn-primary" onClick={()=>onEdit(r)}><Pencil className="w-4 h-4"/></button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="hidden md:block overflow-x-auto bg-base-100 rounded-xl">
        <table className="table">
          <thead>
            <tr>
              <th>Titular</th>
              <th className="hidden md:table-cell">Dirección</th>
              <th>VIN</th>
              <th className="hidden lg:table-cell">Stock</th>
              <th>Auto (Año / Marca / Modelo)</th>
              <th>Ciudad</th>
              <th>Precio</th>
              <th>Impuestos</th>
              <th>Total</th>
              <th className="hidden sm:table-cell">Balance</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="hover">
                <td className="font-medium">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex-shrink-0">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-secondary text-base-100 font-semibold flex items-center justify-center text-sm shadow ring-1 ring-black/10">{initials(r.buyerName)}</div>
                    </div>
                    <div className="min-w-0">
                      <div className="truncate">{r.buyerName}</div>
                      <div className="text-xs opacity-70 truncate">{r.address}</div>
                    </div>
                  </div>
                </td>
                <td className="hidden md:table-cell" style={{maxWidth:220}}>{/* direction kept above for compact */}</td>
                <td>{r.vin}</td>
                <td className="hidden lg:table-cell">{r.stockNumber || '—'}</td>
                <td>{r.year} / {r.make} / {r.model}</td>
                <td>{r.city}</td>
                <td>${Number(r.price || 0).toFixed(2)}</td>
                <td>
                  ${Number((r.stateTax || 0) + (r.cityTax || 0)).toFixed(2)}
                </td>
                <td>${Number(r.totalWithFees || 0).toFixed(2)}</td>
                <td className="hidden sm:table-cell">${Number(r.balanceDue || (r.totalWithFees - (r.downPayment||0)) || 0).toFixed(2)}</td>
                <td>
                  <span className={`badge ${r.status === 'registered' ? 'badge-success' : 'badge-ghost'}`}>
                    {r.status || 'draft'}
                  </span>
                </td>
                <td className="text-right">
                  <div className="flex justify-end gap-2">
                    <button className="btn btn-xs btn-outline" onClick={()=>setSelected(r)} title="Ver detalles">
                      <Info className="w-4 h-4" />
                    </button>
                    {r.status !== 'registered' ? (
                      <button
                        className="btn btn-xs btn-outline"
                        onClick={()=>onMarkRegistered(r)}
                        title="Marcar registrado"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                      </button>
                    ) : null}
                    <button className="btn btn-xs" onClick={()=>onEdit(r)}>
                      <Pencil className="w-4 h-4" /> Editar
                    </button>
                    <button className="btn btn-xs btn-outline btn-error" onClick={()=>onDelete(r)}>
                      <Trash2 className="w-4 h-4" /> Borrar
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={10} className="text-center opacity-60 py-8">Sin buy orders.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {open && (
        <OrderModal
          initial={editing}
          onClose={()=>setOpen(false)}
          ratesMap={ratesMap}
        />
      )}

      {selected && (
        <DetailsModal order={selected} onClose={()=>setSelected(null)} />
      )}
    </div>
  );
}

function OrderModal({ initial, onClose, ratesMap }) {
  const isEdit = !!initial;
  const { register, handleSubmit, formState:{ errors, isSubmitting }, watch, reset } = useForm({
    defaultValues: {
      buyerName: initial?.buyerName ?? "",
      address: initial?.address ?? "",
      phone: initial?.phone ?? "",
      city: initial?.city || Object.keys(CITY_TAX_RATES)[0] || "Denver",
      state: initial?.state ?? "CO",
      zip: initial?.zip ?? "",
      vin: initial?.vin ?? "",
      licenseNumber: initial?.licenseNumber ?? "",
      birthDate: initial?.birthDate ?? "",
      year: initial?.year ?? "",
      make: initial?.make ?? "",
      model: initial?.model ?? "",
      color: initial?.color ?? "",
      body: initial?.body ?? "",
      mileage: initial?.mileage ?? "",
      cylinders: initial?.cylinders ?? "",
      fuelType: initial?.fuelType ?? "",
      stockNumber: initial?.stockNumber ?? "",
      price: initial?.price ?? 0,
      fee: initial?.fee ?? 47.2,
      downPayment: initial?.downPayment ?? 0,
      salesman: initial?.salesman ?? "",
      source: initial?.source ?? "",
      status: initial?.status ?? "draft",
    }
  });

  const watched = watch();
  const calc = computeBuyOrder({ price: watched.price, city: watched.city, fee: watched.fee, downPayment: watched.downPayment }, ratesMap);
    const stateItem = (calc.taxItems || []).find(t => t.key === 'state') || { amount: 0, pct: 0 };
    const cityItem = (calc.taxItems || []).find(t => t.key === 'city') || { amount: 0, pct: 0 };

  const onSubmit = async (v) => {
    const payload = {
      buyerName: v.buyerName.trim(),
      address: v.address.trim(),
      phone: v.phone?.trim() || "",
      city: v.city,
      state: v.state || "CO",
      zip: v.zip?.trim() || "",
      vin: v.vin.trim(),
      licenseNumber: v.licenseNumber?.trim() || "",
      birthDate: v.birthDate || "",
      year: v.year,
      make: v.make.trim(),
      model: v.model.trim(),
      color: v.color?.trim() || "",
      body: v.body?.trim() || "",
      mileage: v.mileage?.trim() || "",
      cylinders: v.cylinders?.trim() || "",
      fuelType: v.fuelType?.trim() || "",
      stockNumber: v.stockNumber?.trim() || "",
      price: Number(v.price || 0),
      fee: Number(v.fee || 0),
      downPayment: Number(v.downPayment || 0),
      salesman: v.salesman?.trim() || "",
      source: v.source?.trim() || "",
      balanceDue: calc.balanceDue,
      stateTax: stateItem.amount,
      cityTax: cityItem.amount,
      totalTaxes: calc.totalTaxes,
      subtotal: calc.subtotal,
      totalWithFees: calc.totalWithFees,
      taxItems: calc.taxItems,
      status: v.status,
      updatedAt: serverTimestamp(),
    };

    if (isEdit) {
      await updateDoc(doc(db, "buyOrders", initial.id), payload);
    } else {
      await addDoc(collection(db, "buyOrders"), {
        ...payload,
        createdAt: serverTimestamp(),
      });
    }
    reset();
    onClose();
  };

  return (
    <dialog className="modal modal-open">
      <div className="modal-box max-w-3xl w-full p-6 rounded-2xl">
        <h3 className="font-bold text-2xl mb-3">{isEdit ? "Editar Buy Order" : "Nuevo Buy Order"}</h3>

        <form className="grid gap-3" onSubmit={handleSubmit(onSubmit)}>
          {/* Comprador */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="label label-text">Comprador (Nombre Completo)</label>
              <input className="input input-sm input-bordered w-full" {...register("buyerName", { required: "Requerido" })} />
              {errors.buyerName && <p className="text-error text-xs mt-1">{errors.buyerName.message}</p>}
            </div>
            <div>
              <label className="label label-text">Teléfono</label>
              <input className="input input-sm input-bordered w-full" placeholder="7208835908" {...register("phone")} />
            </div>
          </div>

          {/* Dirección */}
          <div>
            <label className="label label-text">Dirección</label>
            <input className="input input-sm input-bordered w-full" placeholder="150 S Sable Blvd Apt I205" {...register("address")} />
          </div>

          {/* City/State/Zip */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="label label-text">Ciudad</label>
              <select className="select select-sm select-bordered w-full" {...register("city")}>
                {Object.keys(CITY_TAX_RATES).map(c => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div>
              <label className="label label-text">Estado</label>
              <input className="input input-sm input-bordered w-full" placeholder="CO" {...register("state")} />
            </div>
            <div>
              <label className="label label-text">Zip Code</label>
              <input className="input input-sm input-bordered w-full" placeholder="80011" {...register("zip")} />
            </div>
          </div>

          {/* License & DOB */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="label label-text">License #</label>
              <input className="input input-sm input-bordered w-full" placeholder="17-209-0404" {...register("licenseNumber")} />
            </div>
            <div>
              <label className="label label-text">Fecha de nacimiento</label>
              <input type="date" className="input input-sm input-bordered w-full" {...register("birthDate")} />
            </div>
            <div>
              <label className="label label-text">Stock #</label>
              <input className="input input-sm input-bordered w-full" placeholder="700917" {...register("stockNumber")} />
            </div>
          </div>

          <div className="divider text-xs opacity-50">VEHÍCULO</div>

          {/* Año / Marca / Modelo */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="label label-text">Año</label>
              <input className="input input-sm input-bordered w-full" placeholder="2019" {...register("year")} />
            </div>
            <div>
              <label className="label label-text">Marca</label>
              <input className="input input-sm input-bordered w-full" placeholder="Ford" {...register("make")} />
            </div>
            <div>
              <label className="label label-text">Modelo</label>
              <input className="input input-sm input-bordered w-full" placeholder="Fusion" {...register("model")} />
            </div>
          </div>

          {/* Body / Color / Mileage */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="label label-text">Body</label>
              <input className="input input-sm input-bordered w-full" placeholder="SD" {...register("body")} />
            </div>
            <div>
              <label className="label label-text">Color</label>
              <input className="input input-sm input-bordered w-full" placeholder="Silver" {...register("color")} />
            </div>
            <div>
              <label className="label label-text">Mileage</label>
              <input className="input input-sm input-bordered w-full" placeholder="115600" {...register("mileage")} />
            </div>
          </div>

          {/* VIN / Cylinders / Fuel Type */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="label label-text">VIN</label>
              <input className="input input-sm input-bordered w-full" placeholder="3FA6P0HD9KR145902" {...register("vin")} />
            </div>
            <div>
              <label className="label label-text">Cilindros</label>
              <input className="input input-sm input-bordered w-full" placeholder="4" {...register("cylinders")} />
            </div>
            <div>
              <label className="label label-text">Fuel Type</label>
              <input className="input input-sm input-bordered w-full" placeholder="Gas" {...register("fuelType")} />
            </div>
          </div>

          <div className="divider text-xs opacity-50">PRECIO Y PAGOS</div>

          {/* Precio / Fee / Down Payment */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="label label-text">Precio de Venta ($)</label>
              <input className="input input-sm input-bordered w-full" inputMode="decimal" placeholder="10000.00" {...register("price", { required: "Requerido" })} />
              {errors.price && <p className="text-error text-xs mt-1">{errors.price.message}</p>}
            </div>
            <div>
              <label className="label label-text">Filing Fee ($)</label>
              <input className="input input-sm input-bordered w-full" inputMode="decimal" placeholder="47.20" {...register("fee")} />
            </div>
            <div>
              <label className="label label-text">Down Payment ($)</label>
              <input className="input input-sm input-bordered w-full" inputMode="decimal" placeholder="1100.00" {...register("downPayment")} />
            </div>
          </div>

          {/* Salesman / Source / Status */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="label label-text">Vendedor</label>
              <input className="input input-sm input-bordered w-full" placeholder="BODIE EDELBACH" {...register("salesman")} />
            </div>
            <div>
              <label className="label label-text">Source</label>
              <input className="input input-sm input-bordered w-full" {...register("source")} />
            </div>
            <div>
              <label className="label label-text">Status</label>
              <select className="select select-sm select-bordered w-full" {...register("status")}>
                <option value="draft">draft</option>
                <option value="registered">registered</option>
              </select>
            </div>
          </div>

          {/* Previsualización compacta (mobile friendly) */}
          <div className="card bg-base-200 p-3 rounded text-sm">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="opacity-70">Subtotal</div>
                <div className="font-semibold">${(calc.subtotal || 0).toFixed(2)}</div>
              </div>
              <div>
                <div className="opacity-70">Total impuestos</div>
                <div className="font-semibold">${(calc.totalTaxes || 0).toFixed(2)}</div>
              </div>
              <div>
                <div className="opacity-70">Fee</div>
                <div className="font-semibold">${(calc.fee || 47.2).toFixed(2)}</div>
              </div>
              <div>
                <div className="opacity-70">Total</div>
                <div className="font-semibold">${(calc.totalWithFees || 0).toFixed(2)}</div>
              </div>
            </div>

            <div className="divider my-2" />
            <div className="space-y-1 text-xs">
              {(calc.taxItems || []).map(t => (
                <div key={t.key} className="flex justify-between">
                  <div className="opacity-80">{t.name}</div>
                  <div className="font-medium">{t.pctPercent.toFixed(2)}% — ${t.amount.toFixed(2)}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="modal-action mt-4 flex justify-end gap-3">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
            <button className="btn btn-primary" disabled={isSubmitting}>{isEdit ? 'Guardar' : 'Crear'}</button>
          </div>
        </form>
      </div>
      <form method="dialog" className="modal-backdrop"><button onClick={onClose}>close</button></form>
    </dialog>
  );
}

function DetailsModal({ order, onClose }) {
  if (!order) return null;
  const printOrder = (o) => {
    const win = window.open("", "_blank", "width=800,height=900");
    if (!win) return;
    const html = `
      <html>
        <head>
          <title>Buy Order - ${o.buyerName}</title>
          <style>
            body{ font-family: Arial, Helvetica, sans-serif; padding:20px; color:#111 }
            .h{ font-size:20px; font-weight:700; margin-bottom:6px }
            .muted{ color:#666; font-size:12px }
            .row{ display:flex; justify-content:space-between; margin:8px 0 }
            .divider{ height:1px;background:#ddd;margin:12px 0 }
            .section-title{ font-weight:700; margin-top:10px }
            .small{ font-size:12px }
            @media print { body { -webkit-print-color-adjust: exact } }
          </style>
        </head>
        <body>
          <div class="h">Buy Order</div>
          <div class="muted">${new Date().toLocaleString()}</div>
          <div class="divider"></div>
          <div class="section">
            <div class="small"><strong>Comprador:</strong> ${o.buyerName}</div>
            <div class="small"><strong>Licencia:</strong> ${o.licenseNumber || '—'}</div>
            <div class="small"><strong>Fecha nacimiento:</strong> ${o.birthDate || '—'}</div>
            <div class="small"><strong>Stock/ID:</strong> ${o.stockNumber || '—'}</div>
            <div class="small"><strong>VIN:</strong> ${o.vin || '—'}</div>
            <div class="small"><strong>Auto:</strong> ${o.year || ''} ${o.make || ''} ${o.model || ''}</div>
            <div class="small"><strong>Dirección:</strong> ${o.address || ''}</div>
          </div>
          <div class="divider"></div>
          <div class="section-title">Desglose de impuestos</div>
          ${ (o.taxItems || []).map(t => `<div class="row"><div>${t.name} (${t.pctPercent.toFixed(2)}%)</div><div>$${Number(t.amount||0).toFixed(2)}</div></div>`).join('') }
          <div class="divider"></div>
          <div class="row"><div>Subtotal</div><div>$${Number(o.subtotal||0).toFixed(2)}</div></div>
          <div class="row"><div>Fee</div><div>$${Number(o.fee||0).toFixed(2)}</div></div>
          <div class="row"><div>Down Payment</div><div>$${Number(o.downPayment||0).toFixed(2)}</div></div>
          <div class="row"><div><strong>Total</strong></div><div><strong>$${Number(o.totalWithFees||0).toFixed(2)}</strong></div></div>
          <div class="row"><div><strong>Balance</strong></div><div><strong>$${Number(o.balanceDue || (o.totalWithFees - (o.downPayment||0)) || 0).toFixed(2)}</strong></div></div>
        </body>
      </html>
    `;
    win.document.write(html);
    win.document.close();
    setTimeout(()=>{ win.print(); }, 300);
  };

  return (
    <dialog className="modal modal-open">
      <div className="modal-box max-w-4xl w-full p-4 sm:p-6 rounded-2xl">
        <div className="flex flex-col md:flex-row items-start gap-6">
          <div className="flex-shrink-0">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-secondary text-base-100 font-extrabold flex items-center justify-center text-2xl shadow-2xl ring-1 ring-black/20">{initials(order.buyerName)}</div>
          </div>

          <div className="flex-1">
            <div className="flex flex-col md:flex-row items-start md:justify-between">
              <div className="flex-1 min-w-0">
                <h3 className="text-2xl font-extrabold truncate">{order.buyerName}</h3>
                <p className="text-sm opacity-70 mt-1 truncate max-w-[60ch]">{order.address}</p>
                <p className="text-sm opacity-60 mt-2">{order.year} / {order.make} / {order.model} — VIN: <span className="font-mono">{order.vin || '—'}</span></p>
              </div>

              <div className="mt-4 md:mt-0 md:ml-4 w-full md:w-44 shrink-0">
                <div className="bg-base-200 p-4 rounded-lg shadow-lg text-right">
                  <div className="text-xs opacity-70">Total</div>
                  <div className="text-2xl font-bold text-primary">${Number(order.totalWithFees || 0).toFixed(2)}</div>
                  <div className="text-xs opacity-70 mt-2">Balance</div>
                  <div className="font-semibold">${Number(order.balanceDue || (order.totalWithFees - (order.downPayment||0)) || 0).toFixed(2)}</div>
                </div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-base-200 p-3 rounded-lg shadow-sm">
                <div className="text-xs opacity-70">Licencia</div>
                <div className="font-medium">{order.licenseNumber || '—'}</div>
                <div className="text-xs opacity-70 mt-2">Fecha nacimiento</div>
                <div className="font-medium">{order.birthDate || '—'}</div>
              </div>

              <div className="bg-base-200 p-3 rounded-lg shadow-sm">
                <div className="text-xs opacity-70">Stock / ID</div>
                <div className="font-medium">{order.stockNumber || '—'}</div>
                <div className="text-xs opacity-70 mt-2">Ciudad</div>
                <div className="font-medium">{order.city || '—'}</div>
              </div>

              <div className="bg-base-200 p-3 rounded-lg shadow-sm">
                <div className="text-xs opacity-70">Down Payment</div>
                <div className="font-medium">${Number(order.downPayment || 0).toFixed(2)}</div>
                <div className="text-xs opacity-70 mt-2">Fee</div>
                <div className="font-medium">${Number(order.fee || 0).toFixed(2)}</div>
              </div>
            </div>

            <div className="mt-4">
              <div className="text-sm font-semibold mb-2">Desglose de impuestos</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {(order.taxItems || []).map((t) => (
                  <div key={t.key} className="p-3 bg-base-200 rounded-lg shadow-sm flex items-center justify-between">
                    <div>
                      <div className="font-medium">{t.name}</div>
                      <div className="text-xs opacity-70">{Number(t.pctPercent != null ? t.pctPercent : (t.pct != null ? t.pct * 100 : 0)).toFixed(2)}%</div>
                    </div>
                    <div className="font-semibold">${Number(t.amount || 0).toFixed(2)}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="modal-action mt-6 justify-end gap-2">
          <button className="btn btn-outline" onClick={()=>printOrder(order)}>Imprimir</button>
            <button 
            className="btn btn-secondary gap-2" 
            onClick={async () => {
              try {
                // Generar PDF en modo normal (sin debug)
                await fillBuyOrderPDF(order);
              } catch (err) {
                console.error('Error al generar PDF:', err);
              }
            }}
          >
            <FileText className="w-4 h-4" />
            Generar PDF
          </button>
          <button className="btn btn-primary" onClick={onClose}>Cerrar</button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop"><button onClick={onClose}>close</button></form>
    </dialog>
  );
}
