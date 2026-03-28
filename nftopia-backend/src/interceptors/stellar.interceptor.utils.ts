import type { Request } from 'express';

type RouteShape = {
  path?: string;
};

export type StellarRequestContext = {
  isStellarRequest: boolean;
  txHash?: string;
  contractId?: string;
  method?: string;
  xdr?: string;
  endpoint?: string;
};

export type StellarResponseMeta = {
  txHash?: string;
  contractId?: string;
  status?: string;
  xdr?: string;
};

const STELLAR_PATH_HINTS = [
  'stellar',
  'soroban',
  'wallet',
  'nfts',
  'auction',
  'listing',
  'order',
];

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  return value as Record<string, unknown>;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

export function asHttpRequest(value: unknown): Request | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  return value as Request;
}

function getRoutePath(req: Request): string {
  const route: unknown = Reflect.get(req as object, 'route');
  if (!route || typeof route !== 'object') {
    return '';
  }

  const maybePath = (route as RouteShape).path;
  return typeof maybePath === 'string' ? maybePath : '';
}

export function getQueryString(req: Request, key: string): string | undefined {
  const query = asRecord(req.query);
  return asString(query?.[key]);
}

export function inferStellarContext(req: Request): StellarRequestContext {
  const query = asRecord(req.query);
  const body = asRecord(req.body);

  const endpoint = req.originalUrl || req.url;
  const pathProbe = `${endpoint} ${getRoutePath(req)}`.toLowerCase();

  const method =
    asString(body?.method) ||
    asString(body?.operation) ||
    asString(query?.method) ||
    asString(query?.operation);

  const txHash =
    asString(body?.transactionHash) ||
    asString(body?.txHash) ||
    asString(query?.transactionHash) ||
    asString(query?.txHash);

  const contractId =
    asString(body?.contractId) ||
    asString(body?.contractAddress) ||
    asString(query?.contractId) ||
    asString(query?.contractAddress);

  const xdr = asString(body?.xdr) || asString(query?.xdr);

  const hasPathHint = STELLAR_PATH_HINTS.some((hint) =>
    pathProbe.includes(hint),
  );
  const hasPayloadHint = Boolean(method || txHash || contractId || xdr);

  return {
    isStellarRequest: hasPathHint || hasPayloadHint,
    txHash,
    contractId,
    method,
    xdr,
    endpoint,
  };
}

export function extractStellarResponseMeta(data: unknown): StellarResponseMeta {
  const record = asRecord(data);

  if (!record) {
    return {};
  }

  return {
    txHash:
      asString(record.transactionHash) ||
      asString(record.txHash) ||
      asString(record.hash),
    contractId: asString(record.contractId) || asString(record.contractAddress),
    status: asString(record.status) || asString(record.result),
    xdr: asString(record.xdr),
  };
}
