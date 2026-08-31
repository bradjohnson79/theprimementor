export type ContactSource = "gmail" | "csv" | "manual";
export type CandidateStatus = "new" | "already_in_list" | "filtered" | "invalid";

export interface StoredGmailCandidate {
  id: string;
  email: string;
  emailNormalized: string;
  firstName: string | null;
  firstContact: string | null;
  lastContact: string | null;
  messageCount: number;
  twoWay: boolean;
  sentCount: number;
  receivedCount: number;
  query: string;
  profileId: string | null;
  threadIds: string[];
  messageIds: string[];
  evidenceSummary: string;
  status: CandidateStatus;
  rejectionReason: string | null;
}

export interface CandidatePreview extends StoredGmailCandidate {}
