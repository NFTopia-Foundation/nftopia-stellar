import { createHmac, timingSafeEqual } from 'node:crypto';
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import sharp from 'sharp';
import { Repository } from 'typeorm';
import { PrometheusService } from '../../common/metrics/prometheus';
import { Nft } from './entities/nft.entity';
import { NftImageQueryDto } from './dto/nft-image-query.dto';

type OutputFormat = 'webp' | 'avif' | 'jpeg' | 'png';

interface ImageTransformOptions {
  width?: number;
  height?: number;
  quality: number;
  format: OutputFormat;
}

export interface OptimizedImageResult {
  buffer: Buffer;
  contentType: string;
  cacheControl: string;
  originalBytes: number;
  optimizedBytes: number;
}

export interface ImageFallbackResult {
  redirectUrl: string;
  cacheControl: string;
}

export type NftImageResult = OptimizedImageResult | ImageFallbackResult;

interface MediaVariant {
  url: string | null;
  width: number;
  height: number;
  format: 'auto';
}

interface NftMediaPayload {
  originalUrl: string | null;
  thumbnailUrl: string | null;
  previewUrl: string | null;
  detailUrl: string | null;
  placeholder: string;
  width: number;
  height: number;
  srcSet: string;
  sizes: string;
  variants: {
    thumbnail: MediaVariant;
    preview: MediaVariant;
    detail: MediaVariant;
  };
}

const VARIANTS = {
  thumbnail: { width: 100, height: 100 },
  preview: { width: 400, height: 400 },
  detail: { width: 1200, height: 1200 },
} as const;

@Injectable()
export class NftMediaService {
  private readonly logger = new Logger(NftMediaService.name);

  constructor(
    @InjectRepository(Nft)
    private readonly nftRepository: Repository<Nft>,
    private readonly configService: ConfigService,
    private readonly prometheusService: PrometheusService,
  ) {}

  enrichQueryResult<T extends { data: Nft[] }>(result: T): T {
    return {
      ...result,
      data: result.data.map((nft) => this.enrichNft(nft)),
    };
  }

  enrichNft<T extends Nft>(
    nft: T,
  ): T & {
    media: NftMediaPayload;
    thumbnailUrl: string | null;
    responsiveSrcSet: string;
  } {
    const media = this.buildMediaPayload(nft);

    return {
      ...nft,
      media,
      thumbnailUrl: media.thumbnailUrl,
      responsiveSrcSet: media.srcSet,
    };
  }

