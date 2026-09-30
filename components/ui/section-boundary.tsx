"use client";

// Graceful degradation, one section at a time.
//
// The homepage stitches together a tone scrape, a border scrape and a market
// API. Any of them can fail, and when one does the reader should lose that card
// and nothing else — not the news, not the navigation, not the scroll position.
//
// React still has no function-component error boundary, so the class is not a
// style choice. componentDidCatch is the only way to stop a render error from
// unmounting the whole tree.

import { Component, Suspense, type ReactNode } from "react";
import InlineError from "./inline-error";

type Props = {
  /** Named in the fallback so the reader knows which part is missing. */
  label: string;
  children: ReactNode;
  /** Shown while a suspended child resolves. */
  fallback?: ReactNode;
  /** Replaces the section when it throws. Defaults to a labelled InlineError. */
  errorFallback?: ReactNode;
};

type State = { failed: boolean };

class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    // Left visible in the browser console on purpose: a section that silently
    // disappears in production is far harder to notice than one that does not.
    console.error(`[383] section "${this.props.label}" failed:`, error);
  }

  render() {
    if (!this.state.failed) return this.props.children;

    return (
      this.props.errorFallback ?? (
        <InlineError
          tone="panel"
          title={`${this.props.label} nuk u ngarkua.`}
          detail="Kjo pjesë nuk është e disponueshme për momentin. Pjesa tjetër e faqes funksionon normalisht."
        />
      )
    );
  }
}

export default function SectionBoundary({
  label,
  children,
  fallback,
  errorFallback,
}: Props) {
  return (
    <ErrorBoundary label={label} errorFallback={errorFallback}>
      <Suspense fallback={fallback ?? null}>{children}</Suspense>
    </ErrorBoundary>
  );
}
