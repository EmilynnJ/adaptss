import { Routes, Route, Navigate } from "react-router-dom";
import { useCurrentUser } from "./hooks/useCurrentUser.js";
import { Page } from "./components/Layout.js";
import Home from "./pages/Home.js";
import Readers from "./pages/Readers.js";
import ReaderProfile from "./pages/ReaderProfile.js";
import About from "./pages/About.js";
import Community from "./pages/Community.js";
import CommunityPost from "./pages/CommunityPost.js";
import Login from "./pages/Login.js";
import Dashboard from "./pages/Dashboard.js";
import ReadingSession from "./pages/ReadingSession.js";
import Help from "./pages/Help.js";
import Privacy from "./pages/Privacy.js";
import { useAuth0 } from "@auth0/auth0-react";
import type { ReactNode } from "react";

function Protected({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth0();
  if (isLoading) return <p className="center section">Loading…</p>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  const { me } = useCurrentUser();
  return (
    <Page me={me}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/readers" element={<Readers />} />
        <Route path="/readers/:id" element={<ReaderProfile me={me} />} />
        <Route path="/about" element={<About />} />
        <Route path="/community" element={<Community me={me} />} />
        <Route path="/community/:id" element={<CommunityPost me={me} />} />
        <Route path="/help" element={<Help />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<Protected><Dashboard me={me} /></Protected>} />
        <Route path="/reading/:id" element={<Protected><ReadingSession me={me} /></Protected>} />
        <Route path="*" element={<div className="section center"><h2>Page not found</h2></div>} />
      </Routes>
    </Page>
  );
}
