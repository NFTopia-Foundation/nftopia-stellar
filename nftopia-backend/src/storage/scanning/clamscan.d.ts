declare module 'clamscan' {
  import type { Readable } from 'stream';

  interface NodeClamOptions {
    removeInfected?: boolean;
    debugMode?: boolean;
    clamscan?: {
      active?: boolean;
    };
    clamdscan?: {
      host?: string;
      port?: number;
      timeout?: number;
      localFallback?: boolean;
      active?: boolean;
      bypassTest?: boolean;
    };
    preference?: 'clamscan' | 'clamdscan';
  }

  interface ScanStreamResult {
    isInfected: boolean | null;
    viruses: string[];
  }

  class NodeClam {
    init(options?: NodeClamOptions): Promise<NodeClam>;
    scanStream(stream: Readable): Promise<ScanStreamResult>;
  }

  export = NodeClam;
}
