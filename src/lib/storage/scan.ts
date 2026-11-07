/**
 * Upload scanning. Every uploaded file (firm staff or a client's upload link) passes through here
 * after its type was recognised by its first bytes and before it is encrypted and stored.
 *
 * 1. Built-in checks (always on, no outside service): things a PDF, photo or Word file has no
 *    business containing: Word macros, ActiveX controls or embedded programs, PDF actions that
 *    launch programs, and Windows/Linux/Mac programs hidden inside the file.
 * 2. A malware scan by Cloudmersive when CLOUDMERSIVE_API_KEY is set. Cloudmersive scans privately
 *    and doesn't keep or share the file (unlike public scanners such as VirusTotal, which must never
 *    see client documents). If the scan can't be done, the upload is refused ("fail closed").
 */

export type ScanResult = { ok: true; method: "basic" | "cloudmersive" } | { ok: false; reason: string; detail: string };

const blocked = (reason: string, detail: string): ScanResult => ({ ok: false, reason, detail });

/** Byte patterns that mean "there's a program in here". */
const PROGRAM_MARKERS: { name: string; bytes: Buffer }[] = [
  { name: "Windows program", bytes: Buffer.from("This program cannot be run in DOS mode", "latin1") },
  { name: "Linux program", bytes: Buffer.from([0x7f, 0x45, 0x4c, 0x46, 0x02, 0x01, 0x01]) },
  { name: "Mac program", bytes: Buffer.from([0xcf, 0xfa, 0xed, 0xfe, 0x07, 0x00, 0x00, 0x01]) },
];

/** Names inside a .docx (zip) that mean macros, ActiveX or embedded programs. Zip file names are stored uncompressed. */
const DOCX_FORBIDDEN = [/vbaProject\.bin/i, /vbaData\.xml/i, /\/activeX\//i, /\/embeddings\/oleObject/i, /\.(exe|dll|scr|bat|cmd|js|vbs|ps1|msi|jar)(?=[\x00-\x1f]|$)/i];
const MACRO_CONTENT_TYPE = /macroEnabled/i;

/** PDF features that run things on the reader's computer. Form scripts (/JavaScript) are common in USCIS forms, so they're allowed. */
const PDF_FORBIDDEN: { re: RegExp; what: string }[] = [
  { re: /\/Launch\b/, what: "an action that opens programs" },
  { re: /\/EmbeddedFile\b[\s\S]{0,400}?\.(exe|dll|scr|bat|cmd|js|vbs|ps1|msi|jar|app|sh)\b/i, what: "an attached program" },
];

export function basicScan(data: Buffer, contentType: string): ScanResult {
  for (const m of PROGRAM_MARKERS) {
    if (data.includes(m.bytes)) return blocked("This file contains a hidden program, so it can't be uploaded.", `program:${m.name}`);
  }
  if (contentType === "application/pdf") {
    const text = data.toString("latin1");
    for (const p of PDF_FORBIDDEN) if (p.re.test(text)) return blocked(`This PDF contains ${p.what}, so it can't be uploaded. Print it to a new PDF or take a photo instead.`, `pdf:${p.what}`);
  }
  if (contentType.includes("wordprocessingml")) {
    const names = data.toString("latin1");
    if (MACRO_CONTENT_TYPE.test(names) || DOCX_FORBIDDEN.some((re) => re.test(names))) {
      return blocked("This Word file contains macros or embedded programs, so it can't be uploaded. Save it as a PDF and upload that.", "docx:active-content");
    }
  }
  return { ok: true, method: "basic" };
}

export type Scanner = (data: Buffer, name: string, contentType: string) => Promise<ScanResult>;

type CloudmersiveAnswer = {
  CleanResult?: boolean;
  ContainsExecutable?: boolean;
  ContainsInvalidFile?: boolean;
  ContainsScript?: boolean;
  ContainsMacros?: boolean;
  FoundViruses?: { FileName?: string; VirusName?: string }[] | null;
};

/** Cloudmersive "advanced" virus scan. Scripts are allowed (USCIS PDF forms have them); everything else must be clean. */
export function cloudmersiveScanner({ apiKey, fetchImpl = fetch, timeoutMs = 20_000 }: { apiKey: string; fetchImpl?: typeof fetch; timeoutMs?: number }): Scanner {
  return async (data, name, contentType) => {
    const form = new FormData();
    form.append("inputFile", new Blob([new Uint8Array(data)], { type: contentType }), name);
    let answer: CloudmersiveAnswer;
    try {
      const res = await fetchImpl("https://api.cloudmersive.com/virus/scan/file/advanced", {
        method: "POST",
        headers: { Apikey: apiKey, allowScripts: "true", allowExecutables: "false", allowInvalidFiles: "false", allowMacros: "false", allowPasswordProtectedFiles: "true" },
        body: form,
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!res.ok) return blocked("We couldn't check this file for viruses just now. Please try again in a minute.", `cloudmersive:http-${res.status}`);
      answer = (await res.json()) as CloudmersiveAnswer;
    } catch (err) {
      return blocked("We couldn't check this file for viruses just now. Please try again in a minute.", `cloudmersive:${(err as Error).name}`);
    }
    if (answer.CleanResult === true) return { ok: true, method: "cloudmersive" };
    const virus = answer.FoundViruses?.[0]?.VirusName;
    if (virus) return blocked("This file contains a virus, so it can't be uploaded.", `virus:${virus}`);
    if (answer.ContainsExecutable) return blocked("This file contains a hidden program, so it can't be uploaded.", "cloudmersive:executable");
    if (answer.ContainsMacros) return blocked("This file contains macros, so it can't be uploaded. Save it as a PDF and upload that.", "cloudmersive:macros");
    return blocked("This file didn't pass the virus check, so it can't be uploaded. Try saving it as a PDF.", "cloudmersive:not-clean");
  };
}

/** Built-in checks first (free, instant); then the malware scan if one is set up. */
export function createUploadScanner(external: Scanner | null): Scanner {
  return async (data, name, contentType) => {
    const basic = basicScan(data, contentType);
    if (!basic.ok || !external) return basic;
    return external(data, name, contentType);
  };
}

/** The scanner for this deployment: Cloudmersive when its key is set, built-in checks otherwise. */
export function getUploadScanner(): Scanner {
  const key = process.env.CLOUDMERSIVE_API_KEY?.trim();
  return createUploadScanner(key ? cloudmersiveScanner({ apiKey: key }) : null);
}
