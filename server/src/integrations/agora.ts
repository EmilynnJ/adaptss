import agoraToken from "agora-token";
const { RtcTokenBuilder, RtcRole, RtmTokenBuilder } = agoraToken;
import { env } from "../config/env.js";
import { AGORA_TOKEN_TTL_SECONDS } from "@soulseer/shared";
import { HttpError } from "../middleware/errors.js";

// Deterministic channel name per reading.
export const channelForReading = (readingId: number) => `reading_${readingId}`;

// RTC token for voice/video. uid is the internal user id.
export function buildRtcToken(channel: string, uid: number): string {
  if (!env.agora.appId || !env.agora.certificate) {
    throw new HttpError(500, "Agora is not configured", false);
  }
  const now = Math.floor(Date.now() / 1000);
  const privilegeExpire = now + AGORA_TOKEN_TTL_SECONDS;
  return RtcTokenBuilder.buildTokenWithUid(
    env.agora.appId,
    env.agora.certificate,
    channel,
    uid,
    RtcRole.PUBLISHER,
    AGORA_TOKEN_TTL_SECONDS,
    privilegeExpire
  );
}

// RTM token for chat sessions. Account is stringified user id.
export function buildRtmToken(uid: number): string {
  if (!env.agora.appId || !env.agora.certificate) {
    throw new HttpError(500, "Agora is not configured", false);
  }
  return RtmTokenBuilder.buildToken(
    env.agora.appId,
    env.agora.certificate,
    String(uid),
    AGORA_TOKEN_TTL_SECONDS
  );
}
