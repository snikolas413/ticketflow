import { connect as connectTls, type TLSSocket } from "node:tls";
import { ENV } from "./env";

const buffers = new WeakMap<TLSSocket, string>();
const waiters = new WeakMap<TLSSocket, Array<{ resolve: (value: string) => void; reject: (error: Error) => void }>>();

function attachReader(socket: TLSSocket) {
  buffers.set(socket, "");
  waiters.set(socket, []);
  socket.on("data", (chunk: Buffer) => {
    buffers.set(socket, (buffers.get(socket) ?? "") + chunk.toString("utf8"));
    const pending = waiters.get(socket) ?? [];
    while (pending.length) {
      const lines = (buffers.get(socket) ?? "").split("\r\n");
      const end = lines.findIndex(line => /^\d{3} /.test(line));
      if (end < 0) break;
      const reply = lines.slice(0, end + 1).join("\r\n");
      buffers.set(socket, lines.slice(end + 1).join("\r\n"));
      pending.shift()!.resolve(reply);
    }
  });
  socket.on("error", error => {
    const pending = waiters.get(socket) ?? [];
    while (pending.length) pending.shift()!.reject(error);
  });
}

function readReply(socket: TLSSocket): Promise<string> {
  const lines = (buffers.get(socket) ?? "").split("\r\n");
  const end = lines.findIndex(line => /^\d{3} /.test(line));
  if (end >= 0) {
    buffers.set(socket, lines.slice(end + 1).join("\r\n"));
    return Promise.resolve(lines.slice(0, end + 1).join("\r\n"));
  }
  return new Promise((resolve, reject) => waiters.get(socket)!.push({ resolve, reject }));
}

async function command(socket: TLSSocket, value?: string, accepted: number[] = [250]) {
  const replyPromise = readReply(socket);
  if (value) socket.write(value + "\r\n");
  const reply = await replyPromise;
  const code = Number(reply.match(/^(\d{3})/m)?.[1]);
  if (!accepted.includes(code)) throw new Error("Gmail SMTP error " + code);
  return reply;
}

function base64Url(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

async function sendWithGmailOAuth(to: string, resetUrl: string) {
  const clientId = ENV.gmailOAuthClientId;
  const clientSecret = ENV.gmailOAuthClientSecret;
  const refreshToken = ENV.gmailOAuthRefreshToken;
  const from = ENV.gmailUserEmail;

  if (!clientId || !clientSecret || !refreshToken || !from) {
    throw new Error("Gmail OAuth incompleto: configure client ID, client secret, refresh token e e-mail remetente no Render.");
  }

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
    signal: AbortSignal.timeout(15000),
  });
  if (!tokenResponse.ok) {
    throw new Error(`Gmail OAuth não conseguiu renovar o token (HTTP ${tokenResponse.status}). Confira client ID/secret, refresh token e permissões OAuth.`);
  }

  const tokenData = await tokenResponse.json() as { access_token?: string };
  if (!tokenData.access_token) throw new Error("Gmail OAuth não retornou access token.");

  const message = [
    `From: TicketFlow <${from}>`,
    `To: <${to}>`,
    "Subject: Recuperação de senha do TicketFlow",
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    Buffer.from([
      "Recebemos uma solicitação para redefinir sua senha do TicketFlow.",
      "",
      "Use o link abaixo em até 30 minutos. Ele pode ser utilizado uma única vez:",
      resetUrl,
      "",
      "Se você não solicitou esta alteração, ignore este e-mail.",
    ].join("\r\n"), "utf8").toString("base64").replace(/.{1,76}/g, "$&\r\n").trim(),
    "",
  ].join("\r\n");

  const sendResponse = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: {
      authorization: `Bearer ${tokenData.access_token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ raw: base64Url(message) }),
    signal: AbortSignal.timeout(15000),
  });
  if (!sendResponse.ok) {
    throw new Error(`Gmail API recusou o envio (HTTP ${sendResponse.status}). Verifique se a API Gmail está habilitada e se o OAuth tem o escopo gmail.send.`);
  }
}

async function sendWithSmtp(to: string, resetUrl: string) {
  if (!ENV.smtpUser || !ENV.smtpPass || !ENV.smtpFrom) throw new Error("Gmail não configurado: informe as credenciais OAuth ou as variáveis SMTP.");
  if (ENV.smtpPort !== 465) throw new Error("A configuração Gmail SMTP exige SMTP_PORT=465 (TLS).");
  const socket = connectTls({ host: ENV.smtpHost, port: ENV.smtpPort, servername: ENV.smtpHost });
  attachReader(socket);
  socket.setTimeout(15000, () => socket.destroy(new Error("Tempo limite SMTP excedido")));
  let stage = "TLS connection";
  try {
    await new Promise<void>((resolve, reject) => {
      socket.once("secureConnect", resolve);
      socket.once("error", reject);
    });
    stage = "SMTP greeting";
    await command(socket, undefined, [220]);
    stage = "EHLO";
    await command(socket, "EHLO ticketflow", [250]);
    stage = "SMTP authentication initiation";
    await command(socket, "AUTH LOGIN", [334]);
    stage = "SMTP username authentication";
    await command(socket, Buffer.from(ENV.smtpUser).toString("base64"), [334]);
    stage = "SMTP app-password authentication";
    await command(socket, Buffer.from(ENV.smtpPass).toString("base64"), [235]);
    stage = "sender validation";
    await command(socket, `MAIL FROM:<${ENV.smtpFrom}>`, [250]);
    stage = "recipient validation";
    await command(socket, `RCPT TO:<${to}>`, [250, 251]);
    stage = "message submission";
    await command(socket, "DATA", [354]);
    const body = [
      `From: TicketFlow <${ENV.smtpFrom}>`,
      `To: <${to}>`,
      "Subject: Recuperação de senha do TicketFlow",
      "MIME-Version: 1.0",
      "Content-Type: text/plain; charset=UTF-8",
      "",
      "Recebemos uma solicitação para redefinir sua senha do TicketFlow.",
      "",
      "Use o link abaixo em até 30 minutos. Ele pode ser utilizado uma única vez:",
      resetUrl,
      "",
      "Se você não solicitou esta alteração, ignore este e-mail.",
      "",
    ].join("\r\n").replace(/\r\n\./g, "\r\n..");
    stage = "message delivery acceptance";
    await command(socket, body + "\r\n.", [250]);
    stage = "SMTP session close";
    await command(socket, "QUIT", [221]);
  } catch (error) {
    const detail = error instanceof Error
      ? `${error.name}${error.message ? `: ${error.message}` : ""}`
      : String(error);
    throw new Error(`Gmail SMTP failed at ${stage} (${detail})`);
  } finally {
    socket.end();
  }
}

export async function sendPasswordResetEmail(to: string, resetUrl: string) {
  const hasAnyOAuthSetting = Boolean(ENV.gmailOAuthClientId || ENV.gmailOAuthClientSecret || ENV.gmailOAuthRefreshToken);
  if (hasAnyOAuthSetting) {
    await sendWithGmailOAuth(to, resetUrl);
    return;
  }
  await sendWithSmtp(to, resetUrl);
}
