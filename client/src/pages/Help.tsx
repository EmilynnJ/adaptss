const faqs = [
  ["How does pay-per-minute work?", "You add funds to your balance, then pay only for the minutes you use during a reading at the reader's per-minute rate. Billing is calculated server-side every minute."],
  ["What's the minimum to start a reading?", "You need at least $5 in your account balance to begin a session."],
  ["How are readers paid?", "Readers keep 70% of every reading. Payouts are sent to their Stripe Connect account."],
  ["What reading types are offered?", "Chat, voice, and video — each with its own per-minute rate set by the reader."],
  ["What happens if my connection drops?", "Billing pauses and a 2-minute grace period begins. Reconnect within 2 minutes to resume; otherwise the session finalizes for the time connected."],
  ["Can I get a refund?", "Disputed sessions can be refunded by an administrator. Contact support through the community hub."],
];
export default function Help() {
  return (
    <div className="section">
      <h1 className="center">Help & FAQ</h1>
      <div style={{ maxWidth: 760, margin: "0 auto", display: "grid", gap: 14 }}>
        {faqs.map(([q, a]) => (
          <div className="card" key={q}><h3 style={{ marginTop: 0 }}>{q}</h3><p className="muted">{a}</p></div>
        ))}
      </div>
    </div>
  );
}
