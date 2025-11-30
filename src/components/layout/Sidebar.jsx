// src/components/layout/Sidebar.jsx
import React from "react";
import { NavLink } from "react-router-dom";
import { Link } from "react-router-dom";
import { LayoutDashboard, Users, Receipt, Shield, Settings, LogOut, ShoppingCart } from "lucide-react";
import { useAuth } from "../../providers/AuthProvider.jsx";
import Brand from "../Brand.jsx";

const Item = ({ to, icon: IconCmp, label }) => {
  const handleClick = () => {
    try {
      const cb = document.getElementById('app-drawer');
      if (cb && cb.tagName === 'INPUT' && cb.type === 'checkbox') cb.checked = false;
    } catch {
      // ignore in non-browser contexts
    }
  };

  return (
    <li>
      <NavLink
        to={to}
        end
        onClick={handleClick}
        className={({ isActive }) =>
          `flex items-center gap-4 rounded-xl px-4 py-3 transition text-sm
            ${isActive ? "bg-primary/10 text-primary font-semibold ring-1 ring-primary/20 shadow-md" : "hover:bg-base-200/50"}`
        }
      >
        {IconCmp ? <IconCmp className="w-5 h-5" /> : null}
        <span>{label}</span>
      </NavLink>
    </li>
  );
};

export default function Sidebar() {
  const { logout } = useAuth();

  return (
    <aside className="w-64 lg:w-72 min-h-full bg-gradient-to-b from-base-100/80 to-base-200/75 backdrop-blur-md border-r border-base-300 shadow-xl flex flex-col">
      {/* header */}
      <div className="flex flex-col items-center justify-center px-6 py-6 border-b border-base-300">
        <div className="w-full flex items-center justify-center">
          <Link to="/dashboard" aria-label="Ir al dashboard" className="block">
            <Brand variant="logo" size="lg" className="h-auto mx-auto max-w-[160px] lg:max-w-[220px]" />
          </Link>
        </div>
      </div>
      {/* nav */}
      <nav className="px-4 py-6 flex-1">
        <ul className="space-y-2">
          <Item to="/dashboard" icon={LayoutDashboard} label="Dashboard" />
          <Item to="/clients" icon={Users} label="Clientes" />
          <Item to="/buyorders" icon={ShoppingCart} label="Buy Orders" />
          <Item to="/paystubs" icon={Receipt} label="Paystubs" />
          <Item to="/insurance" icon={Shield} label="Insurance" />
          <Item to="/settings" icon={Settings} label="Ajustes" />
        </ul>
      </nav>
      {/* footer */}
      <div className="p-3 border-t border-base-300">
        <button onClick={logout} className="btn btn-error btn-outline w-full gap-2">
          <LogOut className="w-4 h-4" /> Cerrar Sesión
        </button>
      </div>
    </aside>
  );
}
