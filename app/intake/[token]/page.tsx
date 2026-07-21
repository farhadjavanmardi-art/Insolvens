"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type CreditorRow = { name: string; amount: string; kind: "privatperson" | "behoerde" | "sonstiges" };

const CASE_TYPE_OPTIONS = [
  { value: "verbraucherinsolvenz", label: "Verbraucherinsolvenz (Privatperson, kein Gewerbe)" },
  { value: "regelinsolvenz", label: "Regelinsolvenz" },
  { value: "unternehmensinsolvenz", label: "Unternehmensinsolvenz" },
];

const KIND_OPTIONS: { value: CreditorRow["kind"]; label: string }[] = [
  { value: "privatperson", label: "Privatperson" },
  { value: "behoerde", label: "Behörde / Institution" },
  { value: "sonstiges", label: "Sonstiges (z. B. Unternehmen)" },
];

const MAX_RECORDING_SECONDS = 10 * 60;

export default function IntakePage({ params }: { params: { token: string } }) {
  const [step, setStep] = useState(1);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [caseType, setCaseType] = useState("verbraucherinsolvenz"); // 80%-Vorauswahl: häufigster Fall
  const [creditors, setCreditors] = useState<CreditorRow[]>([{ name: "", amount: "", kind: "privatperson" }]);
  const [notes, setNotes] = useState("");

  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function updateCreditor(i: number, patch: Partial<CreditorRow>) {
    setCreditors((prev) => prev.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  }
  function addCreditor() {
    setCreditors((prev) => [...prev, { name: "", amount: "", kind: "privatperson" }]);
  }
  function removeCreditor(i: number) {
    setCreditors((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function startRecording() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((t) => t.stop());
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setRecording(true);
      setSeconds(0);
      timerRef.current = setInterval(() => {
        setSeconds((s) => {
          if (s + 1 >= MAX_RECORDING_SECONDS) {
            stopRecording();
          }
          return s + 1;
        });
      }, 1000);
    } catch {
      setError("Mikrofonzugriff nicht möglich. Sie können stattdessen eine Datei hochladen.");
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    setRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAudioBlob(file);
    setAudioUrl(URL.createObjectURL(file));
  }

  function blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        resolve(result.split(",")[1] ?? "");
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      const supabase = createClient();
      let audioBase64: string | null = null;
      if (audioBlob) audioBase64 = await blobToBase64(audioBlob);

      const { error: rpcError } = await supabase.rpc("submit_intake", {
        p_firm_token: params.token,
        p_full_name: fullName,
        p_email: email,
        p_phone: phone,
        p_address: address,
        p_case_type: caseType,
        p_creditors: creditors
          .filter((c) => c.name.trim())
          .map((c) => ({ name: c.name, amount: Number(c.amount) || 0, kind: c.kind })),
        p_notes: notes,
        p_voice_audio_base64: audioBase64,
        p_voice_mime_type: audioBlob?.type ?? null,
      });

      if (rpcError) throw new Error(rpcError.message);
      setDone(true);
    } catch (err: any) {
      setError(err.message || "Übermittlung fehlgeschlagen. Bitte versuchen Sie es erneut.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <main className="min-h-screen bg-paper flex items-center justify-center px-6">
        <div className="max-w-md text-center bg-white border border-ink/10 rounded-sm p-10">
          <h1 className="font-serif text-xl font-semibold text-ink mb-3">Vielen Dank!</h1>
          <p className="text-sm text-ash">
            Ihre Angaben wurden übermittelt. Die Kanzlei wird Ihre Anfrage prüfen und sich zeitnah bei Ihnen melden.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-paper px-6 py-12">
      <div className="max-w-xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="font-serif text-2xl font-semibold text-ink">Erstaufnahme</h1>
          <p className="text-sm text-ash mt-1">Schritt {step} von 4</p>
        </div>

        <div className="bg-white border border-ink/10 rounded-sm p-8">
          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-sm font-semibold text-ink uppercase tracking-wide mb-2">Ihre Daten</h2>
              <input className="input w-full" placeholder="Vollständiger Name *" value={fullName} onChange={(e) => setFullName(e.target.value)} />
              <input className="input w-full" placeholder="E-Mail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              <input className="input w-full" placeholder="Telefon" value={phone} onChange={(e) => setPhone(e.target.value)} />
              <input className="input w-full" placeholder="Anschrift" value={address} onChange={(e) => setAddress(e.target.value)} />
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-ink uppercase tracking-wide mb-2">Um welche Art von Verfahren geht es?</h2>
              <p className="text-xs text-ash mb-2">Die häufigste Auswahl ist bereits voreingestellt — bei Unsicherheit einfach so lassen.</p>
              {CASE_TYPE_OPTIONS.map((opt) => (
                <label key={opt.value} className="flex items-center gap-2 text-sm border border-ink/10 rounded-sm px-3 py-2 cursor-pointer">
                  <input type="radio" name="case_type" checked={caseType === opt.value} onChange={() => setCaseType(opt.value)} />
                  {opt.label}
                </label>
              ))}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <h2 className="text-sm font-semibold text-ink uppercase tracking-wide mb-2">Ihre Gläubiger (soweit bekannt)</h2>
              <p className="text-xs text-ash mb-2">Bei wem haben Sie Schulden? Genaue Beträge sind nicht zwingend nötig.</p>
              {creditors.map((c, i) => (
                <div key={i} className="border border-ink/10 rounded-sm p-3 space-y-2">
                  <input
                    className="input w-full"
                    placeholder={`Gläubiger ${i + 1}: Name`}
                    value={c.name}
                    onChange={(e) => updateCreditor(i, { name: e.target.value })}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      className="input"
                      placeholder="Betrag (€), ca."
                      type="number"
                      value={c.amount}
                      onChange={(e) => updateCreditor(i, { amount: e.target.value })}
                    />
                    <select className="input" value={c.kind} onChange={(e) => updateCreditor(i, { kind: e.target.value as CreditorRow["kind"] })}>
                      {KIND_OPTIONS.map((k) => (
                        <option key={k.value} value={k.value}>
                          {k.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  {creditors.length > 1 && (
                    <button type="button" onClick={() => removeCreditor(i)} className="text-xs text-oxblood underline">
                      Entfernen
                    </button>
                  )}
                </div>
              ))}
              <button type="button" onClick={addCreditor} className="text-sm text-oxblood underline">
                + weiterer Gläubiger
              </button>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <h2 className="text-sm font-semibold text-ink uppercase tracking-wide mb-2">Ihre Situation in eigenen Worten</h2>
              <p className="text-xs text-ash">
                Nehmen Sie sich bis zu 10 Minuten Zeit und beschreiben Sie mit eigenen Worten Ihre Situation.
                Alternativ können Sie unten schriftlich Notizen hinterlassen.
              </p>

              <div className="border border-ink/10 rounded-sm p-4 text-center">
                {!audioUrl ? (
                  <>
                    <button
                      type="button"
                      onClick={recording ? stopRecording : startRecording}
                      className={`btn ${recording ? "bg-oxblood" : ""}`}
                    >
                      {recording ? `Aufnahme stoppen (${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")})` : "Aufnahme starten"}
                    </button>
                    <p className="text-xs text-ash mt-3">oder Audiodatei hochladen:</p>
                    <input type="file" accept="audio/*" onChange={handleFileUpload} className="text-xs mt-1" />
                  </>
                ) : (
                  <>
                    <audio controls src={audioUrl} className="w-full mb-2" />
                    <button
                      type="button"
                      onClick={() => {
                        setAudioBlob(null);
                        setAudioUrl(null);
                      }}
                      className="text-xs text-oxblood underline"
                    >
                      Aufnahme verwerfen und neu starten
                    </button>
                  </>
                )}
              </div>

              <textarea
                className="input w-full"
                rows={4}
                placeholder="Schriftliche Notizen (optional)"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          )}

          {error && <p className="text-sm text-oxblood mt-4">{error}</p>}

          <div className="flex justify-between mt-8">
            <button
              type="button"
              disabled={step === 1}
              onClick={() => setStep((s) => s - 1)}
              className="text-sm text-ash disabled:opacity-0"
            >
              ← Zurück
            </button>
            {step < 4 ? (
              <button
                type="button"
                disabled={step === 1 && !fullName.trim()}
                onClick={() => setStep((s) => s + 1)}
                className="btn disabled:opacity-50"
              >
                Weiter →
              </button>
            ) : (
              <button type="button" disabled={submitting} onClick={handleSubmit} className="btn disabled:opacity-50">
                {submitting ? "Wird gesendet…" : "Absenden"}
              </button>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
