import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api.js";
import { fmtUSD, fmtDate } from "../lib/format.js";
import { AddFunds } from "./AddFunds.js";
import { useToast } from "../lib/toast.js";
import { useAuth0 } from "@auth0/auth0-react";
import type { Reading, Transaction, User } from "@soulseer/shared";

export function ClientDashboard({ me }: { me: User }) {
  const [balance, setBalance] = useState(me.accountBalance);
  const [readings, setReadings] = useState<Reading[]>([]);
  const [active, setActive] = useState<Reading[]>([]);
  const [txns, setTxns] = useState<Transaction[]>([]);
  const [showFunds, setShowFunds] = useState(false);
  const toast = useToast();
  const { logout } = useAuth0();

  const refresh = () => {
    api.get<{ accountBalance: number }>("/api/user/balance", true).then((d) => setBalance(d.accountBalance)).catch(() => {});
    api.get<Reading[]>("/api/readings/client", true).then(setReadings).catch(() => {});
    api.get<Reading[]>("/api/readings/active", true).then(setActive).catch(() => {});
    api.get<Transaction[]>("/api/transactions", true).then(setTxns).catch(() => {});
  };
  useEffect(refresh, []);

  return (
    <div>
      <div className="card">
        <div className="row">
          <div><div className="muted">Account Balance</div><h2 style={{ margin: 0 }}>{fmtUSD(balance)}</h2></div>
          <span className="spacer" />
          <button className="btn btn-gold" onClick={() => setShowFunds((v) => !v)}>Add Funds</button>
        </div>
        {showFunds && <div style={{ marginTop: 14 }}><AddFunds onDone={() => { setShowFunds(false); setTimeout(refresh, 1500); }} /></div>}
      </div>

      {active.length > 0 && (
        <div className="card" style={{ marginTop: 16 }}>
          <h3>Active & Pending</h3>
          {active.map((r) => (
            <div className="row" key={r.id}>
              <span>#{r.id} · {r.type} · {r.status}</span><span className="spacer" />
              <Link to={`/reading/${r.id}`} className="btn">Open</Link>
            </div>
          ))}
        </div>
      )}

      <div className="card" style={{ marginTop: 16 }}>
        <h3>Reading History</h3>
        {readings.filter((r) => r.status === "completed").map((r) => (
          <div className="row" key={r.id} style={{ borderBottom: "1px solid rgba(255,255,255,.06)", padding: "6px 0" }}>
            <span>{fmtDate(r.completedAt)} · {r.type}</span><span className="spacer" />
            <span>{r.duration} min</span><span className="price">{fmtUSD(r.totalPrice)}</span>
          </div>
        ))}
        {readings.filter((r) => r.status === "completed").length === 0 && <p className="muted">No completed readings yet.</p>}
      </div>

      <div className="card" style={{ marginTop: 16, borderColor: "rgba(224,85,106,0.4)" }}>
        <h3>Privacy</h3>
        <p className="muted" style={{ fontSize: ".85rem" }}>You can permanently delete your account (GDPR/CCPA). This anonymizes your profile and removes your login.</p>
        <button className="btn btn-ghost" onClick={async () => {
          if (!window.confirm("Permanently delete your account? This cannot be undone.")) return;
          try { await api.del("/api/user/account"); toast("Account deleted", "success"); logout({ logoutParams: { returnTo: window.location.origin } }); }
          catch (e) { toast((e as Error).message, "error"); }
        }}>Delete My Account</button>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3>Transactions</h3>
        {txns.map((t) => (
          <div className="row" key={t.id} style={{ fontSize: ".9rem", padding: "4px 0" }}>
            <span className="muted">{fmtDate(t.createdAt)}</span><span>{t.type}</span><span className="spacer" />
            <span className={t.amount >= 0 ? "price" : ""}>{t.amount >= 0 ? "+" : ""}{fmtUSD(t.amount)}</span>
          </div>
        ))}
        {txns.length === 0 && <p className="muted">No transactions yet.</p>}
      </div>
    </div>
  );
}
