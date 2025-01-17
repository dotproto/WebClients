import type { KeyRotationKeyPair } from '../api';
import type { ShareRole } from './shares';

export type InviteCreateIntent = { shareId: string; email: string; role: ShareRole };
export type InviteResendIntent = { shareId: string; inviteId: string };
export type InviteRemoveIntent = { shareId: string; inviteId: string };
export type InviteAcceptIntent = { inviteToken: string; inviterEmail: string; inviteKeys: KeyRotationKeyPair[] };
export type InviteRejectIntent = { inviteToken: string };
