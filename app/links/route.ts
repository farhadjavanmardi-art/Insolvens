import { NextResponse } from "next/server";

const HTML = `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>InsolvenzFlow — Zugangslinks</title>
<style>
  @import url("https://fonts.googleapis.com/css2?family=Source+Serif+4:opsz,wght@8..60,600;8..60,700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap");

  :root {
    --ink: #14213D;
    --oxblood: #8C2F39;
    --ash: #5B5F5A;
    --paper: #ffffff;
    --line: rgba(20,33,61,0.12);
  }

  * { box-sizing: border-box; }
  body {
    margin: 0;
    background: var(--paper);
    color: var(--ink);
    font-family: 'IBM Plex Sans', system-ui, sans-serif;
    padding: 64px 24px;
  }
  .wrap { max-width: 720px; margin: 0 auto; }

  header { text-align: center; margin-bottom: 48px; }
  h1 {
    font-family: 'Source Serif 4', Georgia, serif;
    font-weight: 700;
    font-size: 30px;
    margin: 0 0 8px;
  }
  header p { color: var(--ash); font-size: 14px; margin: 0; }

  .card {
    border: 1px solid var(--line);
    border-radius: 3px;
    padding: 24px 24px 20px;
    margin-bottom: 16px;
    display: flex;
    gap: 18px;
    align-items: flex-start;
  }
  .icon {
    flex: 0 0 auto;
    width: 42px;
    height: 42px;
    border-radius: 3px;
    background: rgba(20,33,61,0.06);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .icon svg { width: 22px; height: 22px; stroke: var(--ink); }

  .card h2 {
    font-family: 'Source Serif 4', Georgia, serif;
    font-size: 17px;
    font-weight: 600;
    margin: 0 0 4px;
  }
  .card .desc { font-size: 13px; color: var(--ash); margin: 0 0 12px; line-height: 1.5; }

  .link-row {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }
  code {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 12.5px;
    background: rgba(20,33,61,0.05);
    padding: 5px 10px;
    border-radius: 2px;
    word-break: break-all;
    color: var(--ink);
  }
  .tag {
    font-size: 10px;
    font-family: 'IBM Plex Mono', monospace;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    padding: 2px 7px;
    border-radius: 2px;
    border: 1px solid var(--line);
    color: var(--ash);
    white-space: nowrap;
  }
  .tag.public { color: var(--oxblood); border-color: rgba(140,47,57,0.3); }

  footer {
    margin-top: 40px;
    font-size: 12px;
    color: var(--ash);
    text-align: center;
    line-height: 1.6;
  }
</style>
</head>
<body>
  <div class="wrap">
    <header>
      <h1>InsolvenzFlow — Zugangslinks</h1>
      <p>Übersicht aller Einstiegspunkte der Kanzleiverwaltung</p>
    </header>

    <div class="card">
      <div class="icon">
        <svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="8" cy="15" r="4"></circle>
          <path d="M10.5 12.5L20 3M17 6l3 3M20 3l1 1"></path>
        </svg>
      </div>
      <div>
        <h2>Anwalts-Login <span class="tag">nur intern</span></h2>
        <p class="desc">Zugang zum Dashboard: Akten, Gläubiger, Fristen, Berichte, Einstellungen. Nur für Kanzleimitglieder.</p>
        <div class="link-row">
          <code>https://insolvens.netlify.app/login</code>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="icon">
        <svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"></path>
          <path d="M14 3v5h5"></path>
          <path d="M9 15a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"></path>
          <path d="M9 15v3"></path>
        </svg>
      </div>
      <div>
        <h2>Mandanten-Erstaufnahme <span class="tag public">öffentlich</span></h2>
        <p class="desc">Fester Link der Kanzlei. Interessenten füllen ein geführtes Formular aus und können eine Sprachnotiz aufnehmen. Wird auf der Website oder per E-Mail geteilt.</p>
        <div class="link-row">
          <code>https://insolvens.netlify.app/intake/414a7466-1d30-4a8b-b462-b2f10d64eb95</code>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="icon">
        <svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 16V4M12 4l-4 4M12 4l4 4"></path>
          <path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"></path>
        </svg>
      </div>
      <div>
        <h2>Unterlagen-Upload <span class="tag public">öffentlich · pro Akte</span></h2>
        <p class="desc">Individueller Link je Akte — wird dem Mandanten automatisch per E-Mail nach Anlage der Akte zugesandt. Kein fester Link, variiert pro Fall.</p>
        <div class="link-row">
          <code>https://insolvens.netlify.app/upload/[akten-token]</code>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="icon">
        <svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="9" cy="8" r="3"></circle>
          <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"></path>
          <circle cx="17" cy="9" r="2.5"></circle>
          <path d="M15.5 14c2.5 0 4.5 2 4.5 4.5"></path>
        </svg>
      </div>
      <div>
        <h2>Gläubigerportal <span class="tag public">öffentlich · pro Gläubiger</span></h2>
        <p class="desc">Individueller Link je Gläubiger zur Einsicht des Forderungsstatus. Wird über die Akte generiert und per E-Mail versendet.</p>
        <div class="link-row">
          <code>https://insolvens.netlify.app/portal/[gläubiger-token]</code>
        </div>
      </div>
    </div>

    <footer>
      Links mit &quot;pro Akte&quot; / &quot;pro Gläubiger&quot; sind eindeutig und nicht erratbar — sie werden automatisch generiert und über die jeweilige Akte im Dashboard eingesehen.
    </footer>
  </div>
</body>
</html>`;

export async function GET() {
  return new NextResponse(HTML, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}
