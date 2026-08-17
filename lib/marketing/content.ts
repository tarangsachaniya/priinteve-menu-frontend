import {
  BookOpen,
  ClipboardList,
  Gauge,
  QrCode,
  ReceiptText,
  Smartphone,
  Star,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";

/**
 * Static copy for the landing page — no CMS, no API call. The restaurant
 * product's marketing content changes rarely enough that a code change and a
 * redeploy is the right cost, and it keeps app/page.tsx fully static
 * (revalidate = false) with nothing to fetch.
 */

export const HOW_IT_WORKS: { step: string; title: string; description: string }[] = [
  {
    step: "01",
    title: "Guest taps or scans the table",
    description: "No app to install. Tap the NFC tag or scan the QR — either opens your live menu straight in their browser.",
  },
  {
    step: "02",
    title: "They order from their phone",
    description: "Categories, photos, veg/non-veg tags, add-ons — guests build their own order, no waiting to flag someone down.",
  },
  {
    step: "03",
    title: "You get paid, however they choose",
    description: "Pay online, at the counter, or by UPI QR — the order lands on your kitchen board the moment it's placed.",
  },
];

export const FEATURES: { icon: LucideIcon; title: string; description: string }[] = [
  {
    icon: QrCode,
    title: "A QR code per table",
    description: "Generate and print a code for every table in seconds — each one opens straight into that table's order.",
  },
  {
    icon: Gauge,
    title: "Live kitchen board",
    description: "Every order lands on one screen the moment it's placed, moving from placed to preparing to ready as you work.",
  },
  {
    icon: ReceiptText,
    title: "GST-ready invoices",
    description: "Every order generates a proper tax invoice automatically — GSTIN, FSSAI licence, and a clean line-item breakdown.",
  },
  {
    icon: Star,
    title: "Guest reviews",
    description: "Diners rate their order after it's done. Publish the ones you want, keep the rest private.",
  },
  {
    icon: ClipboardList,
    title: "Peak-hour smart menu",
    description: "Mark dishes to demote during your rush windows, so the kitchen isn't buried in the slowest items to make.",
  },
  {
    icon: BookOpen,
    title: "A menu you control",
    description: "Add categories and dishes, mark what's out of stock, and update prices — live the moment you save.",
  },
];

export const PRICING_TIERS: {
  name: string;
  price: string;
  period: string;
  description: string;
  features: string[];
  highlighted?: boolean;
}[] = [
  {
    name: "Starter",
    price: "Free",
    period: "for your first month",
    description: "Everything you need to take table-side QR ordering live.",
    features: ["Unlimited tables", "Live orders board", "GST-ready invoices", "Guest reviews"],
  },
  {
    name: "Growth",
    price: "Talk to us",
    period: "per month, per branch",
    description: "For restaurants running multiple branches or high order volume.",
    features: ["Everything in Starter", "Multiple branches", "Priority support", "Onboarding assistance"],
    highlighted: true,
  },
];

export const FAQS: { question: string; answer: string }[] = [
  {
    question: "Do guests need to install an app?",
    answer: "No. The table QR opens a normal web page in whatever browser they already have open — nothing to download.",
  },
  {
    question: "How do payments work?",
    answer: "You choose which methods to accept: pay online through Razorpay, pay at the counter, or scan your own UPI QR. Nothing is forced on you.",
  },
  {
    question: "Can I edit my menu myself?",
    answer: "Yes — categories, dishes, prices, photos and stock status all update from your own restaurant console, live the moment you save.",
  },
  {
    question: "What does setup actually involve?",
    answer: "We create your restaurant account and your first batch of table QR codes. You add your menu, print the QR codes, and you're taking orders.",
  },
  {
    question: "Is this the same company as Priinteve digital cards?",
    answer: "Yes — same team, same account style. This product is entirely separate from the digital business card product, built for table-side ordering.",
  },
];

export const HERO_STATS: { label: string; icon: LucideIcon }[] = [
  { label: "No app for guests", icon: Smartphone },
  { label: "Set up in a day", icon: UtensilsCrossed },
];
