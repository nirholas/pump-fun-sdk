/**
 * Type declarations for xactions package
 * 
 * xactions@3.1.0 has type definitions but incomplete package.json exports mapping.
 * This file provides the necessary type information for TypeScript.
 */

declare module 'xactions' {
  export class Scraper {
    constructor();
    login(username: string, password: string, email?: string): Promise<void>;
    isLoggedIn(): Promise<boolean>;
    logout(): Promise<void>;
    getProfile(username: string): Promise<Profile>;
    getCookies(): Promise<Cookie[]>;
    setCookies(cookies: Cookie[]): Promise<void>;
    // Add other methods as needed
  }

  export interface Profile {
    username: string;
    name: string;
    followers: number;
    following: number;
    verified: boolean;
    description?: string;
  }

  export interface Cookie {
    key: string;
    value: string;
    domain: string;
    path: string;
    secure: boolean;
    httpOnly: boolean;
    sameSite?: 'Strict' | 'Lax' | 'None';
  }

  export enum SearchMode {
    Latest = 'Latest',
    Top = 'Top',
    Photos = 'Photos',
    Videos = 'Videos',
    Users = 'Users',
  }

  export class ScraperError extends Error {}
  export class AuthenticationError extends ScraperError {}
  export class RateLimitError extends ScraperError {}
  export class NotFoundError extends ScraperError {}
  export class TwitterApiError extends ScraperError {}
}
