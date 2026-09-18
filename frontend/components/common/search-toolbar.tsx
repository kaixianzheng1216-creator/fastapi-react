import { SearchIcon } from "lucide-react";
import type { FormEventHandler } from "react";

import { Button } from "@/components/ui/button";
import { ButtonContent } from "@/components/common/button-content";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type SearchToolbarProps = {
  id: string;
  label: string;
  placeholder: string;
  onSubmit: FormEventHandler<HTMLFormElement>;
  className?: string;
  defaultValue?: string;
  maxLength?: number;
  isPending?: boolean;
  required?: boolean;
};

export function SearchToolbar({
  id,
  label,
  placeholder,
  onSubmit,
  className,
  defaultValue,
  maxLength,
  isPending = false,
  required = false,
}: SearchToolbarProps) {
  return (
    <form
      role="search"
      aria-label={label}
      className={cn("flex w-full min-w-0 items-center gap-2 sm:w-auto", className)}
      onSubmit={(event) => {
        if (isPending) {
          event.preventDefault();
          return;
        }
        onSubmit(event);
      }}
    >
      <label htmlFor={id} className="sr-only">
        {label}
      </label>

      <Input
        key={defaultValue}
        id={id}
        name="search"
        type="search"
        autoComplete="off"
        spellCheck={false}
        className="min-w-0 flex-1 sm:w-64 sm:flex-none"
        placeholder={placeholder}
        defaultValue={defaultValue}
        maxLength={maxLength}
        required={required}
      />
      <Button
        type="submit"
        variant="outline"
        disabled={isPending}
        aria-busy={isPending}
      >
        <ButtonContent loading={isPending} icon={SearchIcon}>
          搜索
        </ButtonContent>
      </Button>
    </form>
  );
}
