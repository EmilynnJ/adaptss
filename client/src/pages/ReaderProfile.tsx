import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth0 } from "@auth0/auth0-react";
import { api } from "../lib/api.js";
import { fmtUSD, fmtDate, stars } from "../lib/format.js";
import { useToast } from "../lib/toast.js";
import type { User } from "@soulseer/shared";

type ReaderDetail = {
  id: number; fullName: string; bio?: string | null; specialties?: string[]; profileImage?: string | null;
  pricingChat: number; pricingVoice: number; pricingVideo: number; isOnline: boolean;
  rating: number; reviewCount: number;
  reviews: { reviewerName: string; rating: number | null; review: string | null; date: string | null }[];
};

export default function ReaderProfile({ me }: { me: User | null }) {
  const { id } = useParams();
  const [r, setR] = useState<ReaderDetail | null>(null);
  const { isAuthenticated, loginWithRedirect } = useAuth0();
  const navigate = useNavigate();
  const toast = useToast();

  useEffect(() => {
    api.get<ReaderDetail>(`/api/readers/${id}`).then(setR).catch(() => toast("Reader not found", "error"));
  }, [id]);

  if (!r) return <p className="section center">Loading…</p>;

  const start = async (type: "chat" | "voice" | "video") => {
    if (!isAuthenticated) return loginWithRedirect({ appState: { returnTo: `/readers/${id}` } });
    if (me && me.accountBalance < 500) {
      toast("You need at least $5 to start. Add funds in your dashboard.", "error");
      return navigate("/dashboard");
    }
    try {
      const reading = await api.post<{ id: number }>("/api/readings/on-demand", { readerId: r.id, type });
      navigate(`/reading/${reading.id}`);
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };

  const types: ["chat" | "voice" | "video", number][] = [["chat", r.pricingChat], ["voice", r.pricingVoice], ["video", r.pricingVideo]];

  return (
    <div className="section">
      <div className="card" style={{ maxWidth: 820, margin: "0 auto" }}>
        <div className="row">
          <img src={r.profileImage || "https://i.postimg.cc/tRLSgCPb/HERO-IMAGE-1.jpg"} alt={r.fullName}
            style={{ width: 110, height: 110, borderRadius: "50%", objectFit: "cover", border: "3px solid var(--gold)" }} />
          <div>
            <h1 style={{ margin: 0 }}>{r.fullName}</h1>
            <span className={`badge ${r.isOnline ? "badge-online" : "badge-offline"}`}>{r.isOnline ? "● Online" : "Offline"}</span>
            {r.reviewCount > 0 && <div className="stars">{stars(r.rating)} <span className="muted">({r.reviewCount} reviews)</span></div>}
          </div>
        </div>
        {r.bio && <p>{r.bio}</p>}
        {!!r.specialties?.length && <div className="row" style={{ gap: 6 }}>{r.specialties.map((s) => <span key={s} className="badge badge-gold">{s}</span>)}</div>}
        <h3>Start a Reading</h3>
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))" }}>
          {types.map(([t, price]) => (
            <div className="card" key={t} style={{ textAlign: "center" }}>
              <div style={{ textTransform: "capitalize", fontWeight: 600 }}>{t}</div>
              <div className="price">{price > 0 ? `${fmtUSD(price)}/min` : "Not offered"}</div>
              <button className="btn" disabled={!r.isOnline || price <= 0} style={{ marginTop: 8, width: "100%" }} onClick={() => start(t)}>
                Start {t}
              </button>
            </div>
          ))}
        </div>
      </div>

      {r.reviews.length > 0 && (
        <div style={{ maxWidth: 820, margin: "24px auto 0" }}>
          <h2>Recent Reviews</h2>
          {r.reviews.map((rev, i) => (
            <div className="card" key={i} style={{ marginBottom: 10 }}>
              <div className="row"><strong>{rev.reviewerName}</strong><span className="stars">{stars(rev.rating || 0)}</span><span className="spacer" /><span className="muted">{fmtDate(rev.date)}</span></div>
              {rev.review && <p className="muted">{rev.review}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
