import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

export function BackButton({ href, label }: { href: string; label: string }) {
  return (
    <Button asChild variant="outline" size="icon">
      <Link href={href} aria-label={label} title={label}>
        <ArrowLeftIcon aria-hidden="true" />
      </Link>
    </Button>
  );
}
