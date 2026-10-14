import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import App from "./App";
import { AuthProvider } from "./auth/AuthContext";
import { TeamProvider } from "./team/TeamContext";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <TeamProvider>
          <App />
        </TeamProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
