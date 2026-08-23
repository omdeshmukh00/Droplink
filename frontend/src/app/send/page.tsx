"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Container } from '@/components/Container';
import {
  UploadCloud,
  ShieldCheck,
  Wifi,
  CloudUpload,
  KeyRound,
  CheckCircle2,
  FileText,
  Pencil,
  Users,
  X,
  Plus,
  Minus,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import { QRCodeSVG as QRCodeComponent } from 'qrcode.react';
import { socketClient } from '@/services/socketClient';
import { WebRTCPeerManager, WebRTCTransferProgress } from '@/utils/webrtc';
import { getDefaultDeviceName } from '@/utils/systemInfo';
import axios from 'axios';
import { getApiUrl } from '@/config/api';

type ConnectionState =
  | 'idle'
  | 'waiting-for-peer'
  | 'pairing-verification'
  | 'connecting'
  | 'transferring'
  | 'completed'
  | 'fallback'
  | 'failed';

function formatFileSize(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const val = bytes / Math.pow(k, i);
  return `${parseFloat(val.toFixed(2))} ${sizes[i]}`;
}

export default function SendPage() {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [shareData, setShareData] = useState<{
    shareId: string;
    shareUrl: string;
    roomKey: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  // Floating Warning Toast
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);

  // Device Name State & Modal
  const [senderName, setSenderName] = useState<string>('');
  const [isNameModalOpen, setIsNameModalOpen] = useState(false);
  const [tempNameInput, setTempNameInput] = useState('');

  // Session Configurations
  const [limitMaxUsers, setLimitMaxUsers] = useState(true);
  const [maxUsers, setMaxUsers] = useState(1);
  const [autoVerify, setAutoVerify] = useState(true);

  // WebRTC & Connection states
  const [connectionState, setConnectionState] = useState<ConnectionState>('idle');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [pairingCodeInput, setPairingCodeInput] = useState<string>('');
  const [expectedPairingCode, setExpectedPairingCode] = useState<string | null>(null);
  const [pairingError, setPairingError] = useState<string | null>(null);

  // Transfer progress
  const [transferProgress, setTransferProgress] = useState<number>(0);
  const [currentFileName, setCurrentFileName] = useState<string>('');
  const [isCloudUploading, setIsCloudUploading] = useState(false);

  const rtcManagerRef = useRef<WebRTCPeerManager | null>(null);

  // Initialize Sender Name
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('droplink_sender_name');
      if (saved) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setSenderName(saved);
      } else {
        const defaultName = getDefaultDeviceName();
        setSenderName(defaultName);
        localStorage.setItem('droplink_sender_name', defaultName);
      }
    }
  }, []);

  // Global Prevent Default on Drop to avoid browser navigation
  useEffect(() => {
    const preventDefaultDrop = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };
    window.addEventListener('dragover', preventDefaultDrop);
    window.addEventListener('drop', preventDefaultDrop);
    return () => {
      window.removeEventListener('dragover', preventDefaultDrop);
      window.removeEventListener('drop', preventDefaultDrop);
    };
  }, []);

  const triggerDuplicateWarning = (duplicateNames: string[]) => {
    const names = duplicateNames.map((n) => `'${n}'`).join(', ');
    setDuplicateWarning(`Duplicate file${duplicateNames.length > 1 ? 's' : ''} ${names} skipped.`);
    setTimeout(() => setDuplicateWarning(null), 3000);
  };

  // Drag & Drop Handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
      const dropped = Array.from(e.dataTransfer.files);
      setSelectedFiles((prev) => {
        const existingKeys = new Set(prev.map((f) => `${f.name}_${f.size}`));
        const duplicates = dropped.filter((f) => existingKeys.has(`${f.name}_${f.size}`));
        const unique = dropped.filter((f) => !existingKeys.has(`${f.name}_${f.size}`));

        if (duplicates.length > 0) {
          triggerDuplicateWarning(duplicates.map((f) => f.name));
        }
        return [...prev, ...unique];
      });
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selected = Array.from(e.target.files);
      setSelectedFiles((prev) => {
        const existingKeys = new Set(prev.map((f) => `${f.name}_${f.size}`));
        const duplicates = selected.filter((f) => existingKeys.has(`${f.name}_${f.size}`));
        const unique = selected.filter((f) => !existingKeys.has(`${f.name}_${f.size}`));

        if (duplicates.length > 0) {
          triggerDuplicateWarning(duplicates.map((f) => f.name));
        }
        return [...prev, ...unique];
      });
      e.target.value = '';
    }
  };

  const handleRemoveFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleGenerateShare = () => {
    if (selectedFiles.length === 0) return;
    setIsGenerating(true);

    setTimeout(() => {
      const randomId = Math.floor(100000000 + Math.random() * 900000000).toString();
      const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
      const data = {
        shareId: randomId,
        shareUrl: `${origin}/download/${randomId}`,
        roomKey: `transfer:${randomId}`,
      };
      setShareData(data);
      setIsGenerating(false);
      setConnectionState('waiting-for-peer');
      setStatusMessage('Waiting for receiver to connect...');
    }, 500);
  };

  async function startWebRTCTransfer(manager: WebRTCPeerManager) {
    try {
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        setCurrentFileName(file.name);
        const fileId = `file_${i}_${Date.now()}`;

        await manager.sendFile(file, fileId, (prog: WebRTCTransferProgress) => {
          const overall = Math.round(((i + prog.percentage / 100) / selectedFiles.length) * 100);
          setTransferProgress(overall);
        });
      }

      setTransferProgress(100);
      setConnectionState('completed');
      setStatusMessage('All files transferred successfully via direct P2P!');
    } catch (err) {
      console.error('WebRTC transfer error:', err);
      setStatusMessage('Direct transfer interrupted. Cloud Fallback available.');
    }
  }

  // Socket.IO & WebRTC Setup when shareData is ready
  useEffect(() => {
    if (!shareData) return;

    const socket = socketClient.getSocket();
    const roomKey = shareData.roomKey;

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
        setConnectionState('connecting');
        const details = await manager.logSelectedCandidatePair();
        const modeLabel = details ? details.transportType : 'WebRTC P2P';
        setStatusMessage(`Connection Established (${modeLabel}). Preparing DataChannel...`);
      } else if (state === 'failed' || state === 'disconnected') {
        setStatusMessage('Direct connection lost. You can use Cloud Fallback.');
      }
    });

    // Listen for WebRTC Signaling from Receiver
    socket.on('pairing-required', (data: { verificationCode?: string; receiverName?: string }) => {
      if (autoVerify) {
        // Auto-verify if autoVerify setting is ON
        socket.emit('pairing-verified', { roomKey });
        setConnectionState('connecting');
        setStatusMessage(`Auto-verified receiver ${data.receiverName ? `'${data.receiverName}'` : ''}. Establishing P2P...`);
      } else if (data.verificationCode) {
        // Manual verification required
        setExpectedPairingCode(data.verificationCode);
        setConnectionState('pairing-verification');
        setStatusMessage(`Receiver ${data.receiverName ? `'${data.receiverName}'` : ''} requested connection with 4-digit code.`);
      }
    });

    socket.on('webrtc-offer', async (data: { offer: RTCSessionDescriptionInit }) => {
      try {
        setConnectionState('connecting');
        setStatusMessage('Connecting to receiver...');
        await manager.setRemoteDescription(data.offer);
        const answer = await manager.createAnswer();

        socket.emit('webrtc-answer', {
          roomKey,
          answer,
        });
      } catch (err) {
        console.error('Failed to handle WebRTC offer:', err);
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

    // Handle incoming DataChannel if receiver created it
    pc.ondatachannel = (event) => {
      const channel = event.channel;
      manager.setDataChannel(channel);

      channel.onopen = () => {
        setConnectionState('transferring');
        setStatusMessage('Transferring files directly via WebRTC DataChannel...');
        startWebRTCTransfer(manager);
      };
    };
    });

    return () => {
      isSubscribed = false;
      socket.off('webrtc-offer');
      socket.off('webrtc-answer');
      socket.off('webrtc-ice-candidate');
      socket.off('pairing-required');
      socket.emit('leave-transfer-room', { roomKey });
      if (rtcManagerRef.current) {
        rtcManagerRef.current.close();
        rtcManagerRef.current = null;
      }
    };
  }, [shareData, autoVerify]);

  const handleVerifyPairingCode = () => {
    if (!pairingCodeInput || pairingCodeInput.trim() !== expectedPairingCode) {
      setPairingError('Incorrect verification code. Please check receiver screen.');
      return;
    }

    setPairingError(null);
    setConnectionState('connecting');
    setStatusMessage('Verification successful! Establishing WebRTC connection...');
    const socket = socketClient.getSocket();
    if (shareData) {
      socket.emit('pairing-verified', { roomKey: shareData.roomKey });
    }
  };

  // Google Drive Cloud Fallback
  const handleCloudFallback = async () => {
    if (selectedFiles.length === 0 || !shareData) return;

    setIsCloudUploading(true);
    setConnectionState('fallback');
    setStatusMessage('Uploading files to Google Drive cloud storage...');

    try {
      const formData = new FormData();
      formData.append('shareId', shareData.shareId);
      selectedFiles.forEach((file) => formData.append('files', file));

      const apiUrl = getApiUrl();
      await axios.post(`${apiUrl}/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setTransferProgress(percent);
          }
        },
      });

      setConnectionState('completed');
      setStatusMessage('Files uploaded to Google Drive! Receiver can download using Share ID.');
    } catch (err) {
      console.error('Cloud Fallback upload failed:', err);
      setStatusMessage('Cloud upload failed. Please try again.');
    } finally {
      setIsCloudUploading(false);
    }
  };

  const handleCopyLink = () => {
    if (shareData?.shareUrl) {
      navigator.clipboard.writeText(shareData.shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Container maxWidth="7xl" className="py-4">
      {/* Floating Toast for Duplicate File Warning */}
      {duplicateWarning && (
        <div className="fixed top-24 left-1/2 transform -translate-x-1/2 z-50 bg-amber-900/95 backdrop-blur-md text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 text-xs font-bold animate-in fade-in slide-in-from-top-4 duration-300 border border-amber-500/40">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          <span>{duplicateWarning}</span>
          <button
            type="button"
            onClick={() => setDuplicateWarning(null)}
            className="ml-2 text-amber-300 hover:text-white p-0.5 rounded-md cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <div className="text-center mb-6">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mb-1">
          Send Files
        </h1>
        <p className="text-slate-600 text-xs sm:text-sm">
          Direct browser-to-browser WebRTC transfer with automatic Google Drive cloud fallback.
        </p>
      </div>

      {!shareData ? (
        /* 2-Column Responsive Layout - Expanded Width for Generous Breathing Room */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 max-w-6xl mx-auto items-start">
          {/* Left Column (Send Upload Model): col-span-7 */}
          <div className="lg:col-span-7 bg-white rounded-3xl p-6 sm:p-7 border border-slate-200 shadow-md space-y-5">
            {/* Sender Device Name Header Bar */}
            <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-2xl p-2.5 px-3.5 text-xs text-slate-700">
              <div className="flex items-center gap-2 font-bold truncate min-w-0">
                <span className="text-slate-400 uppercase tracking-wider shrink-0">Sender Device:</span>
                <span className="text-blue-600 font-extrabold truncate">{senderName}</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setTempNameInput(senderName);
                  setIsNameModalOpen(true);
                }}
                className="p-1 hover:bg-blue-50 text-blue-600 hover:text-blue-700 rounded-lg transition-colors flex items-center gap-1 font-bold shrink-0 cursor-pointer"
                title="Edit Sender Name"
              >
                <Pencil className="w-3.5 h-3.5" />
                <span>Edit</span>
              </button>
            </div>

            {/* Drag & Drop Upload Zone */}
            <label
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center cursor-pointer transition-all text-center group block ${
                isDragging
                  ? 'border-blue-600 bg-blue-100/60 scale-[1.01] shadow-md'
                  : 'border-slate-300 hover:border-blue-500 bg-slate-50 hover:bg-blue-50/50'
              }`}
            >
              <div className="w-12 h-12 bg-white text-blue-600 rounded-2xl flex items-center justify-center shadow-xs border border-slate-200 mb-3 group-hover:scale-105 transition-transform">
                <UploadCloud className="w-6 h-6 stroke-[1.75]" />
              </div>
              <p className="text-sm font-bold text-slate-800 mb-0.5">
                Click to browse or drop files here
              </p>
              <p className="text-2xs text-slate-500">Supports files up to 2GB per transfer</p>
              <input
                type="file"
                multiple
                onChange={handleFileChange}
                className="hidden"
              />
            </label>

            {/* Session Configurations Card */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-3 text-left">
              {/* Row 1: Limit Max Receivers + Inline Stepper + Inline Toggle in ONE ROW */}
              <div className="flex items-center justify-between gap-2 min-w-0">
                <div className="space-y-0.5 min-w-0 flex-1">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5 truncate">
                    <Users className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <span className="truncate">Limit Max Receivers</span>
                  </label>
                  <p className="text-2xs text-slate-500 truncate">
                    {limitMaxUsers ? `Max ${maxUsers} user(s)` : 'Unlimited receivers'}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {/* Stepper Inline */}
                  <div className={`flex items-center gap-1 transition-opacity duration-200 ${!limitMaxUsers ? 'opacity-40' : 'opacity-100'}`}>
                    <button
                      type="button"
                      onClick={() => setMaxUsers((prev) => Math.max(1, prev - 1))}
                      disabled={!limitMaxUsers || maxUsers <= 1}
                      className="w-6 h-6 bg-white border border-slate-300 rounded-md flex items-center justify-center text-slate-600 hover:bg-slate-100 disabled:opacity-40 font-bold transition-colors cursor-pointer disabled:cursor-not-allowed text-xs"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <input
                      type="number"
                      min={1}
                      disabled={!limitMaxUsers}
                      value={maxUsers}
                      onChange={(e) => setMaxUsers(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-10 bg-white border border-slate-300 rounded-md py-0.5 px-1 text-center text-xs font-mono font-bold text-slate-800 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                    />
                    <button
                      type="button"
                      onClick={() => setMaxUsers((prev) => prev + 1)}
                      disabled={!limitMaxUsers}
                      className="w-6 h-6 bg-white border border-slate-300 rounded-md flex items-center justify-center text-slate-600 hover:bg-slate-100 disabled:opacity-40 font-bold transition-colors cursor-pointer disabled:cursor-not-allowed text-xs"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Toggle Inline */}
                  <button
                    type="button"
                    onClick={() => setLimitMaxUsers(!limitMaxUsers)}
                    className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                      limitMaxUsers ? 'bg-blue-600' : 'bg-slate-300'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                        limitMaxUsers ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Row 2: Auto-Verify Receiver */}
              <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200/60 min-w-0">
                <div className="space-y-0.5 min-w-0 flex-1">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5 truncate">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span className="truncate">Auto-Verify Receiver</span>
                  </label>
                  <p className="text-2xs text-slate-500 truncate">
                    {autoVerify ? 'Automatically approve connected receivers' : 'Require manual 4-digit code approval'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setAutoVerify(!autoVerify)}
                  className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                    autoVerify ? 'bg-emerald-600' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                      autoVerify ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Create Transfer Session Action Button */}
            <button
              onClick={handleGenerateShare}
              disabled={selectedFiles.length === 0 || isGenerating}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-3 px-6 rounded-2xl shadow-md transition-all flex items-center justify-center gap-2 text-sm cursor-pointer disabled:cursor-not-allowed"
            >
              {isGenerating ? 'Creating Session...' : 'Create Transfer Session'}
            </button>
          </div>

          {/* Right Column (Files Selected List): col-span-5 */}
          <div className="lg:col-span-5 bg-white rounded-3xl p-6 sm:p-7 border border-slate-200 shadow-md space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Files Selected ({selectedFiles.length})
              </h3>
              {selectedFiles.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedFiles([])}
                  className="text-2xs font-bold text-rose-600 hover:text-rose-700 hover:underline cursor-pointer"
                >
                  Clear All
                </button>
              )}
            </div>

            {selectedFiles.length === 0 ? (
              <div className="text-center py-14 space-y-2 text-slate-400 border-2 border-dashed border-slate-100 rounded-2xl">
                <FileText className="w-9 h-9 mx-auto opacity-30 text-blue-500" />
                <p className="text-xs font-semibold text-slate-600">No files selected yet.</p>
                <p className="text-2xs text-slate-400">Click or drop files in the box on the left.</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
                {selectedFiles.map((file, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs shadow-2xs"
                  >
                    <div className="flex items-center gap-2.5 truncate max-w-[220px] sm:max-w-xs">
                      <FileText className="w-4 h-4 text-blue-600 shrink-0" />
                      <div className="truncate text-left">
                        <p className="font-bold text-slate-800 truncate">{file.name}</p>
                        <p className="text-2xs text-slate-400 font-mono">{formatFileSize(file.size)}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveFile(idx)}
                      className="text-slate-400 hover:text-rose-600 p-1 rounded-md transition-colors cursor-pointer"
                      title="Remove file"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Active Session View */
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-md max-w-2xl mx-auto space-y-6 text-center">
          {/* Status Banner */}
          <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl flex flex-col items-center justify-center text-center space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-blue-600">
              <Wifi className="w-4 h-4 animate-pulse" />
              <span>WebRTC Direct Transfer Status</span>
            </div>
            <p className="text-sm font-semibold text-slate-800">{statusMessage}</p>
          </div>

          {/* Shared Files Summary List */}
          {selectedFiles.length > 0 && (
            <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl space-y-2.5 text-left">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-blue-600" />
                  <span>Shared Files ({selectedFiles.length})</span>
                </span>
                <span className="text-2xs font-extrabold bg-blue-100 text-blue-700 border border-blue-200 px-2.5 py-0.5 rounded-full">
                  Ready to Stream
                </span>
              </div>
              <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                {selectedFiles.map((file, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between bg-white p-2.5 rounded-xl border border-slate-200 text-xs shadow-2xs"
                  >
                    <div className="flex items-center gap-2 truncate max-w-[240px] sm:max-w-xs">
                      <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                      <span className="font-bold text-slate-800 truncate">{file.name}</span>
                    </div>
                    <span className="text-slate-500 font-mono text-xs shrink-0">
                      {formatFileSize(file.size)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Active Session Configurations Summary */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3 text-left">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-blue-600" />
                Max Receivers Limit:
              </span>
              <span className="text-xs font-mono font-bold text-blue-600">
                {limitMaxUsers ? `${maxUsers} User(s)` : 'Unlimited'}
              </span>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-slate-200/60">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                Auto-Verify:
              </span>
              <span className={`text-xs font-bold ${autoVerify ? 'text-emerald-600' : 'text-amber-600'}`}>
                {autoVerify ? 'ON (Automatic)' : 'OFF (Manual Approval)'}
              </span>
            </div>
          </div>

          {/* Verification Code Prompt (if Manual Verification required) */}
          {connectionState === 'pairing-verification' && (
            <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl space-y-3 text-left">
              <div className="flex items-center gap-2 text-amber-800 font-bold text-sm">
                <KeyRound className="w-4 h-4 text-amber-600" />
                <span>Receiver Verification Required</span>
              </div>
              <p className="text-xs text-amber-700 leading-relaxed">
                Enter the 4-digit verification code displayed on the receiver&apos;s screen:
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  maxLength={4}
                  value={pairingCodeInput}
                  onChange={(e) => setPairingCodeInput(e.target.value)}
                  placeholder="1234"
                  className="w-32 bg-white border border-amber-300 rounded-xl px-3 py-2 text-center text-lg font-mono font-bold tracking-widest text-slate-800"
                />
                <button
                  onClick={handleVerifyPairingCode}
                  className="bg-amber-600 hover:bg-amber-700 text-white font-bold px-4 py-2 rounded-xl text-xs transition-colors cursor-pointer"
                >
                  Verify &amp; Start
                </button>
              </div>
              {pairingError && <p className="text-xs font-semibold text-red-600">{pairingError}</p>}
            </div>
          )}

          {/* Progress Bar (during WebRTC or Cloud Transfer) */}
          {(connectionState === 'transferring' || connectionState === 'fallback') && (
            <div className="space-y-2 text-left">
              <div className="flex justify-between text-xs font-bold text-slate-600">
                <span className="truncate max-w-[200px]">{currentFileName || 'Transferring...'}</span>
                <span>{transferProgress}%</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden border border-slate-200">
                <div
                  className="bg-blue-600 h-full transition-all duration-300 ease-out"
                  style={{ width: `${transferProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Success State */}
          {connectionState === 'completed' && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-center gap-3 text-emerald-800 font-bold text-sm">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <span>Transfer Completed Successfully!</span>
            </div>
          )}

          {/* Share ID Display */}
          <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
              9-Digit Share ID
            </p>
            <p className="text-3xl font-extrabold text-blue-600 tracking-widest font-mono">
              {shareData.shareId.slice(0, 3)} {shareData.shareId.slice(3, 6)} {shareData.shareId.slice(6)}
            </p>
          </div>

          {/* Direct Share Link Copy Field */}
          <div className="space-y-2 text-left">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Direct Share Link
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={shareData.shareUrl}
                className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-mono text-slate-700 truncate"
              />
              <button
                onClick={handleCopyLink}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2.5 rounded-xl text-sm transition-colors shrink-0 cursor-pointer"
              >
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>

          {/* QR Code Section */}
          <div className="flex flex-col items-center justify-center p-4 bg-slate-50 border border-slate-200 rounded-2xl max-w-full">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
              Scan QR Code to Connect
            </p>
            <div className="p-3 bg-white rounded-xl shadow-xs border border-slate-200">
              <QRCodeComponent value={shareData.shareUrl} size={150} />
            </div>
          </div>

          {/* Cloud Fallback Button */}
          {connectionState !== 'completed' && (
            <div className="pt-2 border-t border-slate-200/80 space-y-2">
              <button
                onClick={handleCloudFallback}
                disabled={isCloudUploading}
                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-2 transition-colors border border-slate-300 cursor-pointer disabled:cursor-not-allowed"
              >
                <CloudUpload className="w-4 h-4 text-blue-600" />
                <span>{isCloudUploading ? 'Uploading to Cloud...' : 'Direct Connection Unavailable? Use Cloud Fallback'}</span>
              </button>
            </div>
          )}

          <button
            onClick={() => {
              setShareData(null);
              setSelectedFiles([]);
              setConnectionState('idle');
              setTransferProgress(0);
            }}
            className="text-sm font-semibold text-blue-600 hover:text-blue-700 underline pt-2 cursor-pointer"
          >
            Send Another File
          </button>
        </div>
      )}

      {/* Edit Sender Name Modal Popup */}
      {isNameModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-2xl max-w-sm w-full space-y-4 text-left">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold text-slate-900">Edit Sender Name</h3>
              <button
                type="button"
                onClick={() => setIsNameModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-600">Sender Device Name</label>
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
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 px-4 rounded-xl text-xs transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const clean = tempNameInput.trim() || getDefaultDeviceName();
                  setSenderName(clean);
                  localStorage.setItem('droplink_sender_name', clean);
                  setIsNameModalOpen(false);
                }}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition-colors shadow-xs cursor-pointer"
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
