import { DollarSign } from "lucide-react";
import type { ChangeEvent, ComponentProps, FocusEvent } from "react";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { round2 } from "@/lib/utils";

type MoneyInputProps = ComponentProps<typeof InputGroupInput>;

export function MoneyInput({
  className,
  onChange,
  onBlur,
  ...props
}: MoneyInputProps) {
  // Normalize to 2 decimals on blur so the value the user sees matches what the
  // backend stores (it rounds all amounts to 2 decimals).
  const handleBlur = (e: FocusEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    if (raw !== "" && Number.isFinite(Number(raw))) {
      const rounded = String(round2(Number(raw)));
      if (rounded !== raw) {
        e.target.value = rounded;
        onChange?.(e as unknown as ChangeEvent<HTMLInputElement>);
      }
    }
    onBlur?.(e);
  };

  return (
    <InputGroup className={className}>
      <InputGroupAddon aria-hidden="true">
        <DollarSign className="size-3.5" />
      </InputGroupAddon>
      <InputGroupInput
        type="number"
        step="0.01"
        placeholder="0.00"
        onChange={onChange}
        onBlur={handleBlur}
        {...props}
      />
    </InputGroup>
  );
}
