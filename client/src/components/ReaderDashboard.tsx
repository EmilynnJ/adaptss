import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api.js";
import { fmtUSD, fmtDate, stars } from "../lib/format.js";
import { useToast } from "../lib/toast.js";
import type { Reading, User } from "@soulseer/shared";

export function ReaderDashboard({ me }: { me: User }) {
  const [online, setOnline] = useState(me.isOnline);
  const [pricing, setPricing] = useState({ pricingChat: me.pricingChat, pricingVoice: me.pricingVoice, pricingVideo: me.pricingVideo });
  const [sessions, setSessions] = useState<Reading[]>([]);
  const [active, setActive] = useState<Reading[]>([]);
  const toast = useToast();

  const refresh = () => {
    api.get<Reading[]>("/api/readings/reader", true).then(setSessions).catch(() => {});
    api.get<Reading[]>("/api/readings/active", true).then(setActive).catch(() => {});
  };
  useEffect(() => { refresh(); const t = setInterval(refresh, 15000); return () => clearInterval(t); }, []);

  const toggle = async () => {
    try { const r = await api.patch<{ isOnline: boolean }>("/api/readers/status", { isOnline: !online }); setOnline(r.isOnline); }
    catch (e) { toast((e as Error).message, "error"); }
  };
  const savePricing = async () => {
    try { await api.patch("/api/readers/pricing", pricing); toast("Pricing saved", "success"); }
    catch (e) { toast((e as Error).message, "error"); }
  };

  const completed = sessions.filter((s) => s.status === "completed");
  const todayEarnings = completed.filter((s) => s.completedAt && new Date(s.completedAt).toDateString() === new Date().toDateString())
    .reduce((sum, s) => sum + Math.floor(s.totalPrice * 0.7), 0);
  const reviews = completed.filter((s) => s.rating);

  return (
    <div>
      <div className="card">
        <div className="row">
          <h3 style={{ margin: 0 }}>Availability</h3><span className="spacer" />
          <span className={`badge ${online ? "badge-online" : "badge-offline"}`}>{online ? "Online" : "Offline"}</span>
          <button className="btn" onClick={toggle}>{online ? "Go Offline" : "Go Online"}</button>
        </div>
      </div>

      {active.length > 0 && (
        <div className="card" style={{ marginTop: 16 }}>
          <h3>Incoming / Active Readings</h3>
          {active.map((r) => (
            <div className="row" key={r.id}><span>#{r.id} · {r.type} · {r.status}</span><span className="spacer" /><Link className="btn" to={`/reading/${r.id}`}>Open</Link></div>
          ))}
        </div>
      )}

      <div className="card" style={{ marginTop: 16 }}>
        <h3>Per-Minute Rates (USD)</h3>
        {(["pricingChat", "pricingVoice", "pricingVideo"] as const).map((k) => (
          <label key={k} className="row" style={{ marginBottom: 8 }}>
            <span style={{ width: 80, textTransform: "capitalize" }}>{k.replace("pricing", "")}</span>
            <input className="input" type="number" step="0.01" min="0" style={{ width: 140 }}
              value={(pricing[k] / 100).toString()}
              onChange={(e) => setPricing({ ...pricing, [k]: Math.round(parseFloat(e.target.value || "0") * 100) })} />
            <span className="muted">/min</span>
          </label>
        ))}
        <button className="btn" onClick={savePricing}>Save Rates</button>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3>Earnings</h3>
        <div className="row">
          <div><div className="muted">Today</div><strong>{fmtUSD(todayEarnings)}</strong></div>
          <span className="spacer" />
          <div><div className="muted">Pending Payout Balance</div><strong className="price">{fmtUSD(me.accountBalance)}</strong></div>
        </div>
        <p className="muted" style={{ fontSize: ".82rem" }}>Payouts are issued by an admin once your balance reaches $15.</p>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3>Session History</h3>
        {completed.map((s) => (
          <div className="row" key={s.id} style={{ padding: "4px 0", fontSize: ".9rem" }}>
            <span>{fmtDate(s.completedAt)} · Client #{s.clientId} · {s.type}</span><span className="spacer" />
            <span>{s.duration} min</span><span className="price">{fmtUSD(Math.floor(s.totalPrice * 0.7))}</span>
          </div>
        ))}
        {completed.length === 0 && <p className="muted">No sessions yet.</p>}
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3>Reviews</h3>
        {reviews.map((s) => (
          <div key={s.id} style={{ padding: "6px 0" }}><span className="stars">{stars(s.rating || 0)}</span> {s.review && <span className="muted">— {s.review}</span>}</div>
        ))}
        {reviews.length === 0 && <p className="muted">No reviews yet.</p>}
      </div>
    </div>
  );
}
