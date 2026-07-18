import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "./auth/AuthContext";
import { AppErrorBoundary } from "./components/AppErrorBoundary";
import { FeedbackProvider } from "./components/feedback";
import "./tailwind.css";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <FeedbackProvider>
        <AppErrorBoundary>
          <AuthProvider>
            <App />
          </AuthProvider>
        </AppErrorBoundary>
      </FeedbackProvider>
    </BrowserRouter>
  </StrictMode>,
);
