import React from 'react';
import { clientLogger } from '../../services/clientLogger';

export class CalendarErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error: any, errorInfo: any) { 
    clientLogger.errorWithException('calendar_error_boundary_crash', error, { errorInfo });
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-12 text-center bg-white rounded-2xl border border-rose-200">
          <h2 className="text-xl font-bold text-rose-600 mb-2">Calendar Unavailable</h2>
          <p className="text-ui-muted mb-4">Something went wrong while loading the calendar.</p>
          <button onClick={() => window.location.reload()} className="px-4 py-2 bg-ui-soft rounded-lg font-bold">Retry</button>
        </div>
      );
    }
    return this.props.children;
  }
}
