import { useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./hooks/useAuth";
import { ThemeProvider } from "./context/ThemeProvider";
import { LandingPage } from "./pages/LandingPage";
import { LoginPage } from "./pages/LoginPage";
import { Dashboard } from "./pages/Dashboard";
import { DashboardOverview } from "./pages/DashboardOverview";
import { DashboardLayout } from "./components/layout/DashboardLayout";
import { Reports as DashboardReports } from "./pages/Reports";
import { DashboardSettings } from "./pages/DashboardSettings";

function AuthGate({ children }: { children: React.ReactNode }) {
  const auth = useAuth();

  if (auth.isLoading) {
    return (
      <div
        style={{
          width: "100%",
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div className="spinner spinner--light" />
      </div>
    );
  }

  if (!auth.isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function AppLayout() {
  const auth = useAuth();
  const [authError, setAuthError] = useState<string | null>(null);

  if (auth.isLoading) {
    return (
      <div
        style={{
          width: "100%",
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div className="spinner spinner--light" />
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route
        path="/login"
        element={
          auth.isAuthenticated ? (
            <Navigate to="/dashboard" replace />
          ) : (
            <LoginPage
              onLogin={async (email, password) => {
                setAuthError(null);
                try {
                  await auth.login(email, password);
                } catch (e) {
                  setAuthError(e instanceof Error ? e.message : "Invalid email or password");
                  throw e;
                }
              }}
              onRegister={async (email, password, firstName, lastName) => {
                setAuthError(null);
                try {
                  await auth.register(email, password, firstName, lastName);
                } catch (e) {
                  setAuthError(e instanceof Error ? e.message : "Registration failed");
                  throw e;
                }
              }}
              error={authError}
              clearError={() => setAuthError(null)}
            />
          )
        }
      />
      <Route
        path="/dashboard"
        element={
          <AuthGate>
            <DashboardLayout />
          </AuthGate>
        }
      >
        <Route index element={<DashboardOverview />} />
        <Route path="preview" element={<Dashboard />} />
        <Route path="reports" element={<DashboardReports />} />
        <Route path="settings" element={<DashboardSettings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <AppLayout />
      </BrowserRouter>
    </ThemeProvider>
  );
}
