import { lazy, Suspense, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./hooks/useAuth";
import { ThemeProvider } from "./context/ThemeProvider";

const LandingPage = lazy(() =>
  import("./pages/LandingPage").then((m) => ({ default: m.LandingPage })),
);
const LoginPage = lazy(() =>
  import("./pages/LoginPage").then((m) => ({ default: m.LoginPage })),
);
const DashboardOverview = lazy(() =>
  import("./pages/DashboardOverview").then((m) => ({ default: m.DashboardOverview })),
);
const DashboardLayout = lazy(() =>
  import("./components/layout/DashboardLayout").then((m) => ({ default: m.DashboardLayout })),
);
const Reports = lazy(() => import("./pages/Reports").then((m) => ({ default: m.Reports })));
const DashboardSettings = lazy(() =>
  import("./pages/DashboardSettings").then((m) => ({ default: m.DashboardSettings })),
);

function Loader() {
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

function AuthGate({ children }: { children: React.ReactNode }) {
  const auth = useAuth();

  if (auth.isLoading) {
    return <Loader />;
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
    return <Loader />;
  }

  return (
    <Suspense fallback={<Loader />}>
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
        <Route path="reports" element={<Reports />} />
        <Route path="settings" element={<DashboardSettings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
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
