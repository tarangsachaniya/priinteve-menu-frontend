import { MessageCircle } from "lucide-react";

import { serverFetch } from "@/lib/api/server";
import { Card, CardContent } from "@/components/ui/card";
import { WhatsAppSettingsForm, type WhatsappSettings } from "@/components/restaurant/whatsapp-settings-form";
import { WhatsappUsageView, type WhatsappUsageData } from "@/components/restaurant/whatsapp-usage-view";

export const dynamic = "force-dynamic";

const EMPTY_USAGE: WhatsappUsageData = { currentMonth: { count: 0, charges: 0 }, history: [] };

export default async function WhatsappSettingsPage() {
  // Independent, fault-tolerant reads — a still-deploying route missing
  // shouldn't take the whole page down, same convention every other
  // Settings page here already follows.
  const [status, usage] = await Promise.all([
    serverFetch<WhatsappSettings>("/api/restaurant/whatsapp", { cache: "no-store" }).catch(() => null),
    serverFetch<WhatsappUsageData>("/api/restaurant/whatsapp/usage", { cache: "no-store" }).catch(() => EMPTY_USAGE),
  ]);

  if (!status?.isEnabled) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex items-center gap-3 py-6 text-sm text-muted-foreground">
          <MessageCircle className="size-5 shrink-0" />
          WhatsApp messaging isn&apos;t enabled for your restaurant yet. Ask Priinteve to turn it on.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <WhatsAppSettingsForm endpoint="/api/restaurant/whatsapp" initial={status} editable={false} />
      <WhatsappUsageView initial={usage} messagesEndpoint="/api/restaurant/whatsapp/messages" />
    </div>
  );
}
