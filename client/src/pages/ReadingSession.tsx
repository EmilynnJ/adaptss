import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../lib/api.js";
import { config } from "../lib/config.js";
import { fmtUSD, fmtClock } from "../lib/format.js";
import { useToast } from "../lib/toast.js";
import { useAuth0 } from "@auth0/auth0-react";
import type { Reading, User, ChatMessage } from "@soulseer/shared";

type TokenResp = { appId: string; channel: string; uid: number; token: string; type: "chat" | "voice" | "video" };

export default function ReadingSession({ me }: { me: User | null }) {
  const { id } = useParams();
  const readingId = Number(id);
  const navigate = useNavigate();
  const toast = useToast();
  const { getAccessTokenSilently } = useAuth0();

  const [reading, setReading] = useState<Reading | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [cost, setCost] = useState(0);
  const [balance, setBalance] = useState(me?.accountBalance ?? 0);
  const [joined, setJoined] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [ended, setEnded] = useState(false);
  const [showRating, setShowRating] = useState(false);

  const rtcRef = useRef<any>(null);
  const rtmRef = useRef<{ client: any; channel: any } | null>(null);
  const localTracksRef = useRef<any[]>([]);
  const remoteRef = useRef<HTMLDivElement>(null);
  const localRef = useRef<HTMLDivElement>(null);

  const isReader = me?.role === "reader";
  const perMin = reading?.pricePerMinute ?? 0;

  const loadReading = useCallback(async () => {
    const r = await api.get<Reading>(`/api/readings/${readingId}`, true);
    setReading(r);
    return r;
  }, [readingId]);

  useEffect(() => { loadReading().catch(() => toast("Cannot open reading", "error")); }, [loadReading]);

  // SSE: billing ticks, low balance, partner + end events.
  useEffect(() => {
    let es: EventSource | null = null;
    let active = true;
    (async () => {
      try {
        const token = await getAccessTokenSilently();
        es = new EventSource(`${config.apiBase}/api/events?access_token=${encodeURIComponent(token)}`);
        es.onmessage = (e) => {
          if (!active) return;
          const ev = JSON.parse(e.data);
          if (ev.readingId !== readingId) return;
          if (ev.kind === "billing_tick") { setCost(ev.totalPrice); setBalance(ev.clientBalance); setElapsed(ev.duration * 60); }
          if (ev.kind === "low_balance") toast("Low balance — under 2 minutes remaining!", "error");
          if (ev.kind === "partner_disconnected") toast(`Partner disconnected — ${ev.graceSeconds}s grace period`, "error");
          if (ev.kind === "partner_reconnected") toast("Partner reconnected", "success");
          if (ev.kind === "session_ended") { setEnded(true); if (!isReader) setShowRating(true); leaveMedia(); }
        };
      } catch { /* ignore */ }
    })();
    return () => { active = false; es?.close(); };
  }, [readingId, isReader, getAccessTokenSilently]);

  // Local 1s ticking display between server billing ticks.
  useEffect(() => {
    if (!joined || ended) return;
    const t = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [joined, ended]);

  const join = async () => {
    const r = reading ?? (await loadReading());
    const tok = await api.post<TokenResp>(`/api/readings/${readingId}/agora-token`, {});
    if (r.type === "chat") await joinRtm(tok);
    else await joinRtc(tok);
    setJoined(true);
    // Begin server-side billing (idempotent; requires accepted).
    try { await api.post(`/api/readings/${readingId}/start`, {}); } catch (e) { toast((e as Error).message, "error"); }
  };

  const joinRtc = async (tok: TokenResp) => {
    const AgoraRTC = (await import("agora-rtc-sdk-ng")).default;
    const client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
    rtcRef.current = client;
    client.on("user-published", async (user: any, mediaType: any) => {
      await client.subscribe(user, mediaType);
      if (mediaType === "video" && remoteRef.current) user.videoTrack?.play(remoteRef.current);
      if (mediaType === "audio") user.audioTrack?.play();
    });
    await client.join(tok.appId, tok.channel, tok.token, tok.uid);
    const micTrack = await AgoraRTC.createMicrophoneAudioTrack();
    localTracksRef.current = [micTrack];
    if (tok.type === "video") {
      const camTrack = await AgoraRTC.createCameraVideoTrack();
      localTracksRef.current.push(camTrack);
      if (localRef.current) camTrack.play(localRef.current);
      await client.publish([micTrack, camTrack]);
    } else {
      await client.publish([micTrack]);
    }
  };

  const joinRtm = async (tok: TokenResp) => {
    const AgoraRTM = (await import("agora-rtm-sdk")).default as any;
    const client = AgoraRTM.createInstance(tok.appId);
    await client.login({ uid: String(tok.uid), token: tok.token });
    const channel = client.createChannel(tok.channel);
    await channel.join();
    channel.on("ChannelMessage", (msg: any, senderId: string) => {
      setMessages((m) => [...m, { senderId: Number(senderId), senderName: "Partner", text: msg.text, ts: new Date().toISOString() }]);
    });
    rtmRef.current = { client, channel };
  };

  const sendChat = async () => {
    if (!chatInput.trim() || !rtmRef.current) return;
    await rtmRef.current.channel.sendMessage({ text: chatInput });
    setMessages((m) => [...m, { senderId: me!.id, senderName: me!.fullName, text: chatInput, ts: new Date().toISOString() }]);
    setChatInput("");
  };

  const leaveMedia = useCallback(() => {
    localTracksRef.current.forEach((t) => { t.stop?.(); t.close?.(); });
    localTracksRef.current = [];
    rtcRef.current?.leave?.();
    rtcRef.current = null;
    if (rtmRef.current) { rtmRef.current.channel.leave?.(); rtmRef.current.client.logout?.(); rtmRef.current = null; }
  }, []);

  const accept = async () => { try { await api.post(`/api/readings/${readingId}/accept`, {}); await loadReading(); toast("Accepted", "success"); } catch (e) { toast((e as Error).message, "error"); } };

  const end = async () => {
    if (!window.confirm("End this session?")) return;
    try { await api.post(`/api/readings/${readingId}/end`, {}); } catch { /* ignore */ }
    setEnded(true); leaveMedia(); if (!isReader) setShowRating(true);
  };

  useEffect(() => () => leaveMedia(), [leaveMedia]);

  if (!reading) return <p className="section center">Loading session…</p>;

  const liveCost = cost || Math.floor((elapsed / 60) * perMin);

  return (
    <div className="section">
      <h1 className="center" style={{ textTransform: "capitalize" }}>{reading.type} Reading</h1>

      <div className="card">
        <div className="row">
          <div><div className="muted">Elapsed</div><strong style={{ fontSize: "1.4rem" }}>{fmtClock(elapsed)}</strong></div>
          <span className="spacer" />
          <div><div className="muted">Cost</div><strong className="price" style={{ fontSize: "1.4rem" }}>{fmtUSD(liveCost)}</strong></div>
          {!isReader && <><span className="spacer" /><div><div className="muted">Balance</div><strong>{fmtUSD(balance)}</strong></div></>}
        </div>
        {!isReader && balance < perMin * 2 && joined && !ended && <p style={{ color: "#e0556a" }}>⚠ Low balance — under 2 minutes remaining.</p>}
      </div>

      {/* Reader must accept pending requests */}
      {reading.status === "pending" && isReader && (
        <div className="card center" style={{ marginTop: 16 }}><p>Incoming request from Client #{reading.clientId}</p><button className="btn" onClick={accept}>Accept Reading</button></div>
      )}
      {reading.status === "pending" && !isReader && <p className="center muted section">Waiting for the reader to accept…</p>}

      {(reading.status === "accepted" || reading.status === "in_progress") && !joined && !ended && (
        <div className="card center" style={{ marginTop: 16 }}><button className="btn" onClick={join}>Join Session</button></div>
      )}

      {joined && !ended && (
        <div className="card" style={{ marginTop: 16 }}>
          {reading.type === "video" && (
            <div className="grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
              <div><div className="muted">You</div><div ref={localRef} style={{ width: "100%", height: 240, background: "#000", borderRadius: 10 }} /></div>
              <div><div className="muted">Reader/Client</div><div ref={remoteRef} style={{ width: "100%", height: 240, background: "#000", borderRadius: 10 }} /></div>
            </div>
          )}
          {reading.type === "voice" && (<div className="center"><p>🔊 Voice session in progress</p><div ref={remoteRef} /></div>)}
          {reading.type === "chat" && (
            <div>
              <div style={{ height: 300, overflowY: "auto", border: "1px solid rgba(255,255,255,.1)", borderRadius: 10, padding: 10, marginBottom: 8 }}>
                {messages.map((m, i) => (
                  <div key={i} style={{ textAlign: m.senderId === me?.id ? "right" : "left", margin: "4px 0" }}>
                    <span className="badge badge-gold">{m.senderId === me?.id ? "You" : m.senderName}</span> {m.text}
                    <div className="muted" style={{ fontSize: ".7rem" }}>{new Date(m.ts).toLocaleTimeString()}</div>
                  </div>
                ))}
              </div>
              <div className="row"><input className="input" value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendChat()} placeholder="Type a message…" /><button className="btn" onClick={sendChat}>Send</button></div>
            </div>
          )}
          <div className="row" style={{ marginTop: 12, justifyContent: "center" }}>
            {(reading.type === "voice" || reading.type === "video") && (
              <button className="btn btn-ghost" onClick={() => { const a = localTracksRef.current[0]; const on = a?.muted; a?.setMuted(!on); toast(on ? "Unmuted" : "Muted"); }}>Mute / Unmute</button>
            )}
            {reading.type === "video" && (
              <button className="btn btn-ghost" onClick={() => { const v = localTracksRef.current[1]; const on = v?.muted; v?.setMuted(!on); }}>Toggle Camera</button>
            )}
            <button className="btn" style={{ background: "#c0392b" }} onClick={end}>End Session</button>
          </div>
        </div>
      )}

      {ended && (
        <div className="card center" style={{ marginTop: 16 }}>
          <h2>Session Complete</h2>
          <p>Duration: {fmtClock(elapsed)} · Total: <span className="price">{fmtUSD(liveCost)}</span></p>
          <button className="btn" onClick={() => navigate("/dashboard")}>Back to Dashboard</button>
        </div>
      )}

      {showRating && <RatingModal readingId={readingId} onClose={() => setShowRating(false)} />}
    </div>
  );
}

