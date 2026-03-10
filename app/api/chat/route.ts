import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth-helpers';
import { generateLegacyChatResponse, type LegacyChatMessage } from '@/lib/legacy-chat-response';

/**
 * Unified Chat API - Intelligent router for both WordPress embed and logged-in users
 *
 * Accepts two request formats:
 * 1. Legacy (WordPress): { message: string }
 * 2. New (multi-turn): { sessionId: string, messages: [{role, content}] }
 *
 * Auto-detects user authentication and provides:
 * - Anonymous visitors: General TCM knowledge
 * - Logged-in users: Personalized guidance based on care context + booking history
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Auto-detect request format
    const isLegacyFormat = 'message' in body && typeof body.message === 'string';
    const isNewFormat = 'messages' in body && Array.isArray(body.messages);

    let userMessage: string;
    let messages: LegacyChatMessage[] = [];

    if (isLegacyFormat) {
      // WordPress embed format: { message: string }
      userMessage = body.message;
    } else if (isNewFormat) {
      // New format: { sessionId, messages }
      messages = body.messages as LegacyChatMessage[];
      const latestUserMsg = [...messages].reverse().find((m) => m.role === 'user');

      if (!latestUserMsg) {
        return NextResponse.json(
          { error: 'No user message found in messages array' },
          { status: 400 }
        );
      }

      userMessage = latestUserMsg.content;
    } else {
      return NextResponse.json(
        { error: 'Invalid request format. Expected { message: string } or { messages: [...] }' },
        { status: 400 }
      );
    }

    if (!userMessage) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    let userId: string | undefined;

    try {
      const user = await getCurrentUser();
      if (user) {
        userId = user.id;
      }
    } catch {
      // Not authenticated — continue with anonymous mode
    }

    const { reply, userContext } = await generateLegacyChatResponse({
      messages,
      userMessage,
      userId,
    });

    // Return format based on request type
    if (isLegacyFormat) {
      // WordPress embed expects: { response: string }
      return NextResponse.json({ response: reply });
    } else {
      // New format expects: { reply: string, mode?: string, type?: string }
      return NextResponse.json({
        reply,
        userContext,
      });
    }
  } catch (error) {
    console.error('[chat] AI API Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to generate AI response',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
