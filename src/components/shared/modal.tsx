import * as React from "react";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Tracks how many open modals are stacked above this one.
 * When > 0, the modal hides itself so only the topmost is visible.
 */
const ModalDepthContext = React.createContext<{
  depth: number;
  register: () => () => void;
}>({
  depth: 0,
  register: () => () => {},
});

export type ModalStep = {
  id: string;
  title: string;
  content: React.ReactNode;
  /** When false, disables the Next button while this step is active. */
  canAdvance?: boolean;
};

type BaseProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  /** Hide the top-right close button. */
  hideClose?: boolean;
  /** Custom element rendered at the top-right of the modal, replacing the close button. */
  headerAction?: React.ReactNode;
  children?: React.ReactNode;
};

type SingleProps = BaseProps & {
  steps?: undefined;
  /** Pinned footer below the scrollable body. */
  footer?: React.ReactNode;
};

type WizardProps = BaseProps & {
  steps: ModalStep[];
  /** Controlled step index. Omit for uncontrolled. */
  activeStep?: number;
  onStepChange?: (index: number) => void;
  onSubmit?: () => void;
  submitLabel?: string;
  submitting?: boolean;
  /** Disable final submit button (e.g. cross-step validation). */
  canSubmit?: boolean;
};

export type ModalProps = SingleProps | WizardProps;

export function Modal(props: ModalProps) {
  const {
    open,
    onClose,
    title,
    description,
    hideClose,
    headerAction,
    children,
  } = props;

  const isWizard = "steps" in props && props.steps !== undefined;

  const parent = React.useContext(ModalDepthContext);
  const [childCount, setChildCount] = React.useState(0);

  /* Tell our parent we are open, so it hides itself while we're shown. */
  React.useEffect(() => {
    if (!open) return;
    return parent.register();
  }, [open, parent]);

  const ctx = React.useMemo(
    () => ({
      depth: parent.depth + 1,
      register: () => {
        setChildCount((c) => c + 1);
        return () => setChildCount((c) => Math.max(0, c - 1));
      },
    }),
    [parent.depth],
  );

  const hidden = childCount > 0;

  return (
    <ModalDepthContext.Provider value={ctx}>
      <Dialog
        open={open}
        onOpenChange={(o) => {
          if (!o) onClose();
        }}
      >
        <DialogContent
          showCloseButton={!hideClose && !headerAction}
          className={cn("sm:max-w-125", hidden && "hidden")}
        >
          <DialogHeader className="flex flex-row w-full justify-between items-center">
            <div>
              <DialogTitle>{title}</DialogTitle>
              {description && (
                <DialogDescription>{description}</DialogDescription>
              )}
            </div>
            {headerAction && <div>{headerAction}</div>}
          </DialogHeader>

          {isWizard ? (
            <WizardBody {...(props as WizardProps)} onClose={onClose} />
          ) : (
            <SingleBody {...(props as SingleProps)}>{children}</SingleBody>
          )}
        </DialogContent>
      </Dialog>
    </ModalDepthContext.Provider>
  );
}

function SingleBody({ children, footer }: SingleProps) {
  return (
    <>
      <div className="flex-1 overflow-y-auto p-1">{children}</div>
      {footer && <DialogFooter>{footer}</DialogFooter>}
    </>
  );
}

function WizardBody({
  steps,
  activeStep,
  onStepChange,
  onSubmit,
  submitLabel = "Submit",
  submitting,
  canSubmit,
  onClose,
  open,
}: WizardProps & { onClose: () => void; open: boolean }) {
  const [internalStep, setInternalStep] = React.useState(0);
  const current = activeStep ?? internalStep;

  React.useEffect(() => {
    if (open && activeStep === undefined) setInternalStep(0);
  }, [open, activeStep]);

  const setStep = (idx: number) => {
    onStepChange?.(idx);
    if (activeStep === undefined) setInternalStep(idx);
  };

  const step = steps[current];
  const isLast = current === steps.length - 1;
  const isFirst = current === 0;

  return (
    <>
      <StepIndicator steps={steps} current={current} onSelect={setStep} />
      <div className="flex-1 overflow-y-auto p-1">{step.content}</div>
      <DialogFooter className="justify-between">
        <Button
          type="button"
          variant="outline"
          onClick={() => (isFirst ? onClose() : setStep(current - 1))}
        >
          {isFirst ? (
            "Cancel"
          ) : (
            <>
              <ChevronLeft className="size-4" /> Back
            </>
          )}
        </Button>
        {isLast ? (
          <Button
            type="button"
            onClick={onSubmit}
            disabled={submitting || canSubmit === false}
          >
            {submitting ? "Saving…" : submitLabel}
          </Button>
        ) : (
          <Button
            type="button"
            onClick={() => setStep(current + 1)}
            disabled={step.canAdvance === false}
          >
            Next <ChevronRight className="size-4" />
          </Button>
        )}
      </DialogFooter>
    </>
  );
}

function StepIndicator({
  steps,
  current,
  onSelect,
}: {
  steps: ModalStep[];
  current: number;
  onSelect: (idx: number) => void;
}) {
  return (
    <div className="flex items-center gap-2 border-b border-border px-6 py-3">
      {steps.map((s, i) => {
        const done = i < current;
        const active = i === current;
        const clickable = done || active;
        return (
          <React.Fragment key={s.id}>
            <button
              type="button"
              onClick={() => clickable && onSelect(i)}
              disabled={!clickable}
              className={cn(
                "flex items-center gap-2 rounded-md px-2 py-1 text-sm transition-colors",
                active && "text-foreground",
                done && "text-muted-foreground hover:bg-muted",
                !done && !active && "text-muted-foreground/60",
              )}
            >
              <span
                className={cn(
                  "inline-flex size-5 items-center justify-center rounded-full text-xs font-medium",
                  active && "bg-primary text-primary-foreground",
                  done && "bg-muted text-foreground",
                  !done && !active && "bg-muted text-muted-foreground/60",
                )}
              >
                {done ? <Check className="size-3" /> : i + 1}
              </span>
              <span className="font-medium">{s.title}</span>
            </button>
            {i < steps.length - 1 && <div className="h-px flex-1 bg-border" />}
          </React.Fragment>
        );
      })}
    </div>
  );
}
