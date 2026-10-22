import { setToken } from "./auth";

const jsonResponse = (status, data) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: () => "application/json" },
  json: async () => data,
  text: async () => JSON.stringify(data)
});

const originalFetch = global.fetch;

afterEach(() => {
  delete process.env.REACT_APP_BACKEND_URL;
  window.localStorage.clear();
  global.fetch = originalFetch;
});

test("refresh obtains CSRF from the API origin, not document.cookie", async () => {
  process.env.REACT_APP_BACKEND_URL = "https://api.rfargentina.com";
  jest.resetModules();
  const { apiRequest } = require("./api");
  setToken("expired-access-token");
  const fetchMock = jest.fn(async (url) => {
    if (url.endsWith("/auth/csrf")) return jsonResponse(200, { csrf_token: "api-origin-csrf" });
    if (url.endsWith("/auth/refresh")) return jsonResponse(200, { token: "new-access-token" });
    if (url.endsWith("/me")) {
      const token = fetchMock.mock.calls.filter(([requestUrl]) => requestUrl.endsWith("/me")).length;
      return token === 1 ? jsonResponse(401, { error: "expired" }) : jsonResponse(200, { role: "admin" });
    }
    throw new Error(`Unexpected request: ${url}`);
  });
  global.fetch = fetchMock;

  expect(await apiRequest("/me")).toEqual({ role: "admin" });
  expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
    "https://api.rfargentina.com/api/me",
    "https://api.rfargentina.com/api/auth/csrf",
    "https://api.rfargentina.com/api/auth/refresh",
    "https://api.rfargentina.com/api/me"
  ]);
  expect(fetchMock.mock.calls[1][1].credentials).toBe("include");
  expect(fetchMock.mock.calls[2][1]).toEqual(expect.objectContaining({
    credentials: "include",
    headers: expect.objectContaining({ "X-CSRF-Token": "api-origin-csrf" })
  }));
});

test("local same-origin proxy uses the same CSRF flow", async () => {
  jest.resetModules();
  const { apiRequest } = require("./api");
  setToken("expired-access-token");
  let meCalls = 0;
  const fetchMock = jest.fn(async (url) => {
    if (url === "/api/me") return ++meCalls === 1
      ? jsonResponse(401, { error: "expired" })
      : jsonResponse(200, { role: "admin" });
    if (url === "/api/auth/csrf") return jsonResponse(200, { csrf_token: "local-csrf" });
    if (url === "/api/auth/refresh") return jsonResponse(200, { token: "new-access-token" });
    throw new Error(`Unexpected request: ${url}`);
  });
  global.fetch = fetchMock;

  expect(await apiRequest("/me")).toEqual({ role: "admin" });
  expect(fetchMock.mock.calls[2][1].headers["X-CSRF-Token"]).toBe("local-csrf");
});
