import { useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { api } from "../lib/api.js";
import { config } from "../lib/config.js";
import { useToast } from "../lib/toast.js";
import { PRESET_TOPUP_CENTS, MIN_TOPUP_CENTS } from "@soulseer/shared";
import { fmtUSD } from "../lib/format.js";

const stripePromise = config.stripePk ? loadStripe(config.stripePk) : null;

function CheckoutForm({ onDone }: { onDone: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const pay = async () => {
    if (!stripe || !elements) return;
    setBusy(true);
    const { error } = await stripe.confirmPayment({ elements, redirect: "if_required" });
    setBusy(false);
    if (error) toast(error.message || "Payment failed", "error");
    else { toast("Payment received! Balance updates shortly.", "success"); onDone(); }
  };

  return (
    <div>
      <PaymentElement />
      <button className="btn" style={{ marginTop: 12, width: "100%" }} disabled={!stripe || busy} onClick={pay}>
        {busy ? "Processing…" : "Pay"}
      </button>
    </div>
  );
}

export function AddFunds({ onDone }: { onDone: () => void }) {
  const [amount, setAmount] = useState(2500);
  const [custom, setCustom] = useState("");
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const toast = useToast();

  const begin = async () => {
    const cents = custom ? Math.round(parseFloat(custom) * 100) : amount;
    if (!cents || cents < MIN_TOPUP_CENTS) return toast(`Minimum top-up is ${fmtUSD(MIN_TOPUP_CENTS)}`, "error");
    try {
      const { clientSecret } = await api.post<{ clientSecret: string }>("/api/payments/createintent", { amountCents: cents });
      setClientSecret(clientSecret);
    } catch (e) { toast((e as Error).message, "error"); }
  };

  if (!stripePromise) return <p className="muted">Payments are not configured (missing Stripe key).</p>;

  if (clientSecret) {
    return (
      <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: "night", variables: { colorPrimary: "#FF69B4" } } }}>
        <CheckoutForm onDone={onDone} />
      </Elements>
    );
  }

  return (
    <div>
      <div className="row">
        {PRESET_TOPUP_CENTS.map((c) => (
          <button key={c} className={`btn ${amount === c && !custom ? "" : "btn-ghost"}`} onClick={() => { setAmount(c); setCustom(""); }}>{fmtUSD(c)}</button>
        ))}
      </div>
      <input className="input" style={{ marginTop: 10 }} placeholder="Custom amount (USD)" value={custom} onChange={(e) => setCustom(e.target.value)} />
      <button className="btn" style={{ marginTop: 10, width: "100%" }} onClick={begin}>Continue to Payment</button>
    </div>
  );
}
