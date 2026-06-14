import { Link } from "react-router-dom";
import { useAuth0 } from "@auth0/auth0-react";
import type { ReactNode } from "react";
import type { User } from "@soulseer/shared";

export function Nav({ me }: { me: User | null }) {
  const { isAuthenticated, loginWithRedirect, logout } = useAuth0();
  return (
    <nav className="nav">
      <Link to="/" className="brand-link">SoulSeer</Link>
      <div className="nav-links">
        <Link to="/readers">Readers</Link>
        <Link to="/community">Community</Link>
        <Link to="/about">About</Link>
        <Link to="/help">Help</Link>
        {isAuthenticated && <Link to="/dashboard">Dashboard</Link>}
        {me?.role === "admin" && <Link to="/dashboard">Admin</Link>}
        {isAuthenticated ? (
          <button className="btn btn-ghost" onClick={() => logout({ logoutParams: { returnTo: window.location.origin } })}>
            Log Out
          </button>
        ) : (
          <button className="btn" onClick={() => loginWithRedirect()}>Log In / Sign Up</button>
        )}
      </div>
    </nav>
  );
}

export function Footer() {
  return (
    <footer className="container section center muted" style={{ borderTop: "1px solid rgba(212,175,55,0.2)", marginTop: 40 }}>
      <p>SoulSeer — A Community of Gifted Psychics</p>
      <p style={{ fontSize: ".85rem" }}>
        <Link to="/privacy">Privacy Policy</Link> · <Link to="/help">Help</Link>
      </p>
    </footer>
  );
}

export function Page({ children, me }: { children: ReactNode; me: User | null }) {
  return (
    <>
      <Nav me={me} />
      <main className="container" style={{ minHeight: "70vh" }}>{children}</main>
      <Footer />
    </>
  );
}
