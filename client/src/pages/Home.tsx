import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api.js";
import { config } from "../lib/config.js";
import { useToast } from "../lib/toast.js";
import { ReaderCard, type ReaderCardData } from "../components/ReaderCard.js";

export default function Home() {
  const [readers, setReaders] = useState<ReaderCardData[]>([]);
  const [email, setEmail] = useState("");
  const toast = useToast();

  const load = () => api.get<ReaderCardData[]>("/api/readers/online").then(setReaders).catch(() => {});
  useEffect(() => {
    load();
    const t = setInterval(load, 30000); // real-time online updates via 30s polling
    return () => clearInterval(t);
  }, []);

  const subscribe = async () => {
    try {
      await api.post("/api/newsletter", { email }, false);
      toast("You're subscribed!", "success");
      setEmail("");
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };

  return (
    <div>
      <section className="section center">
        <h1>SoulSeer</h1>
        <img className="hero-img" src="https://i.postimg.cc/tRLSgCPb/HERO-IMAGE-1.jpg" alt="SoulSeer" />
        <p className="tagline">A Community of Gifted Psychics</p>
      </section>

      <section className="section">
        <h2 className="center">Readers Online Now</h2>
        {readers.length === 0 ? (
          <p className="center muted">No readers are online right now. Check back soon.</p>
        ) : (
          <div className="grid grid-readers">{readers.map((r) => <ReaderCard key={r.id} r={{ ...r, isOnline: true }} />)}</div>
        )}
        <p className="center" style={{ marginTop: 16 }}><Link to="/readers" className="btn btn-ghost">Browse All Readers</Link></p>
      </section>

      <section className="section center">
        <h2>Stay Connected</h2>
        <div className="row" style={{ justifyContent: "center", maxWidth: 460, margin: "0 auto" }}>
          <input className="input" placeholder="Your email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <button className="btn" onClick={subscribe}>Subscribe</button>
        </div>
        <div className="row" style={{ justifyContent: "center", marginTop: 22 }}>
          <a className="btn btn-gold" href={config.facebookUrl} target="_blank" rel="noreferrer">Join our Facebook Group</a>
          <a className="btn btn-gold" href={config.discordUrl} target="_blank" rel="noreferrer">Join our Discord Server</a>
        </div>
      </section>
    </div>
  );
}
