import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api.js";
import { ReaderCard, type ReaderCardData } from "../components/ReaderCard.js";

export default function Readers() {
  const [readers, setReaders] = useState<ReaderCardData[]>([]);
  const [specialty, setSpecialty] = useState("");
  const [type, setType] = useState("");
  const [onlineOnly, setOnlineOnly] = useState(false);

  useEffect(() => {
    api.get<ReaderCardData[]>("/api/readers").then(setReaders).catch(() => {});
  }, []);

  const specialties = useMemo(
    () => Array.from(new Set(readers.flatMap((r) => r.specialties || []))).sort(),
    [readers]
  );

  const filtered = readers.filter((r) => {
    if (onlineOnly && !r.isOnline) return false;
    if (specialty && !(r.specialties || []).includes(specialty)) return false;
    if (type === "chat" && r.pricingChat <= 0) return false;
    if (type === "voice" && r.pricingVoice <= 0) return false;
    if (type === "video" && r.pricingVideo <= 0) return false;
    return true;
  });

  return (
    <div className="section">
      <h1 className="center">Browse Readers</h1>
      <div className="row" style={{ justifyContent: "center", marginBottom: 18 }}>
        <select className="select" style={{ width: "auto" }} value={specialty} onChange={(e) => setSpecialty(e.target.value)}>
          <option value="">All specialties</option>
          {specialties.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className="select" style={{ width: "auto" }} value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">All types</option>
          <option value="chat">Chat</option>
          <option value="voice">Voice</option>
          <option value="video">Video</option>
        </select>
        <label className="row" style={{ gap: 6 }}>
          <input type="checkbox" checked={onlineOnly} onChange={(e) => setOnlineOnly(e.target.checked)} /> Online only
        </label>
      </div>
      <div className="grid grid-readers">{filtered.map((r) => <ReaderCard key={r.id} r={r} />)}</div>
    </div>
  );
}
