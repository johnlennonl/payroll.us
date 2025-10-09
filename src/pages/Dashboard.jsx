import React from "react";
import { useAuth } from "../providers/AuthProvider.jsx";
import { Users, FileText, ShieldCheck, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { motion } from "framer-motion";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../lib/firebase";

function pctChange(curr, prev) {
  if (!isFinite(prev) || prev === 0) return curr > 0 ? 100 : 0;
  return ((curr - prev) / prev) * 100;
}
function fmtPct(n) {
  const s = (n >= 0 ? "+" : "") + n.toFixed(1) + "%";
  return s;
}

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = React.useState({
    clientsTotal: 0,
    clients30d: 0,
    clients30dPrev: 0,
    paystubs30d: 0,
    paystubs30dPrev: 0,
    policies: 12, // simulado por ahora
  });

  React.useEffect(() => {
  const fetchStats = async () => {
    try {
      const now = new Date();
      const since = new Date(now);
      since.setDate(since.getDate() - 30);
      const prevSince = new Date(since);
      prevSince.setDate(prevSince.getDate() - 30);

      // --- CLIENTES ---
      const clientsAllSnap = await getDocs(collection(db, "clients"));
      const clientsTotal = clientsAllSnap.size;

      const clientsNowQ = query(collection(db, "clients"), where("createdAt", ">", since));
      const clientsNowSnap = await getDocs(clientsNowQ);
      const clients30d = clientsNowSnap.size;

      const clientsPrevQ = query(
        collection(db, "clients"),
        where("createdAt", ">=", prevSince),
        where("createdAt", "<", since)
      );
      const clientsPrevSnap = await getDocs(clientsPrevQ);
      const clients30dPrev = clientsPrevSnap.size;

      // --- PAYSTUBS ---
      const payNowQ = query(collection(db, "paystubs"), where("createdAt", ">", since));
      const payNowSnap = await getDocs(payNowQ);
      const paystubs30d = payNowSnap.size;

      const payPrevQ = query(
        collection(db, "paystubs"),
        where("createdAt", ">=", prevSince),
        where("createdAt", "<", since)
      );
      const payPrevSnap = await getDocs(payPrevQ);
      const paystubs30dPrev = payPrevSnap.size;

      // --- POLIZAS ACTIVAS ---
      const activeInsQ = query(collection(db, "insurances"), where("status", "==", "active"));
      const activeInsSnap = await getDocs(activeInsQ);
      const policies = activeInsSnap.size;

      setStats({
        clientsTotal,
        clients30d,
        clients30dPrev,
        paystubs30d,
        paystubs30dPrev,
        policies,
      });
    } catch (err) {
      console.error("Error obteniendo estadísticas:", err);
    }
  };

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
      title: "Pólizas activas",
      icon: <ShieldCheck className="w-8 h-8" />,
      color: "text-accent",
      value: stats.policies.toLocaleString(),
      desc: "Integrar con Firestore luego",
    },
  ];

  return (
    <motion.div
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
          <div className="avatar mt-4 md:mt-0">
            <div className="w-16 rounded-full ring ring-primary ring-offset-base-100 ring-offset-2 overflow-hidden">
              <img
                src="https://upload.wikimedia.org/wikipedia/commons/thumb/8/88/United-states_flag_icon_round.svg/1024px-United-states_flag_icon_round.svg.png"
                alt="Avatar"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Estadísticas dinámicas */}
      <div className="grid gap-6 md:grid-cols-3">
        {cards.map((item, i) => (
          <motion.div
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
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
