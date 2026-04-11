const FACEBOOK_GRAPH_API_BASE_URL = "https://graph.facebook.com/v25.0";
const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000;

export interface FacebookLatestPost {
  id: string;
  message: string | null;
  permalinkUrl: string;
  createdTime: string;
  fullPicture: string | null;
}

interface FacebookGraphPost {
  id?: string;
  message?: string;
  permalink_url?: string;
  created_time?: string;
  full_picture?: string;
}

interface FacebookGraphFeedResponse {
  data?: FacebookGraphPost[];
}

let cachedLatestPost: FacebookLatestPost | null = null;
let cachedLatestPostExpiresAt = 0;
let latestPostRequest: Promise<FacebookLatestPost | null> | null = null;

function getCacheTtlMs() {
  const rawValue = Number(process.env.FACEBOOK_GRAPH_CACHE_TTL_MS);
  return Number.isFinite(rawValue) && rawValue > 0 ? rawValue : DEFAULT_CACHE_TTL_MS;
}

function getFacebookPageId() {
  return process.env.FACEBOOK_PAGE_ID?.trim() || "";
}

function getFacebookPageAccessToken() {
  return process.env.FACEBOOK_PAGE_ACCESS_TOKEN?.trim() || "";
}

export function isFacebookGraphConfigured() {
  return Boolean(getFacebookPageId() && getFacebookPageAccessToken());
}

function isCacheValid() {
  return Date.now() < cachedLatestPostExpiresAt;
}

function normalizePost(post: FacebookGraphPost): FacebookLatestPost | null {
  if (!post.id || !post.permalink_url || !post.created_time) {
    return null;
  }

  const message = typeof post.message === "string" && post.message.trim() ? post.message.trim() : null;
  const fullPicture = typeof post.full_picture === "string" && post.full_picture.trim()
    ? post.full_picture.trim()
    : null;

  return {
    id: post.id,
    message,
    permalinkUrl: post.permalink_url,
    createdTime: post.created_time,
    fullPicture,
  };
}

async function requestLatestFacebookPost() {
  const pageId = getFacebookPageId();
  const accessToken = getFacebookPageAccessToken();

  if (!pageId || !accessToken) {
    return null;
  }

  const url = new URL(`${FACEBOOK_GRAPH_API_BASE_URL}/${encodeURIComponent(pageId)}/feed`);
  url.searchParams.set("limit", "5");
  url.searchParams.set("fields", "id,message,permalink_url,created_time,full_picture");
  url.searchParams.set("access_token", accessToken);

  const response = await fetch(url);
  const rawBody = await response.text();

  if (!response.ok) {
    throw new Error(`Facebook Graph API request failed with status ${response.status}: ${rawBody}`);
  }

  const payload = JSON.parse(rawBody) as FacebookGraphFeedResponse;
  const latestPost = (payload.data ?? [])
    .map(normalizePost)
    .find((post) => post !== null) ?? null;

  cachedLatestPost = latestPost;
  cachedLatestPostExpiresAt = Date.now() + getCacheTtlMs();
  return latestPost;
}

export async function getLatestFacebookPost() {
  if (!isFacebookGraphConfigured()) {
    return null;
  }

  if (isCacheValid()) {
    return cachedLatestPost;
  }

  if (!latestPostRequest) {
    latestPostRequest = requestLatestFacebookPost().finally(() => {
      latestPostRequest = null;
    });
  }

  return latestPostRequest;
}
