import { connect as connectTls, type TLSSocket } from "node:tls";
import { ENV } from "./env";

function readReply(socket: TLSSocket): Promise<string> {
  return new Promise((resolve, reject) => {
    let buffer = "";
    const cleanup = () => { socket.off("data", onData); socket.off("error", onError); };
    const onError = (error: Error) => { cleanup(); reject(error); };
    const onData = (chunk: Buffer) => {
      buffer += chunk.toString("utf8");
      const lines = buffer.split("\\r\\n");
      const final = [...lines].reverse().find(line => /^\\d{3} /.test(line));
      if (final) { cleanup(); resolve(buffer); }
    };
    socket.on("data", onData);
    socket.once("error", onError);
  });
}

async function command(socket: TLSSocket, value?: string, accepted: number[] = [250]) {
  const replyPromise = readReply(socket);
  if (value) socket.write(value + "\\r\\n");
  const reply = await replyPromise;
  const code = Number(reply.match(/^(\\d{3})/m)?.[1]);
  if (!accepted.includes(code)) throw new Error("Gmail SMTP error " + code);
  return reply;
}

export async function sendPasswordResetEmail(to: string, resetUrl: string) {
  if (!ENV.smtpUser || !ENV.smtpPass || !ENV.smtpFrom) throw new Error("SMTP Gmail não configurado no ambiente");
  if (ENV.smtpPort !== 465) throw new Error("A configuração Gmail exige SMTP_PORT=465 (TLS)");
  const socket = connectTls({ host: ENV.smtpHost, port: ENV.smtpPort, servername: ENV.smtpHost });
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
      ".",
    ].join("\\r\\n").replace(/\\r\\n\\./g, "\\r\\n..");
    await command(socket, body, [250]);
    await command(socket, "QUIT", [221]);
  } finally {
    socket.end();
  }
}
