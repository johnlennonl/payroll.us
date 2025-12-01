import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import './index.css';
import 'sweetalert2/dist/sweetalert2.min.css';
import { AuthProvider } from "./providers/AuthProvider.jsx";
import { UnsavedChangesProvider } from './providers/UnsavedChangesProvider.jsx';

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
      <BrowserRouter>
        <AuthProvider>
          <UnsavedChangesProvider>
            <App />
          </UnsavedChangesProvider>
        </AuthProvider>
      </BrowserRouter>
  </React.StrictMode>
);
