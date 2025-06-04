export interface Upload {
  id: number;
  userId: number;
  fileName: string;
  fileUrl: string;
  fileType: string;
  fileSize: number;
  category: 'profile' | 'document' | 'claim' | 'other';
  status: 'pending' | 'completed' | 'failed';
  error?: string;
  uploadedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type InsertUpload = Omit<Upload, 'id' | 'createdAt' | 'updatedAt'>;

export interface UploadConfig {
  maxFileSize: number;
  allowedFileTypes: string[];
  maxFilesPerUpload: number;
  storageProvider: 'local' | 's3' | 'gcs';
  storageConfig: {
    bucket?: string;
    region?: string;
    accessKeyId?: string;
    secretAccessKey?: string;
  };
}

export interface UploadProgress {
  id: string;
  fileName: string;
  progress: number;
  status: 'uploading' | 'completed' | 'failed';
  error?: string;
}

export interface UploadResult {
  success: boolean;
  fileUrl?: string;
  error?: string;
  uploadId?: string;
} 