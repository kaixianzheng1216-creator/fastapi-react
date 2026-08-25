import { SearchIcon } from "lucide-react";
import type { ChangeEventHandler, FormEventHandler } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type SearchToolbarProps = {
  id: string;
  label: string;
  placeholder: string;
  onSubmit: FormEventHandler<HTMLFormElement>;
  className?: string;
  defaultValue?: string;
  value?: string;
  onChange?: ChangeEventHandler<HTMLInputElement>;
  maxLength?: number;
};

export function SearchToolbar({
  id,
  label,
  placeholder,
  onSubmit,
  className,
  defaultValue,
  value,
  onChange,
  maxLength,
}: SearchToolbarProps) {
  return (
    <form
      role="search"
      className={cn("flex w-full min-w-0 items-center gap-2 sm:w-auto", className)}
      onSubmit={onSubmit}
    >
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <Input
        id={id}
        name="search"
        type="search"
        autoComplete="off"
        spellCheck={false}
        className="min-w-0 flex-1 sm:w-64 sm:flex-none"
        placeholder={placeholder}
        defaultValue={defaultValue}
        value={value}
        onChange={onChange}
        maxLength={maxLength}
      />
      <Button type="submit" variant="outline">
        <SearchIcon data-icon="inline-start" aria-hidden="true" />
        搜索
      </Button>
    </form>
  );
}
