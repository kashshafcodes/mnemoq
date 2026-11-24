import { Component } from 'react';
import { reportError } from '../errors/report';

// If one page crashes, show a short message on that page instead of a blank
// screen. The menu keeps working, and the error is logged (Stats > Live
// activity, event "client_error") so it can be fixed.
export default class PageErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error, info) {
    reportError(error, 'boundary', {
      page: this.props.page,
      where: String(info?.componentStack || '').trim().split('\n')[0]?.trim(),
    });
  }

  render() {
    if (!this.state.failed) return this.props.children;

    return (
      <section className="mq-crash" role="alert">
        <h1>Something went wrong on this page</h1>
        <p>Your cards and results are safe. Try again, or go back home.</p>
        <div className="mq-focus-actions">
          <button type="button" className="mq-btn mq-btn-primary" onClick={() => this.setState({ failed: false })}>
            Try again
          </button>
          <a className="mq-btn mq-btn-ghost" href="#/home">
            Go home
          </a>
        </div>
      </section>
    );
  }
}
