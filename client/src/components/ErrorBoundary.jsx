import { Component } from 'react';

// Last-resort guard: a rendering bug shows a recovery screen instead of a blank page.
export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('UI error:', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="mx-auto flex min-h-dvh max-w-xl flex-col items-center justify-center px-4 text-center">
        <p className="eyebrow">Something went wrong</p>
        <h1 className="section-title mt-5">This page couldn&rsquo;t be displayed</h1>
        <p className="mt-3 text-slate">Reloading usually fixes it. Your data is safe.</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
            Reload
          </button>
          <a href="/" className="btn btn-secondary">
            Go home
          </a>
        </div>
      </div>
    );
  }
}
