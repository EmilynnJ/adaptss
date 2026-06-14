import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api.js";
import { config } from "../lib/config.js";
import { fmtDate } from "../lib/format.js";
import { useToast } from "../lib/toast.js";
import { FORUM_CATEGORIES } from "@soulseer/shared";
import type { User } from "@soulseer/shared";

type Post = { id: number; title: string; content: string; category: string; createdAt: string; authorName: string; commentCount: number };

export default function Community({ me }: { me: User | null }) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [page, setPage] = useState(1);
  const [category, setCategory] = useState("");
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ title: "", content: "", category: "General" });
  const toast = useToast();

  const load = () => {
    const q = new URLSearchParams({ page: String(page) });
    if (category) q.set("category", category);
    api.get<{ posts: Post[] }>(`/api/forum/posts?${q}`).then((d) => setPosts(d.posts)).catch(() => {});
  };
  useEffect(load, [page, category]);

  const submit = async () => {
    try {
      await api.post("/api/forum/posts", form);
      toast("Posted!", "success");
      setCreating(false);
      setForm({ title: "", content: "", category: "General" });
      load();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };

  const canPostAnnouncement = me?.role === "admin";

  return (
    <div className="section">
      <h1 className="center">Community Hub</h1>
      <div className="row" style={{ justifyContent: "center", marginBottom: 24 }}>
        <a className="btn btn-gold" href={config.facebookUrl} target="_blank" rel="noreferrer">Join our Facebook Group</a>
        <a className="btn btn-gold" href={config.discordUrl} target="_blank" rel="noreferrer">Join our Discord Server</a>
      </div>
      <p className="center muted">Connect with our soul tribe on Facebook and Discord, or join the conversation in our forum below.</p>

      <div className="row">
        <h2>Forum</h2><span className="spacer" />
        <select className="select" style={{ width: "auto" }} value={category} onChange={(e) => { setPage(1); setCategory(e.target.value); }}>
          <option value="">All categories</option>
          {FORUM_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        {me && <button className="btn" onClick={() => setCreating((v) => !v)}>New Post</button>}
      </div>

      {creating && (
        <div className="card" style={{ marginTop: 12 }}>
          <input className="input" placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <textarea className="input" style={{ marginTop: 8 }} rows={4} placeholder="Share your thoughts…" value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} />
          <select className="select" style={{ marginTop: 8 }} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
            {FORUM_CATEGORIES.filter((c) => c !== "Announcements" || canPostAnnouncement).map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <button className="btn" style={{ marginTop: 10 }} onClick={submit}>Publish</button>
        </div>
      )}

      <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
        {posts.map((p) => (
          <Link to={`/community/${p.id}`} key={p.id} className="card" style={{ display: "block" }}>
            <div className="row"><span className="badge badge-gold">{p.category}</span><span className="spacer" /><span className="muted">{fmtDate(p.createdAt)}</span></div>
            <h3 style={{ margin: "6px 0" }}>{p.title}</h3>
            <p className="muted">{p.content.slice(0, 150)}{p.content.length > 150 ? "…" : ""}</p>
            <div className="muted" style={{ fontSize: ".85rem" }}>by {p.authorName} · {p.commentCount} comments</div>
          </Link>
        ))}
        {posts.length === 0 && <p className="center muted">No posts yet. Be the first to share.</p>}
      </div>

      <div className="row" style={{ justifyContent: "center", marginTop: 18 }}>
        <button className="btn btn-ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</button>
        <span className="muted">Page {page}</span>
        <button className="btn btn-ghost" disabled={posts.length < 10} onClick={() => setPage((p) => p + 1)}>Next</button>
      </div>
    </div>
  );
}
