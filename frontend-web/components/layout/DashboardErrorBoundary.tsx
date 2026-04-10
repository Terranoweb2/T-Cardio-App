'use client';

import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  retrying: boolean;
}

/**
 * Error boundary for the dashboard content area.
 * Catches React rendering crashes (e.g. stale role data after admin promotion)
 * and shows a recovery UI instead of a blank white page.
 *
 * On error: triggers a token refresh + role verification and reloads.
 */
export default class DashboardErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, retrying: false };

  static getDerivedStateFromError(): Partial<State> {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error('[DashboardErrorBoundary] Caught:', error.message);
  }

  handleRetry = async () => {
    this.setState({ retrying: true });

    try {
      // Try to refresh token and verify role
      const token = localStorage.getItem('accessToken');
      const refreshToken = localStorage.getItem('refreshToken');

      if (refreshToken) {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1'}/auth/refresh`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken }),
          },
        );

        if (res.ok) {
          const data = await res.json();
          localStorage.setItem('accessToken', data.accessToken);
          localStorage.setItem('refreshToken', data.refreshToken);

          // Update user data if returned
          if (data.user) {
            const storedUser = localStorage.getItem('user');
            if (storedUser) {
              try {
                const prev = JSON.parse(storedUser);
                const updated = { ...prev, role: data.user.role, emailVerified: data.user.emailVerified };
                localStorage.setItem('user', JSON.stringify(updated));
              } catch { /* ignore */ }
            }
          }
        }
      }
    } catch {
      // Refresh failed
    }

    // Reload the page to apply fresh state
    window.location.reload();
  };

  handleLogout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    window.location.href = '/login';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex-1 flex items-center justify-center p-6 bg-cardio-900">
          <div className="text-center max-w-sm">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-amber-500/15 flex items-center justify-center">
              <svg className="w-8 h-8 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-slate-200 mb-2">
              Session en cours de mise a jour
            </h3>
            <p className="text-sm text-slate-400 mb-6">
              Votre profil a ete modifie. Cliquez ci-dessous pour actualiser votre session.
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={this.handleRetry}
                disabled={this.state.retrying}
                className="w-full px-4 py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-medium transition-colors disabled:opacity-50"
              >
                {this.state.retrying ? 'Actualisation...' : 'Actualiser la session'}
              </button>
              <button
                onClick={this.handleLogout}
                className="w-full px-4 py-2.5 rounded-lg bg-slate-700/50 hover:bg-slate-700 text-slate-300 text-sm transition-colors"
              >
                Se reconnecter
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
