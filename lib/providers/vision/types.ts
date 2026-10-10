export interface ExtractParams {
  base64: string;
  mediaType?: string;
  docType: string;
  stem: string;
}

export interface VisionProvider {
  name: string;
  extract(params: ExtractParams): Promise<Record<string, unknown>>;
}
