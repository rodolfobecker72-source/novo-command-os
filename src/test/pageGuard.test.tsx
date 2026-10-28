import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { PageGuard } from "@/components/auth/PageGuard";

const authState: { membership: unknown; allowed: string[] } = { membership: null, allowed: [] };

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    isLoading: false,
    membership: authState.membership,
    hasPageAccess: (key: string) => authState.allowed.includes(key),
    logout: vi.fn(),
  }),
}));

vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/boas-vindas" element={<PageGuard pageKey="boas-vindas"><p>welcome</p></PageGuard>} />
        <Route path="/crm" element={<PageGuard pageKey="crm"><p>crm page</p></PageGuard>} />
      </Routes>
    </MemoryRouter>,
  );

describe("PageGuard", () => {
  beforeEach(() => {
    authState.membership = { role: "vendedor" };
    authState.allowed = [];
  });

  it("renders the page when access is allowed", () => {
    authState.allowed = ["boas-vindas"];
    renderAt("/boas-vindas");
    expect(screen.getByText("welcome")).toBeInTheDocument();
  });

  it("redirects to the first accessible page instead of a blank screen", () => {
    authState.allowed = ["crm"];
    renderAt("/boas-vindas");
    expect(screen.getByText("crm page")).toBeInTheDocument();
  });

  it("explains when no page is accessible", () => {
    renderAt("/boas-vindas");
    expect(screen.getByText("Nenhuma página liberada")).toBeInTheDocument();
  });

  it("explains when the user has no workspace", () => {
    authState.membership = null;
    renderAt("/crm");
    expect(screen.getByText("Conta sem empresa vinculada")).toBeInTheDocument();
  });
});
