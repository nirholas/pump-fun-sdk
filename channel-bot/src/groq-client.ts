/**
 * PumpFun Channel Bot — Groq AI Client
 *
 * Generates a concise one-line AI summary for first-claim alerts
 * using Groq's fast inference API (llama-3.3-70b-versatile).
 */

import { log } from './logger.js';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_API_KEY = process.env.GROQ_API_KEY ?? '';
const GROQ_MODEL = 'llama-3.3-70b-versatile';

export interface ClaimSummaryInput {
    tokenName: string;
    tokenSymbol: string;
    tokenDescription: string;
    mcapUsd: number;
    graduated: boolean;
    curveProgress: number;
    claimAmountSol: number;
    claimAmountUsd: number;
    launchToClaimSeconds: number;
    isSelfClaim: boolean;
    creatorLaunches: number;
    creatorGraduated: number;
    creatorFollowers: number;
    holderCount: number;
    recentTradeCount: number;
    githubRepoName: string | null;
    githubStars: number | null;
    githubLanguage: string | null;
    githubLastPush: string | null;
    githubDescription: string | null;
    githubIsFork: boolean | null;
    githubUserLogin: string | null;
    githubUserFollowers: number | null;
    githubUserRepos: number | null;
    githubUserCreatedAt: string | null;
}

/**
 * Generate a 1-line AI take on a first claim.
 * Returns empty string if Groq is unavailable or fails.
 */
export async function generateClaimSummary(input: ClaimSummaryInput): Promise<string> {
    if (!GROQ_API_KEY) return '';

    const facts = buildFactString(input);

    try {
        const resp = await fetch(GROQ_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${GROQ_API_KEY}`,
            },
            body: JSON.stringify({
                model: GROQ_MODEL,
                messages: [
                    {
                        role: 'system',
                        content: `You analyze first fee claims on PumpFun tokens for a Telegram trading channel. Given token and claim data, write ONE concise line (max 120 chars) summarizing the key signal for traders. Be direct, opinionated, and useful. Focus on what matters: is the dev legit? Is the GitHub real? Is the token active? Use emoji sparingly. Never use hashtags. Examples:
- "Real GitHub project, dev claimed fast — active builder with 3 graduated tokens"
- "Fork of popular repo, no original code — proceed with caution"
- "First-time dev, tiny claim, no socials — low conviction"
- "Graduated token, 50+ holders, dev self-claimed 2.6 SOL — active project"`,
                    },
                    {
                        role: 'user',
                        content: facts,
                    },
                ],
                max_tokens: 80,
                temperature: 0.3,
            }),
            signal: AbortSignal.timeout(5_000),
        });

        if (!resp.ok) {
            log.warn('Groq API %d: %s', resp.status, await resp.text().catch(() => ''));
            return '';
        }

        const data = (await resp.json()) as {
            choices?: Array<{ message?: { content?: string } }>;
        };

        const content = data.choices?.[0]?.message?.content?.trim() ?? '';
        // Safety: strip any HTML tags from AI output
        return content.replace(/<[^>]*>/g, '').slice(0, 150);
    } catch (err) {
        log.debug('Groq summary failed: %s', err);
        return '';
    }
}

function buildFactString(input: ClaimSummaryInput): string {
    const lines: string[] = [];

    lines.push(`Token: ${input.tokenName} ($${input.tokenSymbol})`);
    if (input.tokenDescription) lines.push(`Description: ${input.tokenDescription.slice(0, 200)}`);
    lines.push(`Mcap: $${input.mcapUsd > 0 ? formatNum(input.mcapUsd) : 'unknown'}`);
    const pct = Math.round(input.curveProgress);
    lines.push(`Status: ${input.graduated ? 'Graduated to AMM' : `Bonding curve ${pct > 0 ? `${pct}%` : '<1%'}`}`);
    lines.push(`Claim: ${input.claimAmountSol.toFixed(4)} SOL ($${input.claimAmountUsd.toFixed(2)})`);

    if (input.launchToClaimSeconds >= 0) {
        lines.push(`Time from launch to claim: ${formatDuration(input.launchToClaimSeconds)}`);
    }
    lines.push(`Claimer: ${input.isSelfClaim ? 'Creator self-claimed' : 'Third-party claimed'}`);
    lines.push(`Creator: ${input.creatorLaunches} launches, ${input.creatorGraduated} graduated, ${input.creatorFollowers} followers`);

    if (input.holderCount > 0) lines.push(`Holders: ${input.holderCount}`);
    if (input.recentTradeCount > 0) lines.push(`Recent trades: ${input.recentTradeCount}`);

    if (input.githubRepoName) {
        lines.push(`GitHub: ${input.githubRepoName}`);
        if (input.githubDescription) lines.push(`Repo description: ${input.githubDescription.slice(0, 150)}`);
        if (input.githubLanguage) lines.push(`Language: ${input.githubLanguage}`);
        if (input.githubStars != null) lines.push(`Stars: ${input.githubStars}`);
        if (input.githubLastPush) lines.push(`Last push: ${input.githubLastPush}`);
        if (input.githubIsFork) lines.push(`⚠ This is a fork`);
    } else {
        lines.push('No GitHub repo linked');
    }

    if (input.githubUserLogin) {
        lines.push(`GitHub user: ${input.githubUserLogin}`);
        if (input.githubUserFollowers != null) lines.push(`GitHub followers: ${input.githubUserFollowers}`);
        if (input.githubUserRepos != null) lines.push(`GitHub public repos: ${input.githubUserRepos}`);
        if (input.githubUserCreatedAt) lines.push(`GitHub account created: ${input.githubUserCreatedAt}`);
    }

    return lines.join('\n');
}

function formatNum(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return n.toFixed(0);
}

function formatDuration(seconds: number): string {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
    return `${Math.floor(seconds / 86400)}d ${Math.floor((seconds % 86400) / 3600)}h`;
}
