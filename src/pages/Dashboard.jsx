import React from "react";
import { useAuth } from "../providers/AuthProvider.jsx";
import { Users, FileText, ShieldCheck, TrendingUp, TrendingDown, Minus, ShoppingCart, Eye, Printer, CheckCircle2 } from "lucide-react";
import Brand from "../components/Brand.jsx";
import { motion as Motion } from "framer-motion";
import { collection, getDocs, query, where, orderBy, limit, onSnapshot, updateDoc, doc, serverTimestamp } from "firebase/firestore";
import { db } from "../lib/firebase";
import { Link, useNavigate } from "react-router-dom";

function pctChange(curr, prev) {
  if (!isFinite(prev) || prev === 0) return curr > 0 ? 100 : 0;
  return ((curr - prev) / prev) * 100;
}
function fmtPct(n) {
  const s = (n >= 0 ? "+" : "") + n.toFixed(1) + "%";
  return s;
}

// end of helpers

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = React.useState({
    clientsTotal: 0,
    clients30d: 0,
    clients30dPrev: 0,
    paystubs30d: 0,
    paystubs30dPrev: 0,
    policies: 0,
    buyOrdersTotal: 0,
    buyOrdersPending: 0,
  });

  React.useEffect(() => {
    async function fetchStats() {
      try {
        const clientsSnap = await getDocs(collection(db, 'clients'));
        const clientsTotal = clientsSnap.size;

        const paystubsSnap = await getDocs(collection(db, 'paystubs'));
        const paystubs30d = paystubsSnap.size;

        const policiesSnap = await getDocs(collection(db, 'insurances'));
        const policies = policiesSnap.size;

        const buyOrdersSnap = await getDocs(collection(db, 'buyOrders'));
        const buyOrdersTotal = buyOrdersSnap.size;

        const qPending = query(collection(db, 'buyOrders'), where('status', '==', 'pending'));
        const pendingSnap = await getDocs(qPending);
        const buyOrdersPending = pendingSnap.size;

        setStats({
          clientsTotal,
          clients30d: 0,
          clients30dPrev: 0,
          paystubs30d,
          paystubs30dPrev: 0,
          policies,
          buyOrdersTotal,
          buyOrdersPending,
        });
      } catch (err) {
        console.error('Error obteniendo estadísticas:', err);
      }
    }

    fetchStats();
  }, []);

  // cálculos de % growth
  const growthClients = pctChange(stats.clients30d, stats.clients30dPrev);
  const growthPaystubs = pctChange(stats.paystubs30d, stats.paystubs30dPrev);

  // helpers para etiqueta de crecimiento
  const GrowthTag = ({ value }) => {
    if (!isFinite(value)) return (
      <span className="badge badge-ghost gap-1">
        <Minus className="w-3 h-3" /> s/d
      </span>
    );
    const positive = value >= 0;
    const Icon = positive ? TrendingUp : TrendingDown;
    const color = positive ? "badge-success" : "badge-error";
    return (
      <span className={`badge ${color} gap-1`}>
        <Icon className="w-3 h-3" />
        {fmtPct(value)}
      </span>
    );
  };

  const cards = [
    {
      title: "Clientes",
      icon: <Users className="w-8 h-8" />,
      color: "text-primary",
      value: stats.clientsTotal.toLocaleString(),
      desc: (
        <div className="flex items-center gap-2">
          <span className="opacity-80">+{stats.clients30d} en 30d</span>
          <GrowthTag value={growthClients} />
        </div>
      ),
    },
    {
      title: "Paystubs (30d)",
      icon: <FileText className="w-8 h-8" />,
      color: "text-secondary",
      value: stats.paystubs30d.toLocaleString(),
      desc: (
        <div className="flex items-center gap-2">
          <span className="opacity-80">vs 30d previos</span>
          <GrowthTag value={growthPaystubs} />
        </div>
      ),
    },
    {
      title: "Buy Orders",
      icon: <ShoppingCart className="w-8 h-8" />,
      color: "text-info",
      value: (stats.buyOrdersTotal || 0).toLocaleString(),
      desc: "Total de buy orders registrados",
    },
    {
      title: "Pólizas activas",
      icon: <ShieldCheck className="w-8 h-8" />,
      color: "text-accent",
      value: stats.policies.toLocaleString(),
      desc: "Integrar con Firestore luego",
    },
  ];

  return (
    <Motion.div
      className="min-h-screen bg-gradient-to-br from-base-200 to-base-300 p-6"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
    >
      {/* Header de bienvenida */}
      <div className="card bg-base-100 shadow-xl mb-6 border border-base-300">
        <div className="card-body flex flex-col md:flex-row items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">
              ¡Bienvenido,{" "}
              <span className="text-primary">{user?.email?.split("@")[0]}</span>!
            </h2>
            <p className="opacity-70 mt-1">
              Aquí podrás visualizar métricas clave, clientes y movimientos recientes.
            </p>
          </div>
          <div className="hidden sm:block mt-4 md:mt-0">
            <div className="w-full max-w-xs">
              <Brand variant="undraw" size="lg" className="rounded-lg" />
            </div>
          </div>
        </div>
      </div>

      {/* Estadísticas dinámicas */}
      <div className="grid gap-6 md:grid-cols-4">
        {cards.map((item, i) => (
          <Motion.div
            key={i}
            className="stat bg-base-100 shadow-md rounded-xl hover:shadow-lg transition"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.2, duration: 0.5 }}
          >
            <div className={`stat-figure ${item.color}`}>{item.icon}</div>
            <div className="stat-title">{item.title}</div>
            <div className={`stat-value ${item.color}`}>{item.value}</div>
            <div className="stat-desc text-sm">{item.desc}</div>
          </Motion.div>
        ))}
      </div>

      {/* Últimos Buy Orders */}
      <div className="mt-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold">Últimos Buy Orders</h3>
          <Link to="/buyorders" className="btn btn-sm btn-ghost">Ver todos</Link>
        </div>
        <BuyOrdersPreview />
      </div>
    </Motion.div>
  );
}

