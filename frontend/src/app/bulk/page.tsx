"use client";

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Container } from '@/components/Container';
import { Users, QrCode, UploadCloud, Download, Trash2, ShieldCheck, CheckCircle2, AlertCircle, Copy, LogOut, FileText, ChevronDown, AlertTriangle, X } from 'lucide-react';
import { QRCodeSVG as QRCodeComponent } from 'qrcode.react';
import { socketClient } from '@/services/socketClient';
import { WebRTCPeerManager, WebRTCTransferProgress } from '@/utils/webrtc';
import { saveBulkFileBlob, getAllBulkFiles, deleteBulkFileBlob, clearSessionBlobs } from '@/utils/indexedDB';
import JSZip from 'jszip';
import axios from 'axios';
import { getApiUrl } from '@/config/api';

interface UserInfo {
  participantId: string;
  displayName: string;
  socketId: string;
}

interface ReceivedFileItem {
  fileId: string;
  fileName: string;
  size: number;
  displayName: string;
  mimeType: string;
  timestamp: number;
}

interface SubmittedFileItem {
  fileName: string;
  size: number;
  timestamp: number;
}

function formatFileSize(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const val = bytes / Math.pow(k, i);
  return `${parseFloat(val.toFixed(2))} ${sizes[i]}`;
}

