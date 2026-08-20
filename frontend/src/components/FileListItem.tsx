"use client";

import React from 'react';
import { FileText, FileImage, FileCode, Archive, File, Trash2, Download } from 'lucide-react';

interface FileItemProps {
  file: {
    name: string;
    size: number;
    type?: string;
  };
  onRemove?: () => void;
  onDownload?: () => void;
  isDownloading?: boolean;
}

export const FileListItem: React.FC<FileItemProps> = ({
  file,
  onRemove,
  onDownload,
  isDownloading = false,
}) => {
  const formatSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const getFileIcon = (fileName: string, fileType?: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    if (['png', 'jpg', 'jpeg', 'svg', 'webp', 'gif'].includes(ext) || fileType?.startsWith('image/')) {
      return <FileImage className="w-5 h-5 text-blue-500" />;
    }
    if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) {
      return <Archive className="w-5 h-5 text-amber-500" />;
    }
    if (['js', 'ts', 'tsx', 'html', 'css', 'json', 'py'].includes(ext)) {
      return <FileCode className="w-5 h-5 text-emerald-500" />;
    }
    if (['pdf', 'doc', 'docx', 'txt'].includes(ext)) {
      return <FileText className="w-5 h-5 text-indigo-500" />;
    }
    return <File className="w-5 h-5 text-slate-400" />;
  };

  return (
    <div className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl hover:border-slate-300 transition-colors w-full overflow-hidden box-border">
      <div className="flex items-center gap-3 min-w-0 flex-1 pr-2">
        <div className="p-2 bg-white rounded-lg border border-slate-200 shrink-0">
          {getFileIcon(file.name, file.type)}
        </div>
        <div className="min-w-0 flex-1">
          {/* Strict truncation to prevent overflow */}
          <p className="text-sm font-semibold text-slate-800 truncate" title={file.name}>
            {file.name}
          </p>
          <p className="text-xs text-slate-500">{formatSize(file.size)}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {onDownload && (
          <button
            onClick={onDownload}
            disabled={isDownloading}
            className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors disabled:opacity-50"
            title="Download File"
          >
            <Download className="w-4 h-4" />
          </button>
        )}
        {onRemove && (
          <button
            onClick={onRemove}
            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
            title="Remove File"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};
