import { supabase } from '../lib/supabase';
import { PlayCircle, X } from 'lucide-react';

interface MediaFile {
  id: string;
  file_path: string;
  file_type: 'image' | 'video' | 'audio';
  file_size: number;
}

export function MediaGalleries({ media, onDeleteMedia }: { media: MediaFile[], onDeleteMedia?: (media: MediaFile) => void }) {
  if (!media || media.length === 0) return null;

  const images = media.filter(m => m.file_type === 'image');
  const videos = media.filter(m => m.file_type === 'video');
  const audio = media.filter(m => m.file_type === 'audio');

  const getPublicUrl = (path: string) => supabase.storage.from('journal-media').getPublicUrl(path).data.publicUrl;

  const renderDeleteBtn = (m: MediaFile) => {
    if (!onDeleteMedia) return null;
    return (
      <button 
        onClick={() => onDeleteMedia(m)}
        className="absolute top-2 right-2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-red-500/90 text-white shadow-xl hover:bg-red-600 hover:scale-110 active:scale-95 transition-all backdrop-blur-md"
        title="Delete media"
      >
         <X className="h-4 w-4" />
      </button>
    );
  };

  return (
    <div className="mt-4 flex flex-col gap-4">
      {/* Images Grid */}
      {images.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {images.map(img => (
            <div key={img.id} className={`relative overflow-hidden rounded-xl bg-background shadow-sm border border-border group ${images.length === 1 ? 'aspect-video w-full max-w-md' : 'aspect-square w-24 sm:w-32'}`}>
              {renderDeleteBtn(img)}
              <img 
                src={getPublicUrl(img.file_path)} 
                alt="Journal entry attachment" 
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                loading="lazy"
              />
            </div>
          ))}
        </div>
      )}

      {/* Video Player */}
      {videos.map(vid => (
        <div key={vid.id} className="relative aspect-video w-full max-w-md overflow-hidden rounded-xl bg-black shadow-md border border-border">
          {renderDeleteBtn(vid)}
          <video 
            src={getPublicUrl(vid.file_path)} 
            controls 
            className="h-full w-full object-contain"
            preload="metadata"
          />
        </div>
      ))}

      {/* Audio Player */}
      {audio.map(aud => (
        <div key={aud.id} className="relative flex w-full max-w-md flex-col gap-2 rounded-xl bg-card p-4 border border-border shadow-sm">
          {renderDeleteBtn(aud)}
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <PlayCircle className="h-4 w-4 text-indigo-500" /> Audio Recording
          </div>
          <audio 
            src={getPublicUrl(aud.file_path)} 
            controls 
            className="h-10 w-full rounded-md outline-none"
          />
        </div>
      ))}
    </div>
  );
}
