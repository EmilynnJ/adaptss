import { useEffect } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { Navigate } from "react-router-dom";

export default function Login() {
  const { loginWithRedirect, isAuthenticated, isLoading } = useAuth0();
  useEffect(() => {
    if (!isLoading && !isAuthenticated) loginWithRedirect();
  }, [isLoading, isAuthenticated, loginWithRedirect]);
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;
  return (
    <div className="section center">
      <h1>Welcome to SoulSeer</h1>
      <p className="tagline">Redirecting you to secure login…</p>
      <button className="btn" onClick={() => loginWithRedirect()}>Log In / Sign Up</button>
    </div>
  );
}
