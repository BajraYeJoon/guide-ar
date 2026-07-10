"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { TARGETS, TargetInfo } from "@/data/targets";
import { Camera, Sparkles, ChevronDown, BookOpen, Info, Loader2 } from "lucide-react";
import * as tf from "@tensorflow/tfjs";
import "@tensorflow/tfjs-backend-webgl"; // Ensure WebGL backend is used
import * as cocoSsd from "@tensorflow-models/coco-ssd";

export default function ARPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const modelRef = useRef<cocoSsd.ObjectDetection | null>(null);

  const [status, setStatus] = useState<
    "loading" | "camera-denied" | "scanning" | "found"
  >("loading");
  const [foundTarget, setFoundTarget] = useState<TargetInfo | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  // Stop the camera and animation frame on unmount
  const cleanup = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
    }
  }, []);

  useEffect(() => {
    let isUnmounted = false;

    const initAI = async () => {
      try {
        setStatus("loading");

        // 1. Initialize TensorFlow Backend
        await tf.setBackend('webgl');
        await tf.ready();

        if (isUnmounted) return;

        // 2. Load COCO-SSD Model (can detect 80 classes of objects, including "mouse")
        const model = await cocoSsd.load({
          base: "lite_mobilenet_v2"
        });
        modelRef.current = model;

        if (isUnmounted) return;

        // 3. Start Camera
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" }, // use back camera on mobile
          audio: false,
        });

        if (isUnmounted) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }

        const video = videoRef.current;
        if (!video) return;

        video.srcObject = stream;
        
        // Need to wait for video to actually start playing to get its dimensions
        video.onloadedmetadata = () => {
          video.play().then(() => {
            if (isUnmounted) return;
            
            setStatus("scanning");
            
            // Set canvas size to match video
            if (canvasRef.current) {
              canvasRef.current.width = video.videoWidth;
              canvasRef.current.height = video.videoHeight;
            }

            // Start detection loop
            detectFrame();
          });
        };

      } catch (err: any) {
        console.error("AI/Camera init error:", err);
        if (!isUnmounted) {
          setStatus("camera-denied");
        }
      }
    };

    const detectFrame = async () => {
      if (isUnmounted || !videoRef.current || !canvasRef.current || !modelRef.current) return;
      
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      
      // Ensure video is ready and playing
      if (video.readyState === 4 && video.videoWidth > 0 && video.videoHeight > 0) {
        // Sync canvas size in case of orientation change
        if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
        }

        // Draw video frame to canvas
        ctx?.clearRect(0, 0, canvas.width, canvas.height);
        
        // Detect objects
        const predictions = await modelRef.current.detect(video);
        
        let mouseDetected = false;

        // Draw bounding boxes
        predictions.forEach((prediction) => {
          // We only care about highly confident predictions (e.g. > 60%)
          if (prediction.score > 0.6) {
            const [x, y, width, height] = prediction.bbox;

            // Is it our target?
            if (prediction.class === "mouse") {
              mouseDetected = true;
              
              // Draw an amber AR bounding box for the mouse
              if (ctx) {
                ctx.strokeStyle = "#f59e0b";
                ctx.lineWidth = 4;
                // Draw corners instead of full box for AR look
                const cornerLength = 20;
                
                ctx.beginPath();
                // Top left
                ctx.moveTo(x, y + cornerLength);
                ctx.lineTo(x, y);
                ctx.lineTo(x + cornerLength, y);
                
                // Top right
                ctx.moveTo(x + width - cornerLength, y);
                ctx.lineTo(x + width, y);
                ctx.lineTo(x + width, y + cornerLength);
                
                // Bottom right
                ctx.moveTo(x + width, y + height - cornerLength);
                ctx.lineTo(x + width, y + height);
                ctx.lineTo(x + width - cornerLength, y + height);
                
                // Bottom left
                ctx.moveTo(x + cornerLength, y + height);
                ctx.lineTo(x, y + height);
                ctx.lineTo(x, y + height - cornerLength);
                
                ctx.stroke();

                // Draw label
                ctx.fillStyle = "#f59e0b";
                ctx.font = "bold 16px sans-serif";
                ctx.fillText(`Target Locked: ${Math.round(prediction.score * 100)}%`, x, y > 20 ? y - 10 : y + 20);
              }
            } else {
               // Optional: Draw faded boxes for other things it sees, or comment this out
               if (ctx) {
                  ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
                  ctx.lineWidth = 2;
                  ctx.strokeRect(x, y, width, height);
                  ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
                  ctx.font = "12px sans-serif";
                  ctx.fillText(prediction.class, x, y > 15 ? y - 5 : y + 15);
               }
            }
          }
        });

        // Update UI state based on detection
        if (mouseDetected) {
           // If we found it, set state but don't repeatedly overwrite if already found
           setStatus((prev) => {
             if (prev !== "found") {
                setFoundTarget(TARGETS[0]); // The mouse data
                return "found";
             }
             return prev;
           });
        } else {
           setStatus((prev) => {
             if (prev === "found") {
                setFoundTarget(null);
                setShowDetails(false);
                return "scanning";
             }
             return prev;
           });
        }
      }

      // Loop
      animationFrameRef.current = requestAnimationFrame(detectFrame);
    };

    initAI();

    return () => {
      isUnmounted = true;
      cleanup();
    };
  }, [cleanup]);

  return (
    <div className="w-full h-screen bg-black text-zinc-100 relative overflow-hidden font-sans select-none flex flex-col">
      
      {/* 
        Video element: Needs playsInline for iOS.
        We make it absolute and cover the screen. 
      */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="absolute inset-0 w-full h-full object-cover z-0"
      />

      {/* 
        Canvas element: Overlays the video to draw the AR bounding boxes.
        We scale it to cover the screen just like the video.
      */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full object-cover z-10 pointer-events-none"
      />

      {/* Status HUD Overlay */}
      <div className="absolute top-4 left-4 right-4 z-30 pointer-events-none flex justify-between items-center">
        <div className="px-4 py-2 rounded-full bg-zinc-950/80 backdrop-blur-md border border-zinc-800 text-xs font-bold text-zinc-300 flex items-center gap-2 shadow-lg">
          <span
            className={`w-2 h-2 rounded-full ${
              status === "found"
                ? "bg-emerald-500"
                : status === "scanning"
                ? "bg-amber-500 animate-pulse"
                : "bg-zinc-500"
            }`}
          />
          {status === "loading" && "Loading AI Engine..."}
          {status === "camera-denied" && "Camera Access Required"}
          {status === "scanning" && "Scanning environment..."}
          {status === "found" && "Target Locked!"}
        </div>
      </div>

      {/* Loading overlay */}
      {status === "loading" && (
        <div className="absolute inset-0 bg-zinc-950 z-20 flex flex-col items-center justify-center text-center p-6 backdrop-blur-sm">
          <Loader2 className="w-12 h-12 text-amber-500 animate-spin mb-4" />
          <h1 className="text-xl font-extrabold text-white">
            Initializing AI Engine...
          </h1>
          <p className="text-xs text-zinc-400 mt-2 max-w-xs leading-relaxed">
            Downloading neural network models and requesting camera access for real-time 3D object detection.
          </p>
        </div>
      )}

      {/* Camera denied overlay */}
      {status === "camera-denied" && (
        <div className="absolute inset-0 bg-zinc-950 z-20 flex flex-col items-center justify-center text-center p-6">
          <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 mb-4">
            <Camera className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-extrabold text-white">
            Camera Access Required
          </h1>
          <p className="text-xs text-zinc-400 mt-2 max-w-sm leading-relaxed">
            AI scanning needs camera permission. Grant permission in your
            browser settings and reload.
          </p>
          <p className="text-[10px] text-zinc-500 mt-3 max-w-sm leading-relaxed">
            Mobile browsers require HTTPS. Use{" "}
            <span className="text-amber-500 font-mono">
              https://192.168.10.53:3000
            </span>{" "}
            and accept the SSL certificate warning.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-6 py-2.5 rounded-xl bg-amber-500 text-zinc-950 font-bold text-sm hover:bg-amber-400 transition-all pointer-events-auto"
          >
            Retry
          </button>
        </div>
      )}

      {/* Scanning guide overlay */}
      {status === "scanning" && (
        <div className="absolute inset-0 z-20 pointer-events-none flex items-center justify-center">
          <div className="w-64 h-64 border border-dashed border-white/20 rounded-3xl relative">
             {/* Scanner line animation */}
             <div className="absolute top-0 left-0 w-full h-0.5 bg-amber-500/50 shadow-[0_0_10px_rgba(245,158,11,0.5)] animate-[scan_2s_ease-in-out_infinite]" />
             
             <style dangerouslySetInnerHTML={{__html: `
                @keyframes scan {
                   0% { top: 0; opacity: 0; }
                   10% { opacity: 1; }
                   90% { opacity: 1; }
                   100% { top: 100%; opacity: 0; }
                }
             `}} />
          </div>

          <div className="absolute bottom-24 left-6 right-6 flex justify-center">
            <div className="px-5 py-3 rounded-2xl bg-zinc-950/80 backdrop-blur-xl border border-zinc-800 text-xs text-zinc-300 text-center shadow-2xl leading-relaxed">
              <span className="font-bold text-amber-500 block mb-1">Point your camera at a physical computer mouse</span>
              The AI will detect its 3D shape from any angle.
            </div>
          </div>
        </div>
      )}

      {/* Info overlay panel */}
      {status === "found" && foundTarget && (
        <div
          className="absolute bottom-0 left-0 right-0 z-50 pointer-events-auto animate-fadeIn"
        >
          <div className="bg-zinc-950/95 backdrop-blur-xl border-t border-zinc-800 rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.5)] flex flex-col">
            <div className="p-5 pb-0">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-1.5 text-xs text-amber-500 font-bold uppercase tracking-wider mb-1">
                    <Sparkles className="w-4 h-4 animate-pulse" />
                    Target Identified
                  </div>
                  <h2 className="text-xl font-extrabold text-white">
                    {foundTarget.name}
                  </h2>
                  <p className="text-xs text-zinc-400 mt-1 leading-relaxed max-w-sm">
                    {foundTarget.description}
                  </p>
                </div>
              </div>
            </div>

            <div className="p-5 pt-4">
              <div className="grid grid-cols-3 gap-2">
                {foundTarget.specs
                  .slice(0, showDetails ? undefined : 3)
                  .map((spec, i) => (
                    <div
                      key={i}
                      className="p-2.5 rounded-xl bg-zinc-900/60 border border-zinc-800/60 flex flex-col"
                    >
                      <span className="text-[9px] text-zinc-500 uppercase font-medium">
                        {spec.label}
                      </span>
                      <span className="text-[11px] font-bold text-zinc-200 mt-0.5 whitespace-nowrap overflow-hidden text-ellipsis">
                        {spec.value}
                      </span>
                    </div>
                  ))}
              </div>
            </div>

            <button
              onClick={() => setShowDetails(!showDetails)}
              className="flex items-center justify-center gap-1.5 py-3 text-xs font-semibold text-zinc-400 hover:text-amber-500 transition-colors border-t border-zinc-900"
            >
              <BookOpen className="w-3.5 h-3.5" />
              {showDetails ? "Hide History" : "Show History & Details"}
              <ChevronDown
                className={`w-3.5 h-3.5 transition-transform ${
                  showDetails ? "rotate-180" : ""
                }`}
              />
            </button>

            {showDetails && (
              <div className="px-5 pb-5 border-t border-zinc-900 pt-4 animate-fadeIn">
                <div className="flex items-center gap-1.5 text-xs text-amber-500 font-bold uppercase tracking-wider mb-2">
                  <Info className="w-3.5 h-3.5" />
                  History
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  {foundTarget.history}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
