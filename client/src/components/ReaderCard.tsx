import { Link } from "react-router-dom";
import { fmtUSD, stars } from "../lib/format.js";

export type ReaderCardData = {
  id: number; fullName: string; username?: string; bio?: string | null;
  specialties?: string[]; profileImage?: string | null;
  pricingChat: number; pricingVoice: number; pricingVideo: number;
  isOnline?: boolean; rating?: number; reviewCount?: number;
};

export function ReaderCard({ r }: { r: ReaderCardData }) {
  return (
    <div className="card">
      <div className="row">
        <img
          src={r.profileImage || "https://i.postimg.cc/tRLSgCPb/HERO-IMAGE-1.jpg"}
          alt={r.fullName}
          style={{ width: 64, height: 64, borderRadius: "50%", objectFit: "cover", border: "2px solid var(--gold)" }}
        />
        <div>
          <h3 style={{ margin: 0 }}>{r.fullName}</h3>
          <span className={`badge ${r.isOnline ? "badge-online" : "badge-offline"}`}>
            {r.isOnline ? "● Online" : "Offline"}
          </span>
        </div>
      </div>
      {r.bio && <p className="muted" style={{ fontSize: ".9rem" }}>{r.bio.slice(0, 110)}{r.bio.length > 110 ? "…" : ""}</p>}
      {!!r.specialties?.length && (
        <div className="row" style={{ gap: 6 }}>
          {r.specialties.slice(0, 3).map((s) => <span key={s} className="badge badge-gold">{s}</span>)}
        </div>
      )}
      {typeof r.rating === "number" && r.reviewCount ? (
        <div className="stars">{stars(r.rating)} <span className="muted" style={{ fontSize: ".8rem" }}>({r.reviewCount})</span></div>
      ) : null}
      <div style={{ marginTop: 8, fontSize: ".9rem" }}>
        <div>Chat <span className="price">{fmtUSD(r.pricingChat)}/min</span></div>
        <div>Voice <span className="price">{fmtUSD(r.pricingVoice)}/min</span></div>
        <div>Video <span className="price">{fmtUSD(r.pricingVideo)}/min</span></div>
      </div>
      <Link to={`/readers/${r.id}`} className="btn" style={{ marginTop: 12, width: "100%" }}>View & Start Reading</Link>
    </div>
  );
}
