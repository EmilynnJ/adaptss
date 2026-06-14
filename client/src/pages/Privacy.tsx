export default function Privacy() {
  return (
    <div className="section" style={{ maxWidth: 760, margin: "0 auto" }}>
      <h1 className="center">Privacy Policy</h1>
      <div className="card">
        <p className="muted">SoulSeer respects your privacy. We collect only the information needed to operate the platform: your account details, reading history, and payment records.</p>
        <p className="muted">Authentication is handled by Auth0; we never store your password. Payments are processed by Stripe; raw card data never touches our servers. Reading media is carried by Agora.</p>
        <p className="muted">In shared reading history, identities are shown by display name, not email. You may request account deletion at any time (GDPR/CCPA) by contacting support, and we will honor it.</p>
      </div>
    </div>
  );
}
