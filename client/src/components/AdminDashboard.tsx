import { useEffect, useState } from "react";
import { api } from "../lib/api.js";
import { fmtUSD, fmtDate } from "../lib/format.js";
import { useToast } from "../lib/toast.js";
import type { Reading, Transaction } from "@soulseer/shared";

type AdminUser = { id: number; email: string; username: string; fullName: string; role: string; accountBalance: number; isOnline: boolean };

const tabs = ["Users", "Create Reader", "Readings", "Ledger", "Payouts", "Moderation"] as const;
type Tab = typeof tabs[number];

export function AdminDashboard() {
  const [tab, setTab] = useState<Tab>("Users");
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [readings, setReadings] = useState<Reading[]>([]);
  const [ledger, setLedger] = useState<Transaction[]>([]);
  const [flags, setFlags] = useState<{ id: number; postId: number | null; commentId: number | null; reason: string }[]>([]);
  const toast = useToast();

  const reloadUsers = () => api.get<AdminUser[]>("/api/admin/users", true).then(setUsers).catch(() => {});
  useEffect(() => {
    reloadUsers();
    api.get<Reading[]>("/api/admin/readings", true).then(setReadings).catch(() => {});
    api.get<Transaction[]>("/api/admin/transactions", true).then(setLedger).catch(() => {});
    api.get<typeof flags>("/api/admin/forum/flagged", true).then(setFlags).catch(() => {});
  }, []);

  return (
    <div>
      <div className="row" style={{ marginBottom: 14, flexWrap: "wrap" }}>
        {tabs.map((t) => <button key={t} className={`btn ${tab === t ? "" : "btn-ghost"}`} onClick={() => setTab(t)}>{t}</button>)}
      </div>

      {tab === "Users" && (
        <div className="card">
          <h3>All Users</h3>
          {users.map((u) => (
            <div className="row" key={u.id} style={{ padding: "5px 0", fontSize: ".9rem", borderBottom: "1px solid rgba(255,255,255,.06)" }}>
              <span>#{u.id} {u.fullName}</span><span className="badge badge-gold">{u.role}</span><span className="muted">{u.email}</span>
              <span className="spacer" /><span className="price">{fmtUSD(u.accountBalance)}</span>
              <BalanceAdjust userId={u.id} onDone={reloadUsers} />
            </div>
          ))}
        </div>
      )}

      {tab === "Create Reader" && <CreateReader onDone={reloadUsers} />}

      {tab === "Readings" && (
        <div className="card">
          <h3>All Readings</h3>
          {readings.map((r) => (
            <div className="row" key={r.id} style={{ padding: "4px 0", fontSize: ".88rem" }}>
              <span>#{r.id} R{r.readerId}↔C{r.clientId} · {r.type} · {r.status}</span><span className="spacer" />
              <span>{r.duration}m</span><span className="price">{fmtUSD(r.totalPrice)}</span>
              {r.paymentStatus === "paid" && <button className="btn btn-ghost" onClick={async () => { try { await api.post(`/api/admin/refund/${r.id}`); toast("Refunded", "success"); } catch (e) { toast((e as Error).message, "error"); } }}>Refund</button>}
            </div>
          ))}
        </div>
      )}

      {tab === "Ledger" && (
        <div className="card">
          <h3>Transaction Ledger</h3>
          {ledger.map((t) => (
            <div className="row" key={t.id} style={{ padding: "3px 0", fontSize: ".85rem" }}>
              <span className="muted">{fmtDate(t.createdAt)}</span><span>U{t.userId} {t.type}</span><span className="spacer" />
              <span className={t.amount >= 0 ? "price" : ""}>{fmtUSD(t.amount)}</span>
            </div>
          ))}
        </div>
      )}

      {tab === "Payouts" && (
        <div className="card">
          <h3>Reader Payouts</h3>
          {users.filter((u) => u.role === "reader").map((u) => (
            <div className="row" key={u.id} style={{ padding: "5px 0" }}>
              <span>{u.fullName}</span><span className="spacer" /><span className="price">{fmtUSD(u.accountBalance)}</span>
              <button className="btn" disabled={u.accountBalance < 1500} onClick={async () => {
                try { const r = await api.post<{ paidOut: number }>(`/api/admin/payouts/${u.id}`); toast(`Paid out ${fmtUSD(r.paidOut)}`, "success"); reloadUsers(); }
                catch (e) { toast((e as Error).message, "error"); }
              }}>Pay Out</button>
            </div>
          ))}
          <p className="muted" style={{ fontSize: ".82rem" }}>Minimum $15 balance required to pay out.</p>
        </div>
      )}

      {tab === "Moderation" && (
        <div className="card">
          <h3>Flagged Content</h3>
          {flags.map((f) => (
            <div className="row" key={f.id} style={{ padding: "5px 0" }}>
              <span>{f.postId ? `Post #${f.postId}` : `Comment #${f.commentId}`} — {f.reason}</span><span className="spacer" />
              <button className="btn btn-ghost" onClick={async () => {
                const path = f.postId ? `/api/admin/forum/posts/${f.postId}` : `/api/admin/forum/comments/${f.commentId}`;
                try { await api.del(path); toast("Deleted", "success"); setFlags((x) => x.filter((y) => y.id !== f.id)); }
                catch (e) { toast((e as Error).message, "error"); }
              }}>Delete</button>
            </div>
          ))}
          {flags.length === 0 && <p className="muted">No flagged content.</p>}
        </div>
      )}
    </div>
  );
}

