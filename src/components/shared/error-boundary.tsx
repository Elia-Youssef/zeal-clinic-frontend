import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { hasError: boolean };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Unhandled render error:", error, info.componentStack);
  }

  // The crashed tree is unmounted, so reload once the URL moves back (root if none).
  handleBack = () => {
    if (window.history.length > 1) {
      window.addEventListener("popstate", () => window.location.reload(), {
        once: true,
      });
      window.history.back();
    } else {
      window.location.href = "/";
    }
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="flex min-h-full w-full items-center justify-center bg-muted p-6">
        <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 text-center">
          <h1 className="text-lg font-semibold text-foreground">
            Something went wrong
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            The app ran into an unexpected error. Go back to the previous page,
            or reload. If it keeps happening, contact the development team.
          </p>
          <div className="mt-5 flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={this.handleBack}
              className="inline-flex h-9 items-center justify-center rounded-md border border-border bg-background px-4 text-sm font-medium text-foreground hover:bg-muted"
            >
              Go back
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Reload
            </button>
          </div>
        </div>
      </div>
    );
  }
}
