import { Component } from 'react';
import toast from 'react-hot-toast';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null, showDetails: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    console.error('ErrorBoundary caught:', error, errorInfo);
    try {
      toast.error('یک خطای غیرمنتظره در برنامه رخ داد.', { id: 'error-boundary-toast' });
    } catch (e) {
      // Ignored if toast is not ready
    }
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null, errorInfo: null, showDetails: false });
    window.location.reload();
  };

  handleGoHome = () => {
    this.setState({ hasError: false, error: null, errorInfo: null, showDetails: false });
    window.location.href = '/';
  };

  toggleDetails = () => {
    this.setState((prev) => ({ showDetails: !prev }));
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-6 text-right" dir="rtl">
          <div className="bg-white rounded-3xl shadow-xl max-w-xl w-full p-8 border border-gray-100 animate-fade-in">
            <div className="text-center mb-6">
              <span className="text-6xl inline-block mb-4 animate-bounce">⚠️</span>
              <h2 className="text-2xl font-black text-gray-800 mb-2 font-vazir">اختلال در اجرای برنامه</h2>
              <p className="text-gray-500 text-sm leading-6">
                متأسفانه خطایی در رندر یا منطق این صفحه رخ داده است. جای نگرانی نیست؛ می‌توانید صفحه را دوباره بارگذاری کنید یا به داشبورد بازگردید.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-center mb-8">
              <button
                onClick={this.handleReload}
                className="bg-primary-500 hover:bg-primary-600 text-white px-6 py-3 rounded-xl font-bold transition-all shadow-md shadow-primary-500/20 text-sm flex items-center justify-center gap-2"
              >
                🔄 بارگذاری مجدد صفحه
              </button>
              <button
                onClick={this.handleGoHome}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-6 py-3 rounded-xl font-bold transition-all text-sm flex items-center justify-center gap-2"
              >
                📊 بازگشت به داشبورد
              </button>
            </div>

            {/* Collapsible Error details */}
            <div className="border border-gray-100 rounded-2xl overflow-hidden bg-gray-50/50">
              <button
                onClick={this.toggleDetails}
                className="w-full flex items-center justify-between p-4 text-sm font-bold text-gray-600 hover:bg-gray-50 transition-colors"
              >
                <span>🔍 مشاهده جزئیات فنی خطا (جهت عیب‌یابی)</span>
                <span>{this.state.showDetails ? '▲' : '▼'}</span>
              </button>

              {this.state.showDetails && (
                <div className="p-4 border-t border-gray-100 text-xs font-mono text-left bg-gray-900 text-gray-200 overflow-x-auto max-h-60 dir-ltr rounded-b-2xl">
                  <div className="text-red-400 font-bold mb-2">
                    {this.state.error && this.state.error.toString()}
                  </div>
                  {this.state.errorInfo && this.state.errorInfo.componentStack && (
                    <pre className="whitespace-pre-wrap leading-relaxed opacity-90 text-[11px]">
                      {this.state.errorInfo.componentStack}
                    </pre>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
