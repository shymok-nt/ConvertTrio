"use client";

import { useEffect, useRef, useState } from "react";

type OutputFormat = "image/png" | "image/jpeg" | "image/webp";
type Result = { url: string; name: string; size: number; format: OutputFormat };
const formats: { value: OutputFormat; label: string; extension: string }[] = [
  { value: "image/png", label: "PNG", extension: "png" },
  { value: "image/jpeg", label: "JPG", extension: "jpg" },
  { value: "image/webp", label: "WebP", extension: "webp" },
];
const MAX_BYTES = 20 * 1024 * 1024;
const MAX_PIXELS = 40_000_000;
const allowedTypes = new Set(["image/png", "image/jpeg", "image/webp"]);
const formatBytes = (bytes: number) => bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1024 / 1024).toFixed(2)} MB`;

export default function HomePage() {
  const [file, setFile] = useState<File | null>(null);
  const [format, setFormat] = useState<OutputFormat>("image/webp");
  const [preview, setPreview] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<string | null>(null);
  const resultRef = useRef<string | null>(null);
  const busyRef = useRef(false);

  useEffect(() => () => {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    if (resultRef.current) URL.revokeObjectURL(resultRef.current);
  }, []);

  function clearResult() {
    if (resultRef.current) URL.revokeObjectURL(resultRef.current);
    resultRef.current = null;
    setResult(null);
  }

  function chooseFile(next: File | null) {
    if (busyRef.current) return;
    setError("");
    clearResult();
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    previewRef.current = null;
    setPreview(null);
    setFile(null);
    if (!next) return;
    if (!allowedTypes.has(next.type)) {
      setError("Please choose a PNG, JPG, or WebP image.");
      return;
    }
    if (!next.size || next.size > MAX_BYTES) {
      setError("Choose an image smaller than 20 MB.");
      return;
    }
    const url = URL.createObjectURL(next);
    previewRef.current = url;
    setPreview(url);
    setFile(next);
  }

  async function convert() {
    if (!file || !preview || busyRef.current) return;
    busyRef.current = true;
    setWorking(true);
    setError("");
    clearResult();
    try {
      const image = new Image();
      image.src = preview;
      await image.decode();
      if (!image.naturalWidth || !image.naturalHeight || image.naturalWidth * image.naturalHeight > MAX_PIXELS) {
        throw new Error("This image is too large to process. Maximum: 40 megapixels.");
      }
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Your browser cannot process this image.");
      if (format === "image/jpeg") {
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, canvas.width, canvas.height);
      }
      context.drawImage(image, 0, 0);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, format, 0.92));
      canvas.width = 0;
      canvas.height = 0;
      if (!blob || blob.type !== format) throw new Error("This output format is not supported by your browser.");
      const extension = formats.find((item) => item.value === format)!.extension;
      const name = `${file.name.replace(/\.[^.]+$/, "") || "converted"}.${extension}`;
      const url = URL.createObjectURL(blob);
      resultRef.current = url;
      setResult({ url, name, size: blob.size, format });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Conversion failed. Try a different image.");
    } finally {
      busyRef.current = false;
      setWorking(false);
    }
  }

  return (
    <main className="shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="ConvertTrio home"><span className="brand-mark">C<span>↗</span></span>Convert<span>Trio</span></a>
        <span className="header-label">Simple tools. Better files.</span>
      </header>

      <section className="hero">
        <div className="eyebrow"><span className="eyebrow-dot" /> FREE ONLINE IMAGE CONVERTER</div>
        <h1>Every format.<br /><em>One simple place.</em></h1>
        <p className="subtitle">Convert PNG, JPG, and WebP images in seconds. No account, no uploads, no fuss.</p>
        <div className="feature-pills"><span>✦ Private by design</span><span>✦ No sign-up</span><span>✦ Free to use</span></div>
      </section>

      <section className="converter" aria-label="Image converter">
        <div className="converter-heading"><div><p className="section-kicker">YOUR WORKSPACE</p><h2>Image converter</h2></div><span className="converter-tag">PNG · JPG · WEBP</span></div>
        <input ref={inputRef} className="sr-only" type="file" accept="image/png,image/jpeg,image/webp" aria-label="Choose image" onChange={(event) => { chooseFile(event.target.files?.[0] ?? null); event.target.value = ""; }} />
        <div className={`dropzone ${dragging ? "dragging" : ""}`} onDragEnter={(event) => { event.preventDefault(); setDragging(true); }} onDragOver={(event) => event.preventDefault()} onDragLeave={(event) => { event.preventDefault(); if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragging(false); }} onDrop={(event) => { event.preventDefault(); setDragging(false); chooseFile(event.dataTransfer.files[0] ?? null); }}>
          {preview && file ? (
            <div className="selected-file">
              {/* A local object URL is created only for the user's selected image. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="preview-image" src={preview} alt="Selected image preview" />
              <div className="file-info"><strong title={file.name}>{file.name}</strong><span>{formatBytes(file.size)} · Ready to convert</span><button type="button" className="text-button" disabled={working} onClick={() => inputRef.current?.click()}>Choose another image</button></div>
            </div>
          ) : (
            <div className="empty-upload"><div className="upload-icon" aria-hidden="true">↑</div><h3>Drop your image here</h3><p>or browse files from your device</p><button type="button" className="browse-button" onClick={() => inputRef.current?.click()}>Browse files <span aria-hidden="true">↗</span></button><small>PNG, JPG or WebP · Up to 20 MB · 40 MP maximum</small></div>
          )}
        </div>
        <div className="converter-controls">
          <label htmlFor="output-format">Convert to</label>
          <select id="output-format" value={format} disabled={working} onChange={(event) => { setFormat(event.target.value as OutputFormat); clearResult(); setError(""); }}>
            {formats.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
          <button className="convert-button" type="button" disabled={!file || working} onClick={convert}>{working ? "Converting…" : "Convert image"} <span aria-hidden="true">→</span></button>
        </div>
        {error && <p className="message error" role="alert">{error}</p>}
        {result && <div className="message success" role="status"><div><strong>Your image is ready!</strong><span>{result.name} · {formatBytes(result.size)}</span></div><a className="download-button" href={result.url} download={result.name}>Download ↓</a></div>}
        <p className="privacy-note">🔒 Your images stay on your device. Conversion happens in your browser.</p>
      </section>

      <section className="benefits" aria-label="Benefits"><div><span className="benefit-icon">◇</span><h3>Made to be easy</h3><p>No complicated settings. Just choose your image and format.</p></div><div><span className="benefit-icon">◎</span><h3>Privacy comes first</h3><p>Images are processed locally, without being sent to a server.</p></div><div><span className="benefit-icon">↗</span><h3>Ready in seconds</h3><p>Get your converted image and download it right away.</p></div></section>
      <footer><span>© {new Date().getFullYear()} ConvertTrio</span><span>Made for simpler file conversions.</span></footer>
    </main>
  );
}
