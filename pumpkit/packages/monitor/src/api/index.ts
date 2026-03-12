/**
 * Monitor Bot API — Module Barrel
 *
 * Wire up: import { MonitorApi, loadApiConfig } from './api/index.js'
 */

export { ClaimBuffer } from './claimBuffer.js';
export { RateLimiter } from './rateLimiter.js';
export { loadApiConfig, MonitorApi } from './server.js';
export type {
    ApiConfig,
    ApiError,
    ApiWatchEntry,
    ClaimResponse,
    CreateWatchBody,
    HealthResponse,
    LaunchResponse,
    PaginatedResponse,
    PaginationParams,
    RegisterWebhookBody,
    StatusResponse,
    WatchResponse,
    WebhookRegistration,
} from './types.js';

