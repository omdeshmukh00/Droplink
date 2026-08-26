"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Container } from '@/components/Container';
import { Download, ArrowRight, Camera, Pencil, X } from 'lucide-react';
import { socketClient } from '@/services/socketClient';
import { WebRTCPeerManager, formatSpeed, formatETA, formatBytes } from '@/utils/webrtc';
import { getDefaultDeviceName } from '@/utils/systemInfo';

export default function ReceivePage() {
  const router = useRouter();
  const [shareCodeInput, setShareCodeInput] = useState('');
  const [error, setError] = useState('');

  // Device Name State & Modal
  const [receiverName, setReceiverName] = useState<string>('');
  const [isNameModalOpen, setIsNameModalOpen] = useState(false);
  const [tempNameInput, setTempNameInput] = useState('');

  // Active Transfer & WebRTC state
  const [activeShareId, setActiveShareId] = useState<string | null>(null);
  const [pairingCode, setPairingCode] = useState<string>('');
  const [isPairingVerified, setIsPairingVerified] = useState<boolean>(false);
  const [connectionStatus, setConnectionStatus] = useState<string>('');
  const [downloadProgress, setDownloadProgress] = useState<number>(0);
  const [downloadFileName, setDownloadFileName] = useState<string>('');
  const [downloadSpeed, setDownloadSpeed] = useState<string>('');
  const [downloadEta, setDownloadEta] = useState<string>('');
  const [downloadBytesFormatted, setDownloadBytesFormatted] = useState<string>('');
  const [isCompleted, setIsCompleted] = useState<boolean>(false);
  const [showQrScanner, setShowQrScanner] = useState<boolean>(false);

  const rtcManagerRef = useRef<WebRTCPeerManager | null>(null);
  const receivedChunksRef = useRef<ArrayBuffer[]>([]);
  const currentFileMetaRef = useRef<{ fileName: string; mimeType: string; size: number } | null>(null);
  const transferStartTimeRef = useRef<number | null>(null);

  // Initialize Receiver Name
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('droplink_receiver_name');
      if (saved) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setReceiverName(saved);
      } else {
        const defaultName = getDefaultDeviceName();
        setReceiverName(defaultName);
        localStorage.setItem('droplink_receiver_name', defaultName);
      }
    }
  }, []);

  // Normalize input string (ABC-92L-KJD -> ABC92LKJD)
  const normalizeShareId = (input: string): string => {
    const cleaned = input.trim();
    const linkMatch = cleaned.match(/download\/([a-zA-Z0-9_-]+)/);
    const raw = linkMatch ? linkMatch[1] : cleaned;
    return raw.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  };

  const handleStartReceive = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const normalized = normalizeShareId(shareCodeInput);

    if (!normalized) {
      setError('Please enter a valid Share ID or Share Link.');
      return;
    }

    setError('');
    const code = Math.floor(1000 + Math.random() * 9000).toString();
    setPairingCode(code);
    setActiveShareId(normalized);
    setConnectionStatus('Connecting to signaling network...');
  };

  function setupDataChannel(dc: RTCDataChannel) {
    dc.binaryType = 'arraybuffer';
    receivedChunksRef.current = [];

    dc.onmessage = (event) => {
      if (typeof event.data === 'string') {
        try {
          const parsed = JSON.parse(event.data);

          if (parsed.type === 'header') {
            currentFileMetaRef.current = {
              fileName: parsed.fileName,
              mimeType: parsed.mimeType,
              size: parsed.size,
            };
            setDownloadFileName(parsed.fileName);
            receivedChunksRef.current = [];
            transferStartTimeRef.current = Date.now();
            setConnectionStatus(`Receiving '${parsed.fileName}' via WebRTC P2P...`);
          } else if (parsed.type === 'eof') {
            // Reassemble file Blob and trigger download
            if (currentFileMetaRef.current && receivedChunksRef.current.length > 0) {
              const blob = new Blob(receivedChunksRef.current, {
                type: currentFileMetaRef.current.mimeType,
              });

              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = currentFileMetaRef.current.fileName;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              URL.revokeObjectURL(url);

              setIsCompleted(true);
              setDownloadProgress(100);
              setConnectionStatus(`'${currentFileMetaRef.current.fileName}' downloaded successfully!`);
            }
          }
        } catch {
          // Plain string message
        }
      } else if (event.data instanceof ArrayBuffer) {
        if (!transferStartTimeRef.current) {
          transferStartTimeRef.current = Date.now();
        }
        receivedChunksRef.current.push(event.data);
        const meta = currentFileMetaRef.current;
        if (meta) {
          const receivedBytes = receivedChunksRef.current.reduce((acc, c) => acc + c.byteLength, 0);
          const percent = Math.min(100, Math.round((receivedBytes / meta.size) * 100));
          setDownloadProgress(percent);

          const elapsedSec = (Date.now() - transferStartTimeRef.current) / 1000;
          const speedBytes = elapsedSec > 0 ? Math.round(receivedBytes / elapsedSec) : 0;
          const remainingBytes = Math.max(0, meta.size - receivedBytes);
          const etaSec = speedBytes > 0 ? Math.ceil(remainingBytes / speedBytes) : 0;

          setDownloadSpeed(formatSpeed(speedBytes));
          setDownloadEta(formatETA(etaSec));
          setDownloadBytesFormatted(`${formatBytes(receivedBytes)} / ${formatBytes(meta.size)}`);
        }
      }
    };
  }

  // Socket.IO & WebRTC receiver signaling
  useEffect(() => {
    if (!activeShareId) return;

    const socket = socketClient.getSocket();
    const roomKey = `transfer:${activeShareId}`;

    socket.emit('join-transfer-room', { roomKey });

    let isSubscribed = true;

    if (rtcManagerRef.current) {
      rtcManagerRef.current.close();
      rtcManagerRef.current = null;
    }

    WebRTCPeerManager.create().then((manager) => {
      if (!isSubscribed) {
        manager.close();
        return;
      }
      rtcManagerRef.current = manager;
      const pc = manager.getPeerConnection();

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit('webrtc-ice-candidate', {
            roomKey,
            candidate: event.candidate,
          });
        }
      };

      manager.onConnectionStateChange(async (state) => {
        if (state === 'connected') {
          const details = await manager.logSelectedCandidatePair();
          const modeLabel = details ? details.transportType : 'WebRTC P2P';
          setConnectionStatus(`WebRTC Connection Established (${modeLabel})!`);
        } else if (state === 'failed' || state === 'disconnected') {
          setConnectionStatus('Direct connection lost. You can download via Cloud Fallback.');
        }
      });

      // Send pairing code requirement to Sender along with Receiver Name
      socket.emit('pairing-required', {
        roomKey,
        verificationCode: pairingCode,
        receiverName: receiverName || getDefaultDeviceName(),
      });
      setConnectionStatus(`Waiting for sender verification (${pairingCode})...`);

      socket.on('pairing-verified', async () => {
        setIsPairingVerified(true);
        setConnectionStatus('Pairing verified! Initiating WebRTC DataChannel offer...');

        try {
          const dc = manager.createDataChannel('fileTransfer');
          setupDataChannel(dc);

          const offer = await manager.createOffer();

          socket.emit('webrtc-offer', {
            roomKey,
            offer,
          });
        } catch (err) {
          console.error('Failed to create WebRTC offer:', err);
        }
      });

      socket.on('webrtc-answer', async (data: { answer: RTCSessionDescriptionInit }) => {
        try {
          await manager.setRemoteDescription(data.answer);
        } catch (err) {
          console.error('Failed to set remote description from answer:', err);
        }
      });

      socket.on('webrtc-ice-candidate', async (data: { candidate: RTCIceCandidateInit }) => {
        try {
          await manager.addIceCandidate(data.candidate);
        } catch (err) {
          console.error('Failed to add ICE candidate:', err);
        }
      });
    });

    return () => {
      isSubscribed = false;
      socket.off('pairing-verified');
      socket.off('webrtc-answer');
      socket.off('webrtc-ice-candidate');
      socket.emit('leave-transfer-room', { roomKey });
      if (rtcManagerRef.current) {
        rtcManagerRef.current.close();
        rtcManagerRef.current = null;
      }
    };
  }, [activeShareId, pairingCode, receiverName]);

  return (
    <Container maxWidth="lg" className="py-6">
      <div className="text-center mb-8">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mb-2">
          Receive Files
        </h1>
        <p className="text-slate-600 text-sm sm:text-base">
          Enter Share ID (e.g. ABC92LKJD or ABC-92L-KJD) or scan QR code to receive P2P files directly.
        </p>
      </div>

      <div className="bg-[#F6FFF9] rounded-3xl p-6 sm:p-8 border border-emerald-200 shadow-md max-w-xl mx-auto overflow-hidden box-border">
        {!activeShareId ? (
          <form onSubmit={handleStartReceive} className="space-y-6">
            <div className="w-16 h-16 bg-white text-emerald-600 rounded-2xl flex items-center justify-center shadow-xs border border-emerald-100 mx-auto mb-4">
              <Download className="w-8 h-8 stroke-[1.75]" />
            </div>

            {/* Receiver Device Name Field with Pencil Edit Icon */}
            <div className="flex items-center justify-between bg-white border border-emerald-200 rounded-2xl p-3 px-4 text-xs text-slate-700 shadow-2xs">
              <div className="flex items-center gap-2 font-bold truncate">
                <span className="text-slate-400 uppercase tracking-wider">Receiver Device:</span>
                <span className="text-emerald-700 font-extrabold truncate">{receiverName}</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setTempNameInput(receiverName);
                  setIsNameModalOpen(true);
                }}
                className="p-1.5 hover:bg-emerald-50 text-emerald-700 rounded-lg transition-colors flex items-center gap-1 font-bold shrink-0"
                title="Edit Receiver Name"
              >
                <Pencil className="w-3.5 h-3.5" />
                <span>Edit</span>
              </button>
            </div>

            <div className="space-y-2 text-left">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-600">
                Share ID or Transfer Link
              </label>
              <input
                type="text"
                placeholder="e.g. ABC-92L-KJD or https://..."
                value={shareCodeInput}
                onChange={(e) => {
                  setShareCodeInput(e.target.value);
                  setError('');
                }}
                className="w-full bg-white border border-slate-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 rounded-2xl px-4 py-3.5 text-base text-slate-800 font-mono placeholder:font-sans placeholder:text-slate-400 outline-hidden transition-all"
              />
              {error && <p className="text-xs font-semibold text-red-500 mt-1">{error}</p>}
            </div>

            <button
              type="submit"
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 px-6 rounded-2xl shadow-md transition-all flex items-center justify-center gap-2"
            >
              Connect to Transfer
              <ArrowRight className="w-4 h-4" />
            </button>

            {/* Alternative Scan QR option */}
            <div className="mt-6 pt-6 border-t border-emerald-200/60 text-center">
              <button
                type="button"
                onClick={() => setShowQrScanner(!showQrScanner)}
                className="inline-flex items-center gap-2 text-xs font-bold text-emerald-700 hover:text-emerald-800 uppercase tracking-wider"
              >
                <Camera className="w-4 h-4" />
                <span>{showQrScanner ? 'Close Camera Scanner' : 'Scan QR Code with Camera'}</span>
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-6 text-center">
            {/* Connection Status Box */}
            <div className="p-4 bg-white border border-emerald-200 rounded-2xl space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                Transfer Progress
              </span>
              <p className="text-sm font-semibold text-slate-800">{connectionStatus}</p>

              {!isPairingVerified && (
                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 space-y-1">
                  <p className="text-xs font-bold text-emerald-800">Your 4-Digit Pairing Code:</p>
                  <p className="text-2xl font-mono font-extrabold text-emerald-700 tracking-widest">
                    {pairingCode}
                  </p>
                </div>
              )}

              {/* Progress Bar */}
              {downloadProgress > 0 && (
                <div className="space-y-2 pt-2 text-left bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                  <div className="flex justify-between text-xs font-bold text-slate-700">
                    <span className="truncate max-w-[180px]">{downloadFileName}</span>
                    <span>{downloadProgress}%</span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden border border-slate-300">
                    <div
                      className="bg-emerald-600 h-full transition-all duration-300 ease-out"
                      style={{ width: `${downloadProgress}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-2xs font-semibold text-slate-500 pt-0.5">
                    <span>{downloadBytesFormatted}</span>
                    <div className="flex items-center gap-2 font-mono">
                      {downloadSpeed && <span className="text-emerald-700 font-bold">{downloadSpeed}</span>}
                      {downloadEta && <span className="text-slate-600">ETA: {downloadEta}</span>}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={() => {
                setActiveShareId(null);
                setDownloadProgress(0);
                setIsCompleted(false);
              }}
              className="text-sm font-semibold text-emerald-700 hover:text-emerald-800 underline"
            >
              Receive Another File
            </button>
          </div>
        )}
      </div>

      {/* Edit Receiver Name Modal Popup */}
      {isNameModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-2xl max-w-sm w-full space-y-4 text-left">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold text-slate-900">Edit Receiver Name</h3>
              <button
                type="button"
                onClick={() => setIsNameModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-600">Receiver Device Name</label>
              <input
                type="text"
                value={tempNameInput}
                onChange={(e) => setTempNameInput(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 focus:bg-white transition-all font-semibold"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsNameModalOpen(false)}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 px-4 rounded-xl text-xs transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const clean = tempNameInput.trim() || getDefaultDeviceName();
                  setReceiverName(clean);
                  localStorage.setItem('droplink_receiver_name', clean);
                  setIsNameModalOpen(false);
                }}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition-colors shadow-xs"
              >
                Save Name
              </button>
            </div>
          </div>
        </div>
      )}
    </Container>
  );
}
