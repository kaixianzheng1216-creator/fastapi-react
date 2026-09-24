"use client";

import { useRef, useState, type ReactNode } from "react";
import { ChevronsUpDownIcon } from "lucide-react";
import { useDebouncedCallback } from "use-debounce";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export function SelectionPopover({
  label,
  searchLabel,
  open,
  onOpenChange,
  onSearch,
  disabled,
  children,
}: {
  label: string;
  searchLabel: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSearch: (search: string) => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  const [input, setInput] = useState("");
  const composing = useRef(false);
  const searchLater = useDebouncedCallback(
    (value: string) => onSearch(value.trim()),
    300,
  );

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen);

        if (!nextOpen) {
          searchLater.cancel();
          composing.current = false;
          setInput("");
          onSearch("");
        }
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="w-full justify-between"
          disabled={disabled}
        >
          {label}
          <ChevronsUpDownIcon data-icon="inline-end" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        aria-label={label}
        className="flex max-h-[var(--radix-popover-content-available-height)] w-[var(--radix-popover-trigger-width)] flex-col gap-3 overflow-hidden"
      >
        <Input
          aria-label={searchLabel}
          placeholder={`${searchLabel}…`}
          value={input}
          disabled={disabled}
          onChange={(event) => {
            setInput(event.target.value);
            if (!composing.current) searchLater(event.target.value);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              if (!composing.current) searchLater.flush();
            }
          }}
          onCompositionStart={() => {
            composing.current = true;
            searchLater.cancel();
          }}
          onCompositionEnd={(event) => {
            composing.current = false;
            searchLater(event.currentTarget.value);
          }}
        />
        <div className="min-h-0 max-h-72 overflow-y-auto overscroll-contain p-1">
          {children}
        </div>
      </PopoverContent>
    </Popover>
  );
}
