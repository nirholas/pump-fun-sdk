import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { ServerState, ResourceDefinition } from '../types/index.js';
export declare const STATIC_RESOURCES: ResourceDefinition[];
export declare const RESOURCE_TEMPLATES: {
    uriTemplate: string;
    name: string;
    description: string;
    mimeType: string;
}[];
export declare function registerResourceHandlers(server: Server, state: ServerState): void;
//# sourceMappingURL=resources.d.ts.map
