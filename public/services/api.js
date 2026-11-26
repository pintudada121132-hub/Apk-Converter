// All calls to the local build server live here.

async function request(path, options) {
  let res;
  try {
    res = await fetch(path, options);
  } catch {
    throw new ApiError('Can\'t reach the build server. Make sure it is still running (start.bat), then try again.', 'network');
  }
  let data = {};
  try { data = await res.json(); } catch { /* non-JSON response */ }
  if (!res.ok) {
    const list = data.errors || [data.error || `Server error (${res.status})`];
    throw new ApiError(list.join(' '), res.status === 400 ? 'validation' : 'server', list);
  }
  return data;
}

export class ApiError extends Error {
  constructor(message, kind, list) {
    super(message);
    this.kind = kind;
    this.list = list || [message];
  }
}

export const getStatus = () => request('/api/status');

export const startBuild = (payload) => request('/api/build', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload),
});

export const getBuild = (id) => request('/api/build/' + encodeURIComponent(id));

export const downloadUrl = (id) => '/download/' + encodeURIComponent(id);