function BalanceAdjust({ userId, onDone }: { userId: number; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [amt, setAmt] = useState("");
  const [note, setNote] = useState("");
  const toast = useToast();
  if (!open) return <button className="btn btn-ghost" onClick={() => setOpen(true)}>Adjust</button>;
  return (
    <span className="row">
      <input className="input" style={{ width: 90 }} placeholder="$ +/-" value={amt} onChange={(e) => setAmt(e.target.value)} />
      <input className="input" style={{ width: 120 }} placeholder="reason" value={note} onChange={(e) => setNote(e.target.value)} />
      <button className="btn" onClick={async () => {
        try { await api.post("/api/admin/balance-adjust", { userId, amountCents: Math.round(parseFloat(amt) * 100), note }); toast("Adjusted", "success"); setOpen(false); onDone(); }
        catch (e) { toast((e as Error).message, "error"); }
      }}>OK</button>
    </span>
  );
}

function CreateReader({ onDone }: { onDone: () => void }) {
  const [f, setF] = useState({ email: "", username: "", fullName: "", bio: "", specialties: "", pricingChat: "1.99", pricingVoice: "2.99", pricingVideo: "3.99", profileImage: "" });
  const toast = useToast();
  const submit = async () => {
    try {
      const res = await api.post<{ stripeOnboardingUrl?: string }>("/api/admin/readers", {
        email: f.email, username: f.username, fullName: f.fullName, bio: f.bio,
        specialties: f.specialties.split(",").map((s) => s.trim()).filter(Boolean),
        pricingChat: Math.round(parseFloat(f.pricingChat) * 100),
        pricingVoice: Math.round(parseFloat(f.pricingVoice) * 100),
        pricingVideo: Math.round(parseFloat(f.pricingVideo) * 100),
        profileImage: f.profileImage || undefined,
      });
      toast("Reader created. Create their Auth0 login next.", "success");
      if (res.stripeOnboardingUrl) window.open(res.stripeOnboardingUrl, "_blank");
      onDone();
    } catch (e) { toast((e as Error).message, "error"); }
  };
  return (
    <div className="card">
      <h3>Create Reader</h3>
      {(["fullName", "email", "username", "specialties", "profileImage"] as const).map((k) => (
        <input key={k} className="input" style={{ marginBottom: 8 }} placeholder={k === "specialties" ? "Specialties (comma separated)" : k === "profileImage" ? "Profile image URL (or upload via edit)" : k} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
      ))}
      <textarea className="input" style={{ marginBottom: 8 }} rows={3} placeholder="Bio" value={f.bio} onChange={(e) => setF({ ...f, bio: e.target.value })} />
      <div className="row">
        {(["pricingChat", "pricingVoice", "pricingVideo"] as const).map((k) => (
          <label key={k}><span className="muted" style={{ textTransform: "capitalize" }}>{k.replace("pricing", "")} $/min </span>
            <input className="input" style={{ width: 90 }} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></label>
        ))}
      </div>
      <button className="btn" style={{ marginTop: 10 }} onClick={submit}>Create Reader</button>
      <p className="muted" style={{ fontSize: ".8rem" }}>After creating, add the reader's login in your Auth0 tenant (email + initial password) and send them the Stripe Connect onboarding link.</p>
    </div>
  );
}
