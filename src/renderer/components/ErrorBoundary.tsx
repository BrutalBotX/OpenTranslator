import { Component, ReactNode } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

interface Props { children: ReactNode }
interface State { hasError: boolean; error: Error | null }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full p-6 text-center">
          <AlertTriangle size={36} className="text-red-400 mb-4" />
          <h2 className="text-lg font-bold text-gray-200 mb-2">Something went wrong</h2>
          <p className="text-xs text-red-300 bg-red-900/20 rounded p-3 mb-4 font-mono max-w-md break-words">
            {this.state.error?.message || 'Unknown error'}
          </p>
          <button onClick={() => window.location.reload()}
            className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 rounded-lg text-sm transition-colors">
            <RefreshCw size={16} /> Reload App
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
