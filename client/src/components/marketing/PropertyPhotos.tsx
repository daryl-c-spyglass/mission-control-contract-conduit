import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Camera, Upload, Lock, Trash2, ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

interface TransactionPhoto {
  id: string;
  transactionId: string;
  url: string;
  filename: string | null;
  source: 'mls' | 'off_market' | 'coming_soon' | 'uploaded';
  label: string | null;
  sortOrder: number | null;
  createdAt: string | null;
}

interface PropertyPhotosProps {
  transactionId: string;
}

export function PropertyPhotos({ transactionId }: PropertyPhotosProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);

  const { data: photos = [], isLoading } = useQuery<TransactionPhoto[]>({
    queryKey: ['transaction-photos', transactionId],
    queryFn: async () => {
      const res = await fetch(`/api/transactions/${transactionId}/transaction-photos`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch photos');
      return res.json();
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (photoId: string) => {
      const res = await fetch(`/api/transactions/${transactionId}/transaction-photos/${photoId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to delete photo');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transaction-photos', transactionId] });
      queryClient.invalidateQueries({ queryKey: ['/api/transactions', transactionId] });
      toast({
        title: "Photo deleted",
        description: "The photo has been removed from this transaction.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;

    setIsUploading(true);
    try {
      for (const file of Array.from(files)) {
        const reader = new FileReader();
        const imageData = await new Promise<string>((resolve, reject) => {
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        const res = await fetch(`/api/transactions/${transactionId}/photos`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            imageData,
            fileName: file.name,
          }),
        });

        if (!res.ok) {
          const error = await res.json();
          throw new Error(error.message || 'Upload failed');
        }
      }

      queryClient.invalidateQueries({ queryKey: ['transaction-photos', transactionId] });
      queryClient.invalidateQueries({ queryKey: ['/api/transactions', transactionId] });
      toast({
        title: "Photos uploaded",
        description: "Your photos have been added successfully.",
      });
    } catch (error: any) {
      toast({
        title: "Upload failed",
        description: error.message || "Failed to upload photos",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const mlsPhotos = photos.filter(p => p.source === 'mls');
  const userPhotos = photos.filter(p => p.source !== 'mls');

  const getSourceBadgeStyle = (source: string) => {
    switch (source) {
      case 'mls':
        return 'bg-blue-600 text-white';
      case 'coming_soon':
        return 'bg-orange-600 text-white';
      case 'off_market':
        return 'bg-purple-600 text-white';
      default:
        return 'bg-green-600 text-white';
    }
  };

  const getSourceLabel = (source: string) => {
    switch (source) {
      case 'mls':
        return 'MLS';
      case 'coming_soon':
        return 'Coming Soon';
      case 'off_market':
        return 'Off Market';
      default:
        return 'Uploaded';
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-40" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="aspect-[4/3] bg-gray-200 dark:bg-gray-700 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Camera className="h-5 w-5 text-orange-500" />
          Property Photos
        </h2>
        <label>
          <Button disabled={isUploading} className="cursor-pointer" data-testid="button-upload-photos">
            <Upload className="h-4 w-4 mr-2" />
            {isUploading ? 'Uploading...' : 'Upload Photos'}
          </Button>
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={handleUpload}
            className="hidden"
            data-testid="input-upload-photos"
          />
        </label>
      </div>

      {mlsPhotos.length > 0 && (
        <div>
          <div className="flex items-center gap-3 mb-3 flex-wrap">
            <h3 className="text-sm font-medium text-muted-foreground">MLS Photos</h3>
            <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded">
              {mlsPhotos.length} photos
            </span>
            <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded flex items-center gap-1">
              <Lock className="h-3 w-3" />
              Synced from MLS
            </span>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            These photos are pulled from MLS and cannot be removed
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {mlsPhotos.map(photo => (
              <div 
                key={photo.id} 
                className="relative group rounded-lg overflow-hidden aspect-[4/3] bg-muted"
                data-testid={`photo-mls-${photo.id}`}
              >
                <img 
                  src={photo.url} 
                  alt={photo.label || 'MLS Photo'} 
                  className="w-full h-full object-cover"
                />
                <span className={`absolute top-2 left-2 text-xs px-2 py-0.5 rounded ${getSourceBadgeStyle(photo.source)}`}>
                  {getSourceLabel(photo.source)}
                </span>
                <div className="absolute top-2 right-2 w-6 h-6 bg-black/50 rounded-full flex items-center justify-center">
                  <Lock className="h-3 w-3 text-gray-400" />
                </div>
                {photo.label && (
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                    <p className="text-xs text-white truncate">{photo.label}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="flex items-center gap-3 mb-3 flex-wrap">
          <h3 className="text-sm font-medium text-muted-foreground">Your Uploaded Photos</h3>
          <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded">
            {userPhotos.length} photos
          </span>
          {userPhotos.length > 0 && (
            <span className="text-xs bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 px-2 py-0.5 rounded flex items-center gap-1">
              <Upload className="h-3 w-3" />
              User Uploads
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          Hover over a photo and click the trash icon to remove it
        </p>
        
        {userPhotos.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {userPhotos.map(photo => (
              <div 
                key={photo.id} 
                className="relative group rounded-lg overflow-hidden aspect-[4/3] bg-muted border-2 border-green-500/50"
                data-testid={`photo-user-${photo.id}`}
              >
                <img 
                  src={photo.url} 
                  alt={photo.label || 'Uploaded Photo'} 
                  className="w-full h-full object-cover"
                />
                <span className={`absolute top-2 left-2 text-xs px-2 py-0.5 rounded ${getSourceBadgeStyle(photo.source)}`}>
                  {getSourceLabel(photo.source)}
                </span>
                
                <button
                  onClick={() => deleteMutation.mutate(photo.id)}
                  disabled={deleteMutation.isPending}
                  className="absolute top-2 right-2 w-7 h-7 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  data-testid={`button-delete-photo-${photo.id}`}
                >
                  <Trash2 className="h-4 w-4 text-white" />
                </button>
                
                {photo.label && (
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                    <p className="text-xs text-white truncate">{photo.label}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="border-2 border-dashed border-muted-foreground/30 rounded-lg p-8 text-center">
            <ImageIcon className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">No uploaded photos yet</p>
            <p className="text-muted-foreground/70 text-xs mt-1">
              Click "Upload Photos" to add your own photos
            </p>
          </div>
        )}
      </div>

      <div className="bg-muted/50 rounded-lg p-4">
        <h4 className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wide">
          Photo Types
        </h4>
        <div className="flex flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-blue-600 rounded" />
            <span className="text-sm">MLS Photos</span>
            <span className="text-xs text-muted-foreground">- Synced from MLS, cannot be removed</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-purple-600 rounded" />
            <span className="text-sm">Off Market</span>
            <span className="text-xs text-muted-foreground">- Added during creation</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-orange-600 rounded" />
            <span className="text-sm">Coming Soon</span>
            <span className="text-xs text-muted-foreground">- Added during creation</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-600 rounded" />
            <span className="text-sm">Uploaded</span>
            <span className="text-xs text-muted-foreground">- Added in Marketing tab</span>
          </div>
        </div>
      </div>
    </div>
  );
}
