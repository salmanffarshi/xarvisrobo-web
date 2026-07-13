// Order status tracker (Phase D.1). A visual stepper of the order's journey,
// method-aware (prepaid vs COD, via getOrderProgress). Display-only — reads
// the customer-facing status, never Manufacturing internals (ADR-006). No
// interactivity, so this stays a server component.
//
// Two layouts from one model: horizontal on sm+ (labels under the nodes),
// vertical on mobile (labels beside the nodes) — steppers read better
// vertically on narrow screens. The circle itself is shared between them.

import { Ban, Check } from "lucide-react";

import { getOrderProgress, type StepState } from "@/lib/order-progress";
import { cn } from "@/lib/utils";
import type { OrderStatus, PaymentMethod } from "@prisma/client";

// The node circle — filled+check when complete, ringed when current, hollow
// when upcoming. Restrained palette: blue for done/current, neutral-300 edge
// for upcoming. Shared by both layouts.
function StepNode({ state }: { state: StepState }) {
  if (state === "complete") {
    return (
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white">
        <Check className="size-4" strokeWidth={1.5} aria-hidden />
      </span>
    );
  }
  if (state === "current") {
    return (
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white ring-2 ring-blue-600">
        <span className="size-2.5 rounded-full bg-blue-600" aria-hidden />
      </span>
    );
  }
  return (
    <span
      className="flex size-8 shrink-0 items-center justify-center rounded-full border border-neutral-300 bg-white"
      aria-hidden
    >
      <span className="size-2.5 rounded-full bg-neutral-200" />
    </span>
  );
}

function labelClasses(state: StepState): string {
  return state === "upcoming"
    ? "text-neutral-400"
    : "font-medium text-neutral-900";
}

// A connector segment reads "done" (blue) once the step it leads out of is
// complete, otherwise it's a neutral track.
function connectorClasses(fromState: StepState): string {
  return fromState === "complete" ? "bg-blue-600" : "bg-neutral-200";
}

export function OrderStatusTracker({
  paymentMethod,
  status,
}: {
  paymentMethod: PaymentMethod;
  status: OrderStatus;
}) {
  const { cancelled, returned, steps } = getOrderProgress(paymentMethod, status);

  if (cancelled || returned) {
    return (
      <div className="flex items-start gap-3 rounded-2xl border border-neutral-200 bg-neutral-50 p-5">
        <Ban
          className="mt-0.5 size-5 shrink-0 text-neutral-400"
          strokeWidth={1.5}
          aria-hidden
        />
        <div>
          <p className="font-medium text-neutral-700">
            {returned ? "This order was returned." : "This order was cancelled."}
          </p>
          <p className="mt-1 text-sm text-neutral-500">
            If you have any questions, please get in touch with us.
          </p>
        </div>
      </div>
    );
  }

  const lastIndex = steps.length - 1;

  return (
    <div className="rounded-2xl border border-neutral-200 p-6">
      {/* Horizontal — sm and up. Labels sit under each node. */}
      <ol className="hidden items-start sm:flex">
        {steps.map((step, index) => (
          <li
            key={step.label}
            aria-current={step.state === "current" ? "step" : undefined}
            className="flex flex-1 flex-col items-center last:flex-none"
          >
            <div className="flex w-full items-center">
              {/* left half-connector (skipped on the first node) */}
              {index === 0 ? (
                <span className="flex-1" />
              ) : (
                <span
                  className={cn(
                    "h-0.5 flex-1",
                    connectorClasses(steps[index - 1]!.state),
                  )}
                />
              )}
              <StepNode state={step.state} />
              {/* right half-connector (skipped on the last node) */}
              {index === lastIndex ? (
                <span className="flex-1" />
              ) : (
                <span
                  className={cn("h-0.5 flex-1", connectorClasses(step.state))}
                />
              )}
            </div>
            <span
              className={cn(
                "mt-2 px-1 text-center text-xs",
                labelClasses(step.state),
              )}
            >
              {step.label}
            </span>
          </li>
        ))}
      </ol>

      {/* Vertical — mobile. Labels sit to the right of each node. */}
      <ol className="flex flex-col sm:hidden">
        {steps.map((step, index) => (
          <li
            key={step.label}
            aria-current={step.state === "current" ? "step" : undefined}
            className="flex gap-3"
          >
            <div className="flex flex-col items-center">
              <StepNode state={step.state} />
              {index !== lastIndex && (
                <span
                  className={cn(
                    "my-1 w-0.5 flex-1",
                    connectorClasses(step.state),
                  )}
                />
              )}
            </div>
            <span
              className={cn(
                "pt-1 text-sm",
                index !== lastIndex && "pb-6",
                labelClasses(step.state),
              )}
            >
              {step.label}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
