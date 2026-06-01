import { DollarSign } from "lucide-react";
import type { ComponentProps } from "react";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";

type MoneyInputProps = ComponentProps<typeof InputGroupInput>;

export function MoneyInput({ className, ...props }: MoneyInputProps) {
  return (
    <InputGroup className={className}>
      <InputGroupAddon aria-hidden="true">
        <DollarSign className="size-3.5" />
      </InputGroupAddon>
      <InputGroupInput
        type="number"
        step="0.01"
        placeholder="0.00"
        {...props}
      />
    </InputGroup>
  );
}
