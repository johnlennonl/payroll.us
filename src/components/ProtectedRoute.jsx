import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../providers/AuthProvider.jsx";

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return children;
}
