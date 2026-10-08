import Image from "next/image";

import { LoginForm } from "@/app/login/_components/login-form";
import loginHero from "./login-hero.png";

export default function LoginPage() {
  return (
    <main className="flex min-h-svh items-center justify-center bg-muted/30 p-6">
      <div className="grid w-full max-w-6xl overflow-hidden rounded-lg border bg-card text-card-foreground md:grid-cols-2">
        <Image
          src={loginHero}
          alt="DATA HUB"
          loading="eager"
          sizes="(max-width: 768px) 100vw, 50vw"
          className="h-auto w-full"
        />

        <section className="flex items-center justify-center p-8" aria-labelledby="login-heading">
          <div className="w-full max-w-xs">
            <LoginForm />
          </div>
        </section>
      </div>
    </main>
  );
}
