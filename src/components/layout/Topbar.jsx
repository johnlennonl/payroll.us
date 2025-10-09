import React from "react";
import { useAuth } from "../../providers/AuthProvider.jsx";
import ThemeToggle from "../ui/ThemeToggle.jsx";

export default function Topbar() {
  const { user } = useAuth();

  return (
    <div className="navbar bg-base-100/70 backdrop-blur sticky top-0 z-40 border-b border-base-300 shadow-sm px-4">
      {/* Izquierda */}
      <div className="flex-1 gap-3">
        <label htmlFor="app-drawer" className="btn btn-ghost lg:hidden text-lg">☰</label>


      </div>

      
      {/* Derecha */}
      <div className="flex items-center gap-3">
        <div className="hidden md:block text-sm opacity-70">
          {user?.email}
        </div>

        {/* 👇 nuevo switch de tema (único) */}
        <ThemeToggle className="btn btn-ghost btn-circle" />

      </div>
    </div>
  );
}

