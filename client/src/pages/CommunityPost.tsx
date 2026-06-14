import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../lib/api.js";
import { fmtDate } from "../lib/format.js";
import { useToast } from "../lib/toast.js";
import type { User } from "@soulseer/shared";

type PostDetail = {
  id: number; title: string; content: string; category: string; createdAt: string; authorName: string;
  comments: { id: number; content: string; createdAt: string; authorName: string }[];
};

export default function CommunityPost({ me }: { me: User | null }) {
  const { id } = useParams();
  const [post, setPost] = useState<PostDetail | null>(null);
  const [comment, setComment] = useState("");
  const toast = useToast();

  const load = () => api.get<PostDetail>(`/api/forum/posts/${id}`).then(setPost).catch(() => {});
  useEffect(() => { load(); }, [id]);
  if (!post) return <p className="section center">Loading…</p>;

  const addComment = async () => {
    try {
      await api.post(`/api/forum/posts/${id}/comments`, { content: comment });
      setComment(""); load();
    } catch (e) { toast((e as Error).message, "error"); }
  };
  const flag = async (kind: "posts" | "comments", targetId: number) => {
    try { await api.post(`/api/forum/${kind}/${targetId}/flag`, { reason: "Reported by user" }); toast("Reported for review", "success"); }
    catch (e) { toast((e as Error).message, "error"); }
  };

  return (
    <div className="section" style={{ maxWidth: 800, margin: "0 auto" }}>
      <div className="card">
        <span className="badge badge-gold">{post.category}</span>
        <h1>{post.title}</h1>
        <p className="muted" style={{ fontSize: ".85rem" }}>by {post.authorName} · {fmtDate(post.createdAt)}</p>
        <p style={{ whiteSpace: "pre-wrap" }}>{post.content}</p>
        {me && <button className="btn btn-ghost" onClick={() => flag("posts", post.id)}>Report</button>}
      </div>

      <h3>Comments</h3>
      {post.comments.map((c) => (
        <div className="card" key={c.id} style={{ marginBottom: 10 }}>
          <div className="row"><strong>{c.authorName}</strong><span className="spacer" /><span className="muted">{fmtDate(c.createdAt)}</span></div>
          <p>{c.content}</p>
          {me && <button className="btn btn-ghost" onClick={() => flag("comments", c.id)}>Report</button>}
        </div>
      ))}
      {post.comments.length === 0 && <p className="muted">No comments yet.</p>}

      {me ? (
        <div className="card" style={{ marginTop: 12 }}>
          <textarea className="input" rows={3} placeholder="Add a comment…" value={comment} onChange={(e) => setComment(e.target.value)} />
          <button className="btn" style={{ marginTop: 8 }} onClick={addComment} disabled={!comment.trim()}>Comment</button>
        </div>
      ) : <p className="muted">Log in to join the discussion.</p>}
    </div>
  );
}
