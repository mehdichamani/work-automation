import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  handleReload = () => {
    this.setState({ hasError: false });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-screen bg-gray-50">
          <div className="text-6xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">خطایی رخ داد</h2>
          <p className="text-sm text-gray-500 mb-6">صفحه با خطا مواجه شد. لطفاً دوباره تلاش کنید.</p>
          <button
            onClick={this.handleReload}
            className="bg-primary-500 hover:bg-primary-600 text-white px-6 py-3 rounded-xl font-bold transition-colors"
          >
            بارگذاری مجدد
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
