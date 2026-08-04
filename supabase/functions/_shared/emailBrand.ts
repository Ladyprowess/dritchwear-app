// Shared Dritchwear email shell - matches supabase/templates/confirmation.html
// and recovery.html (the auth emails) so every email the business sends,
// transactional or automated, looks like it came from the same brand.
// Used by send-customer-order-alert, send-payment-reminder,
// process-cart-reminders, and send-admin-order-alert.

export const BRAND = "#5A2D82";
export const GOLD = "#FDB813";
export const PAGE_BG = "#F4F3F7";
export const CARD_BORDER = "#ECE7F1";
export const TEXT_DARK = "#17131C";
export const TEXT_BODY = "#5B5560";
export const TEXT_FAINT = "#8A838F";
export const BOX_BG = "#FAF8FC";
export const BOX_BORDER = "#EEE9F4";
export const FOOTER_BG = "#FBFAFC";
export const FOOTER_BORDER = "#EFEAF4";

// Real entity-encoding (not character deletion), so it's safe for both text
// content and attribute values (e.g. a tracking URL's ?id=1&carrier=dhl
// query string survives instead of losing its "&").
export function esc(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export function p(text: string, marginBottom = 14): string {
  return `<p style="margin:0 0 ${marginBottom}px 0;font-size:15px;line-height:24px;color:${TEXT_BODY}">${text}</p>`;
}

export function infoBox(html: string): string {
  return `<div style="padding:14px 16px;background:${BOX_BG};border:1px solid ${BOX_BORDER};border-radius:12px;margin:0 0 20px 0"><div style="font-size:13px;line-height:20px;color:#6B6470">${html}</div></div>`;
}

export interface EmailFact {
  label: string;
  value: string;
  highlight?: boolean;
}

// A titled box with optional item list (as raw HTML, since item shape
// differs by caller) and a label/value fact table - the "Order Summary" card.
export function summaryCard(cardTitle: string, itemsHtml: string, facts: EmailFact[]): string {
  const factsHtml = facts.length
    ? `<div style="border-top:1px solid ${BOX_BORDER};margin:16px 0"></div><table width="100%" cellpadding="0" cellspacing="0">${facts.map((fact, i) => `<tr><td style="font-size:12px;color:${TEXT_FAINT};padding-bottom:${i === facts.length - 1 ? "0" : "8"}px">${fact.label}</td><td style="font-size:12px;color:${fact.highlight ? BRAND : TEXT_DARK};font-weight:700;text-align:right;padding-bottom:${i === facts.length - 1 ? "0" : "8"}px">${fact.value}</td></tr>`).join("")}</table>`
    : "";
  return `<div style="background:${BOX_BG};border:1px solid ${BOX_BORDER};border-radius:12px;padding:18px 20px;margin:0 0 20px 0"><div style="font-size:11px;font-weight:700;letter-spacing:0.8px;color:${BRAND};text-transform:uppercase;margin:0 0 12px 0">${cardTitle}</div>${itemsHtml}${factsHtml}</div>`;
}

export interface EmailShellOptions {
  eyebrow: string;
  headline: string;
  bodyHtml: string;
  ctaPrimaryLabel: string;
  ctaPrimaryUrl: string;
  ctaSecondaryLabel?: string;
  ctaSecondaryUrl?: string;
  footerNote: string;
}

export function emailShell(opts: EmailShellOptions): string {
  const secondaryButton = opts.ctaSecondaryLabel && opts.ctaSecondaryUrl
    ? `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-top:10px"><tr><td align="center" style="border:1px solid #D8D2DC;border-radius:11px"><a href="${opts.ctaSecondaryUrl}" style="display:block;padding:14px 40px;color:${BRAND};text-decoration:none;font-size:14px;font-weight:700;border-radius:11px;text-align:center">${opts.ctaSecondaryLabel}</a></td></tr></table>`
    : "";

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <style>
    body,table,td,p,a{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}
    table,td{mso-table-lspace:0;mso-table-rspace:0}
    table{border-collapse:collapse!important}
    a{color:${BRAND}}
    @media only screen and (max-width:620px){
      .outer{padding:16px!important}
      .card{border-radius:14px!important}
      .pad{padding-left:24px!important;padding-right:24px!important}
      .h1{font-size:23px!important;line-height:30px!important}
    }
  </style>
</head>
<body style="margin:0;padding:0;background:${PAGE_BG};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:${TEXT_DARK}">
  <table width="100%" role="presentation" cellpadding="0" cellspacing="0" style="background:${PAGE_BG}">
    <tr><td class="outer" align="center" style="padding:40px 16px">
      <table class="card" width="560" role="presentation" cellpadding="0" cellspacing="0" style="width:100%;max-width:560px;background:#FFFFFF;border:1px solid ${CARD_BORDER};border-radius:18px;overflow:hidden">

        <tr><td class="pad" align="center" style="padding:30px 40px 0">
          <span style="font-size:19px;font-weight:800;letter-spacing:3px;color:${BRAND}">DRITCHWEAR</span>
          <div style="width:34px;height:3px;background:${GOLD};border-radius:2px;margin:12px auto 0"></div>
        </td></tr>

        <tr><td class="pad" style="padding:30px 40px 0;text-align:left">
          <div style="font-size:11px;font-weight:700;letter-spacing:1.2px;color:${BRAND};text-transform:uppercase">${opts.eyebrow}</div>
          <h1 class="h1" style="margin:10px 0 0;font-size:26px;line-height:34px;font-weight:800;color:${TEXT_DARK};letter-spacing:-0.3px">${opts.headline}</h1>
        </td></tr>

        <tr><td class="pad" style="padding:18px 40px 0;text-align:left">
          ${opts.bodyHtml}
        </td></tr>

        <tr><td class="pad" style="padding:4px 40px 0">
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%"><tr>
            <td align="center" bgcolor="${BRAND}" style="border-radius:11px">
              <a href="${opts.ctaPrimaryUrl}" style="display:block;padding:15px 40px;color:#FFFFFF;text-decoration:none;font-size:14px;font-weight:700;border-radius:11px;text-align:center">${opts.ctaPrimaryLabel}</a>
            </td>
          </tr></table>
          ${secondaryButton}
        </td></tr>

        <tr><td class="pad" style="padding:30px 40px 30px;background:${FOOTER_BG};border-top:1px solid ${FOOTER_BORDER};margin-top:24px">
          <div style="font-size:12px;line-height:19px;color:#6B6470">${opts.footerNote}</div>
          <div style="margin-top:14px;font-size:11px;line-height:17px;color:#A29CAB">support@dritchwear.com &nbsp;&middot;&nbsp; © 2026 Dritchwear Collections</div>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
