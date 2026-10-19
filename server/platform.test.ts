import { afterEach, describe, expect, it, vi } from "vitest";
import { getSessionCookieOptions } from "./_core/cookies";
import { sdk } from "./_core/sdk";
import { listLLMModels } from "./_core/llm";
import { generateImage } from "./_core/imageGeneration";
import { COOKIE_NAME } from "../shared/const";

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
describe("current platform integration", () => {
  it("does not guess a production API when the project environment is absent", async () => {
    vi.stubEnv("AI_API_URL", ""); vi.stubEnv("AI_API_KEY", "test-only");
    const request = vi.fn(); vi.stubGlobal("fetch", request);
    await expect(listLLMModels()).rejects.toThrow("AI_API_URL");
    expect(request).not.toHaveBeenCalled();
  });
  it("persists URL-only image results through current managed storage", async () => {
    vi.stubEnv("PLATFORM_API_URL", "https://api.example"); vi.stubEnv("PLATFORM_API_KEY", "test-only"); vi.stubEnv("SUPABASE_URL", "https://storage.example"); vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "storage-test-only"); vi.stubEnv("SUPABASE_STORAGE_BUCKET", "ticket-attachments");
    const request = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ image: { url: "https://image.example/result.png", mimeType: "image/png" } })))
      .mockResolvedValueOnce(new Response(new Uint8Array([1, 2, 3])))
      .mockResolvedValueOnce(new Response(JSON.stringify({ url: "https://upload.example/object" })))
      .mockResolvedValueOnce(new Response(""));
    vi.stubGlobal("fetch", request);
    const image = await generateImage({ prompt: "test", originalImages: [] });
    expect(image.url).toMatch(/^supabase-storage:\/\/ticket-attachments\/generated\//);
    expect(request).toHaveBeenCalledTimes(3);
    expect(JSON.parse(request.mock.calls[0][1].body)).toHaveProperty("originalImages");
  });
  it("uses a distinct secure app cookie behind the HTTPS Preview proxy", () => {
    expect(COOKIE_NAME).not.toBe("app_session_id");
    expect(getSessionCookieOptions({ protocol: "http", headers: {} } as never)).toMatchObject({ secure: true, httpOnly: true, sameSite: "none" });
  });
  it("binds signed app sessions to this project and accepts an empty display name", async () => {
    vi.stubEnv("MANUS_PROJECT_ID", "project-test");
    vi.stubEnv("MANUS_JWT_SECRET", "unit-test-signing-key-never-deployed");
    const token = await sdk.signSession({ openId: "user-test", appId: "project-test", name: "" });
    expect(await sdk.verifySession(token)).toMatchObject({ openId: "user-test" });
    vi.stubEnv("MANUS_PROJECT_ID", "different-project");
    expect(await sdk.verifySession(token)).toBeNull();
  });
});
