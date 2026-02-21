import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable()
export class StellarTransformInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map((data) => {
        return this.transformData(data);
      }),
    );
  }

  private transformData(data: any): any {
    if (!data) return data;

    // Handle Horizon server collection pages
    if (data.records && Array.isArray(data.records)) {
      return {
        items: data.records.map((item: any) => this.transformItem(item)),
        nextPageToken: this.extractNextPageToken(data),
      };
    }

    // Handle arrays
    if (Array.isArray(data)) {
      return data.map((item: any) => this.transformItem(item));
    }

    // Handle single item explicitly if it's an object with `data` payload
    if (data.data && typeof data.data === 'object') {
      data.data = this.transformData(data.data);
      return data;
    }

    return this.transformItem(data);
  }

  private extractNextPageToken(data: any): string | null {
    if (data._links && data._links.next && data._links.next.href) {
      try {
        const nextUrl = new URL(data._links.next.href);
        return nextUrl.searchParams.get('cursor') || null;
      } catch (e) {
        return null;
      }
    }
    return null;
  }

  private stroopsToXlm(stroops: string): string {
    try {
      const isInteger = /^\d+$/.test(stroops);
      if (!isInteger) return stroops; // Already formatted or invalid

      const s = BigInt(stroops);
      const xlm = s / 10000000n;
      const fraction = s % 10000000n;
      if (fraction === 0n) return xlm.toString();
      const fractionStr = fraction
        .toString()
        .padStart(7, '0')
        .replace(/0+$/, '');
      return `${xlm}.${fractionStr}`;
    } catch {
      return stroops;
    }
  }

  private transformItem(item: any): any {
    if (!item || typeof item !== 'object') return item;

    const transformed = { ...item };

    // Format Stellar account responses (e.g., balances, trustlines).
    if (transformed.balances && Array.isArray(transformed.balances)) {
      transformed.balances = transformed.balances.map((b: any) => {
        if (
          b.balance &&
          typeof b.balance === 'string' &&
          /^\d+$/.test(b.balance)
        ) {
          // If we suspect it's pure stroops (no decimal), convert it to XLM format string
          b.balanceXlm = this.stroopsToXlm(b.balance);
        }
        return b;
      });
    }

    return transformed;
  }
}
