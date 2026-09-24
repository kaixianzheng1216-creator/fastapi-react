"use client";

import { SearchIcon } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { useDebouncedCallback } from "use-debounce";

import { Button } from "@/components/ui/button";
import { ButtonContent } from "@/components/common/button-content";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type SearchToolbarProps = {
  label: string;
  placeholder?: string;
  className?: string;
  maxLength?: number;
  isPending?: boolean;
  value: string;
  onSearch: (value: string) => void;
  searchOnChange?: boolean;
};

export function SearchToolbar({
  label,
  placeholder = label,
  onSearch,
  value,
  className,
  maxLength,
  isPending = false,
  searchOnChange = true,
}: SearchToolbarProps) {
  const generatedId = useId();
  const [input, setInput] = useState(value);
  const composing = useRef(false);
  const submitted = useRef(value);
  const search = useDebouncedCallback((text: string) => {
    submitted.current = text.trim();
    onSearch(submitted.current);
  }, 300);

  useEffect(() => {
    if (value !== submitted.current) {
      search.cancel();
      submitted.current = value;
      setInput(value);
    }
  }, [value, search]);

  useEffect(() => () => search.cancel(), [search]);

  return (
    <form
      role="search"
      aria-label={label}
      className={cn(
        "flex w-full min-w-0 items-center gap-2 sm:w-auto",
        className,
      )}
      onSubmit={(event) => {
        event.preventDefault();
        if (isPending || composing.current) {
          return;
        }
        search.cancel();
        submitted.current = input.trim();
        onSearch(submitted.current);
      }}
    >
      <label htmlFor={generatedId} className="sr-only">
        {label}
      </label>

      <Input
        id={generatedId}
        name="search"
        type="search"
        autoComplete="off"
        spellCheck={false}
        className="min-w-0 flex-1 sm:w-64 sm:flex-none"
        placeholder={placeholder}
        value={input}
        onChange={(event) => {
          setInput(event.target.value);
          if (searchOnChange && !composing.current) search(event.target.value);
        }}
        onCompositionStart={() => {
          composing.current = true;
          search.cancel();
        }}
        onCompositionEnd={(event) => {
          composing.current = false;
          if (searchOnChange) search(event.currentTarget.value);
        }}
        maxLength={maxLength}
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
