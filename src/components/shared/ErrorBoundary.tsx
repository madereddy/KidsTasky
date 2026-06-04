import React from 'react';
import { clientLogger } from '../../services/clientLogger';

interface State {
  hasError: boolean;
  error: Error | null;
  reloadIn: number;
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  private reloadTimer: ReturnType<typeof setInterval> | null = null;

  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null, reloadIn: 10 };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    clientLogger.errorWithException('react_error_boundary_caught', error, {
      componentStack: info.componentStack,
    });
  }

  componentDidUpdate(_: unknown, prev: State) {
    if (this.state.hasError && !prev.hasError) {
      this.reloadTimer = setInterval(() => {
        this.setState(s => {
          if (s.reloadIn <= 1) {
            window.location.reload();
            return s;
          }
          return { ...s, reloadIn: s.reloadIn - 1 };
        });
      }, 1000);
    }
    if (!this.state.hasError && prev.hasError && this.reloadTimer) {
      clearInterval(this.reloadTimer);
      this.reloadTimer = null;
    }
  }

  componentWillUnmount() {
    if (this.reloadTimer) clearInterval(this.reloadTimer);
  }

  handleReloadNow = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center flex-col gap-6 text-white p-8">
        <div className="text-6xl">⚠️</div>
        <h1 className="text-2xl font-bold">Something went wrong</h1>
        <p className="text-slate-400 text-center max-w-md">
          {this.state.error?.message || 'An unexpected error occurred.'}
        </p>
        <p className="text-slate-500 text-sm">
          Reloading automatically in {this.state.reloadIn}s…
        </p>
        <button
          onClick={this.handleReloadNow}
          className="px-6 py-3 bg-sky-500 hover:bg-sky-400 rounded-xl font-semibold transition-colors"
        >
          Reload now
        </button>
      </div>
    );
  }
}
