import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { supabase } from '../lib/supabase';
import { useToast } from '../contexts/ToastContext';
import { UploadCloud, Loader2 } from 'lucide-react';

export interface UploadedMedia {
  file_path: string;
  file_type: 'image' | 'video' | 'audio';
  url: string;
}

export function MediaUploader({ onFilesUploaded, onUploadError }: { onFilesUploaded: (files: UploadedMedia[]) => void, onUploadError?: (msg: string) => void }) {
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{current: number, total: number}>({current: 0, total: 0});

  const onDrop = useCallback(async (acceptedFiles: File[], rejectedFiles: any[]) => {
    if (rejectedFiles.length > 0) {
      if (onUploadError) onUploadError("Some files were rejected. Only images, video, and audio under 50MB are allowed.");
      else toast("Some files were rejected. Only images, video, and audio under 50MB are allowed.", "error");
    }
    
    if (acceptedFiles.length === 0) return;
    
    setIsUploading(true);
    setUploadProgress({ current: 0, total: acceptedFiles.length });
    
    let completed = 0;
    
    // Concurrent map instead of sequential loop
    const uploadPromises = acceptedFiles.map(async (file) => {
      let type: 'image' | 'video' | 'audio' | null = null;
      if (file.type.startsWith('image/')) type = 'image';
      else if (file.type.startsWith('video/')) type = 'video';
      else if (file.type.startsWith('audio/')) type = 'audio';
      else return null; // skip unsupported

      const fileExt = file.name.split('.').pop() || 'tmp';
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `${type}s/${fileName}`; // prefix by folder
      
      const { data, error } = await supabase.storage.from('journal-media').upload(filePath, file, {
        cacheControl: '8640000',
        upsert: false
      });
      
      completed++;
      setUploadProgress(prev => ({ ...prev, current: completed }));

      if (!error && data) {
        return {
          file_path: data.path,
          file_type: type,
          url: supabase.storage.from('journal-media').getPublicUrl(data.path).data.publicUrl
        } as UploadedMedia;
      }
      
      console.error("Upload Error:", error);
      return null;
    });

    const resultsRaw = await Promise.all(uploadPromises);
    const results = resultsRaw.filter(r => r !== null) as UploadedMedia[];

    onFilesUploaded(results);
    setIsUploading(false);
  }, [onFilesUploaded, onUploadError]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
    onDrop, 
    accept: {
      'image/*': [],
      'video/*': [],
      'audio/*': []
    },
    maxSize: 52428800 // 50MB
  });

  return (
    <div className="mt-4">
      <div 
        {...getRootProps()} 
        className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 transition-colors ${
          isDragActive 
            ? 'border-primary bg-primary/5 shadow-inner'
            : 'border-input bg-card hover:bg-muted/50'
        }`}
      >
        <input {...getInputProps()} />
        {isUploading ? (
          <div className="flex flex-col items-center text-indigo-600 dark:text-indigo-400">
             <Loader2 className="mb-3 h-8 w-8 animate-spin" />
             <p className="text-sm font-semibold">Uploading {uploadProgress.current} of {uploadProgress.total} files...</p>
          </div>
        ) : (
          <>
            <UploadCloud className={`mb-4 h-10 w-10 transition-colors ${isDragActive ? 'text-primary' : 'text-muted-foreground'}`} />
            <p className="mb-2 text-sm font-bold text-foreground font-sans">
              Drag & Drop Media files here
            </p>
            <p className="text-xs text-muted-foreground text-center font-sans">
              Support for Images (.jpg, .png), Video (.mov, .mp4), and Audio (.mp3, .m4a) up to 50MB. per file.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
