import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import AppLayout from "./components/layout/AppLayout.jsx";
import Login from "./pages/Login.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import BuyOrders from "./pages/BuyOrders.jsx";
import Clients from "./pages/Clients.jsx";
import ClientDetail from "./pages/ClientDetail.jsx";
import Paystubs from "./pages/Paystubs.jsx";
import Insurance from "./pages/Insurance.jsx";
import Settings from "./pages/Settings.jsx";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="clients" element={<Clients />} />
        <Route path="clients/:id" element={<ClientDetail />} />
        <Route path="buyorders" element={<BuyOrders />} />
        <Route path="paystubs" element={<Paystubs />} />
        <Route path="insurance" element={<Insurance />} />
        <Route path="settings" element={<Settings />} />
      </Route>

      <Route path="*" element={<div className="p-8">404 — Esa ruta no existe</div>} />
    </Routes>
  );
}