  async getOptimizedImage(
    nftId: string,
    query: NftImageQueryDto,
    acceptHeader = '',
  ): Promise<NftImageResult> {
    const nft = await this.nftRepository.findOne({ where: { id: nftId } });
    if (!nft) {
      throw new NotFoundException('NFT not found');
    }

    if (!nft.imageUrl) {
      throw new NotFoundException('NFT image not found');
    }

    this.validateSignature(nftId, query);

    if (query.format === 'original') {
      return this.fallbackToOriginal(nft.imageUrl);
    }

    const options = this.normalizeTransformOptions(query, acceptHeader);

    try {
      const original = await this.fetchOriginalImage(nft.imageUrl);
      const optimized = await this.transformImage(original, options);
      this.prometheusService.observeNftImageOptimization(
        options.format,
        original.length,
        optimized.length,
      );

      return {
        buffer: optimized,
        contentType: `image/${options.format}`,
        cacheControl: this.getProcessedCacheControl(),
        originalBytes: original.length,
        optimizedBytes: optimized.length,
      };
    } catch (error) {
      this.logger.warn(
        `Image optimization failed for nft=${nftId}; falling back to original: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
      this.prometheusService.incrementNftImageOptimizationFallback(
        options.format,
      );
      return this.fallbackToOriginal(nft.imageUrl);
    }
  }

  pregenerateVariants(nft: Nft): void {
    if (!nft.imageUrl) {
      return;
    }

    setImmediate(() => {
      void Promise.allSettled(
        Object.values(VARIANTS).map((variant) =>
          this.getOptimizedImage(
            nft.id,
            { ...variant, quality: 82, format: 'auto' },
            'image/avif,image/webp,image/*',
          ),
        ),
      );
    });
  }

  private buildMediaPayload(nft: Nft): NftMediaPayload {
    const thumbnailUrl = this.buildVariantUrl(nft, VARIANTS.thumbnail);
    const previewUrl = this.buildVariantUrl(nft, VARIANTS.preview);
    const detailUrl = this.buildVariantUrl(nft, VARIANTS.detail);

    return {
      originalUrl: nft.imageUrl ?? null,
      thumbnailUrl,
      previewUrl,
      detailUrl,
      placeholder: this.buildPlaceholder(nft.id),
      width: VARIANTS.detail.width,
      height: VARIANTS.detail.height,
      srcSet: [thumbnailUrl, previewUrl, detailUrl]
        .filter((url): url is string => Boolean(url))
        .map((url, index) => {
          const width = Object.values(VARIANTS)[index].width;
          return `${url} ${width}w`;
        })
        .join(', '),
      sizes: '(max-width: 640px) 100vw, (max-width: 1024px) 400px, 1200px',
      variants: {
        thumbnail: {
          url: thumbnailUrl,
          width: VARIANTS.thumbnail.width,
          height: VARIANTS.thumbnail.height,
          format: 'auto',
        },
        preview: {
          url: previewUrl,
          width: VARIANTS.preview.width,
          height: VARIANTS.preview.height,
          format: 'auto',
        },
        detail: {
          url: detailUrl,
          width: VARIANTS.detail.width,
          height: VARIANTS.detail.height,
          format: 'auto',
        },
      },
    };
  }

  private buildVariantUrl(
    nft: Nft,
    variant: { width: number; height: number },
  ): string | null {
    if (!nft.imageUrl) {
      return null;
    }

    const baseUrl =
      this.configService.get<string>('NFT_MEDIA_CDN_BASE_URL') ??
      this.configService.get<string>('APP_PUBLIC_URL') ??
      '';
    const path = `/nfts/${nft.id}/image`;
    const params = new URLSearchParams({
      width: String(variant.width),
      height: String(variant.height),
      quality: '82',
      format: 'auto',
      v: String(
        (
          nft.updatedAt ??
          nft.mintedAt ??
          nft.createdAt ??
          new Date()
        ).getTime(),
      ),
    });

    const secret = this.configService.get<string>('NFT_MEDIA_SIGNING_SECRET');
    if (secret) {
      const expires = String(
        Math.floor(Date.now() / 1000) +
          Number(this.configService.get('NFT_MEDIA_SIGNED_TTL_SECONDS') ?? 900),
      );
      params.set('expires', expires);
      params.set(
        'signature',
        this.signPath(`${path}?${params.toString()}`, secret),
      );
    }

    return `${baseUrl}${path}?${params.toString()}`;
  }

  private normalizeTransformOptions(
    query: NftImageQueryDto,
    acceptHeader: string,
  ): ImageTransformOptions {
    return {
      width: query.width,
      height: query.height,
      quality: query.quality ?? 82,
      format: this.selectFormat(query.format, acceptHeader),
    };
  }

  private selectFormat(
    requestedFormat: NftImageQueryDto['format'],
    acceptHeader: string,
  ): OutputFormat {
    if (
      requestedFormat &&
      requestedFormat !== 'auto' &&
      requestedFormat !== 'original'
    ) {
      return requestedFormat;
    }

    if (acceptHeader.includes('image/avif')) {
      return 'avif';
    }

    if (acceptHeader.includes('image/webp')) {
      return 'webp';
    }

    return 'jpeg';
  }

  private async fetchOriginalImage(imageUrl: string): Promise<Buffer> {
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new ServiceUnavailableException(
        `Original image request failed with ${response.status}`,
      );
    }

    const bytes = await response.arrayBuffer();
    return Buffer.from(bytes);
  }

  private async transformImage(
    original: Buffer,
    options: ImageTransformOptions,
  ): Promise<Buffer> {
    let pipeline = sharp(original, { animated: false }).rotate();

    if (options.width || options.height) {
      pipeline = pipeline.resize({
        width: options.width,
        height: options.height,
        fit: 'inside',
        withoutEnlargement: true,
      });
    }

    switch (options.format) {
      case 'avif':
        return pipeline.avif({ quality: options.quality }).toBuffer();
      case 'webp':
        return pipeline.webp({ quality: options.quality }).toBuffer();
      case 'png':
        return pipeline.png({ quality: options.quality }).toBuffer();
      case 'jpeg':
        return pipeline.jpeg({ quality: options.quality }).toBuffer();
    }
  }

  private validateSignature(nftId: string, query: NftImageQueryDto): void {
    const secret = this.configService.get<string>('NFT_MEDIA_SIGNING_SECRET');
    if (!secret) {
      return;
    }

    if (!query.expires || !query.signature) {
      throw new BadRequestException('Signed NFT image URL is required');
    }

    const expires = Number(query.expires);
    if (!Number.isFinite(expires) || expires < Math.floor(Date.now() / 1000)) {
      throw new BadRequestException('Signed NFT image URL has expired');
    }

    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (
        value !== undefined &&
        value !== null &&
        key !== 'signature' &&
        key !== 'signed'
      ) {
        params.set(key, String(value));
      }
    }

    const expected = this.signPath(`/nfts/${nftId}/image?${params}`, secret);
    const expectedBytes = Buffer.from(expected);
    const actualBytes = Buffer.from(query.signature);

    if (
      expectedBytes.length !== actualBytes.length ||
      !timingSafeEqual(expectedBytes, actualBytes)
    ) {
      throw new BadRequestException('Signed NFT image URL is invalid');
    }
  }

  private signPath(value: string, secret: string): string {
    return createHmac('sha256', secret).update(value).digest('hex');
  }

  private fallbackToOriginal(imageUrl: string): ImageFallbackResult {
    return {
      redirectUrl: imageUrl,
      cacheControl:
        this.configService.get<string>('NFT_MEDIA_ORIGINAL_CACHE_CONTROL') ??
        'public, max-age=300',
    };
  }

  private getProcessedCacheControl(): string {
    return (
      this.configService.get<string>('NFT_MEDIA_CACHE_CONTROL') ??
      'public, max-age=31536000, immutable'
    );
  }

  private buildPlaceholder(seed: string): string {
    const hash = createHmac('sha1', 'nftopia-media-placeholder')
      .update(seed)
      .digest('hex');
    const color = `#${hash.slice(0, 6)}`;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20"><rect width="20" height="20" fill="${color}"/></svg>`;

    return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
  }
}
