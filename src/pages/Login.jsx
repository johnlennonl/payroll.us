import React, { useState } from "react";
import { useAuth } from "../providers/AuthProvider.jsx";
import { useNavigate, Link } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import Brand from "../components/Brand.jsx";

export default function Login() {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isRegister, setIsRegister] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      if (isRegister) {
        await register(email, password);
      } else {
        await login(email, password);
      }
      navigate("/dashboard"); // 👈 redirige al dashboard al entrar
    } catch (err) {
      console.error(err.code, err.message); // para ver el problema en consola
      setError(err.message);
    }
  };
  return (
    <div className="min-h-screen grid place-items-center bg-base-200 px-4">
      <div className="w-full max-w-lg">
        <div className="card bg-base-100 shadow-2xl rounded-xl overflow-hidden">
          <div className="p-8">
              <div className="flex justify-center mb-4">
                <Link to="/dashboard" aria-label="Ir al dashboard" className="block">
                  <Brand variant="logo" size="lg" className="h-auto mx-auto max-w-[220px]" />
                </Link>
              </div>

            <h3 className="text-lg font-semibold mb-2">{isRegister ? "Crea tu cuenta" : "Inicia sesión"}</h3>
            <p className="text-sm opacity-60 mb-4">Ingresa tus credenciales para continuar.</p>

            {error && <div className="alert alert-error mb-3">{error}</div>}

            <form className="grid gap-3" onSubmit={onSubmit}>
              <label className="label">
                <span className="label-text">Correo</span>
              </label>
              <input
                className="input input-bordered w-full"
                placeholder="correo@ejemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                inputMode="email"
              />

              <label className="label">
                <span className="label-text">Contraseña</span>
              </label>
              <div className="relative">
                <input
                  className="input input-bordered w-full pr-12"
                  placeholder="Contraseña"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="absolute right-2 top-2 text-base-300 hover:text-base-400"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>

              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2">
                  <input type="checkbox" className="checkbox checkbox-sm" />
                  <span className="text-sm opacity-70">Recordarme</span>
                </label>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => alert('Función de restablecimiento no configurada')}>Olvidé mi contraseña</button>
              </div>

              <button className="btn btn-primary w-full py-3">
                {isRegister ? "Crear cuenta" : "Entrar"}
              </button>
            </form>

            <div className="flex items-center justify-between mt-4">
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setIsRegister((v) => !v)}
              >
                {isRegister ? "¿Ya tienes cuenta? Inicia sesión" : "¿Nuevo por aquí? Regístrate"}
              </button>
              <span className="text-xs opacity-60">v1.0.0</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
