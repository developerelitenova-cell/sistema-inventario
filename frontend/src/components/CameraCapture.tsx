import { useState, useRef, useEffect } from "react";
import { Camera, Upload, RotateCcw } from "lucide-react";

interface CameraCaptureProps {
  photo: string | null;
  onCapture: (dataUrl: string) => void;
  onRetake: () => void;
  aspect?: string;
  facingMode?: "user" | "environment";
}

export default function CameraCapture({ photo, onCapture, onRetake, aspect = "1 / 1", facingMode = "user" }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraActive, setCameraActive] = useState(false);

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode } });
      setStream(mediaStream);
      setCameraActive(true);
    } catch (err) {
      console.error("Error accessing camera:", err);
      alert("No se pudo acceder a la cámara. Puedes subir la foto directamente desde tu dispositivo o galería.");
    }
  };

  useEffect(() => {
    if (cameraActive && stream && videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [cameraActive, stream]);

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
      setCameraActive(false);
    }
  };

  const processAndCapture = (source: HTMLVideoElement | HTMLImageElement, width: number, height: number) => {
    const MAX_DIM = 1200;
    let targetW = width;
    let targetH = height;
    if (targetW > targetH && targetW > MAX_DIM) {
      targetH = Math.round((targetH * MAX_DIM) / targetW);
      targetW = MAX_DIM;
    } else if (targetH > MAX_DIM) {
      targetW = Math.round((targetW * MAX_DIM) / targetH);
      targetH = MAX_DIM;
    }
    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(source, 0, 0, targetW, targetH);
      onCapture(canvas.toDataURL('image/jpeg', 0.8));
      stopCamera();
    }
  };

  const takePhoto = () => {
    if (!videoRef.current) return;
    const vw = videoRef.current.videoWidth;
    const vh = videoRef.current.videoHeight;
    if (!vw || !vh) {
      alert("La cámara aún se está inicializando. Intenta de nuevo.");
      return;
    }
    processAndCapture(videoRef.current, vw, vh);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        processAndCapture(img, img.width, img.height);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const retake = () => {
    onRetake();
    startCamera();
  };

  useEffect(() => () => stopCamera(), [stream]);

  return (
    <div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      <div className="bg-black rounded-lg overflow-hidden flex items-center justify-center relative mb-3" style={{ aspectRatio: aspect, minHeight: '180px' }}>
        {!photo && !cameraActive && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', padding: '16px' }}>
            <button
              type="button"
              onClick={startCamera}
              className="btn btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', fontSize: '0.85rem' }}
            >
              <Camera size={16} /> Tomar Foto con Cámara
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="btn btn-outline"
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 14px', fontSize: '0.8rem', color: '#e2e8f0', borderColor: '#475569' }}
            >
              <Upload size={14} /> Subir desde Galería / Archivo
            </button>
          </div>
        )}
        {!photo && cameraActive && (
          <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
        )}
        {photo && <img src={photo} alt="Foto capturada" className="w-full h-full object-cover" />}
      </div>

      {cameraActive && !photo && (
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            onClick={takePhoto}
            className="btn btn-primary"
            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '10px' }}
          >
            <Camera size={16} /> Capturar Foto
          </button>
          <button
            type="button"
            onClick={stopCamera}
            className="btn btn-outline"
            style={{ padding: '10px 14px' }}
            title="Cancelar cámara"
          >
            Cancelar
          </button>
        </div>
      )}

      {photo && (
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            onClick={retake}
            className="btn btn-outline"
            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '8px', fontSize: '0.8rem' }}
          >
            <RotateCcw size={14} /> Repetir con Cámara
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="btn btn-outline"
            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '8px', fontSize: '0.8rem' }}
          >
            <Upload size={14} /> Cambiar Archivo
          </button>
        </div>
      )}
    </div>
  );
}
