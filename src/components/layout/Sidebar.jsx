// src/components/layout/Sidebar.jsx
import React from "react";
import { NavLink } from "react-router-dom";
import { LayoutDashboard, Users, Receipt, Shield, Settings, LogOut } from "lucide-react";
import { useAuth } from "../../providers/AuthProvider.jsx";

const Item = ({ to, icon: IconCmp, label }) => (
  <li>
    <NavLink
      to={to}
      end
      className={({ isActive }) =>
        `flex items-center gap-3 rounded-xl px-3 py-2 transition
          ${isActive ? "bg-primary/15 text-primary font-semibold" : "hover:bg-base-200/60"}`
      }
    >
      {IconCmp ? <IconCmp className="w-4 h-4" /> : null}
      <span>{label}</span>
    </NavLink>
  </li>
);

export default function Sidebar() {
  const { logout } = useAuth();

  return (
    <aside className="w-72 min-h-full bg-base-100/80 backdrop-blur-md border-r border-base-300 flex flex-col">
      {/* header */}
      <div className="flex  items-center gap-2 px-4 py-4 ">
        <img src="https://www.commonwealthpayroll.net/wp-content/uploads/2025/04/12-e1745509219572.png" alt="logo" className="w-60 " />
      </div>
      {/* nav */}
      <nav className="p-3 flex-1">
        <ul className="menu gap-1">
          <Item to="/dashboard" icon={LayoutDashboard} label="Dashboard" />
          <Item to="/clients" icon={Users} label="Clientes" />
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