function RatingModal({ readingId, onClose }: { readingId: number; onClose: () => void }) {
  const [rating, setRating] = useState(5);
  const [review, setReview] = useState("");
  const toast = useToast();
  const submit = async () => {
    try { await api.post(`/api/readings/${readingId}/rate`, { rating, review: review || undefined }); toast("Thank you for your review!", "success"); onClose(); }
    catch (e) { toast((e as Error).message, "error"); }
  };
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.7)", display: "grid", placeItems: "center", zIndex: 200 }}>
      <div className="card" style={{ maxWidth: 420, width: "90%" }}>
        <h3>Rate Your Reading</h3>
        <div className="stars" style={{ fontSize: "2rem", cursor: "pointer" }}>
          {[1, 2, 3, 4, 5].map((n) => <span key={n} onClick={() => setRating(n)}>{n <= rating ? "★" : "☆"}</span>)}
        </div>
        <textarea className="input" rows={3} placeholder="Share your experience (optional)" value={review} onChange={(e) => setReview(e.target.value)} style={{ marginTop: 10 }} />
        <div className="row" style={{ marginTop: 10 }}><button className="btn" onClick={submit}>Submit</button><button className="btn btn-ghost" onClick={onClose}>Skip</button></div>
      </div>
    </div>
  );
}