function BuyOrdersPreview() {
  const [orders, setOrders] = React.useState([]);
  const navigate = useNavigate();

  React.useEffect(() => {
    const q = query(collection(db, "buyOrders"), orderBy("createdAt", "desc"), limit(5));
    const unsub = onSnapshot(q, (snap) => {
      setOrders(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => console.error("Error snapshot buy orders:", err));
    return () => unsub();
  }, []);

  if (!orders.length) return (
    <div className="card p-4 bg-base-100">No hay buy orders recientes.</div>
  );
  return (
    <>
      {/* Mobile card list */}
      <div className="md:hidden space-y-3">
        {orders.map(o => (
          <div key={o.id} className="card p-3 bg-base-100 rounded shadow-sm" onClick={() => navigate(`/buyorders?id=${o.id}`)}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="font-medium text-sm truncate">{o.buyerName || o.buyerEmail || '—'}</div>
                <div className="text-xs opacity-70 truncate">
                  {(() => {
                    const year = o.year || o.vehicle?.year;
                    const make = o.make || o.vehicle?.make;
                    const model = o.model || o.vehicle?.model;
                    const vin = o.vin || o.vehicle?.vin;
                    const parts = [year, make, model].filter(Boolean);
                    if (parts.length) return parts.join(' ');
                    if (vin) return vin;
                    return '—';
                  })()}
                </div>
                <div className="text-xs opacity-70 mt-1">{o.city || '—'}</div>
              </div>
              <div className="text-right">
                <div className="text-sm">{Number(o.totalWithFees || o.subtotal || 0).toLocaleString(undefined, { style: 'currency', currency: 'USD' })}</div>
                <div className="text-xs opacity-70">{o.createdAt?.toDate ? o.createdAt.toDate().toLocaleDateString() : '—'}</div>
                <div className="flex items-center justify-end gap-2 mt-2">
                  <button className="btn btn-ghost btn-xs" onClick={(e) => { e.stopPropagation(); const win = window.open('', '_blank', 'width=800,height=900'); if (!win) return; win.document.write('<html><body><h3>Buy Order</h3><pre>'+JSON.stringify(o,null,2)+'</pre></body></html>'); win.document.close(); setTimeout(()=>win.print(),300); }} title="Imprimir"><Printer className="w-4 h-4" /></button>
                  <button className="btn btn-ghost btn-xs" onClick={async (e) => { e.stopPropagation(); if (!confirm('Marcar como registrado?')) return; await updateDoc(doc(db, 'buyOrders', o.id), { status: 'registered', updatedAt: serverTimestamp() }); }} title="Marcar registrado"><CheckCircle2 className="w-4 h-4" /></button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto bg-base-100 rounded-xl">
        <table className="table">
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Vehículo</th>
              <th className="text-right">Precio</th>
              <th className="text-right">Total</th>
              <th className="text-right">Fecha</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {orders.map(o => (
              <tr key={o.id} className="hover:bg-base-200 hover:shadow-sm transition cursor-pointer" onClick={() => navigate(`/buyorders?id=${o.id}`)}>
                <td>{o.buyerName || o.buyerEmail || '—'}</td>
                <td>
                  {(() => {
                    const year = o.year || o.vehicle?.year;
                    const make = o.make || o.vehicle?.make;
                    const model = o.model || o.vehicle?.model;
                    const vin = o.vin || o.vehicle?.vin;
                    const parts = [year, make, model].filter(Boolean);
                    if (parts.length) return parts.join(' ');
                    if (vin) return vin;
                    return '—';
                  })()}
                </td>
                <td className="text-right">{Number(o.price).toLocaleString(undefined, { style: 'currency', currency: 'USD' })}</td>
                <td className="text-right">{Number(o.totalWithFees || o.subtotal || 0).toLocaleString(undefined, { style: 'currency', currency: 'USD' })}</td>
                <td className="text-right">{o.createdAt?.toDate ? o.createdAt.toDate().toLocaleDateString() : '—'}</td>
                <td className="text-right">
                  <div className="flex justify-end gap-2">
                    <button className="btn btn-ghost btn-xs" onClick={(e) => { e.stopPropagation(); const win = window.open('', '_blank', 'width=800,height=900'); if (!win) return; win.document.write('<html><body><h3>Buy Order</h3><pre>'+JSON.stringify(o,null,2)+'</pre></body></html>'); win.document.close(); setTimeout(()=>win.print(),300); }} title="Imprimir"><Printer className="w-4 h-4" /></button>
                    <button className="btn btn-ghost btn-xs" onClick={async (e) => { e.stopPropagation(); if (!confirm('Marcar como registrado?')) return; await updateDoc(doc(db, 'buyOrders', o.id), { status: 'registered', updatedAt: serverTimestamp() }); }} title="Marcar registrado"><CheckCircle2 className="w-4 h-4" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
