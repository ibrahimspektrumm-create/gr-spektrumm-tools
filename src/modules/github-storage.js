const GH_API = "https://api.github.com";
const OWNER = "ibrahimspektrumm-create";
const REPO = "gr-spektrumm-tools";
const BRANCH = "main";
const ROOT = "gr-spektrumm-tools-files";

const TOKEN_KEY = "spektrumm_github_token";

export function getGithubToken() {
  return localStorage.getItem(TOKEN_KEY) || "";
}

export function saveGithubToken(token) {
  localStorage.setItem(TOKEN_KEY, token.trim());
}

export function clearGithubToken() {
  localStorage.removeItem(TOKEN_KEY);
}

function requireToken() {
  const token = getGithubToken();

  if (!token) {
    throw new Error("GITHUB_TOKEN_MISSING");
  }

  return token;
}

function headers() {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${requireToken()}`,
    "X-GitHub-Api-Version": "2026-03-10",
    "Content-Type": "application/json",
  };
}

function bytesToBase64(bytes) {
  let binary = "";
  const chunkSize = 0x8000;

  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(
      ...bytes.subarray(i, i + chunkSize)
    );
  }

  return btoa(binary);
}

async function githubRequest(url, options = {}) {
  const response = await fetch(url, options);

  let data = null;

  try {
    data = await response.json();
  } catch (_) {
    data = null;
  }

  if (!response.ok) {
    const message =
      data?.message ||
      data?.error ||
      `GitHub HTTP ${response.status}`;

    const error = new Error(message);
    error.status = response.status;
    throw error;
  }

  return data;
}

export async function uploadHtmlToGithub(file, userId) {
  if (!file) {
    throw new Error("FILE_MISSING");
  }

  const MAX = 90 * 1024 * 1024;

  if (file.size > MAX) {
    throw new Error("FILE_TOO_LARGE");
  }

  const safeName = file.name
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_+/g, "_");

  const timestamp = Date.now();

  const path =
    `${ROOT}/${userId}/${timestamp}_${safeName}`;

  const bytes = new Uint8Array(await file.arrayBuffer());

  const content = bytesToBase64(bytes);

  const url =
    `${GH_API}/repos/${OWNER}/${REPO}/contents/${encodeURIComponent(path)}`;

  const result = await githubRequest(url, {
    method: "PUT",
    headers: headers(),
    body: JSON.stringify({
      message: `Upload tool: ${safeName}`,
      content,
      branch: BRANCH,
    }),
  });

  const pagesUrl =
    `https://${OWNER}.github.io/${REPO}/${path}`;

  return {
    path,
    sha: result.content?.sha || "",
    githubUrl: result.content?.html_url || "",
    url: pagesUrl,
    rawUrl:
      `https://raw.githubusercontent.com/${OWNER}/${REPO}/${BRANCH}/${path}`,
  };
}

export async function deleteGithubFile(path, sha) {
  if (!path || !sha) return;

  const url =
    `${GH_API}/repos/${OWNER}/${REPO}/contents/${encodeURIComponent(path)}`;

  await githubRequest(url, {
    method: "DELETE",
    headers: headers(),
    body: JSON.stringify({
      message: `Delete tool file: ${path}`,
      sha,
      branch: BRANCH,
    }),
  });
}

export async function testGithubToken() {
  const data = await githubRequest(
    `${GH_API}/repos/${OWNER}/${REPO}`,
    {
      method: "GET",
      headers: headers(),
    }
  );

  return data;
}
