import React, { useState } from "react";
import { useAuth } from "../providers/AuthProvider.jsx";
import { useNavigate } from "react-router-dom";

export default function Login() {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isRegister, setIsRegister] = useState(false);
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
    <div className="min-h-screen grid place-items-center bg-base-200">
      <div className="card bg-base-100 shadow-xl w-full max-w-md">
        <div className="card-body">
          <div className="flex justify-center"> 
            <img className="w-72 mb-4 mx-auto" src="https://www.commonwealthpayroll.net/wp-content/uploads/2025/04/12-e1745509219572.png" alt="Logotipo" />
          </div>
          <p className="opacity-70 mb-2">
            Tu plataforma de clientes, paystubs e insurance
          </p>

          {error && <div className="alert alert-error mb-2">{error}</div>}

          <form className="grid gap-3" onSubmit={onSubmit}>
            <input
              className="input input-bordered w-full"
              placeholder="Correo"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <input
              className="input input-bordered w-full"
              placeholder="Contraseña"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button className="btn btn-primary w-full">
              {isRegister ? "Crear cuenta" : "Entrar"}
            </button>
          </form>

          <button
            className="btn btn-ghost btn-sm mt-2"
            onClick={() => setIsRegister((v) => !v)}
          >
            {isRegister
              ? "¿Ya tienes cuenta? Inicia sesión"
              : "¿Nuevo por aquí? Regístrate"}
          </button>
        </div>
      </div>
    </div>
  );
}
