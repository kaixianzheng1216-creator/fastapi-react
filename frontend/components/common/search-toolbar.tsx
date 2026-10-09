"use client";

import { SearchIcon } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { useDebouncedCallback } from "use-debounce";

import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Spinner } from "@/components/ui/spinner";
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
      className={cn("w-full min-w-0 sm:w-72", className)}
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

      <InputGroup>
        <InputGroupInput
          id={generatedId}
          name="search"
          type="search"
          autoComplete="off"
          spellCheck={false}
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
        <InputGroupAddon align="inline-end">
          <InputGroupButton
            type="submit"
            size="icon-sm"
            disabled={isPending}
            aria-label="搜索"
            aria-busy={isPending}
          >
            {isPending ? <Spinner /> : <SearchIcon aria-hidden="true" />}
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
    </form>
  );
}
