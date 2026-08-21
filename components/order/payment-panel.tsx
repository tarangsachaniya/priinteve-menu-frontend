"use client";

import { useState } from "react";
import { Banknote, Check, Loader2, Smartphone } from "lucide-react";
import { toast } from "sonner";

import { formatCurrency } from "@/lib/format";

/** Matches settleOrderSchema — the three methods the pay route accepts. */
type PayMethod = "UPI" | "CASH" | "UPI_QR";

type UpiQrDetails = { uri: string; qrDataUrl: string; vpa: string; payeeName: string };

/**
 * How a guest settles their invoice, shown once the restaurant closes it.
 *
 * Two kinds. UPI hands the guest a `upi://pay?...` deep link plus its QR
 * encoding, with the amount pre-filled — no gateway involved. Cash and UPI
 * both only declare an intention: both keep showing a waiting state until a
 * staff member confirms receipt, because a guest saying they will pay, or
 * tapping a link that reports nothing back, is not the same as having paid.
 *
 * Every option is gated on the restaurant's own settings, so a place that only
 * takes cash never shows a button that would fail.
 */
export function PaymentPanel({
  orderId,
  total,
  canPayCash,
  canPayUpiQr,
  paymentMode,
  onPaid,
}: {
  orderId: string;
  total: number;
  canPayCash: boolean;
  canPayUpiQr: boolean;
  /** Set once the guest has committed to a method; drives the waiting state. */
  paymentMode: "ONLINE" | "COUNTER" | "UPI_QR" | null;
  onPaid: () => void;
}) {
  const [busy, setBusy] = useState<PayMethod | null>(null);
  const [upiQr, setUpiQr] = useState<UpiQrDetails | null>(null);
  const cashDeclared = paymentMode === "COUNTER";

  async function choose(method: PayMethod) {
    setBusy(method);
    try {
      const res = await fetch(`/api/order/${orderId}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        toast.error(typeof data.error === "string" ? data.error : "Could not start the payment");
        return;
      }

      if (method === "CASH") {
        toast.success("Let the counter know — they'll confirm your payment.");
        onPaid();
        return;
      }

      // UPI and UPI_QR both land here: the guest has not paid, they have
      // been handed a deep link + code. The panel swaps to it and the order
      // stays open until the restaurant confirms the credit.
      setUpiQr(data.upi);
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  if (upiQr) {
    return (
      <UpiQrPanel
        details={upiQr}
        total={total}
        onBack={() => setUpiQr(null)}
        canSwitch={canPayCash}
      />
    );
  }

  if (cashDeclared) {
    return (
      <section
        className="flex flex-col items-center gap-2 border p-5 text-center"
        style={{
          backgroundColor: "var(--resto-surface)",
          borderColor: "var(--resto-border)",
          borderRadius: "var(--resto-radius-lg)",
        }}
      >
        <span
          className="grid size-12 place-items-center rounded-full"
          style={{ backgroundColor: "var(--resto-brand-tint)" }}
        >
          <Banknote className="size-6" style={{ color: "var(--resto-brand-text)" }} aria-hidden />
        </span>
        <p className="resto-display text-lg font-semibold" style={{ color: "var(--resto-text)" }}>
          Show this at the counter
        </p>
        <p className="resto-numeric text-2xl font-bold" style={{ color: "var(--resto-text)" }}>
          {formatCurrency(total)}
        </p>
        <p className="text-sm" style={{ color: "var(--resto-text-muted)" }}>
          This screen updates automatically once the restaurant confirms your payment.
        </p>
        {canPayUpiQr && (
          <button
            type="button"
            onClick={() => choose("UPI")}
            disabled={busy !== null}
            className="mt-1 text-xs font-semibold underline-offset-2 hover:underline"
            style={{ color: "var(--resto-brand-text)" }}
          >
            Pay by UPI instead
          </button>
        )}
      </section>
    );
  }

  return (
    <>
      <section
        className="flex flex-col gap-4 border p-5"
        style={{
          backgroundColor: "var(--resto-surface)",
          borderColor: "var(--resto-brand-tint-border)",
          borderRadius: "var(--resto-radius-lg)",
        }}
      >
        <div className="text-center">
          <p className="text-sm" style={{ color: "var(--resto-text-muted)" }}>
            Your invoice is ready
          </p>
          <p
            className="resto-display resto-numeric text-3xl font-bold"
            style={{ color: "var(--resto-text)" }}
          >
            {formatCurrency(total)}
          </p>
        </div>

        {!canPayCash && !canPayUpiQr ? (
          <p className="text-center text-sm" style={{ color: "var(--resto-text-muted)" }}>
            Please settle with the restaurant directly.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {canPayUpiQr && (
              <button
                type="button"
                onClick={() => choose("UPI")}
                disabled={busy !== null}
                className="flex items-center justify-center gap-2 py-3 text-sm font-semibold transition-colors disabled:opacity-60"
                style={{
                  backgroundColor: "var(--resto-brand-500)",
                  color: "var(--on-brand)",
                  borderRadius: "var(--resto-radius-full)",
                }}
              >
                {busy === "UPI" ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  <Smartphone className="size-4" aria-hidden />
                )}
                Pay by UPI
              </button>
            )}
            {canPayCash && (
              <button
                type="button"
                onClick={() => choose("CASH")}
                disabled={busy !== null}
                className="flex items-center justify-center gap-2 border py-3 text-sm font-semibold transition-colors disabled:opacity-60"
                style={{
                  borderColor: "var(--resto-border)",
                  color: "var(--resto-text)",
                  borderRadius: "var(--resto-radius-full)",
                }}
              >
                {busy === "CASH" ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  <Banknote className="size-4" aria-hidden />
                )}
                Pay by cash
              </button>
            )}
          </div>
        )}
      </section>
    </>
  );
}

/**
 * The UPI QR, once the guest has tapped "Pay by UPI".
 *
 * Shows both a QR and a deep-link button, because the guest is in one of two
 * situations and they need opposite things. At a table with a friend's
 * phone, or at a counter, the QR is scanned by another device. Alone with
 * their own phone — the common case, since they are reading this menu on it
 * — a QR is useless and the deep link is the answer, so the button below
 * hands them straight to their UPI app.
 *
 * The `upi://` link resolves to an app chooser on Android. iOS is less
 * dependable about it, which is why the QR is the thing on top and the link is
 * the fallback rather than the other way round.
 *
 * It says plainly that the restaurant has to confirm. A guest who pays and
 * then walks out believing the invoice is settled is the exact failure this
 * whole flow has to avoid, and the honest sentence is cheaper than the
 * argument at the door.
 */
function UpiQrPanel({
  details,
  total,
  onBack,
  canSwitch,
}: {
  details: UpiQrDetails;
  total: number;
  onBack: () => void;
  canSwitch: boolean;
}) {
  return (
    <section
      className="flex flex-col items-center gap-3 border p-5 text-center"
      style={{
        backgroundColor: "var(--resto-surface)",
        borderColor: "var(--resto-brand-tint-border)",
        borderRadius: "var(--resto-radius-lg)",
      }}
    >
      <p className="text-sm" style={{ color: "var(--resto-text-muted)" }}>
        Scan with any UPI app
      </p>

      {/* White plate under the code regardless of theme: a QR inverted by a
          dark surface is one many scanners refuse to read. */}
      <span className="rounded-2xl bg-white p-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={details.qrDataUrl}
          alt={`UPI payment code for ${formatCurrency(total)}`}
          width={200}
          height={200}
          className="size-[200px]"
        />
      </span>

      <div>
        <p className="resto-numeric text-2xl font-bold" style={{ color: "var(--resto-text)" }}>
          {formatCurrency(total)}
        </p>
        <p className="text-xs" style={{ color: "var(--resto-text-muted)" }}>
          to {details.payeeName} · {details.vpa}
        </p>
      </div>

      <a
        href={details.uri}
        className="flex w-full items-center justify-center gap-2 py-3 text-sm font-semibold"
        style={{
          backgroundColor: "var(--resto-brand-500)",
          color: "var(--on-brand)",
          borderRadius: "var(--resto-radius-full)",
        }}
      >
        <Smartphone className="size-4" aria-hidden />
        Open in a UPI app
      </a>

      <p className="text-sm" style={{ color: "var(--resto-text-muted)" }}>
        After paying, show this screen at the counter. The restaurant confirms your payment, and
        this page updates on its own.
      </p>

      {canSwitch && (
        <button
          type="button"
          onClick={onBack}
          className="text-xs font-semibold underline-offset-2 hover:underline"
          style={{ color: "var(--resto-brand-text)" }}
        >
          Pay another way
        </button>
      )}
    </section>
  );
}

/** The receipt state, once money has actually arrived. */
export function PaidReceipt({
  total,
  mode,
}: {
  total: number;
  mode: "ONLINE" | "COUNTER" | "UPI_QR" | null;
}) {
  return (
    <section
      className="flex flex-col items-center gap-2 border p-5 text-center"
      style={{
        backgroundColor: "var(--resto-success-soft)",
        borderColor: "var(--resto-success)",
        borderRadius: "var(--resto-radius-lg)",
      }}
    >
      <span
        className="grid size-12 place-items-center rounded-full"
        style={{ backgroundColor: "var(--resto-success)" }}
      >
        <Check className="size-6 text-white" aria-hidden />
      </span>
      <p className="resto-display text-lg font-semibold" style={{ color: "var(--resto-text)" }}>
        Paid
      </p>
      <p className="resto-numeric text-2xl font-bold" style={{ color: "var(--resto-text)" }}>
        {formatCurrency(total)}
      </p>
      <p className="text-sm" style={{ color: "var(--resto-text-muted)" }}>
        {mode === "COUNTER"
          ? "Paid in cash at the counter."
          : mode === "UPI_QR"
            ? "Paid by UPI. Thank you!"
            : "Paid online. Thank you!"}
      </p>
    </section>
  );
}
