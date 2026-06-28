import { useState, useEffect } from 'react';
import api from '../api/axios';
import toast from 'react-hot-toast';

export default function CameraCapture({ onCapture, currentPhoto }) {
  const [showCamera, setShowCamera] = useState(false);
  const [cameraStatus, setCameraStatus] = useState(null);
  const [capturing, setCapturing] = useState(false);
  const [countdown, setCountdown] = useState(null);

  useEffect(() => {
    checkCameraStatus();
  }, []);

  const checkCameraStatus = async () => {
    try {
      const res = await api.get('/camera/status');
      setCameraStatus(res.data);
    } catch (err) {
      setCameraStatus({ connected: false, error: 'خطا در بررسی وضعیت' });
    }
  };

  const openCamera = () => {
    setShowCamera(true);
  };

  const closeCamera = () => {
    setShowCamera(false);
    setCountdown(null);
  };

  const captureSnapshot = async () => {
    setCapturing(true);
    setCountdown(3);

    for (let i = 3; i >= 1; i--) {
      setCountdown(i);
      await new Promise(r => setTimeout(r, 1000));
    }
    setCountdown(null);

    try {
      const res = await api.get('/camera/snapshot');
      if (res.data.image) {
        onCapture(res.data.image);
        setShowCamera(false);
        toast.success('عکس از دوربین گرفته شد');
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'خطا در گرفتن عکس');
    } finally {
      setCapturing(false);
    }
  };

  return (
    <div>
      {currentPhoto ? (
        <div className="relative inline-block">
          <img src={currentPhoto} alt="عکس متقاضی" className="w-40 h-40 object-cover rounded-2xl border-4 border-primary-200 shadow-lg" />
          <button type="button" onClick={() => onCapture(null)} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-7 h-7 flex items-center justify-center text-sm hover:bg-red-600 shadow">✕</button>
          <button type="button" onClick={() => { const w = window.open(); w.document.write(`<html><head><title>عکس با کیفیت اصلی</title><style>body{margin:0;background:#111;display:flex;justify-content:center;align-items:center;min-height:100vh}img{max-width:100%;max-height:100vh}</style></head><body><img src="${currentPhoto}"/></body></html>`); }} className="absolute -top-2 -left-2 bg-blue-500 text-white rounded-full w-7 h-7 flex items-center justify-center text-sm hover:bg-blue-600 shadow" title="بزرگنمایی">🔍</button>
        </div>
      ) : showCamera ? (
        <div className="text-center space-y-4">
          <div className="relative inline-block">
            <img
              src={`/api/camera/stream?&t=${Date.now()}`}
              alt="دوربین حراست"
              className="w-80 h-60 object-cover rounded-2xl border-4 border-primary-200 bg-gray-900"
              onError={(e) => { e.target.style.display = 'none'; }}
            />
            {countdown && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-2xl">
                <span className="text-6xl font-bold text-white animate-pulse">{countdown}</span>
              </div>
            )}
          </div>
          <div className="flex gap-3 justify-center">
            <button type="button" onClick={captureSnapshot} disabled={capturing} className="bg-green-500 hover:bg-green-600 text-white px-6 py-2 rounded-xl font-bold text-sm transition disabled:opacity-50">
              {capturing ? 'در حال گرفتن عکس...' : '📸 عکس بگیر'}
            </button>
            <button type="button" onClick={closeCamera} className="bg-red-500 hover:bg-red-600 text-white px-6 py-2 rounded-xl font-bold text-sm transition">لغو</button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <button type="button" onClick={openCamera} className="flex flex-col items-center gap-2 bg-primary-50 hover:bg-primary-100 border-2 border-dashed border-primary-300 rounded-2xl p-6 transition w-full">
            <span className="text-4xl">📷</span>
            <span className="text-sm font-bold text-primary-700">عکس از دوربین حراست</span>
            {cameraStatus && (
              <span className={`text-xs ${cameraStatus.connected ? 'text-green-600' : 'text-red-500'}`}>
                {cameraStatus.connected ? `✓ متصل (${cameraStatus.model || 'Hikvision'})` : `✗ ${cameraStatus.error || 'قطع'}`}
              </span>
            )}
          </button>
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <div className="flex-1 border-t border-gray-200"></div>
            <span>یا</span>
            <div className="flex-1 border-t border-gray-200"></div>
          </div>
          <label className="flex flex-col items-center gap-2 bg-gray-50 hover:bg-gray-100 border-2 border-dashed border-gray-300 rounded-2xl p-6 cursor-pointer transition">
            <span className="text-4xl">🖼️</span>
            <span className="text-sm font-bold text-gray-600">آپلود از فایل</span>
            <input type="file" accept="image/*" onChange={(e) => {
              const file = e.target.files[0];
              if (!file) return;
              const reader = new FileReader();
              reader.onload = (ev) => onCapture(ev.target.result);
              reader.readAsDataURL(file);
            }} className="hidden" />
          </label>
        </div>
      )}
    </div>
  );
}
