import type { Metadata } from "next";

import { instrumentSerif } from "@/lib/marketing/fonts";
import { cn } from "@/lib/utils";
import { MarketingNavbar } from "@/components/marketing/marketing-navbar";
import { Footer } from "@/components/marketing/footer";

// Fully static, same reasoning as the marketing homepage — this must never
// depend on the API being up.
export const revalidate = false;

export const metadata: Metadata = {
  title: "Privacy Policy — Priinteve Menu",
  description: "How Priinteve collects, uses, and protects data for restaurants and their guests.",
};

const LAST_UPDATED = "September 9, 2026";

export default function PrivacyPolicyPage() {
  return (
    <div
      data-marketing
      className={cn("flex min-h-screen flex-col bg-background", instrumentSerif.variable)}
    >
      <MarketingNavbar />
      <main className="flex-1">
        <div className="mx-auto max-w-[760px] px-6 py-20 sm:px-10 sm:py-28">
          <h1 className="text-4xl font-semibold tracking-[-0.02em] text-ink sm:text-5xl">Privacy Policy</h1>
          <p className="mt-3 text-sm text-muted-foreground">Last updated: {LAST_UPDATED}</p>

          <div className="mt-12 flex flex-col gap-10 text-[0.9375rem] leading-relaxed text-foreground/85">
            <Section title="Who we are">
              <p>
                Priinteve (&quot;we&quot;, &quot;us&quot;) provides table-side QR ordering, a kitchen display board, and
                billing tools that restaurants use to run their own ordering operations. This policy
                covers priinteve.com and its subdomains (menu.priinteve.com, cards.priinteve.com), and
                applies both to the guests who place orders and the restaurant staff who use our
                dashboard.
              </p>
            </Section>

            <Section title="Information we collect">
              <p className="font-medium text-foreground">From guests placing an order</p>
              <List
                items={[
                  "Name and mobile number, entered at checkout — used to identify repeat guests at the same restaurant and to deliver order updates.",
                  "Order details: items, table or takeaway selection, and amount paid.",
                  "Payment status from our payment processor (see “Third parties” below) — we do not receive or store your card, UPI, or bank details ourselves.",
                ]}
              />
              <p className="mt-4 font-medium text-foreground">From restaurant staff and owners</p>
              <List
                items={[
                  "Account details: name, email, and a securely hashed password.",
                  "Business details entered for invoicing: restaurant name, address, GSTIN, and FSSAI licence number.",
                  "Uploaded assets, such as a restaurant's logo.",
                ]}
              />
              <p className="mt-4 font-medium text-foreground">Automatically</p>
              <List
                items={[
                  "Session cookies, so staff and admin logins persist across visits.",
                  "Device-pairing identifiers for kitchen display screens and receipt printers connected to a restaurant's account.",
                ]}
              />
            </Section>

            <Section title="How we use this information">
              <List
                items={[
                  "To take, prepare, and fulfil orders, and to show a guest their own order status and receipt.",
                  "To send an order-completion receipt — including a PDF invoice — over WhatsApp, using Meta's WhatsApp Business Platform, when a restaurant marks an order complete.",
                  "To announce when a pickup order is ready, by push notification and by a spoken announcement on the restaurant's pickup screen.",
                  "To process payments through our payment gateway partner.",
                  "To give restaurant owners a dashboard of their own orders, customers, and sales.",
                  "To operate loyalty points, rewards, and scratch-card promotions a restaurant chooses to run.",
                ]}
              />
              <p className="mt-4">
                We do not sell guest or restaurant data, and we do not use order data for advertising.
              </p>
            </Section>

            <Section title="Third parties we work with">
              <p>
                We rely on a small number of service providers to run the platform. Each only receives
                the data it needs to do its specific job:
              </p>
              <List
                items={[
                  "Razorpay — processes online payments. We receive payment status back, not your payment details.",
                  "Meta / WhatsApp Business Platform — delivers the order-completion receipt described above, when a restaurant has this enabled.",
                  "Amazon Web Services (S3) — stores uploaded images such as restaurant logos and menu photos.",
                  "Sarvam AI — converts “order ready” text into spoken audio for the restaurant's pickup screen.",
                  "Our email provider — sends account and password-related emails to restaurant staff.",
                ]}
              />
            </Section>

            <Section title="Data retention">
              <p>
                We keep order and account records for as long as a restaurant&apos;s account is active, and
                for a reasonable period afterward for accounting and legal purposes (e.g. tax records).
                A restaurant can ask us to delete a closed account&apos;s data — see &quot;Contact us&quot; below.
              </p>
            </Section>

            <Section title="Security">
              <p>
                Passwords are stored hashed, never in plain text. Traffic to our apps is encrypted in
                transit (HTTPS). Access to restaurant and payment data is limited to what each part of
                the system needs to function.
              </p>
            </Section>

            <Section title="Your choices">
              <p>
                If you&apos;d like your order history or account data corrected or deleted, or you&apos;d
                like a restaurant to stop sending you WhatsApp order receipts, contact us using the
                details below and we&apos;ll act on it.
              </p>
            </Section>

            <Section title="Children's privacy">
              <p>
                Priinteve is intended for restaurants and their adult customers, and is not directed at
                children. We do not knowingly collect personal information from children.
              </p>
            </Section>

            <Section title="Changes to this policy">
              <p>
                We&apos;ll update this page if how we handle data changes, and update the &quot;Last
                updated&quot; date above when we do.
              </p>
            </Section>

            <Section title="Contact us">
              <p>
                Questions about this policy or your data can be sent to{" "}
                <a href="mailto:support@priinteve.com" className="text-primary underline underline-offset-2">
                  support@priinteve.com
                </a>
                .
              </p>
            </Section>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-xl font-semibold tracking-[-0.01em] text-ink">{title}</h2>
      <div className="mt-3 flex flex-col gap-3">{children}</div>
    </section>
  );
}

function List({ items }: { items: string[] }) {
  return (
    <ul className="flex flex-col gap-2 pl-5">
      {items.map((item) => (
        <li key={item} className="list-disc marker:text-primary">
          {item}
        </li>
      ))}
    </ul>
  );
}