function BulkPageContent() {
  const searchParams = useSearchParams();
  const codeFromUrl = searchParams.get('code') || '';

  // Mode Selection: 'select' | 'host' | 'user'
  const [activeRole, setActiveRole] = useState<'select' | 'host' | 'user'>('select');

  // User Form State
  const [userName, setUserName] = useState<string>('');
  const [bulkCodeInput, setBulkCodeInput] = useState<string>(codeFromUrl);
  const [userError, setUserError] = useState<string>('');
  const [joinedSession, setJoinedSession] = useState<{ sessionId: string; bulkCode: string } | null>(null);
  const [isCodeActive, setIsCodeActive] = useState<boolean | null>(null);
  const [isCheckingCode, setIsCheckingCode] = useState<boolean>(false);

  // Host Session State
  const [hostSession, setHostSession] = useState<{
    sessionId: string;
    bulkCode: string;
    shareUrl: string;
  } | null>(null);
  const [hostError, setHostError] = useState<string>('');
  const [connectedUsers, setConnectedUsers] = useState<UserInfo[]>([]);
  const [receivedFiles, setReceivedFiles] = useState<ReceivedFileItem[]>([]);
  const [copySuccess, setCopySuccess] = useState(false);

  // User Upload State
  const [selectedUserFiles, setSelectedUserFiles] = useState<File[]>([]);
  const [uploadProgressMap, setUploadProgressMap] = useState<Record<string, number>>({});
  const [userUploadStatus, setUserUploadStatus] = useState<string>('');
  const [submittedUserFiles, setSubmittedUserFiles] = useState<SubmittedFileItem[]>([]);

  // Common State
  const [sessionEndedMessage, setSessionEndedMessage] = useState<string | null>(null);
  const [isUsersDropdownOpen, setIsUsersDropdownOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);

  const rtcManagerRef = useRef<WebRTCPeerManager | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const usersDropdownRef = useRef<HTMLDivElement>(null);
  const hostPeersRef = useRef<Map<string, WebRTCPeerManager>>(new Map());
  const peerIceQueueRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());

  const triggerDuplicateWarning = (duplicateNames: string[]) => {
    const names = duplicateNames.map((n) => `'${n}'`).join(', ');
    setDuplicateWarning(`Duplicate file${duplicateNames.length > 1 ? 's' : ''} ${names} skipped.`);
    setTimeout(() => setDuplicateWarning(null), 3000);
  };

  // Prevent browser default file open behavior on drop globally
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
      const droppedFiles = Array.from(e.dataTransfer.files);
      setSelectedUserFiles((prev) => {
        const existingKeys = new Set(prev.map((f) => `${f.name}_${f.size}`));
        const duplicates = droppedFiles.filter((f) => existingKeys.has(`${f.name}_${f.size}`));
        const uniqueDropped = droppedFiles.filter((f) => !existingKeys.has(`${f.name}_${f.size}`));

        if (duplicates.length > 0) {
          triggerDuplicateWarning(duplicates.map((f) => f.name));
        }
        return [...prev, ...uniqueDropped];
      });
    }
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (usersDropdownRef.current && !usersDropdownRef.current.contains(event.target as Node)) {
        setIsUsersDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Auto-detect name from localStorage & auto-fill code from URL
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedName = localStorage.getItem('droplink_user_name');
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (savedName) setUserName(savedName);

      if (codeFromUrl) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setBulkCodeInput(codeFromUrl);
      }
    }
  }, [codeFromUrl]);

  // Validate 9-digit Bulk Code automatically
  useEffect(() => {
    const cleanedCode = bulkCodeInput.replace(/\s+/g, '').trim();

    if (cleanedCode.length === 9) {
      let isMounted = true;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsCheckingCode(true);

      const apiUrl = getApiUrl();
      axios
        .get(`${apiUrl}/bulk/sessions/${cleanedCode}`)
        .then((res) => {
          if (isMounted) {
            if (res.data?.success && res.data?.data?.status === 'ACTIVE') {
              setIsCodeActive(true);
              setUserError('');
            } else {
              setIsCodeActive(false);
            }
          }
        })
        .catch(() => {
          if (isMounted) setIsCodeActive(false);
        })
        .finally(() => {
          if (isMounted) setIsCheckingCode(false);
        });

      return () => {
        isMounted = false;
      };
    } else {
      setIsCodeActive(null);
      setIsCheckingCode(false);
    }
  }, [bulkCodeInput]);

  const userPendingIceRef = useRef<RTCIceCandidateInit[]>([]);
  const hostPendingIceRef = useRef<RTCIceCandidateInit[]>([]);

  // Host Heartbeat & Socket Listener Setup
  useEffect(() => {
    if (!hostSession) return;

    const socket = socketClient.getSocket();
    socket.emit('bulk-host-register', { sessionId: hostSession.sessionId });

    // Host Heartbeat every 5 seconds
    heartbeatIntervalRef.current = setInterval(() => {
      socket.emit('bulk-host-heartbeat', { sessionId: hostSession.sessionId });
    }, 5000);

    // Listen for user joining (deduplicate by normalized displayName or socketId)
    socket.on('bulk-student-joined', (data: UserInfo) => {
      setConnectedUsers((prev) => {
        const normalizedName = data.displayName.trim().toLowerCase();
        const filtered = prev.filter(
          (s) =>
            s.displayName.trim().toLowerCase() !== normalizedName &&
            s.socketId !== data.socketId &&
            s.participantId !== data.participantId
        );
        return [...filtered, data];
      });
    });

    // Listen for user leaving
    socket.on('bulk-student-left', (data: { socketId: string; participantId?: string; displayName?: string }) => {
      setConnectedUsers((prev) =>
        prev.filter((s) => s.socketId !== data.socketId && s.participantId !== data.participantId)
      );
    });

    // Handle user WebRTC offer to Host (create fresh peer connection per transfer)
    socket.on('bulk-webrtc-offer', async (data: { senderSocketId: string; offer: RTCSessionDescriptionInit; studentName?: string; participantId?: string }) => {
      if (!data?.offer || !data?.senderSocketId) return;

      try {
        // Clean up previous connection for this sender socket if any
        if (hostPeersRef.current.has(data.senderSocketId)) {
          hostPeersRef.current.get(data.senderSocketId)?.close();
          hostPeersRef.current.delete(data.senderSocketId);
        }

        const peerManager = new WebRTCPeerManager();
        hostPeersRef.current.set(data.senderSocketId, peerManager);
        const pc = peerManager.getPeerConnection();

        pc.onicecandidate = (evt) => {
          if (evt.candidate) {
            socket.emit('bulk-webrtc-ice-candidate', {
              sessionId: hostSession.sessionId,
              targetSocketId: data.senderSocketId,
              candidate: evt.candidate,
            });
          }
        };

        pc.ondatachannel = (event) => {
          const channel = event.channel;
          channel.binaryType = 'arraybuffer';

          let currentFileId: string | null = null;
          const transferMap = new Map<
            string,
            {
              fileId: string;
              fileName: string;
              mimeType: string;
              size: number;
              studentName: string;
              chunks: ArrayBuffer[];
            }
          >();

          channel.onmessage = async (evt) => {
            if (typeof evt.data === 'string') {
              try {
                const parsed = JSON.parse(evt.data);
                if (parsed.type === 'header') {
                  const resolvedName =
                    parsed.studentName ||
                    parsed.displayName ||
                    parsed.userName ||
                    data.studentName ||
                    'Student';
                  const fileId =
                    parsed.fileId ||
                    `bulk_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

                  currentFileId = fileId;
                  transferMap.set(fileId, {
                    fileId,
                    fileName: parsed.fileName,
                    mimeType: parsed.mimeType || 'application/octet-stream',
                    size: parsed.size || parsed.fileSize || 0,
                    studentName: resolvedName,
                    chunks: [],
                  });
                } else if (parsed.type === 'eof') {
                  const targetId = parsed.fileId || currentFileId;
                  if (targetId && transferMap.has(targetId)) {
                    const record = transferMap.get(targetId)!;
                    const blob = new Blob(record.chunks, { type: record.mimeType });

                    await saveBulkFileBlob({
                      fileId: record.fileId,
                      sessionId: hostSession.sessionId,
                      fileName: record.fileName,
                      mimeType: record.mimeType,
                      size: record.size,
                      blob,
                      displayName: record.studentName,
                    });

                    setReceivedFiles((prev) => [
                      {
                        fileId: record.fileId,
                        fileName: record.fileName,
                        size: record.size,
                        displayName: record.studentName,
                        mimeType: record.mimeType,
                        timestamp: Date.now(),
                      },
                      ...prev,
                    ]);

                    transferMap.delete(targetId);
                  }
                }
              } catch (err) {
                console.error('Error processing DataChannel message:', err);
              }
            } else if (evt.data instanceof ArrayBuffer && currentFileId) {
              const fileRecord = transferMap.get(currentFileId);
              if (fileRecord) {
                fileRecord.chunks.push(evt.data);
              }
            }
          };
        };

        await pc.setRemoteDescription(new RTCSessionDescription(data.offer));

        // Process any queued ICE candidates for this senderSocketId
        const pendingIce = peerIceQueueRef.current.get(data.senderSocketId) || [];
        while (pendingIce.length > 0) {
          const cand = pendingIce.shift();
          if (cand) {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(cand));
            } catch (e) {}
          }
        }
        peerIceQueueRef.current.delete(data.senderSocketId);

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        socket.emit('bulk-webrtc-answer', {
          sessionId: hostSession.sessionId,
          targetSocketId: data.senderSocketId,
          answer,
        });
      } catch (err) {
        console.error('Host failed WebRTC offer processing:', err);
      }
    });

    socket.on('bulk-webrtc-ice-candidate', async (data: { senderSocketId?: string; candidate: RTCIceCandidateInit }) => {
      if (!data?.candidate) return;
      const senderId = data.senderSocketId;

      if (senderId && hostPeersRef.current.has(senderId)) {
        const pm = hostPeersRef.current.get(senderId)!;
        const pc = pm.getPeerConnection();
        if (pc.remoteDescription && pc.remoteDescription.type) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
          } catch (e) {}
        } else {
          const queue = peerIceQueueRef.current.get(senderId) || [];
          queue.push(data.candidate);
          peerIceQueueRef.current.set(senderId, queue);
        }
      }
    });

    return () => {
      if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
      socket.off('bulk-student-joined');
      socket.off('bulk-student-left');
      socket.off('bulk-webrtc-offer');
      socket.off('bulk-webrtc-ice-candidate');

      hostPeersRef.current.forEach((pm) => pm.close());
      hostPeersRef.current.clear();
      peerIceQueueRef.current.clear();
    };
  }, [hostSession]);

  // User Session Listener
  useEffect(() => {
    if (!joinedSession) return;

    const socket = socketClient.getSocket();

    socket.on('bulk-session-ended', (data: { message?: string }) => {
      setSessionEndedMessage(data.message || 'The host has closed the session or lost connection.');
      setJoinedSession(null);
      setActiveRole('select');

      setTimeout(() => {
        setSessionEndedMessage(null);
      }, 4000);
    });

    const processUserPendingIce = async () => {
      if (rtcManagerRef.current) {
        const pc = rtcManagerRef.current.getPeerConnection();
        while (userPendingIceRef.current.length > 0) {
          const cand = userPendingIceRef.current.shift();
          if (cand) {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(cand));
            } catch (e) {
              console.error('Error adding queued user ICE candidate:', e);
            }
          }
        }
      }
    };

    socket.on('bulk-webrtc-answer', async (data: { answer: RTCSessionDescriptionInit }) => {
      if (rtcManagerRef.current) {
        try {
          const pc = rtcManagerRef.current.getPeerConnection();
          await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
          await processUserPendingIce();
        } catch (err) {
          console.error('User answer error:', err);
        }
      }
    });

    socket.on('bulk-webrtc-ice-candidate', async (data: { candidate: RTCIceCandidateInit }) => {
      if (rtcManagerRef.current) {
        try {
          const pc = rtcManagerRef.current.getPeerConnection();
          if (pc.remoteDescription && pc.remoteDescription.type) {
            await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
          } else {
            userPendingIceRef.current.push(data.candidate);
          }
        } catch (err) {
          console.error('User ICE error:', err);
        }
      }
    });

    return () => {
      socket.off('bulk-session-ended');
      socket.off('bulk-webrtc-answer');
      socket.off('bulk-webrtc-ice-candidate');
    };
  }, [joinedSession]);

  // Host Action: Create Session
  const handleCreateHostSession = async () => {
    try {
      setHostError('');
      setConnectedUsers([]);
      setReceivedFiles([]);
      setIsUsersDropdownOpen(false);
      const socket = socketClient.getSocket();
      const apiUrl = getApiUrl();
      const res = await axios.post(`${apiUrl}/bulk/sessions`, {
        hostSocketId: socket.id,
      });

      const { sessionId, bulkCode, shareUrl } = res.data.data;
      setHostSession({ sessionId, bulkCode, shareUrl });
      setActiveRole('host');
    } catch (err: unknown) {
      console.error('Failed to create bulk session:', err);
      const message = axios.isAxiosError(err)
        ? err.response?.data?.error?.message || err.message
        : 'Failed to create bulk session';
      setHostError(message || 'Failed to create bulk session.');
    }
  };

  // User Action: Join Session
  const handleUserJoin = async (e?: React.FormEvent | React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const cleanCode = bulkCodeInput.replace(/\s+/g, '').replace(/-/g, '').trim();

    if (!userName.trim()) {
      setUserError('Please enter your name.');
      return;
    }
    if (!cleanCode) {
      setUserError('Please enter a valid 9-digit Bulk Code.');
      return;
    }

    setUserError('');

    try {
      localStorage.setItem('droplink_user_name', userName.trim());
      const apiUrl = getApiUrl();
      const socket = socketClient.getSocket();

      const res = await axios.post(`${apiUrl}/bulk/sessions/${cleanCode}/join`, {
        displayName: userName.trim(),
        socketId: socket.id,
      });

      const data = res.data.data;
      setJoinedSession({ sessionId: data.sessionId, bulkCode: data.bulkCode });
      setSubmittedUserFiles([]);

      socket.emit('bulk-student-join', {
        sessionId: data.sessionId,
        displayName: userName.trim(),
        participantId: data.participantId,
      });

      setActiveRole('user');
    } catch (err: unknown) {
      const message = axios.isAxiosError(err) ? err.response?.data?.error?.message : 'Failed to join session';
      setUserError(message || 'Failed to join bulk session.');
    }
  };

  // User Action: Upload Files to Host via WebRTC
  const handleUserUpload = async () => {
    if (selectedUserFiles.length === 0 || !joinedSession) return;

    setUserUploadStatus('Establishing P2P DataChannel to Host...');
    const socket = socketClient.getSocket();

    try {
      const manager = new WebRTCPeerManager();
      rtcManagerRef.current = manager;
      const pc = manager.getPeerConnection();

      pc.onicecandidate = (evt) => {
        if (evt.candidate) {
          socket.emit('bulk-webrtc-ice-candidate', {
            sessionId: joinedSession.sessionId,
            candidate: evt.candidate,
          });
        }
      };

      const dc = manager.createDataChannel('bulkFileTransfer');

      dc.onopen = async () => {
        setUserUploadStatus('Connected! Streaming files to Host...');
        const newlyTransferred: SubmittedFileItem[] = [];

        for (let i = 0; i < selectedUserFiles.length; i++) {
          const file = selectedUserFiles[i];
          const fileId = `bulk_file_${i}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

          await manager.sendFile(
            file,
            fileId,
            (prog: WebRTCTransferProgress) => {
              setUploadProgressMap((prev) => ({ ...prev, [file.name]: prog.percentage }));
            },
            {
              studentName: userName.trim(),
              displayName: userName.trim(),
              userName: userName.trim(),
            }
          );

          setUploadProgressMap((prev) => ({ ...prev, [file.name]: 100 }));
          newlyTransferred.push({
            fileName: file.name,
            size: file.size,
            timestamp: Date.now(),
          });
        }

        setUserUploadStatus('All files transferred to Host successfully!');
        setSubmittedUserFiles((prev) => [...newlyTransferred, ...prev]);

        setTimeout(() => {
          setSelectedUserFiles([]);
          setUploadProgressMap({});
        }, 1500);
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      socket.emit('bulk-webrtc-offer', {
        sessionId: joinedSession.sessionId,
        offer,
        studentName: userName.trim(),
      });
    } catch (err) {
      console.error('User Bulk WebRTC error:', err);
      setUserUploadStatus('Upload failed. Please retry.');
    }
  };

  // Host Action: Download Single File from IndexedDB
  const handleDownloadSingleFile = async (fileItem: ReceivedFileItem) => {
    const record = await getAllBulkFiles(hostSession?.sessionId || '');
    const target = record.find((r) => r.fileId === fileItem.fileId);

    if (target) {
      const url = URL.createObjectURL(target.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = target.fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  // Host Action: Delete Single File
  const handleDeleteSingleFile = async (fileId: string) => {
    await deleteBulkFileBlob(fileId);
    setReceivedFiles((prev) => prev.filter((f) => f.fileId !== fileId));
  };

  // Host Action: Download All Files as ZIP
  const handleDownloadAllZip = async () => {
    if (!hostSession) return;
    const records = await getAllBulkFiles(hostSession.sessionId);

    if (records.length === 0) return;

    const zip = new JSZip();
    records.forEach((file) => {
      const folderName = file.displayName ? `${file.displayName.replace(/[^a-zA-Z0-9]/g, '_')}` : 'General';
      zip.folder(folderName)?.file(file.fileName, file.blob);
    });

    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Bulk_Files_${hostSession.bulkCode}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Host Action: Delete All Files
  const handleDeleteAllFiles = async () => {
    if (!hostSession) return;
    await clearSessionBlobs(hostSession.sessionId);
    setReceivedFiles([]);
  };

  // Host Action: End Session
  const handleEndHostSession = async () => {
    if (!hostSession) return;
    const socket = socketClient.getSocket();
    socket.emit('bulk-end-session', { sessionId: hostSession.sessionId });
    await clearSessionBlobs(hostSession.sessionId);
    setHostSession(null);
    setConnectedUsers([]);
    setReceivedFiles([]);
    setIsUsersDropdownOpen(false);
    setActiveRole('select');
  };

  const handleCopyLink = () => {
    if (hostSession?.shareUrl) {
      navigator.clipboard.writeText(hostSession.shareUrl);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }
  };

  return (
    <Container maxWidth="7xl" className="py-6 space-y-6">
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

      {/* Top Header */}
      <div className="text-center space-y-2">
        <div className="w-12 h-12 rounded-2xl bg-purple-100 text-purple-600 flex items-center justify-center mx-auto mb-2 shadow-xs border border-purple-200">
          <Users className="w-6 h-6 stroke-[2]" />
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
          Bulk Transfer Mode
        </h1>
        <p className="text-xs sm:text-sm text-slate-600 max-w-xl mx-auto">
          Fast browser-to-host file collection for classrooms, presentations &amp; shared PCs. No logins or cloud limits.
        </p>
      </div>

      {/* Session Ended Alert Banner */}
      {sessionEndedMessage && (
        <div className="max-w-2xl mx-auto bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center justify-between text-amber-900">
          <div className="flex items-center gap-3 text-sm font-semibold">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
            <span>{sessionEndedMessage}</span>
          </div>
          <button
            onClick={() => setSessionEndedMessage(null)}
            className="text-xs font-bold text-amber-700 underline shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* HOST DASHBOARD VIEW */}
      {activeRole === 'host' && hostSession && (
        <div className="space-y-6 max-w-6xl mx-auto">
          {/* Top Session Details Banner */}
          <div className="bg-[#FCFBFE] rounded-3xl p-6 border border-purple-200 shadow-md grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
            {/* Left: 9-Digit Code & QR */}
            <div className="lg:col-span-7 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-purple-100 text-purple-700 text-xs font-bold rounded-full">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Bulk Transfer Host Active</span>
                </div>
                <button
                  onClick={handleEndHostSession}
                  className="bg-slate-900 hover:bg-slate-800 text-white font-bold py-2 px-3.5 rounded-xl text-xs flex items-center gap-1.5 transition-colors shadow-2xs"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>End Bulk Transfer</span>
                </button>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">9-Digit Bulk Code</p>
                <p className="text-4xl sm:text-5xl font-extrabold text-purple-600 font-mono tracking-widest pt-1">
                  {hostSession.bulkCode.slice(0, 3)} {hostSession.bulkCode.slice(3, 6)} {hostSession.bulkCode.slice(6)}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={hostSession.shareUrl}
                  className="flex-1 bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono text-slate-700 truncate"
                />
                <button
                  onClick={handleCopyLink}
                  className="bg-purple-600 hover:bg-purple-700 text-white font-bold px-3 py-2 rounded-xl text-xs flex items-center gap-1 shrink-0"
                >
                  <Copy className="w-3.5 h-3.5" />
                  {copySuccess ? 'Copied!' : 'Copy Link'}
                </button>
              </div>
            </div>

            {/* Right: QR Code Display */}
            <div className="lg:col-span-5 flex flex-col items-center justify-center border-t lg:border-t-0 lg:border-l border-slate-200 pt-4 lg:pt-0 pl-0 lg:pl-6">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Scan QR Code to Join</p>
              <div className="p-3 bg-white rounded-2xl shadow-xs border border-slate-200">
                <QRCodeComponent value={hostSession.shareUrl} size={140} />
              </div>
            </div>
          </div>

          {/* Host Controls & Stats */}
          <div className="flex flex-wrap items-center justify-between gap-4 bg-white rounded-2xl p-4 border border-slate-200 shadow-xs relative">
            <div className="flex flex-wrap items-center gap-6 text-sm font-semibold text-slate-700">
              {/* Connected Users Dropdown */}
              <div className="relative" ref={usersDropdownRef}>
                <button
                  onClick={() => setIsUsersDropdownOpen((prev) => !prev)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 text-slate-800 transition-colors border border-purple-200/80 cursor-pointer select-none"
                >
                  <Users className="w-4 h-4 text-purple-600" />
                  <span>
                    Connected Users: <strong className="text-purple-600">{connectedUsers.length}</strong>
                  </span>
                  <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform duration-200 ${isUsersDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Floating Dropdown Menu */}
                {isUsersDropdownOpen && (
                  <div className="absolute top-full left-0 mt-2 w-72 bg-white rounded-2xl border border-slate-200 shadow-xl z-50 p-3 space-y-2">
                    <div className="flex items-center justify-between px-1 pb-2 border-b border-slate-100">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        Connected Participants ({connectedUsers.length})
                      </span>
                    </div>

                    {connectedUsers.length === 0 ? (
                      <div className="py-4 text-center text-xs text-slate-400 space-y-1">
                        <Users className="w-6 h-6 mx-auto opacity-40 text-slate-400" />
                        <p className="font-medium">No users connected yet.</p>
                        <p className="text-2xs text-slate-400">Share 9-digit code or QR to invite users.</p>
                      </div>
                    ) : (
                      <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
                        {connectedUsers.map((user) => (
                          <div
                            key={user.socketId || user.participantId}
                            className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-200/70 text-xs"
                          >
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                              <span className="font-bold text-slate-900 truncate max-w-[150px]">
                                {user.displayName}
                              </span>
                            </div>
                            <span className="text-2xs font-semibold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
                              Active
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <span>Files Received: <strong className="text-emerald-600">{receivedFiles.length}</strong></span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleDownloadAllZip}
                disabled={receivedFiles.length === 0}
                className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold py-2 px-4 rounded-xl text-xs flex items-center gap-1.5 transition-colors shadow-2xs"
              >
                <Download className="w-4 h-4" />
                <span>Download All (ZIP)</span>
              </button>

              <button
                onClick={handleDeleteAllFiles}
                disabled={receivedFiles.length === 0}
                className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 disabled:opacity-50 font-bold py-2 px-3 rounded-xl text-xs flex items-center gap-1 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete All</span>
              </button>
            </div>
          </div>

          {/* Received Files Table / List */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-md space-y-4">
            <h3 className="text-base font-extrabold text-slate-900">Received User Files</h3>

            {receivedFiles.length === 0 ? (
              <div className="text-center py-10 space-y-2 text-slate-400">
                <FileText className="w-10 h-10 mx-auto opacity-50" />
                <p className="text-sm font-medium">No files received yet. Users can scan QR or use Bulk Code to upload.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-bold border-b border-slate-200">
                    <tr>
                      <th className="p-3">User Name</th>
                      <th className="p-3">File Name</th>
                      <th className="p-3">Size</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {receivedFiles.map((file, idx) => (
                      <tr key={`${file.fileId}_${idx}`} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-3 font-bold text-slate-900">{file.displayName}</td>
                        <td className="p-3 font-mono truncate max-w-xs">{file.fileName}</td>
                        <td className="p-3 text-slate-500 font-mono">{formatFileSize(file.size)}</td>
                        <td className="p-3 text-right space-x-2">
                          <button
                            onClick={() => handleDownloadSingleFile(file)}
                            className="bg-blue-50 text-blue-600 hover:bg-blue-100 font-bold px-3 py-1.5 rounded-lg transition-colors"
                          >
                            Download
                          </button>
                          <button
                            onClick={() => handleDeleteSingleFile(file.fileId)}
                            className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            title="Delete file"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Role Selection Screen */}
      {activeRole === 'select' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {/* Option A: Join Bulk Session (Left) */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-md space-y-5 relative overflow-hidden">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-2xl font-extrabold text-slate-900">Join Bulk Session</h2>
                {isCodeActive === true && (
                  <span className="flex items-center gap-1.5 px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-extrabold rounded-full border border-emerald-300 shadow-2xs shrink-0">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    Ready to Join
                  </span>
                )}
              </div>
              <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
                Enter your name and the 9-digit Bulk Code to submit your files to the Host.
              </p>
            </div>

            <form onSubmit={handleUserJoin} className="space-y-4">
              <div className="space-y-1 text-left">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-600">What is your name?</label>
                <input
                  type="text"
                  placeholder="e.g. Om Deshmukh"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 focus:bg-white transition-all"
                />
              </div>

              <div className="space-y-1 text-left">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-600">9-Digit Bulk Code</label>
                <div className="relative flex items-center">
                  <input
                    type="text"
                    placeholder="e.g. 482 917 635"
                    value={bulkCodeInput}
                    onChange={(e) => setBulkCodeInput(e.target.value)}
                    className={`w-full bg-slate-50 border rounded-xl pl-3.5 ${
                      isCodeActive === true
                        ? 'pr-10 border-emerald-500 bg-emerald-50/20 focus:border-emerald-600 focus:bg-white'
                        : isCodeActive === false
                        ? 'pr-10 border-rose-300 bg-rose-50/20 focus:border-rose-500'
                        : 'pr-3.5 border-slate-300 focus:bg-white'
                    } py-2.5 text-sm font-mono text-slate-800 transition-all`}
                  />
                  {isCheckingCode && (
                    <div className="absolute right-3 w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                  )}
                  {!isCheckingCode && isCodeActive === true && (
                    <CheckCircle2 className="absolute right-3 w-5 h-5 text-emerald-500 stroke-[2.2] animate-in zoom-in duration-150" />
                  )}
                </div>
              </div>

              {userError && <p className="text-xs font-semibold text-red-600">{userError}</p>}

              <button
                type="submit"
                onClick={handleUserJoin}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 px-6 rounded-2xl shadow-md transition-all text-sm cursor-pointer"
              >
                Join &amp; Upload
              </button>
            </form>
          </div>

          {/* Option B: Host a Session (Right) */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-md flex flex-col justify-between space-y-6">
            <div className="space-y-3">
              <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-2xl flex items-center justify-center">
                <QrCode className="w-6 h-6" />
              </div>
              <h2 className="text-2xl font-extrabold text-slate-900">Host a Session</h2>
              <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
                Projector PC or Host screen. Generates a 9-digit Bulk Code &amp; QR for users to upload files directly to your browser.
              </p>
            </div>
            {hostError && <p className="text-xs font-semibold text-red-600">{hostError}</p>}
            <button
              type="button"
              onClick={handleCreateHostSession}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3.5 px-6 rounded-2xl shadow-md transition-all text-sm flex items-center justify-center gap-2 cursor-pointer"
            >
              Start Host Session
            </button>
          </div>
        </div>
      )}



      {/* USER UPLOAD VIEW */}
      {activeRole === 'user' && joinedSession && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 max-w-6xl mx-auto items-start">
          {/* Left Column (Upload Model): col-span-7 */}
          <div className="lg:col-span-7 bg-white rounded-3xl p-6 sm:p-7 border border-slate-200 shadow-md space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <div>
                <span className="text-xs font-bold text-purple-600 uppercase tracking-wider">User Upload Mode</span>
                <h2 className="text-xl font-extrabold text-slate-900">{userName}</h2>
              </div>
              <div className="text-right">
                <span className="text-xs text-slate-400">Connected to Bulk Code</span>
                <p className="text-sm font-mono font-bold text-purple-600">{joinedSession.bulkCode}</p>
              </div>
            </div>

            {/* Upload Dropzone */}
            <label
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer transition-all text-center group block ${
                isDragging
                  ? 'border-purple-600 bg-purple-100/70 scale-[1.01] shadow-md'
                  : 'border-purple-200 hover:border-purple-500 bg-purple-50/40 hover:bg-purple-50'
              }`}
            >
              <div className="w-14 h-14 bg-white text-purple-600 rounded-2xl flex items-center justify-center shadow-xs border border-purple-100 mb-3 group-hover:scale-105 transition-transform">
                <UploadCloud className="w-7 h-7 stroke-[1.75]" />
              </div>
              <p className="text-sm font-bold text-slate-800 mb-1">Click to select files or drop here</p>
              <p className="text-xs text-slate-500">Supports PDF, ZIP, Images, Docs &amp; Videos</p>
              <input
                type="file"
                multiple
                onChange={(e) => {
                  if (e.target.files) {
                    const selectedFiles = Array.from(e.target.files!);
                    setSelectedUserFiles((prev) => {
                      const existingKeys = new Set(prev.map((f) => `${f.name}_${f.size}`));
                      const duplicates = selectedFiles.filter((f) => existingKeys.has(`${f.name}_${f.size}`));
                      const uniqueSelected = selectedFiles.filter((f) => !existingKeys.has(`${f.name}_${f.size}`));

                      if (duplicates.length > 0) {
                        triggerDuplicateWarning(duplicates.map((f) => f.name));
                      }
                      return [...prev, ...uniqueSelected];
                    });
                    e.target.value = '';
                  }
                }}
                className="hidden"
              />
            </label>

            {userUploadStatus && (
              <div className="p-3 bg-purple-50 text-purple-800 rounded-xl text-xs font-semibold text-center">
                {userUploadStatus}
              </div>
            )}

            {/* Submit Action Button */}
            <button
              onClick={handleUserUpload}
              disabled={selectedUserFiles.length === 0}
              className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold py-3.5 px-6 rounded-2xl shadow-md transition-all text-sm cursor-pointer disabled:cursor-not-allowed"
            >
              Submit Files to Host
            </button>
          </div>

          {/* Right Column (Selected Files & Upload History): col-span-5 */}
          <div className="lg:col-span-5 bg-white rounded-3xl p-6 sm:p-7 border border-slate-200 shadow-md space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Selected Files ({selectedUserFiles.length})
              </h3>
              {selectedUserFiles.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedUserFiles([])}
                  className="text-2xs font-bold text-rose-600 hover:text-rose-700 hover:underline cursor-pointer"
                >
                  Clear All
                </button>
              )}
            </div>

            {selectedUserFiles.length === 0 ? (
              <div className="text-center py-12 space-y-2 text-slate-400 border-2 border-dashed border-slate-100 rounded-2xl">
                <FileText className="w-9 h-9 mx-auto opacity-30 text-purple-500" />
                <p className="text-xs font-semibold text-slate-600">No files selected yet.</p>
                <p className="text-2xs text-slate-400">Click or drop files in the box on the left.</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
                {selectedUserFiles.map((file, idx) => (
                  <div key={idx} className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs space-y-1.5 shadow-2xs">
                    <div className="flex items-center justify-between font-bold text-slate-800">
                      <span className="truncate max-w-[180px]">{file.name}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span>{uploadProgressMap[file.name] || 0}%</span>
                        <button
                          type="button"
                          onClick={() => setSelectedUserFiles((prev) => prev.filter((_, i) => i !== idx))}
                          className="text-slate-400 hover:text-rose-600 transition-colors p-0.5 rounded-md cursor-pointer"
                          title="Remove file"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-purple-600 h-full transition-all duration-300"
                        style={{ width: `${uploadProgressMap[file.name] || 0}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Successfully Submitted Files History */}
            {submittedUserFiles.length > 0 && (
              <div className="space-y-3 pt-4 border-t border-slate-200/80">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Submitted Files ({submittedUserFiles.length})</span>
                  </h3>
                  <span className="text-2xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                    Received by Host
                  </span>
                </div>

                <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                  {submittedUserFiles.map((file, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between bg-emerald-50/60 p-3 rounded-xl border border-emerald-200/80 text-xs"
                    >
                      <div className="flex items-center gap-2.5 truncate max-w-[180px]">
                        <FileText className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span className="font-bold text-slate-800 truncate">{file.fileName}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-slate-500 font-mono">{formatFileSize(file.size)}</span>
                        <span className="flex items-center gap-1 text-2xs font-bold text-emerald-700 bg-white px-2 py-0.5 rounded-lg border border-emerald-200 shadow-2xs">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          Sent
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </Container>
  );
}

export default function BulkPage() {
  return (
    <Suspense fallback={<div className="py-12 text-center text-slate-500 font-semibold">Loading Bulk Transfer...</div>}>
      <BulkPageContent />
    </Suspense>
  );
}
