"use client";

import { useId, type ReactNode } from "react";

import { FieldLegend, FieldSet } from "@/components/ui/field";
import { ToggleGroup } from "@/components/ui/toggle-group";

export function FilterGroup({
  label,
  value,
  onValueChange,
  children,
}: {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  children: ReactNode;
}) {
  const labelId = useId();

  return (
    <FieldSet>
      <FieldLegend variant="label" id={labelId}>
        {label}
      </FieldLegend>
      <ToggleGroup
        type="single"
        variant="outline"
        value={value}
        aria-labelledby={labelId}
        onValueChange={(nextValue) => {
          if (nextValue) onValueChange(nextValue);
        }}
      >
        {children}
      </ToggleGroup>
    </FieldSet>
  );
}
