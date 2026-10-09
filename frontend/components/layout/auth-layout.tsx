import Image from "next/image";
import type { ReactNode } from "react";

import loginHero from "@/app/login/login-hero.png";

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-svh items-center justify-center bg-muted/30 p-6">
      <div className="grid w-full max-w-6xl overflow-hidden rounded-lg border bg-card text-card-foreground shadow-xl md:grid-cols-2">
        <Image
          src={loginHero}
          alt="DATA HUB"
          loading="eager"
          sizes="(max-width: 768px) 100vw, 50vw"
          className="h-auto w-full"
        />

        <section
          className="flex min-w-0 items-center justify-center p-8"
          aria-labelledby="login-heading"
        >
          <div className="w-full max-w-xs">{children}</div>
        </section>
      </div>
    </main>
  );
}
