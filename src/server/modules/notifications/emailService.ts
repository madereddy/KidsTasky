type MailTransporter = {
  sendMail: (options: { from: string; to: string; subject: string; text: string }) => Promise<unknown>;
};

type NodemailerModule = {
  createTransport: (config: {
    host: string;
    port: number;
    secure: boolean;
    auth: { user: string; pass: string };
  }) => MailTransporter;
};

let nodemailerPromise: Promise<NodemailerModule | null> | null = null;
let transporter: MailTransporter | null = null;

async function getNodemailer(): Promise<NodemailerModule | null> {
  if (!nodemailerPromise) {
    nodemailerPromise = import('nodemailer')
      .then((mod) => (mod.default || mod) as NodemailerModule)
      .catch(() => null);
  }
  return nodemailerPromise;
}

async function getTransporter(): Promise<MailTransporter | null> {
  if (transporter) return transporter;
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;
  const nodemailer = await getNodemailer();
  if (!nodemailer) return null;

  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: parseInt(SMTP_PORT || '587', 10),
    secure: false,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
  return transporter;
}

export async function sendEmail(to: string, subject: string, text: string): Promise<boolean> {
  const t = await getTransporter();
  if (!t) return false;
  try {
    await t.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@example.com',
      to,
      subject,
      text,
    });
    return true;
  } catch {
    return false;
  }
}
