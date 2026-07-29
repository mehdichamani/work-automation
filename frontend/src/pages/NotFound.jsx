import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="flex items-center justify-center h-screen bg-gray-50">
      <div className="text-center space-y-6">
        <div className="text-8xl font-bold text-primary-600">۴۰۴</div>
        <h1 className="text-2xl font-bold text-gray-800">صفحه مورد نظر یافت نشد</h1>
        <p className="text-gray-500">آدرس وارد شده اشتباه است یا صفحه حذف شده</p>
        <Link to="/" className="inline-block bg-primary-600 text-white px-6 py-3 rounded-xl hover:bg-primary-700 transition-colors font-medium">
          بازگشت به داشبورد
        </Link>
      </div>
    </div>
  );
}
