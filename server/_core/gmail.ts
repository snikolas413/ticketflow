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
      const buffer = buffers.get(socket) ?? "";
      const lines = buffer.split("\r\n");
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
  const buffer = buffers.get(socket) ?? "";
  const lines = buffer.split("\r\n");
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

export async function sendPasswordResetEmail(to: string, resetUrl: string) {
  if (!ENV.smtpUser || !ENV.smtpPass || !ENV.smtpFrom) throw new Error("SMTP Gmail não configurado no ambiente");
  if (ENV.smtpPort !== 465) throw new Error("A configuração Gmail exige SMTP_PORT=465 (TLS)");
  const socket = connectTls({ host: ENV.smtpHost, port: ENV.smtpPort, servername: ENV.smtpHost });
  attachReader(socket);
  socket.setTimeout(15000, () => socket.destroy(new Error("Tempo limite SMTP excedido")));
  try {
    await new Promise<void>((resolve, reject) => {
      socket.once("secureConnect", resolve);
      socket.once("error", reject);
    });
    await command(socket, undefined, [220]);
    await command(socket, "EHLO ticketflow", [250]);
    await command(socket, "AUTH LOGIN", [334]);
    await command(socket, Buffer.from(ENV.smtpUser).toString("base64"), [334]);
    await command(socket, Buffer.from(ENV.smtpPass).toString("base64"), [235]);
    await command(socket, `MAIL FROM:<${ENV.smtpFrom}>`, [250]);
    await command(socket, `RCPT TO:<${to}>`, [250, 251]);
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
    await command(socket, body + "\r\n.", [250]);
    await command(socket, "QUIT", [221]);
  } finally {
    socket.end();
  }
}
