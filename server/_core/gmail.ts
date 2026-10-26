import { ENV } from "./env";

function base64Url(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

export async function sendPasswordResetEmail(to: string, resetUrl: string) {
  const clientId = ENV.gmailOAuthClientId;
  const clientSecret = ENV.gmailOAuthClientSecret;
  const refreshToken = ENV.gmailOAuthRefreshToken;
  const from = ENV.gmailUserEmail;

  console.info("[Password reset] Gmail configuration presence", {
    clientId: Boolean(clientId),
    clientSecret: Boolean(clientSecret),
    refreshToken: Boolean(refreshToken),
    sender: Boolean(from),
  });
  if (!clientId || !clientSecret || !refreshToken || !from) {
    throw new Error("Gmail OAuth incompleto: configure GMAIL_OAUTH_CLIENT_ID, GMAIL_OAUTH_CLIENT_SECRET, GMAIL_OAUTH_REFRESH_TOKEN e GMAIL_USER_EMAIL no Render.");
  }

  console.info("[Password reset] Requesting Gmail OAuth access token");
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: "refresh_token" }),
    signal: AbortSignal.timeout(15000),
  });
  if (!tokenResponse.ok) throw new Error(`Gmail OAuth token request failed (HTTP ${tokenResponse.status}).`);
  const tokenData = await tokenResponse.json() as { access_token?: string };
  if (!tokenData.access_token) throw new Error("Gmail OAuth did not return an access token.");
  console.info("[Password reset] Gmail OAuth access token obtained");

  const bodyText = [
    "Recebemos uma solicitação para redefinir sua senha do TicketFlow.",
    "",
    "Use o link abaixo em até 30 minutos. Ele pode ser utilizado uma única vez:",
    resetUrl,
    "",
    "Se você não solicitou esta alteração, ignore este e-mail.",
  ].join("\r\n");

  const message = [
    `From: TicketFlow <${from}>`,
    `To: <${to}>`,
    "Subject: Recuperação de senha do TicketFlow",
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    Buffer.from(bodyText, "utf8").toString("base64").replace(/.{1,76}/g, "$&\r\n").trim(),
    "",
  ].join("\r\n");

  console.info("[Password reset] Submitting message to Gmail API");
  const sendResponse = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: { authorization: `Bearer ${tokenData.access_token}`, "content-type": "application/json" },
    body: JSON.stringify({ raw: base64Url(message) }),
    signal: AbortSignal.timeout(15000),
  });
  if (!sendResponse.ok) throw new Error(`Gmail API send failed (HTTP ${sendResponse.status}).`);
  console.info("[Password reset] Gmail API accepted the message");
}
