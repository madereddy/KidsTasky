import React from 'react';
import { clientLogger } from '../../services/clientLogger';

interface Props {
  children: React.ReactNode;
  label?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class SectionErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    clientLogger.errorWithException('section_error_boundary_caught', error, {
      section: this.props.label,
      componentStack: info.componentStack,
    });
  }

  retry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    const label = this.props.label ?? 'This section';

    return (
      <div className="p-8 rounded-2xl border border-rose-200 bg-rose-50 text-center my-4">
        <p className="font-semibold text-rose-700 mb-1">{label} failed to load</p>
        <p className="text-xs text-rose-500 mb-4">{this.state.error?.message}</p>
        <button
          onClick={this.retry}
          className="px-4 py-2 bg-white border border-rose-300 rounded-xl text-sm font-semibold text-rose-700 hover:bg-rose-50 transition-colors"
        >
          Try again
        </button>
      </div>
    );
  }
}
