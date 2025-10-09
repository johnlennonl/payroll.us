// src/components/layout/AppLayout.jsx
import React from "react";
import Topbar from "./Topbar.jsx";
import Sidebar from "./Sidebar.jsx";
import { Outlet } from "react-router-dom";

export default function AppLayout() {
  return (
    <div className="drawer lg:drawer-open min-h-screen"> {/* 👈 altura total */}
      <input id="app-drawer" type="checkbox" className="drawer-toggle" />
      {/* CONTENIDO */}
      <div className="drawer-content flex flex-col min-h-screen"> {/* 👈 ocupa alto */}
        <Topbar />
        <main className="p-6 flex-1">   {/* 👈 que crezca y no quede 0px */}
          <Outlet />
        </main>
      </div>
      {/* SIDEBAR */}
      <div className="drawer-side z-40">  {/* 👈 z-index por si acaso */}
        <label htmlFor="app-drawer" className="drawer-overlay"></label>
        <Sidebar />
      </div>
    </div>
  );
}
