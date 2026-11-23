import { Component } from 'react';

/**
 * Root error boundary: shows a friendly fallback instead of a blank page.
 * (Error boundaries must be class components in React.)
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('Unhandled UI error', error, info?.componentStack);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <main id="main" className="mx-auto max-w-xl px-4 py-16 text-center">
        <div role="alert">
          <h1 className="text-2xl font-bold">Something went wrong</h1>
          <p className="mt-3 text-muted">
            The page hit an unexpected problem. Your data is safe. Please reload to try again.
          </p>
        </div>
        <button type="button" onClick={this.handleReload} className="btn-primary mt-6">
          Reload page
        </button>
      </main>
    );
  }
}
