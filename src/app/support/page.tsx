import type { Metadata } from "next";
import { AppShell, SectionTitle } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Headphones, Megaphone } from "@/components/icons";
import {
  BRAND_NAME,
  SUPPORT_HANDLE,
  TELEGRAM_CHANNEL_URL,
  TELEGRAM_SUPPORT_URL,
  payoutClockLabel,
} from "@/lib/platform";

export const metadata: Metadata = { title: `Support · ${BRAND_NAME}` };

const FAQ = [
  {
    q: "When do my returns arrive?",
    a: `Every day at ${payoutClockLabel()} Kampala time, once the coffee has been processed and sold to market vendors. They are credited automatically — there is nothing to press.`,
  },
  {
    q: "My deposit has not arrived.",
    a: "Deposits are confirmed by mobile money, not by us. If you approved the prompt and the wallet has not moved after a few minutes, open Records and check the deposit status, then contact support with the amount and time.",
  },
  {
    q: "Why is my balance higher than what I can withdraw?",
    a: "A withdrawal you already requested holds its amount until it is paid. That held amount is shown on the withdraw screen and is released if the payout fails.",
  },
  {
    q: "How much is the withdrawal fee?",
    a: "15% of the amount you request. The withdraw screen shows the fee and the exact amount that will reach your phone before you confirm.",
  },
  {
    q: "Can I change who invited me?",
    a: "No. The person whose code you used is recorded once and never changes, which is what keeps commission fair for everyone.",
  },
];

export default function SupportPage() {
  return (
    <AppShell title="Support" back="/me">
      <div className="space-y-4 px-4 py-4">
        <div className="app-card space-y-3 p-4">
          <p className="text-sm text-muted-foreground">
            Our team answers on Telegram. Please include your username and the time of the
            transaction so we can find it quickly.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <a href={TELEGRAM_SUPPORT_URL} target="_blank" rel="noreferrer">
              <Button className="w-full" size="lg">
                <Headphones className="size-4" />
                Support
              </Button>
            </a>
            <a href={TELEGRAM_CHANNEL_URL} target="_blank" rel="noreferrer">
              <Button variant="outline" className="w-full" size="lg">
                <Megaphone className="size-4" />
                Channel
              </Button>
            </a>
          </div>
          <p className="text-center text-xs font-bold text-accent">{SUPPORT_HANDLE}</p>
        </div>

        <section>
          <SectionTitle>Common questions</SectionTitle>
          <dl className="app-card divide-y divide-border">
            {FAQ.map((item) => (
              <div key={item.q} className="space-y-1 p-4">
                <dt className="text-sm font-bold">{item.q}</dt>
                <dd className="text-xs leading-relaxed text-muted-foreground">{item.a}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
    </AppShell>
  );
}
