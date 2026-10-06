import React, { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Camera, Check, Pencil, Copy } from "lucide-react";
import { registerUser, getPublicWarehouses, type Warehouse } from "../api";
import { setToken } from "../session";
import CameraCapture from "../components/CameraCapture";

// Catálogo predeterminado para garantizar disponibilidad inmediata aún sin conexión o durante carga de API
const DEFAULT_COMPANIES: Warehouse[] = [
  { id: 1, key: "elite_nutricion", name: "Elite Nutrition", is_active: true },
  { id: 2, key: "futupro", name: "FutuPro", is_active: true },
  { id: 3, key: "estudio", name: "Estudio", is_active: true },
  { id: 4, key: "estadio", name: "Estadio", is_active: true },
  { id: 5, key: "junin", name: "Junín", is_active: true },
  { id: 6, key: "ee_uu", name: "EE.UU", is_active: true },
  { id: 7, key: "lago_verde", name: "Lago Verde", is_active: true },
  { id: 8, key: "unicentro", name: "Unicentro", is_active: true },
];

export default function Register() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    full_name: "",
    document_id: "",
    email: "",
    warehouse_key: "",
  });
  const [warehouses, setWarehouses] = useState<Warehouse[]>(DEFAULT_COMPANIES);
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [photo, setPhoto] = useState<string | null>(null);

  React.useEffect(() => {
    getPublicWarehouses()
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          // Normalizar nombres si es necesario (ej. "Futuro Pro" -> "FutuPro")
          const normalized = data.map((w) => ({
            ...w,
            name: w.key.includes("futu") ? "FutuPro" : w.name,
          }));
          setWarehouses(normalized);
        }
      })
      .catch((err) => {
        console.warn("API de bodegas públicas no disponible, usando catálogo integrado:", err);
      });
  }, []);

  const handleEmailChange = (newEmail: string) => {
    const lower = newEmail.toLowerCase().trim();
    let autoWarehouse = formData.warehouse_key;

    // Autoselección inteligente basada en el dominio corporativo
    if (lower.includes("@futupro")) {
      autoWarehouse = "futupro";
    } else if (lower.includes("@elitenutrition") || lower.includes("@elitenova")) {
      autoWarehouse = "elite_nutricion";
    }

    setFormData((prev) => ({
      ...prev,
      email: newEmail,
      warehouse_key: autoWarehouse || prev.warehouse_key,
    }));
  };

  // Signature state
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [signature, setSignature] = useState<string | null>(null);

  // Signature logic
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        const rect = canvas.getBoundingClientRect();
        const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
        ctx.beginPath();
        ctx.moveTo(clientX - rect.left, clientY - rect.top);
      }
    }
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        const rect = canvas.getBoundingClientRect();
        const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
        ctx.lineTo(clientX - rect.left, clientY - rect.top);
        ctx.stroke();
      }
    }
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
    setSignature(null);
  };

  const saveSignature = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      setSignature(canvas.toDataURL("image/png"));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!photo) return alert("Debes tomarte una foto.");

    // Si no han dado click a "Guardar firma", la guardamos autómaticamente
    let finalSignature = signature;
    if (!finalSignature && canvasRef.current) {
        finalSignature = canvasRef.current.toDataURL("image/png");
    }

    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await registerUser({
        full_name: formData.full_name,
        document_id: formData.document_id,
        email: formData.email,
        photo_url: photo,
        digital_signature_url: finalSignature ?? undefined,
        warehouse_key: formData.warehouse_key || undefined,
      });
      setToken(res.token);
      setGeneratedPassword(res.generated_password);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (generatedPassword) {
    return (
      <div className="p-8 max-w-lg mx-auto">
        <div className="liquid-glass p-8 rounded-2xl text-center shadow-lg border border-slate-200">
          <Check className="w-12 h-12 mx-auto mb-4 text-emerald-600" />
          <h1 className="text-2xl font-bold mb-2 text-slate-900">Perfil creado</h1>
          <p className="text-slate-600 mb-6">
            Guarda la siguiente contraseña autogenerada en un lugar seguro. Usala junto con tu correo electrónico para iniciar sesión.
          </p>
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-6 flex items-center justify-between gap-3">
            <code className="text-lg text-emerald-700 break-all">{generatedPassword}</code>
            <button
              type="button"
              onClick={() => navigator.clipboard.writeText(generatedPassword)}
              className="shrink-0 bg-slate-200 hover:bg-slate-300 p-2 rounded-lg transition-colors"
              title="Copiar"
            >
              <Copy className="w-4 h-4 text-slate-700" />
            </button>
          </div>
          <button
            type="button"
            onClick={() => navigate("/dashboard")}
            className="w-full bg-[var(--gold)] hover:bg-[var(--gold-deep)] text-white py-3 rounded-xl font-bold"
          >
            Ya la guardé, continuar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      <div className="liquid-glass p-6 md:p-8 rounded-2xl shadow-lg border border-slate-200">
        <div className="text-center mb-6">
          <p className="text-xs uppercase tracking-widest font-bold text-[var(--gold)] mb-1">Elite Nutrition · FutuPro</p>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Registro de Colaborador</h1>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-8">
          
          {/* Datos Personales */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Nombre Completo</label>
              <input 
                type="text" 
                required
                className="w-full bg-white border border-slate-300 rounded-lg p-3 text-slate-900 focus:outline-none focus:border-[var(--gold)] focus:ring-2 focus:ring-[rgba(176,141,87,0.15)]"
                value={formData.full_name}
                onChange={e => setFormData({...formData, full_name: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Cédula / Documento</label>
              <input 
                type="text" 
                required
                className="w-full bg-white border border-slate-300 rounded-lg p-3 text-slate-900 focus:outline-none focus:border-[var(--gold)] focus:ring-2 focus:ring-[rgba(176,141,87,0.15)]"
                value={formData.document_id}
                onChange={e => setFormData({...formData, document_id: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Correo Electrónico Corporativo</label>
              <input 
                type="email" 
                required
                placeholder="usuario@elitenutrition.com.co o @futupro.com"
                className="w-full bg-white border border-slate-300 rounded-lg p-3 text-slate-900 focus:outline-none focus:border-[var(--gold)] focus:ring-2 focus:ring-[rgba(176,141,87,0.15)]"
                value={formData.email}
                onChange={e => handleEmailChange(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Empresa a la que perteneces</label>
              <select
                required
                className="w-full bg-white border border-slate-300 rounded-lg p-3 text-slate-900 font-medium focus:outline-none focus:border-[var(--gold)] focus:ring-2 focus:ring-[rgba(176,141,87,0.15)] cursor-pointer"
                value={formData.warehouse_key}
                onChange={e => setFormData(prev => ({...prev, warehouse_key: e.target.value}))}
              >
                <option value="">-- Seleccionar Empresa --</option>
                {warehouses.map(w => (
                  <option key={w.key} value={w.key}>
                    {w.key === 'elite_nutricion' ? '🏢 Elite Nutrition' : w.key.includes('futu') ? '⚽ FutuPro' : `📍 ${w.name}`}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-8">
            {/* Foto */}
            <div className="bg-slate-50 p-6 rounded-xl border border-slate-200">
              <h3 className="text-xl text-slate-900 font-semibold mb-4 flex items-center"><Camera className="w-5 h-5 mr-2 text-[var(--gold)]" /> Fotografía</h3>
              <CameraCapture photo={photo} onCapture={setPhoto} onRetake={() => setPhoto(null)} aspect="1 / 1" />
            </div>

            {/* Firma */}
            <div className="bg-slate-50 p-6 rounded-xl border border-slate-200">
              <h3 className="text-xl text-slate-900 font-semibold mb-4 flex items-center"><Pencil className="w-5 h-5 mr-2 text-[var(--gold)]" /> Firma Digital</h3>
              <div className="bg-white rounded-lg overflow-hidden mb-4 relative shadow-inner border border-slate-300" style={{ height: '300px' }}>
                <canvas 
                  ref={canvasRef}
                  width={400}
                  height={300}
                  className="w-full h-full cursor-crosshair touch-none"
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onTouchStart={startDrawing}
                  onTouchMove={draw}
                  onTouchEnd={stopDrawing}
                />
              </div>
              <div className="flex space-x-4">
                <button type="button" onClick={clearSignature} className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 py-3 rounded-lg font-medium transition-colors">
                  Limpiar
                </button>
                <button type="button" onClick={saveSignature} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-lg font-medium flex items-center justify-center transition-colors">
                  <Check className="w-5 h-5 mr-2" /> Confirmar
                </button>
              </div>
            </div>
          </div>

          {submitError && <p className="text-red-500 text-sm text-center font-medium">{submitError}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-[var(--gold)] hover:bg-[var(--gold-deep)] text-white py-4 rounded-xl font-bold text-lg mt-8 shadow-[0_0_20px_rgba(176,141,87,0.4)] disabled:opacity-60"
          >
            {submitting ? "Creando perfil..." : "Completar Registro"}
          </button>
        </form>
      </div>
    </div>
  );
}
