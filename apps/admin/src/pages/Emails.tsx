import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@clerk/react";
import { motion } from "framer-motion";
import { useSearchParams } from "react-router-dom";
import Card from "../components/Card";
import EmptyState from "../components/EmptyState";
import Loading from "../components/Loading";
import Table from "../components/Table";
import { api } from "../lib/api";

interface GmailStatus {
  status: "disconnected" | "connected" | "expired" | "error" | string;
  gmailAddress: string | null;
  connectedAt: string | null;
}

interface SearchProfile {
  id: string;
  name: string;
  query: string;
}

interface Candidate {
  id: string;
  email: string;
  firstName: string | null;
  firstContact: string | null;
  lastContact: string | null;
  messageCount: number;
  twoWay: boolean;
  status: "new" | "already_in_list" | "filtered" | "invalid";
  rejectionReason: string | null;
  actions?: string | null;
}

interface ContactRow {
  id: string;
  firstName: string | null;
  email: string;
  source: string;
  createdAt: string;
  select?: boolean;
  actions?: string | null;
}

interface ExclusionRow {
  id: string;
  kind: "email" | "domain";
  value: string;
  pattern: string;
}

interface ImportSummary {
  query: string;
  added: number;
  existing: number;
  filtered: number;
  invalid: number;
  pages: number;
  hasMore: boolean;
  nextPageToken: string | null;
  searchSessionId?: string;
  candidates?: Candidate[];
  total?: number;
}

interface CsvPreviewRow {
  rowNumber: number;
  email: string;
  firstName: string | null;
  status: string;
  reason: string | null;
}

const PAGE_SIZE = 25;
const CANDIDATE_PAGE_SIZE = 100;
const GMAIL_SEARCH_MIN_YEAR = 2004;
const SEARCH_YEAR_OPTIONS = Array.from(
  { length: new Date().getFullYear() - GMAIL_SEARCH_MIN_YEAR + 1 },
  (_, index) => new Date().getFullYear() - index,
);
const COMPLIANCE_NOTICE =
  "This tool recovers correspondence from your connected Gmail mailbox and maintains a shared master list for AWeber import. It does not send mail, subscribe contacts automatically, or store message bodies.";

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function providerError(error: unknown) {
  const message = error instanceof Error ? error.message : "Something went wrong.";
  if (/search session not found|preview expired/i.test(message)) {
    return "This preview expired. Load matches again, then add selected contacts.";
  }
  if (/failed query|insert into|relation |duplicate key/i.test(message)) {
    if (/duplicate key|unique constraint/i.test(message)) {
      return "That exclusion is already on the list.";
    }
    return "Something went wrong. Try again.";
  }
  return message.replace(/token|client_secret|refresh_token/gi, "[redacted]");
}

function unwrapData<T>(response: unknown): T {
  if (response && typeof response === "object" && "data" in response) {
    return (response as { data: T }).data;
  }
  return response as T;
}

function emailDomain(email: string) {
  const normalized = email.trim().toLowerCase();
  const at = normalized.lastIndexOf("@");
  return at > 0 ? normalized.slice(at + 1) : "";
}

function matchesExclusion(email: string, rules: ExclusionRow[]) {
  const normalized = email.trim().toLowerCase();
  const domain = emailDomain(normalized);
  return rules.some((rule) => (
    rule.kind === "email"
      ? normalized === rule.value.toLowerCase()
      : domain === rule.value.toLowerCase()
  ));
}

function isPreviewableCandidate(candidate: Candidate, rules: ExclusionRow[], dismissed: string[]) {
  if (candidate.status !== "new") return false;
  const email = candidate.email.trim().toLowerCase();
  if (dismissed.includes(email)) return false;
  return !matchesExclusion(candidate.email, rules);
}

function uniqueNewCsvRows(rows: CsvPreviewRow[]) {
  const seen = new Set<string>();
  const unique: CsvPreviewRow[] = [];
  for (const row of rows) {
    if (row.status !== "new") continue;
    const key = row.email.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(row);
  }
  return unique;
}

