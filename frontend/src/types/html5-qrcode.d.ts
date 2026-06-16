/** html5-qrcode carregado via CDN em /portaria */
declare class Html5Qrcode {
  constructor(elementId: string, config?: object);
  start(
    cameraIdOrConfig: { facingMode: string } | string,
    config: { fps: number; qrbox?: { width: number; height: number } },
    onSuccess: (decodedText: string) => void,
    onError?: (errorMessage: string) => void,
  ): Promise<void>;
  stop(): Promise<void>;
  clear(): Promise<void>;
  scanFile(imageFile: File, showImage?: boolean): Promise<string>;
  scanFileV2(imageFile: File, showImage?: boolean): Promise<{ decodedText: string } | string>;
}

declare class Html5QrcodeScanner {
  constructor(
    elementId: string,
    config: { fps: number; qrbox?: { width: number; height: number }; rememberLastUsedCamera?: boolean },
    verbose?: boolean,
  );
  render(onSuccess: (decodedText: string) => void, onError?: (errorMessage: string) => void): void;
  clear(): Promise<void>;
}
