import { useState, useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileUp, Trash2, FileText, Image, Loader2, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { CmaBrochure } from "@shared/schema";

interface ListingBrochureContentProps {
  cmaId: string;
  brochure: CmaBrochure | null;
  onChange: (brochure: CmaBrochure | null) => void;
  subjectProperty?: any;
}

export function ListingBrochureContent({
  cmaId,
  brochure,
  onChange,
  subjectProperty,
}: ListingBrochureContentProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      setIsUploading(true);
      
      const urlResponse = await apiRequest('POST', '/api/uploads/request-url', {
        name: file.name,
        size: file.size,
        contentType: file.type,
      });
      const { uploadURL, objectPath } = await urlResponse.json();

      await fetch(uploadURL, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type },
      });

      const isPdf = file.type === 'application/pdf';
      const saveBrochureResponse = await apiRequest('POST', `/api/cmas/${cmaId}/brochure`, {
        url: objectPath,
        filename: file.name,
        type: isPdf ? 'pdf' : 'image',
        generated: false,
      });
      
      return saveBrochureResponse.json();
    },
    onSuccess: (savedBrochure) => {
      onChange(savedBrochure);
      toast({ title: 'Brochure uploaded', description: 'Your brochure has been saved' });
    },
    onError: (error: any) => {
      toast({ 
        title: 'Upload failed', 
        description: error.message || 'Failed to upload brochure',
        variant: 'destructive' 
      });
    },
    onSettled: () => {
      setIsUploading(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest('DELETE', `/api/cmas/${cmaId}/brochure`);
    },
    onSuccess: () => {
      onChange(null);
      toast({ title: 'Brochure removed' });
    },
    onError: () => {
      toast({ title: 'Delete failed', variant: 'destructive' });
    },
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', `/api/cmas/${cmaId}/brochure/generate`);
      return response.json();
    },
    onSuccess: (generatedBrochure) => {
      onChange(generatedBrochure);
      toast({ title: 'Brochure generated', description: 'AI-generated brochure is ready' });
    },
    onError: (error: any) => {
      toast({ 
        title: 'Generation failed', 
        description: error.message || 'Failed to generate brochure',
        variant: 'destructive' 
      });
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      toast({ 
        title: 'File too large', 
        description: 'Maximum file size is 10MB',
        variant: 'destructive' 
      });
      return;
    }

    const validTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      toast({ 
        title: 'Invalid file type', 
        description: 'Please upload a PDF or image file',
        variant: 'destructive' 
      });
      return;
    }

    uploadMutation.mutate(file);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Listing Brochure</CardTitle>
        <CardDescription>Upload or generate a property brochure for the presentation</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {brochure ? (
          <div className="space-y-4">
            <div className="flex items-center gap-4 p-4 border rounded-lg bg-muted/50">
              {brochure.type === 'pdf' ? (
                <FileText className="w-10 h-10 text-red-500" />
              ) : (
                <Image className="w-10 h-10 text-blue-500" />
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{brochure.filename}</p>
                <p className="text-sm text-muted-foreground">
                  {brochure.generated ? 'AI Generated' : 'Uploaded'} • {brochure.type.toUpperCase()}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
                data-testid="button-delete-brochure"
              >
                {deleteMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4 text-destructive" />
                )}
              </Button>
            </div>
            
            {brochure.type === 'image' && brochure.url && (
              <img 
                src={brochure.url} 
                alt="Brochure preview" 
                className="w-full max-h-[300px] object-contain rounded-lg border"
              />
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp"
              onChange={handleFileChange}
              className="hidden"
            />
            
            <Button
              variant="outline"
              className="w-full h-24 border-dashed gap-2"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              data-testid="button-upload-brochure"
            >
              {isUploading ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <FileUp className="w-6 h-6" />
              )}
              <div className="text-left">
                <div className="font-medium">Upload Brochure</div>
                <div className="text-sm text-muted-foreground">PDF, JPG, PNG up to 10MB</div>
              </div>
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">or</span>
              </div>
            </div>

            <Button
              variant="secondary"
              className="w-full gap-2"
              onClick={() => generateMutation.mutate()}
              disabled={generateMutation.isPending || !subjectProperty}
              data-testid="button-generate-brochure"
            >
              {generateMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              Generate with AI
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
