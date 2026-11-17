/** Peças comuns dos e-mails do SafeWalk (texto escapado e layout em tabela nas cores da marca). */

export function escapeHtml(value: string): string {
  return value.replace(
    /[&<>'"]/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character] ??
      character,
  );
}

/** Layout simples em tabela (compatível com clientes de e-mail) nas cores do SafeWalk. */
export function brandedEmailLayout(input: {
  eyebrow: string;
  title: string;
  paragraphs: readonly string[];
  action?: { label: string; url: string; tone?: 'primary' | 'danger' };
  footer: string;
}): string {
  const actionColor = input.action?.tone === 'danger' ? '#d92636' : '#2f6fec';
  const paragraphs = input.paragraphs
    .map(
      (text) =>
        `<p style="margin:0 0 14px;color:#475467;font-size:15px;line-height:1.65;">${text}</p>`,
    )
    .join('');
  const action = input.action
    ? `<a href="${escapeHtml(input.action.url)}" style="display:block;margin:22px 0 6px;padding:15px 22px;border-radius:12px;background:${actionColor};color:#ffffff;text-align:center;text-decoration:none;font-size:15px;font-weight:700;">${escapeHtml(input.action.label)}</a>`
    : '';
  const fallback = input.action
    ? `<br />Se o botão não funcionar, copie este endereço: <a href="${escapeHtml(input.action.url)}" style="color:#2f6fec;word-break:break-all;">${escapeHtml(input.action.url)}</a>`
    : '';
  return `<!doctype html>
<html lang="pt-BR">
  <body style="margin:0;padding:0;background:#eef2f7;font-family:Inter,Arial,sans-serif;color:#101828;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#eef2f7;padding:32px 16px;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border-radius:18px;overflow:hidden;">
          <tr><td style="background:#0b1324;padding:24px 30px;border-bottom:3px solid #2f6fec;">
            <span style="color:#ffffff;font-size:20px;font-weight:800;letter-spacing:-0.4px;">Safe<span style="color:#6ea0ff;">Walk</span></span>
          </td></tr>
          <tr><td style="padding:34px 30px 26px;">
            <p style="margin:0 0 8px;color:#2f6fec;font-size:12px;font-weight:800;letter-spacing:1.1px;text-transform:uppercase;">${escapeHtml(input.eyebrow)}</p>
            <h1 style="margin:0 0 18px;color:#0f172a;font-size:24px;line-height:1.25;">${escapeHtml(input.title)}</h1>
            ${paragraphs}${action}
          </td></tr>
          <tr><td style="padding:18px 30px;background:#f8fafc;border-top:1px solid #e2e8f0;color:#98a2b3;font-size:12px;line-height:1.6;">
            ${escapeHtml(input.footer)}${fallback}
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}
