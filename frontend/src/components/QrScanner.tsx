import jsQR from "jsqr";
import { useCallback, useEffect, useRef, useState } from "react";
import { isUpiLink, parseUpiLink, type UpiPayment } from "../lib/upi";

interface Props {
  onDecoded: (payment: UpiPayment, decodedText: string) => void;
}

declare global {
  interface Window {
    BarcodeDetector?: new (opts?: { formats?: string[] }) => {
      detect: (source: CanvasImageSource) => Promise<Array<{ rawValue: string }>>;
    };
  }
}

function stopTracks(stream: MediaStream | null) {
  stream?.getTracks().forEach((t) => t.stop());
}

export default function QrScanner({ onDecoded }: Props) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"camera" | "upload">("camera");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const cleanup = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    stopTracks(streamRef.current);
    streamRef.current = null;
  }, []);

  useEffect(() => {
    return () => cleanup();
  }, [cleanup]);

  const finish = useCallback(
    (raw: string) => {
      cleanup();
      try {
        const payment = parseUpiLink(raw);
        setOpen(false);
        setError(null);
        setStatus("");
        onDecoded(payment, raw);
      } catch (err) {
        if (isUpiLink(raw)) {
          setError((err as Error).message);
        } else {
          setError("Unsupported QR code: this does not appear to be a UPI payment link. Enter details manually or upload a payment QR.");
        }
        setStatus("");
      }
    },
    [cleanup, onDecoded],
  );

  const startCamera = useCallback(async () => {
    setError(null);
    setStatus("Starting camera…");
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Camera access is not available in this browser. Use image upload or manual entry.");
      setStatus("");
      return;
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
    } catch (err) {
      const name = (err as DOMException)?.name;
      if (name === "NotAllowedError" || name === "SecurityError") {
        setError("Camera permission denied. Allow camera access or upload a QR image instead.");
      } else if (name === "NotFoundError" || name === "OverconstrainedError") {
        setError("No usable camera found on this device. Upload a QR image instead.");
      } else if (name === "NotReadableError") {
        setError("The camera is busy or unreadable. Close other camera apps and try again, or upload an image.");
      } else {
        setError("Camera access failed. Upload a QR image instead.");
      }
      setStatus("");
      return;
    }
    streamRef.current = stream;
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      try {
        await videoRef.current.play();
      } catch {
        /* autoplay may resolve via event; decoding still runs */
      }
    }
    setStatus("Point the camera at a UPI QR code…");

    const hasBarcodeDetector = typeof window.BarcodeDetector === "function";
    const detector = hasBarcodeDetector ? new window.BarcodeDetector!({ formats: ["qr_code"] }) : null;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    const tick = async () => {
      const video = videoRef.current;
      if (!video || video.readyState < 2) {
        rafRef.current = requestAnimationFrame(() => void tick());
        return;
      }
      try {
        if (detector) {
          const codes = await detector.detect(video);
          if (codes.length > 0) {
            finish(codes[0].rawValue);
            return;
          }
        } else if (ctx) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const decoded = jsQR(frame.data, frame.width, frame.height);
          if (decoded?.data) {
            finish(decoded.data);
            return;
          }
        }
      } catch {
        /* keep scanning */
      }
      rafRef.current = requestAnimationFrame(() => void tick());
    };
    rafRef.current = requestAnimationFrame(() => void tick());
  }, [finish]);

  useEffect(() => {
    if (open && mode === "camera") {
      void startCamera();
    } else {
      cleanup();
    }
  }, [open, mode, startCamera, cleanup]);

  const close = () => {
    cleanup();
    setOpen(false);
    setError(null);
    setStatus("");
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setStatus("Decoding image…");
    try {
      const bitmap = await createImageBitmap(file);
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) throw new Error("Canvas unavailable");
      ctx.drawImage(bitmap, 0, 0);
      const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
      let raw: string | null = null;
      if (typeof window.BarcodeDetector === "function") {
        try {
          const detector = new window.BarcodeDetector({ formats: ["qr_code"] });
          const codes = await detector.detect(canvas);
          if (codes.length > 0) raw = codes[0].rawValue;
        } catch {
          /* fall through to jsQR */
        }
      }
      if (!raw) {
        const decoded = jsQR(frame.data, frame.width, frame.height);
        raw = decoded?.data ?? null;
      }
      if (!raw) {
        setError("Could not read a QR code from that image. Try a clearer photo or a different image.");
        setStatus("");
        return;
      }
      finish(raw);
    } catch {
      setError("That file could not be opened as an image. Choose a PNG or JPEG QR image.");
      setStatus("");
    }
  };

  return (
    <div>
      <button type="button" className="btn btn-secondary" onClick={() => setOpen(true)}>
        Scan payment QR
      </button>
      {open && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Scan payment QR code">
          <div className="modal">
            <div className="modal-header">
              <h3>Scan payment QR</h3>
              <button type="button" className="btn btn-ghost" onClick={close} aria-label="Close scanner">
                ✕
              </button>
            </div>
            <div className="tabs" role="tablist">
              <button role="tab" aria-selected={mode === "camera"} className={mode === "camera" ? "tab active" : "tab"} onClick={() => setMode("camera")}>
                Camera
              </button>
              <button role="tab" aria-selected={mode === "upload"} className={mode === "upload" ? "tab active" : "tab"} onClick={() => setMode("upload")}>
                Upload image
              </button>
            </div>
            {mode === "camera" && (
              <video ref={videoRef} className="qr-video" playsInline muted aria-label="Camera preview" />
            )}
            {mode === "upload" && (
              <div className="upload-box">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  aria-label="Upload QR image"
                  onChange={(e) => void handleFile(e.target.files?.[0])}
                />
              </div>
            )}
            {status && <p className="status" role="status">{status}</p>}
            {error && <p className="error-text" role="alert">{error}</p>}
            <p className="hint">Image frames are decoded locally in your browser and are never uploaded or stored.</p>
          </div>
        </div>
      )}
    </div>
  );
}
