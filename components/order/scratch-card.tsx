import React, { useRef, useEffect, useState, useCallback, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface ScratchCardInteractiveProps {
  onReveal?: () => void;
  children: ReactNode;
  isRevealed?: boolean;
  className?: string;
}

export function ScratchCardInteractive({
  onReveal,
  children,
  isRevealed = false,
  className,
}: ScratchCardInteractiveProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [revealed, setRevealed] = useState(isRevealed);
  const isDrawing = useRef(false);
  const lastPoint = useRef<{ x: number; y: number } | null>(null);
  const animationFrameId = useRef<number | null>(null);

  useEffect(() => {
    if (isRevealed && !revealed) {
      setRevealed(true);
    }
  }, [isRevealed, revealed]);

  // Handle Initial Draw
  useEffect(() => {
    if (revealed) return;

    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let resizeObserver: ResizeObserver | null = null;
    let isScratched = false;

    const initCanvas = () => {
      if (isScratched) return; // Don't redraw if user already started scratching
      width = container.clientWidth;
      height = container.clientHeight;
      
      // Handle device pixel ratio for sharper canvas
      const dpr = window.devicePixelRatio || 1;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      
      ctx.scale(dpr, dpr);

      // Draw initial pattern/gradient
      const patterns = [
        { c1: "#FADB5F", c2: "#f7b733" }, // Gold
        { c1: "#e0e0e0", c2: "#bdbdbd" }, // Silver
        { c1: "#cd7f32", c2: "#a0522d" }, // Bronze
        { c1: "#FF416C", c2: "#FF4B2B" }, // Colorful
        { c1: "#4CA1AF", c2: "#C4E0E5" }  // Blue-ish
      ];
      const selected = patterns[Math.floor(Math.random() * patterns.length)];

      const gradient = ctx.createLinearGradient(0, 0, width, height);
      gradient.addColorStop(0, selected.c1);
      gradient.addColorStop(1, selected.c2);

      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);

      // Add some random noise or geometric shapes
      ctx.fillStyle = "rgba(255, 255, 255, 0.15)";
      for (let i = 0; i < 60; i++) {
        ctx.beginPath();
        ctx.arc(
          Math.random() * width,
          Math.random() * height,
          Math.random() * 20 + 5,
          0,
          Math.PI * 2
        );
        ctx.fill();
      }
      
      // Draw text — sized relative to the container so it reads cleanly at
      // both the small grid-tile preview and the full-screen reveal, and
      // shrunk further if it would still overflow (e.g. an unusually narrow
      // container) rather than ever wrapping across two lines.
      const label = "Scratch To Reveal";
      ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      let fontSize = Math.max(14, Math.min(32, width * 0.09));
      ctx.font = `bold ${fontSize}px sans-serif`;
      const maxTextWidth = width * 0.85;
      while (ctx.measureText(label).width > maxTextWidth && fontSize > 10) {
        fontSize -= 1;
        ctx.font = `bold ${fontSize}px sans-serif`;
      }
      ctx.fillText(label, width / 2, height / 2);
    };

    initCanvas();

    resizeObserver = new ResizeObserver(() => {
      // Re-init canvas on resize only if they haven't started scratching
      if (!isScratched) {
        initCanvas();
      }
    });

    resizeObserver.observe(container);

    // Provide a way to mark as scratched to prevent resize resets
    canvas.dataset.scratched = "false";
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((m) => {
        if (m.type === "attributes" && m.attributeName === "data-scratched") {
          isScratched = canvas.dataset.scratched === "true";
        }
      });
    });
    observer.observe(canvas, { attributes: true });

    return () => {
      resizeObserver?.disconnect();
      observer.disconnect();
    };
  }, [revealed]);

  const checkCompletion = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    const { width, height } = canvas;
    // Get image data
    const imageData = ctx.getImageData(0, 0, width, height);
    const pixels = imageData.data;
    
    let transparentPixels = 0;
    
    // Check every Nth pixel for performance (stride)
    // We check the alpha channel which is at index i * 4 + 3
    const pixelStep = 16; 
    let checked = 0;
    
    for (let i = 0; i < pixels.length; i += 4 * pixelStep) {
      const alpha = pixels[i + 3];
      if (alpha < 128) {
        transparentPixels++;
      }
      checked++;
    }

    const percentage = (transparentPixels / checked) * 100;
    
    if (percentage > 60) {
      setRevealed(true);
      if (onReveal) {
        onReveal();
      }
    }
  }, [onReveal]);

  const getCoordinates = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    
    // We don't need scaleX/Y for logical drawing coordinates because we applied scale(dpr, dpr)
    // The CSS size matches the client size, so clientX - rect.left gives logical CSS pixels.
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const scratch = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing.current || revealed) return;
    const coords = getCoordinates(e);
    if (!coords) return;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d", { willReadFrequently: true });
    if (!canvas || !ctx) return;

    if (canvas.dataset.scratched === "false") {
      canvas.dataset.scratched = "true";
    }

    ctx.globalCompositeOperation = "destination-out";
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.lineWidth = 40; // Scratch brush size

    ctx.beginPath();
    if (lastPoint.current) {
      ctx.moveTo(lastPoint.current.x, lastPoint.current.y);
    } else {
      ctx.moveTo(coords.x, coords.y);
    }
    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();

    lastPoint.current = coords;

    if (animationFrameId.current) {
      cancelAnimationFrame(animationFrameId.current);
    }
    animationFrameId.current = requestAnimationFrame(() => {
      checkCompletion();
    });
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (revealed) return;
    isDrawing.current = true;
    lastPoint.current = getCoordinates(e);
    (e.target as Element).setPointerCapture(e.pointerId);
    
    // Do an initial dot scratch at the point of touch
    scratch(e);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    scratch(e);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    isDrawing.current = false;
    lastPoint.current = null;
    (e.target as Element).releasePointerCapture(e.pointerId);
  };

  return (
    <div 
      ref={containerRef}
      className={cn(
        "relative select-none overflow-hidden rounded-xl bg-muted w-full h-full min-h-[200px]",
        className
      )}
    >
      {/* Reward Content */}
      <div className="absolute inset-0 flex items-center justify-center p-4">
        {children}
      </div>

      {/* Canvas Overlay */}
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className={cn(
          "absolute inset-0 z-10 block h-full w-full touch-none transition-opacity duration-700",
          revealed ? "pointer-events-none opacity-0" : "opacity-100"
        )}
      />
    </div>
  );
}
