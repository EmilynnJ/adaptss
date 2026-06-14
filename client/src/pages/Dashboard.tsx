import { ClientDashboard } from "../components/ClientDashboard.js";
import { ReaderDashboard } from "../components/ReaderDashboard.js";
import { AdminDashboard } from "../components/AdminDashboard.js";
import type { User } from "@soulseer/shared";

export default function Dashboard({ me }: { me: User | null }) {
  if (!me) return <p className="section center">Loading your dashboard…</p>;
  return (
    <div className="section">
      <h1 className="center">
        {me.role === "admin" ? "Admin Dashboard" : me.role === "reader" ? "Reader Dashboard" : "My Dashboard"}
      </h1>
      <p className="center muted">Welcome back, {me.fullName}</p>
      {me.role === "admin" ? <AdminDashboard /> : me.role === "reader" ? <ReaderDashboard me={me} /> : <ClientDashboard me={me} />}
    </div>
  );
}