export default function Emails() {
  const { getToken } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [status, setStatus] = useState<GmailStatus | null>(null);
  const [profiles, setProfiles] = useState<SearchProfile[]>([]);
  const [query, setQuery] = useState("");
  const [searchYear, setSearchYear] = useState("");
  const [profileName, setProfileName] = useState("");
  const [searching, setSearching] = useState(false);
  const [importing, setImporting] = useState(false);
  const [exclusions, setExclusions] = useState<ExclusionRow[]>([]);
  const [exclusionInput, setExclusionInput] = useState("");
  const [lastImport, setLastImport] = useState<ImportSummary | null>(null);
  const [searchSessionId, setSearchSessionId] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [hasMoreCandidates, setHasMoreCandidates] = useState(false);
  const [candidatePage, setCandidatePage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [dismissedEmails, setDismissedEmails] = useState<string[]>([]);
  const candidateSelectAllRef = useRef<HTMLInputElement | null>(null);
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [contactTotal, setContactTotal] = useState(0);
  const [contactPage, setContactPage] = useState(1);
  const [contactSearchInput, setContactSearchInput] = useState("");
  const [contactSearch, setContactSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const selectAllRef = useRef<HTMLInputElement | null>(null);
  const [sort, setSort] = useState<"newest" | "oldest" | "email" | "name">("newest");
  const [loadingContacts, setLoadingContacts] = useState(true);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualEmail, setManualEmail] = useState("");
  const [manualName, setManualName] = useState("");
  const [editing, setEditing] = useState<ContactRow | null>(null);
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
  const [importSessionId, setImportSessionId] = useState<string | null>(null);
  const [csvPreview, setCsvPreview] = useState<CsvPreviewRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const visibleCandidates = useMemo(
    () => candidates.filter((candidate) => isPreviewableCandidate(candidate, exclusions, dismissedEmails)),
    [candidates, dismissedEmails, exclusions],
  );
  const csvNewRows = useMemo(() => uniqueNewCsvRows(csvPreview), [csvPreview]);
  const csvSkipCounts = useMemo(() => ({
    exists: csvPreview.filter((row) => row.status === "exists").length,
    duplicateInFile: csvPreview.filter((row) => row.status === "duplicate_in_file").length,
    excluded: csvPreview.filter((row) => row.status === "excluded").length,
    invalid: csvPreview.filter((row) => row.status === "invalid" || row.status === "missing_email").length,
  }), [csvPreview]);
  const candidateTotalPages = Math.max(1, Math.ceil(visibleCandidates.length / CANDIDATE_PAGE_SIZE));
  const pagedCandidates = useMemo(() => {
    const start = (candidatePage - 1) * CANDIDATE_PAGE_SIZE;
    return visibleCandidates.slice(start, start + CANDIDATE_PAGE_SIZE);
  }, [candidatePage, visibleCandidates]);
  const selectableCandidates = visibleCandidates.filter((candidate) => candidate.status !== "invalid");
  const allLoadedSelected = selectableCandidates.length > 0 && selectableCandidates.every((candidate) => selectedIds.includes(candidate.id));
  const allPageSelected = pagedCandidates.length > 0 && pagedCandidates.every((candidate) => candidate.status === "invalid" || selectedIds.includes(candidate.id));
  const somePageSelected = pagedCandidates.some((candidate) => selectedIds.includes(candidate.id));

  const loadStatus = useCallback(async () => {
    const token = await getToken();
    const response = unwrapData<GmailStatus>(await api.get("/admin/gmail/status", token));
    setStatus(response);
  }, [getToken]);

  const loadProfiles = useCallback(async () => {
    const token = await getToken();
    const response = unwrapData<{ profiles: SearchProfile[] }>(await api.get("/admin/gmail/search-profiles", token));
    setProfiles(response.profiles ?? []);
  }, [getToken]);

  const loadExclusions = useCallback(async () => {
    const token = await getToken();
    const response = unwrapData<{ exclusions: ExclusionRow[] }>(await api.get("/admin/email-contacts/exclusions", token));
    setExclusions(response.exclusions ?? []);
  }, [getToken]);

  const loadContacts = useCallback(async () => {
    setLoadingContacts(true);
    try {
      const token = await getToken();
      const params = new URLSearchParams({
        page: String(contactPage),
        pageSize: String(PAGE_SIZE),
        sort,
      });
      if (contactSearch.trim()) params.set("search", contactSearch.trim());
      if (sourceFilter) params.set("source", sourceFilter);
      const response = unwrapData<{
        contacts: ContactRow[];
        pagination: { total: number };
      }>(await api.get(`/admin/email-contacts?${params}`, token));
      setContacts(response.contacts ?? []);
      setContactTotal(response.pagination?.total ?? 0);
    } catch (err) {
      setError(providerError(err));
    } finally {
      setLoadingContacts(false);
    }
  }, [contactPage, contactSearch, getToken, sort, sourceFilter]);

  useEffect(() => {
    void loadStatus();
    void loadProfiles();
    void loadExclusions();
  }, [loadExclusions, loadProfiles, loadStatus]);

  useEffect(() => {
    void loadContacts();
  }, [loadContacts]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setContactSearch(contactSearchInput.trim());
      setContactPage(1);
    }, 250);
    return () => window.clearTimeout(handle);
  }, [contactSearchInput]);

  useEffect(() => {
    const gmail = searchParams.get("gmail");
    if (!gmail) return;
    if (gmail === "connected") setMessage("Gmail connected.");
    if (gmail === "error") setError("Gmail authorization did not complete.");
    if (gmail === "invalid_state") setError("Gmail authorization state was invalid or expired.");
    setSearchParams({}, { replace: true });
    void loadStatus();
  }, [loadStatus, searchParams, setSearchParams]);

  async function connectGmail() {
    setError(null);
    try {
      const token = await getToken();
      const response = unwrapData<{ url: string }>(await api.get("/admin/gmail/oauth/start", token));
      window.location.assign(response.url);
    } catch (err) {
      setError(providerError(err));
    }
  }

  async function disconnect() {
    if (!window.confirm("Disconnect this Gmail account from Admin Emails?")) return;
    try {
      const token = await getToken();
      const response = unwrapData<{ warning?: string }>(await api.post("/admin/gmail/disconnect", {}, token));
      setMessage(response.warning ?? "Gmail disconnected.");
      await loadStatus();
    } catch (err) {
      setError(providerError(err));
    }
  }

  async function runSearch(pageToken?: string) {
    setSearching(true);
    setError(null);
    try {
      const token = await getToken();
      const response = unwrapData<{
        searchSessionId: string;
        candidates: Candidate[];
        nextPageToken?: string | null;
        hasMore?: boolean;
        total?: number;
        batchAdded?: number;
      }>(await api.post("/admin/gmail/search", {
        query: query.trim(),
        year: searchYear ? Number(searchYear) : undefined,
        pageToken,
        searchSessionId: pageToken ? searchSessionId : undefined,
      }, token));
      setSearchSessionId(response.searchSessionId);
      setCandidates(response.candidates ?? []);
      setNextPageToken(response.nextPageToken ?? null);
      setHasMoreCandidates(Boolean(response.hasMore && response.nextPageToken));
      setSelectedIds([]);
      const keptDismissed = pageToken ? dismissedEmails : [];
      if (!pageToken) {
        setDismissedEmails([]);
        setCandidatePage(1);
      }
      const previewable = (response.candidates ?? []).filter((candidate) => (
        isPreviewableCandidate(candidate, exclusions, keptDismissed)
      ));
      if (pageToken) {
        setCandidatePage(Math.max(1, Math.ceil(previewable.length / CANDIDATE_PAGE_SIZE)));
      }
      const skipped = (response.candidates?.length ?? 0) - previewable.length;
      const yearLabel = searchYear ? ` from ${searchYear}` : "";
      setMessage(`Loaded ${previewable.length} new address${previewable.length === 1 ? "" : "es"}${yearLabel} into preview${skipped ? ` (${skipped} already on the list or filtered)` : ""}${response.hasMore ? ". Continue to load the next 1,000." : "."}`);
    } catch (err) {
      setError(providerError(err));
    } finally {
      setSearching(false);
    }
  }

  async function importMatches(pageToken?: string) {
    if (!query.trim()) return;
    setImporting(true);
    setError(null);
    try {
      const token = await getToken();
      const response = unwrapData<ImportSummary>(await api.post("/admin/gmail/search-import", {
        query: query.trim(),
        year: searchYear ? Number(searchYear) : undefined,
        pageToken,
        searchSessionId: pageToken ? searchSessionId : undefined,
      }, token));
      setLastImport(response);
      setSearchSessionId(response.searchSessionId ?? null);
      setCandidates(response.candidates ?? []);
      setNextPageToken(response.nextPageToken ?? null);
      setHasMoreCandidates(Boolean(response.hasMore && response.nextPageToken));
      setSelectedIds([]);
      const keptDismissed = pageToken ? dismissedEmails : [];
      if (!pageToken) {
        setDismissedEmails([]);
        setCandidatePage(1);
      }
      const previewable = (response.candidates ?? []).filter((candidate) => (
        isPreviewableCandidate(candidate, exclusions, keptDismissed)
      ));
      if (pageToken) {
        setCandidatePage(Math.max(1, Math.ceil(previewable.length / CANDIDATE_PAGE_SIZE)));
      }
      const more = response.hasMore ? " Continue to import the next 1,000." : "";
      setMessage(
        `Imported ${response.added} new contact${response.added === 1 ? "" : "s"} from “${response.query}”. ${previewable.length} remain in preview. ${response.existing} already on the list, ${response.filtered} filtered.${more}`,
      );
      await loadContacts();
    } catch (err) {
      setError(providerError(err));
    } finally {
      setImporting(false);
    }
  }

  async function addExclusion() {
    const pattern = exclusionInput.trim();
    if (!pattern) return;
    setBusy(true);
    setError(null);
    try {
      const token = await getToken();
      await api.post("/admin/email-contacts/exclusions", { pattern }, token);
      setExclusionInput("");
      await loadExclusions();
    } catch (err) {
      const text = providerError(err);
      if (/already on the list/i.test(text)) {
        setExclusionInput("");
        await loadExclusions();
      }
      setError(text);
    } finally {
      setBusy(false);
    }
  }

  async function removeExclusion(id: string) {
    try {
      const token = await getToken();
      await api.delete(`/admin/email-contacts/exclusions/${id}`, token);
      await loadExclusions();
    } catch (err) {
      setError(providerError(err));
    }
  }

  async function saveProfile() {
    if (!profileName.trim() || !query.trim()) return;
    try {
      const token = await getToken();
      await api.post("/admin/gmail/search-profiles", { name: profileName.trim(), query: query.trim() }, token);
      setProfileName("");
      await loadProfiles();
    } catch (err) {
      setError(providerError(err));
    }
  }

  async function deleteProfile(id: string) {
    if (!window.confirm("Delete this saved search?")) return;
    const token = await getToken();
    await api.delete(`/admin/gmail/search-profiles/${id}`, token);
    await loadProfiles();
  }

  function toggleCandidate(id: string) {
    setSelectedIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  function toggleSelectPage() {
    const pageIds = pagedCandidates
      .filter((candidate) => candidate.status !== "invalid")
      .map((candidate) => candidate.id);
    setSelectedIds((current) => {
      const allOn = pageIds.length > 0 && pageIds.every((id) => current.includes(id));
      if (allOn) return current.filter((id) => !pageIds.includes(id));
      return [...new Set([...current, ...pageIds])];
    });
  }

  function toggleSelectAllLoaded() {
    if (allLoadedSelected) {
      setSelectedIds([]);
      return;
    }
    setSelectedIds(selectableCandidates.map((candidate) => candidate.id));
  }

  function dismissCandidates(ids: string[]) {
    if (ids.length === 0) return;
    const emails = candidates
      .filter((candidate) => ids.includes(candidate.id))
      .map((candidate) => candidate.email.trim().toLowerCase());
    setDismissedEmails((current) => [...new Set([...current, ...emails])]);
    setSelectedIds((current) => current.filter((id) => !ids.includes(id)));
  }

  async function saveSelected() {
    if (selectedIds.length === 0) return;
    if (!searchSessionId) {
      setError("This preview expired. Load matches again, then add selected contacts.");
      return;
    }
    const summary = `${selectedIds.length} selected contact${selectedIds.length === 1 ? "" : "s"} will be added to the shared master list.`;
    if (!window.confirm(summary)) return;
    setError(null);
    setBusy(true);
    try {
      const token = await getToken();
      const savedIds = selectedIds;
      const response = unwrapData<{ added: number; existing: number }>(await api.post("/admin/gmail/candidates/save", {
        searchSessionId,
        candidateIds: selectedIds,
      }, token));
      setCandidates((current) => current.map((candidate) => (
        savedIds.includes(candidate.id) && candidate.status === "new"
          ? { ...candidate, status: "already_in_list" as const }
          : candidate
      )));
      setMessage(`Added ${response.added} new contact${response.added === 1 ? "" : "s"} (${response.existing} already on the list).`);
      setSelectedIds([]);
      await loadContacts();
    } catch (err) {
      setError(providerError(err));
    } finally {
      setBusy(false);
    }
  }

  async function saveManual() {
    setBusy(true);
    try {
      const token = await getToken();
      const payload = { email: editing?.email ?? manualEmail, firstName: editing ? manualName : manualName };
      if (editing) {
        await api.patch(`/admin/email-contacts/${editing.id}`, { firstName: manualName, email: manualEmail }, token);
      } else {
        await api.post("/admin/email-contacts", payload, token);
      }
      setManualOpen(false);
      setEditing(null);
      setManualEmail("");
      setManualName("");
      await loadContacts();
    } catch (err) {
      setError(providerError(err));
    } finally {
      setBusy(false);
    }
  }

  const allVisibleSelected = contacts.length > 0 && contacts.every((row) => selectedContactIds.includes(row.id));
  const someVisibleSelected = contacts.some((row) => selectedContactIds.includes(row.id));

  useEffect(() => {
    if (!selectAllRef.current) return;
    selectAllRef.current.indeterminate = someVisibleSelected && !allVisibleSelected;
  }, [allVisibleSelected, someVisibleSelected]);

  useEffect(() => {
    if (!candidateSelectAllRef.current) return;
    candidateSelectAllRef.current.indeterminate = somePageSelected && !allPageSelected;
  }, [allPageSelected, somePageSelected]);

  useEffect(() => {
    if (candidatePage > candidateTotalPages) {
      setCandidatePage(candidateTotalPages);
    }
  }, [candidatePage, candidateTotalPages]);

  function toggleContact(id: string) {
    setSelectedContactIds((current) => (
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    ));
  }

  function toggleSelectAllVisible() {
    const visibleIds = contacts.map((row) => row.id);
    setSelectedContactIds((current) => (
      allVisibleSelected
        ? current.filter((id) => !visibleIds.includes(id))
        : [...new Set([...current, ...visibleIds])]
    ));
  }

  async function deleteContacts(ids: string[]) {
    if (ids.length === 0) return;
    if (!window.confirm(`Remove ${ids.length} contact${ids.length === 1 ? "" : "s"} from the Contacts list?`)) return;
    const token = await getToken();
    if (ids.length === 1) {
      await api.delete(`/admin/email-contacts/${ids[0]}`, token);
    } else {
      await api.post("/admin/email-contacts/bulk-delete", { ids }, token);
    }
    setSelectedContactIds([]);
    await loadContacts();
  }

  async function previewCsv(file: File) {
    setBusy(true);
    setError(null);
    try {
      const token = await getToken();
      const form = new FormData();
      form.append("file", file);
      const response = unwrapData<{
        importSessionId: string;
        preview: { rows: CsvPreviewRow[] };
      }>(await api.postForm("/admin/email-contacts/import/preview", form, token));
      setImportSessionId(response.importSessionId);
      setCsvPreview(response.preview.rows ?? []);
    } catch (err) {
      setError(providerError(err));
    } finally {
      setBusy(false);
    }
  }

  async function commitCsv() {
    if (!importSessionId || csvNewRows.length === 0) return;
    if (!window.confirm(`Import ${csvNewRows.length} unique new address${csvNewRows.length === 1 ? "" : "es"}? Existing contacts and duplicates will not be added.`)) return;
    setBusy(true);
    try {
      const token = await getToken();
      const response = unwrapData<{
        added: number;
        alreadyExisted: number;
        duplicateInFile?: number;
        invalid: number;
        skipped?: number;
      }>(await api.post("/admin/email-contacts/import/commit", { importSessionId }, token));
      const skippedDupes = (response.alreadyExisted ?? 0) + (response.duplicateInFile ?? 0);
      setMessage(`Imported ${response.added} unique contact${response.added === 1 ? "" : "s"}. ${skippedDupes} duplicate${skippedDupes === 1 ? "" : "s"} skipped, ${response.invalid} invalid.`);
      setImportSessionId(null);
      setCsvPreview([]);
      await loadContacts();
    } catch (err) {
      setError(providerError(err));
    } finally {
      setBusy(false);
    }
  }

  async function exportCsv() {
    const token = await getToken();
    await api.downloadBlob("/admin/email-contacts/export", token, "email-contacts.csv");
  }

  const totalPages = Math.max(1, Math.ceil(contactTotal / PAGE_SIZE));
  const connected = status?.status === "connected";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="space-y-6"
    >
      <div>
        <h2 className="text-2xl font-bold text-white">Emails</h2>
        <p className="mt-1 text-white/55">Search Gmail by keyword, skip filtered addresses, and export the shared AWeber-ready list.</p>
      </div>

      <div className="rounded-xl border border-cyan-400/20 bg-cyan-400/5 px-4 py-3 text-sm text-white/70" data-emails-compliance-notice>
        {COMPLIANCE_NOTICE}
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{error}</div>
      ) : null}
      {message ? (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">{message}</div>
      ) : null}

      <Card>
        <h3 className="text-lg font-semibold text-white">Gmail connection</h3>
        <p className="mt-1 text-sm text-white/55">
          {status?.status === "connected" && status.gmailAddress
            ? `Connected as ${status.gmailAddress}`
            : status?.status === "expired"
              ? "Gmail connection expired."
              : status?.status === "error"
                ? "Gmail connection needs attention."
                : "Not connected."}
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => void connectGmail()}
            className="rounded-lg bg-accent-cyan px-4 py-2 text-sm font-medium text-black"
          >
            {connected ? "Reconnect" : "Connect Gmail"}
          </button>
          {status && status.status !== "disconnected" ? (
            <button
              type="button"
              onClick={() => void disconnect()}
              className="rounded-lg border border-white/15 px-4 py-2 text-sm text-white/80"
            >
              Disconnect
            </button>
          ) : null}
        </div>
      </Card>

      <Card>
        <h3 className="text-lg font-semibold text-white">Exclusion filters</h3>
        <p className="mt-1 text-sm text-white/55">
          Skip a full address or a domain such as <span className="text-white/80">@facebook.com</span>. Shared for every admin.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <input
            value={exclusionInput}
            onChange={(event) => setExclusionInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void addExclusion();
              }
            }}
            placeholder="@facebook.com or name@domain.com"
            className="min-w-[240px] flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-accent-cyan/40"
          />
          <button
            type="button"
            disabled={busy || !exclusionInput.trim()}
            onClick={() => void addExclusion()}
            className="rounded-lg bg-accent-cyan px-4 py-2 text-sm font-medium text-black disabled:opacity-40"
          >
            Add filter
          </button>
        </div>
        {exclusions.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {exclusions.map((rule) => (
              <span key={rule.id} className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70">
                {rule.pattern}
                <button type="button" onClick={() => void removeExclusion(rule.id)} aria-label={`Remove ${rule.pattern}`}>×</button>
              </span>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-white/40">No filters yet. Add @google.com or a specific address to keep those out of the list.</p>
        )}
      </Card>

      <Card>
        <h3 className="text-lg font-semibold text-white">Keyword import</h3>
        <p className="mt-1 text-sm text-white/55">
          Load up to 1,000 unique matching addresses into Candidate preview, then select the ones to add. Choose a year to search only that calendar year, or leave All years. A large load can take a minute. Addresses already on Contacts, exclusion filters, and automated senders stay out of the preview.
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-[1fr_140px_220px_auto]">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Adronis"
            aria-label="Keyword"
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-accent-cyan/40"
          />
          <select
            value={searchYear}
            onChange={(event) => setSearchYear(event.target.value)}
            aria-label="Search year"
            className="rounded-xl border border-white/10 bg-[#0f1327] px-4 py-3 text-sm text-white outline-none focus:border-accent-cyan/40"
          >
            <option value="">All years</option>
            {SEARCH_YEAR_OPTIONS.map((year) => (
              <option key={year} value={String(year)}>{year}</option>
            ))}
          </select>
          <input
            value={profileName}
            onChange={(event) => setProfileName(event.target.value)}
            placeholder="Save as profile"
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-accent-cyan/40"
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={searching || !connected || !query.trim()}
              onClick={() => void runSearch()}
              className="rounded-lg bg-accent-cyan px-4 py-2 text-sm font-medium text-black disabled:opacity-40"
            >
              {searching && candidates.length === 0 ? "Loading…" : "Load 1,000 matches"}
            </button>
            <button
              type="button"
              disabled={importing || !connected || !query.trim()}
              onClick={() => void importMatches()}
              className="rounded-lg border border-white/15 px-4 py-2 text-sm text-white/80 disabled:opacity-40"
            >
              {importing ? "Importing…" : "Import matching contacts"}
            </button>
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setSearchYear("");
                setCandidates([]);
                setSearchSessionId(null);
                setSelectedIds([]);
                setDismissedEmails([]);
                setNextPageToken(null);
                setHasMoreCandidates(false);
                setCandidatePage(1);
                setLastImport(null);
              }}
              className="rounded-lg border border-white/15 px-4 py-2 text-sm text-white/80"
            >
              Clear
            </button>
            <button type="button" onClick={() => void saveProfile()} className="rounded-lg border border-white/15 px-4 py-2 text-sm text-white/80">
              Save profile
            </button>
          </div>
        </div>
        {profiles.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {profiles.map((profile) => (
              <span key={profile.id} className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70">
                <button type="button" onClick={() => setQuery(profile.query)}>{profile.name}</button>
                <button type="button" onClick={() => void deleteProfile(profile.id)} aria-label={`Delete ${profile.name}`}>×</button>
              </span>
            ))}
          </div>
        ) : null}
        {lastImport ? (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/70">
            <span>
              Last import: {lastImport.added} added, {lastImport.existing} existing, {lastImport.filtered} filtered
              {lastImport.invalid ? `, ${lastImport.invalid} invalid` : ""} across {lastImport.pages} page{lastImport.pages === 1 ? "" : "s"}.
            </span>
            {lastImport.hasMore && lastImport.nextPageToken ? (
              <button
                type="button"
                disabled={importing}
                onClick={() => void importMatches(lastImport.nextPageToken ?? undefined)}
                className="rounded-lg border border-white/15 px-3 py-1.5 text-sm text-white/80 disabled:opacity-40"
              >
                {importing ? "Importing…" : "Continue (next 1,000)"}
              </button>
            ) : null}
          </div>
        ) : null}
      </Card>

      <Card className="overflow-hidden p-0">
        <div className="flex flex-wrap items-start justify-between gap-4 px-6 pt-6">
          <div>
            <h3 className="text-lg font-semibold text-white">Candidate preview</h3>
            <p className="mt-1 text-sm text-white/45">
              {visibleCandidates.length === 0
                ? "Only new addresses appear here. Already-listed and filtered emails are removed automatically."
                : `${visibleCandidates.length} new address${visibleCandidates.length === 1 ? "" : "es"} ready to add. Showing ${CANDIDATE_PAGE_SIZE} per page.`}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {hasMoreCandidates && nextPageToken ? (
              <button
                type="button"
                disabled={searching}
                onClick={() => void runSearch(nextPageToken)}
                className="rounded-lg border border-white/15 px-3 py-2 text-sm text-white/80 disabled:opacity-40"
              >
                {searching ? "Loading…" : "Continue (next 1,000)"}
              </button>
            ) : null}
            <button
              type="button"
              disabled={selectableCandidates.length === 0}
              onClick={toggleSelectAllLoaded}
              className="rounded-lg border border-white/15 px-3 py-2 text-sm text-white/80 disabled:opacity-40"
            >
              {allLoadedSelected ? "Clear selection" : "Select all loaded"}
            </button>
            <button
              type="button"
              disabled={selectedIds.length === 0}
              onClick={() => dismissCandidates(selectedIds)}
              className="rounded-lg border border-white/15 px-3 py-2 text-sm text-white/80 disabled:opacity-40"
            >
              {selectedIds.length > 0 ? `Remove selected (${selectedIds.length})` : "Remove selected"}
            </button>
            <button type="button" disabled={busy || selectedIds.length === 0} onClick={() => void saveSelected()} className="rounded-lg bg-accent-cyan px-4 py-2 text-sm font-medium text-black disabled:opacity-40">
              {busy
                ? "Adding…"
                : selectedIds.length > 0 ? `Add selected to Contacts (${selectedIds.length})` : "Add selected to Contacts"}
            </button>
          </div>
        </div>
        {visibleCandidates.length === 0 && (searching || importing) ? <Loading /> : visibleCandidates.length === 0 ? (
          <EmptyState title="No candidates yet" message="Load 1,000 matches to preview new addresses here. Already-listed and filtered emails are skipped." />
        ) : (
          <>
            <Table
              columns={[
                {
                  key: "id",
                  label: (
                    <input
                      ref={candidateSelectAllRef}
                      type="checkbox"
                      aria-label="Select all candidates on this page"
                      checked={allPageSelected}
                      onChange={toggleSelectPage}
                    />
                  ),
                  render: (_value, row) => (
                    <input
                      type="checkbox"
                      aria-label={`Select ${row.email}`}
                      checked={selectedIds.includes(row.id)}
                      disabled={row.status === "invalid"}
                      onChange={() => toggleCandidate(row.id)}
                    />
                  ),
                },
                { key: "firstName", label: "Name", render: (value) => String(value ?? "—") },
                { key: "email", label: "Email" },
                { key: "firstContact", label: "First", render: (value) => formatDate(String(value ?? "")) },
                { key: "lastContact", label: "Last", render: (value) => formatDate(String(value ?? "")) },
                { key: "messageCount", label: "Count" },
                { key: "twoWay", label: "Two-way", render: (value) => (value ? "Yes" : "No") },
                {
                  key: "actions",
                  label: "",
                  render: (_value, row) => (
                    <button
                      type="button"
                      className="text-rose-200"
                      onClick={() => dismissCandidates([row.id])}
                    >
                      Remove
                    </button>
                  ),
                },
              ]}
              data={pagedCandidates}
            />
            {visibleCandidates.length > CANDIDATE_PAGE_SIZE ? (
              <div className="flex items-center justify-center gap-3 px-6 py-4">
                <button
                  type="button"
                  disabled={candidatePage <= 1}
                  onClick={() => setCandidatePage((value) => value - 1)}
                  className="rounded-lg bg-glass px-4 py-2 text-sm text-white/70 disabled:opacity-30"
                >
                  Previous
                </button>
                <span className="text-sm text-white/50">
                  Page {candidatePage} of {candidateTotalPages}
                </span>
                <button
                  type="button"
                  disabled={candidatePage >= candidateTotalPages}
                  onClick={() => setCandidatePage((value) => value + 1)}
                  className="rounded-lg bg-glass px-4 py-2 text-sm text-white/70 disabled:opacity-30"
                >
                  Next
                </button>
              </div>
            ) : null}
          </>
        )}
      </Card>

      <Card>
        <div className="flex flex-wrap items-end justify-between gap-4" data-emails-contacts-section>
          <div>
            <h3 className="text-lg font-semibold text-white">Contacts</h3>
            <p className="mt-1 text-sm text-white/55">
              {contactTotal} saved contact{contactTotal === 1 ? "" : "s"}. Search by email, then select and remove any you do not want.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              value={contactSearchInput}
              onChange={(event) => setContactSearchInput(event.target.value)}
              placeholder="Search by email or name"
              aria-label="Search contacts by email or name"
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white"
            />
            <select
              value={sourceFilter}
              onChange={(event) => {
                setSourceFilter(event.target.value);
                setContactPage(1);
              }}
              className="rounded-xl border border-white/10 bg-[#0f1327] px-3 py-2 text-sm text-white"
            >
              <option value="">All sources</option>
              <option value="gmail">Gmail</option>
              <option value="csv">CSV</option>
              <option value="manual">Manual</option>
            </select>
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value as typeof sort)}
              className="rounded-xl border border-white/10 bg-[#0f1327] px-3 py-2 text-sm text-white"
            >
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="email">Email</option>
              <option value="name">Name</option>
            </select>
            <button
              type="button"
              onClick={() => {
                setEditing(null);
                setManualEmail("");
                setManualName("");
                setManualOpen(true);
              }}
              className="rounded-lg bg-accent-cyan px-4 py-2 text-sm font-medium text-black"
            >
              Add contact
            </button>
            <button
              type="button"
              disabled={selectedContactIds.length === 0}
              onClick={() => void deleteContacts(selectedContactIds)}
              className="rounded-lg border border-white/15 px-4 py-2 text-sm text-white/80 disabled:opacity-40"
            >
              {selectedContactIds.length > 0 ? `Remove selected (${selectedContactIds.length})` : "Remove selected"}
            </button>
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden p-0">
        {loadingContacts ? <Loading /> : contacts.length === 0 ? (
          <EmptyState
            title={contactSearch ? "No matching contacts" : "No contacts yet"}
            message={contactSearch
              ? `No saved contacts match “${contactSearch}”.`
              : "Import matching Gmail contacts, add one manually, or import a CSV."}
          />
        ) : (
          <Table
            columns={[
              {
                key: "select",
                label: (
                  <input
                    ref={selectAllRef}
                    type="checkbox"
                    aria-label="Select all visible contacts"
                    checked={allVisibleSelected}
                    onChange={toggleSelectAllVisible}
                  />
                ),
                render: (_value, row) => (
                  <input
                    type="checkbox"
                    aria-label={`Select ${row.email}`}
                    checked={selectedContactIds.includes(row.id)}
                    onChange={() => toggleContact(row.id)}
                  />
                ),
              },
              { key: "firstName", label: "Name", render: (value) => String(value ?? "—") },
              { key: "email", label: "Email" },
              { key: "source", label: "Source" },
              { key: "createdAt", label: "Date added", render: (value) => formatDate(String(value)) },
              {
                key: "actions",
                label: "",
                render: (_value, row) => (
                  <span className="flex gap-2">
                    <button
                      type="button"
                      className="text-accent-cyan"
                      onClick={() => {
                        setEditing(row);
                        setManualEmail(row.email);
                        setManualName(row.firstName ?? "");
                        setManualOpen(true);
                      }}
                    >
                      Edit
                    </button>
                    <button type="button" className="text-rose-200" onClick={() => void deleteContacts([row.id])}>
                      Remove
                    </button>
                  </span>
                ),
              },
            ]}
            data={contacts}
          />
        )}
      </Card>

      {contactTotal > PAGE_SIZE ? (
        <div className="flex items-center justify-center gap-3">
          <button type="button" disabled={contactPage <= 1} onClick={() => setContactPage((value) => value - 1)} className="rounded-lg bg-glass px-4 py-2 text-sm text-white/70 disabled:opacity-30">
            Previous
          </button>
          <span className="text-sm text-white/50">Page {contactPage} of {totalPages}</span>
          <button type="button" disabled={contactPage >= totalPages} onClick={() => setContactPage((value) => value + 1)} className="rounded-lg bg-glass px-4 py-2 text-sm text-white/70 disabled:opacity-30">
            Next
          </button>
        </div>
      ) : null}

      <Card>
        <h3 className="text-lg font-semibold text-white">CSV import / export</h3>
        <p className="mt-1 text-sm text-white/55">
          Preview first. Addresses already on Contacts, repeated in the file, or on the exclusion list are removed automatically. Only unique new addresses remain.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <label className="rounded-lg border border-white/15 px-4 py-2 text-sm text-white/80">
            Choose CSV
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void previewCsv(file);
              }}
            />
          </label>
          <button type="button" disabled={!importSessionId || busy || csvNewRows.length === 0} onClick={() => void commitCsv()} className="rounded-lg bg-accent-cyan px-4 py-2 text-sm font-medium text-black disabled:opacity-40">
            Commit import
          </button>
          <button type="button" onClick={() => void exportCsv()} className="rounded-lg border border-white/15 px-4 py-2 text-sm text-white/80">
            Export CSV
          </button>
        </div>
        {csvPreview.length > 0 ? (
          <div className="mt-4">
            <p className="text-sm text-white/55">
              {csvNewRows.length} unique new address{csvNewRows.length === 1 ? "" : "es"} remain{csvNewRows.length === 1 ? "s" : ""}.
              {csvSkipCounts.exists ? ` ${csvSkipCounts.exists} already on Contacts.` : ""}
              {csvSkipCounts.duplicateInFile ? ` ${csvSkipCounts.duplicateInFile} repeat${csvSkipCounts.duplicateInFile === 1 ? "" : "s"} in this file.` : ""}
              {csvSkipCounts.excluded ? ` ${csvSkipCounts.excluded} filtered.` : ""}
              {csvSkipCounts.invalid ? ` ${csvSkipCounts.invalid} invalid.` : ""}
            </p>
            {csvNewRows.length > 0 ? (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-sm text-white/75">
                  <thead>
                    <tr className="text-left text-xs uppercase text-white/40">
                      <th className="py-2">Row</th>
                      <th>Email</th>
                      <th>Name</th>
                    </tr>
                  </thead>
                  <tbody>
                    {csvNewRows.slice(0, 25).map((row) => (
                      <tr key={`${row.rowNumber}-${row.email}`}>
                        <td className="py-1">{row.rowNumber}</td>
                        <td>{row.email}</td>
                        <td>{row.firstName ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {csvNewRows.length > 25 ? (
                  <p className="mt-2 text-xs text-white/40">Showing the first 25 of {csvNewRows.length} unique new addresses.</p>
                ) : null}
              </div>
            ) : (
              <p className="mt-3 text-sm text-white/40">Nothing new to import. Every address was already on Contacts, repeated, filtered, or invalid.</p>
            )}
          </div>
        ) : null}
      </Card>

      {manualOpen ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0f1327] p-6">
            <h3 className="text-lg font-semibold text-white">{editing ? "Edit contact" : "Add contact"}</h3>
            <div className="mt-4 space-y-3">
              <input
                value={manualEmail}
                onChange={(event) => setManualEmail(event.target.value)}
                placeholder="Email"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white"
              />
              <input
                value={manualName}
                onChange={(event) => setManualName(event.target.value)}
                placeholder="First name"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white"
              />
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setManualOpen(false)} className="rounded-lg border border-white/15 px-4 py-2 text-sm text-white/80">
                Cancel
              </button>
              <button type="button" disabled={busy} onClick={() => void saveManual()} className="rounded-lg bg-accent-cyan px-4 py-2 text-sm font-medium text-black">
                Save
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </motion.div>
  );
}
