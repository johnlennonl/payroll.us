import React, { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";

/**
 * Toggle de tema (dark/light) con persistencia y UI compacta.
 * - Guarda en localStorage ("theme").
 * - Lee al iniciar (o usa preferencia del sistema).
 * - Cambia data-theme en <html>.
 */
export default function ThemeToggle({ className = "" }) {
  const [theme, setTheme] = useState("dark");

  // Lee tema guardado o sistema
  useEffect(() => {
    const saved = localStorage.getItem("theme");
    if (saved === "light" || saved === "dark") {
      applyTheme(saved);
      return;
    }
    const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
    applyTheme(prefersDark ? "dark" : "light");
  }, []);

  // Opcional: si el usuario cambia el tema del sistema en vivo
  useEffect(() => {
    const mm = window.matchMedia?.("(prefers-color-scheme: dark)");
    const handler = (e) => {
      if (!localStorage.getItem("theme")) {
        applyTheme(e.matches ? "dark" : "light");
      }
    };
    mm?.addEventListener?.("change", handler);
    return () => mm?.removeEventListener?.("change", handler);
  }, []);

  const applyTheme = (t) => {
    document.documentElement.setAttribute("data-theme", t);
    localStorage.setItem("theme", t);
    setTheme(t);
  };

  const toggle = () => applyTheme(theme === "dark" ? "light" : "dark");

  return (
    <button
      onClick={toggle}
      className={`btn btn-sm btn-ghost gap-2 ${className}`}
      aria-label="Cambiar tema"
      title={theme === "dark" ? "Cambiar a claro" : "Cambiar a oscuro"}
    >
      {/* Icono con swap suave */}
      <span className="relative w-5 h-5 inline-grid place-items-center">
        <Sun className={`w-5 h-5 transition-all duration-200 ${theme === "dark" ? "opacity-0 rotate-90" : "opacity-100 rotate-0"}`} />
        <Moon className={`w-5 h-5 absolute transition-all duration-200 ${theme === "dark" ? "opacity-100 rotate-0" : "opacity-0 -rotate-90"}`} />
      </span>
    </button>
  );
}
