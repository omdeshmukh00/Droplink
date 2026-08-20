export interface StorageProvider {
    upload(
        filePath: string,
        fileName: string,
        mimeType: string
    ): Promise<{
        fileId: string;
        fileName: string;
    }>;

    download(fileId: string): Promise<NodeJS.ReadableStream>;

    delete(fileId: string): Promise<void>;

    exists(fileId: string): Promise<boolean>;

    getMetadata(fileId: string): Promise<any>;
}