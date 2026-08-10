import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { DashboardHeader } from "./DashboardHeader";

const DESKTOP_BREAKPOINT = 1024;

export function DashboardLayout() {
  const [isDesktop, setIsDesktop] = useState(
    () => window.innerWidth >= DESKTOP_BREAKPOINT,
  );
  const [sidebarOpen, setSidebarOpen] = useState(
    () => window.innerWidth >= DESKTOP_BREAKPOINT,
  );

  useEffect(() => {
    const handleResize = () => {
      const desktop = window.innerWidth >= DESKTOP_BREAKPOINT;
      setIsDesktop(desktop);
      if (!desktop) {
        setSidebarOpen(false);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const collapseSidebar = () => setSidebarOpen(false);

  return (
    <div className="fixed inset-0 bg-[var(--color-bg)]">
      {/* Mobile backdrop */}
      {!isDesktop && (
        <div
          className={`fixed inset-0 z-40 bg-[var(--color-overlay)] transition-opacity duration-300 ${
            sidebarOpen ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
          onClick={collapseSidebar}
          aria-hidden="true"
        />
      )}

      {isDesktop ? (
        /* Desktop: CSS Grid — smooth width transition */
        <div
          className="grid h-full"
          style={{
            gridTemplateColumns: sidebarOpen ? "220px 1fr" : "0px 1fr",
            transition: "grid-template-columns 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
            willChange: "grid-template-columns",
          }}
        >
          <div className="overflow-hidden">
            <Sidebar onCollapse={collapseSidebar} />
          </div>
          <div className="flex min-w-0 flex-col overflow-y-auto">
            <DashboardHeader sidebarOpen={sidebarOpen} onToggleSidebar={() => setSidebarOpen(true)} />
            <main className="min-h-0 flex-1 overflow-y-auto">
              <div className="mx-auto w-full max-w-[1280px] px-6 py-8 sm:px-10 lg:px-24 lg:py-16">
                <Outlet />
              </div>
            </main>
          </div>
        </div>
      ) : (
        /* Mobile: fixed sidebar with translateX */
        <div className="flex h-full">
          <div
            className="fixed inset-y-0 left-0 z-50 flex"
            style={{
              transform: sidebarOpen ? "translateX(0)" : "translateX(-220px)",
              transition: "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
            }}
          >
            <Sidebar onCollapse={collapseSidebar} />
          </div>
          <div className="flex min-w-0 flex-1 flex-col">
            <DashboardHeader sidebarOpen={sidebarOpen} onToggleSidebar={() => setSidebarOpen(true)} />
            <main className="min-h-0 flex-1 overflow-y-auto">
              <div className="mx-auto w-full max-w-[1280px] px-6 py-8 sm:px-10 lg:px-24 lg:py-16">
                <Outlet />
              </div>
            </main>
          </div>
        </div>
      )}
    </div>
  );
}
