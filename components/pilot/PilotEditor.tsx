"use client";

import { ChangeEvent, useMemo, useRef, useState } from "react";
import { circlesSchema } from "@/lib/schemas";
import type { InfernoCircle, Subregion, VisualMode } from "@/lib/types";

const visualModes: { value: VisualMode; label: string }[] = [
  { value: "columns", label: "Stupovi / nedostižni red" },
  { value: "vortex", label: "Vrtlog / tijela bez oslonca" },
  { value: "rain", label: "Kiša / sluz / raspadanje" },
  { value: "weights", label: "Tereti / mehanička arena" },
  { value: "marsh", label: "Močvara / potopljeni glasovi" },
  { value: "tombs", label: "Grobnice / užarene ploče" },
  { value: "forest", label: "Šuma / trnje / krv" },
  { value: "ditches", label: "Jarkovi / sustav prijevare" },
  { value: "ice", label: "Led / potpuna nepokretnost" }
];

const emptySubregion = (): Subregion => ({
  name: "Nova podrazina",
  condemned: "Tko ovdje završava?",
  punishment: "Što se tijelu i vremenu događa?",
  meaning: "Zašto je kazna precizan oblik krivnje?"
});

function slugify(value: string) {
  return value
    .toLocaleLowerCase("hr")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

function newCircle(order: number): InfernoCircle {
  const now = new Date().toISOString();
  return {
    id: `custom-${crypto.randomUUID()}`,
    order,
    kind: "custom",
    slug: `novi-krug-${order}`,
    roman: String(order),
    title: "Neimenovani krug",
    subtitle: "Kazna još nema konačan oblik.",
    canto: "Autorski sloj",
    sin: "Nova vrsta krivnje",
    thesis: "Ovdje upiši jednu rečenicu koja cijeli krug pretvara u argument.",
    summary: "Opiši kako se u krug ulazi, koga se prvo vidi i što se postupno otkriva.",
    guilt: "Objasni ljudsku odluku, izgovor i štetu koja je stvorila ovaj krug.",
    punishment: "Opiši točan ritam kazne, materijale, pokret, trajanje i nemogućnost bijega.",
    contrapasso: "Poveži kaznu s logikom krivnje. Ne samo sličnošću, nego uzročnom ironijom.",
    guardians: ["Neimenovani čuvar"],
    inhabitants: ["Anonimne figure"],
    geography: "Opiši arhitekturu, razinu, granice i odnos prema krugovima iznad i ispod.",
    senses: "Opiši zvuk, miris, temperaturu, teksturu zraka i način na koji prostor utječe na tijelo.",
    stageDirection: "Opiši što scroll, kamera, tipografija i interakcija rade u ovom sloju.",
    visualMode: "vortex",
    palette: ["#b24a62", "#3e1728", "#070507"],
    ambient: "Opiši generativni zvuk i tišinu.",
    subregions: [],
    published: true,
    updatedAt: now
  };
}

function normalizeOrders(circles: InfernoCircle[]) {
  return circles.map((circle, index) => ({ ...circle, order: index + 1 }));
}

export function PilotEditor({ initialCircles, initialStorageMode }: { initialCircles: InfernoCircle[]; initialStorageMode: "supabase" | "filesystem" }) {
  const [circles, setCircles] = useState(() => normalizeOrders(initialCircles));
  const [selectedId, setSelectedId] = useState(initialCircles[0]?.id ?? "");
  const [storageMode, setStorageMode] = useState(initialStorageMode);
  const [status, setStatus] = useState("Spremljeno stanje učitano.");
  const [saving, setSaving] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);

  const selectedIndex = circles.findIndex((circle) => circle.id === selectedId);
  const selected = circles[selectedIndex] ?? circles[0];
  const dirtyLabel = storageMode === "supabase" ? "SUPABASE / TRAJNO" : "DATOTEKA / LOKALNI RAZVOJ";

  const totals = useMemo(() => ({
    all: circles.length,
    dante: circles.filter((circle) => circle.kind === "dante").length,
    custom: circles.filter((circle) => circle.kind === "custom").length,
    published: circles.filter((circle) => circle.published).length
  }), [circles]);

  function updateSelected(patch: Partial<InfernoCircle>) {
    if (!selected) return;
    setCircles((current) => current.map((circle) => circle.id === selected.id ? { ...circle, ...patch, updatedAt: new Date().toISOString() } : circle));
    setStatus("Nespremljene promjene.");
  }

  function updateTextArray(key: "guardians" | "inhabitants", value: string) {
    updateSelected({ [key]: value.split("\n").map((item) => item.trim()).filter(Boolean) } as Pick<InfernoCircle, typeof key>);
  }

  function addCircle() {
    const created = newCircle(circles.length + 1);
    setCircles((current) => [...current, created]);
    setSelectedId(created.id);
    setStatus("Novi krug postoji samo u editoru dok ga ne spremiš.");
  }

  function duplicateCircle() {
    if (!selected) return;
    const copy: InfernoCircle = {
      ...structuredClone(selected),
      id: `custom-${crypto.randomUUID()}`,
      kind: "custom",
      title: `${selected.title} / varijanta`,
      slug: `${selected.slug}-varijanta-${Date.now().toString().slice(-4)}`,
      order: selectedIndex + 2,
      updatedAt: new Date().toISOString()
    };
    const next = [...circles];
    next.splice(selectedIndex + 1, 0, copy);
    setCircles(normalizeOrders(next));
    setSelectedId(copy.id);
    setStatus("Krug je dupliciran kao autorska varijanta.");
  }

  function deleteCircle() {
    if (!selected || circles.length === 1) return;
    if (!window.confirm(`Izbrisati krug “${selected.title}”? Brisanje postaje javno tek nakon spremanja.`)) return;
    const next = circles.filter((circle) => circle.id !== selected.id);
    setCircles(normalizeOrders(next));
    setSelectedId(next[Math.max(0, selectedIndex - 1)]?.id ?? next[0]?.id ?? "");
    setStatus("Krug je označen za brisanje.");
  }

  function move(direction: -1 | 1) {
    if (!selected) return;
    const target = selectedIndex + direction;
    if (target < 0 || target >= circles.length) return;
    const next = [...circles];
    [next[selectedIndex], next[target]] = [next[target], next[selectedIndex]];
    setCircles(normalizeOrders(next));
    setStatus("Redoslijed je promijenjen.");
  }

  async function persist(payload: { action?: "reset"; circles?: InfernoCircle[] }) {
    setSaving(true);
    setStatus("Spremanje...");
    try {
      const response = await fetch("/api/circles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = (await response.json()) as { circles?: InfernoCircle[]; storageMode?: "supabase" | "filesystem"; error?: string };
      if (!response.ok || !data.circles) throw new Error(data.error || "Spremanje nije uspjelo.");
      setCircles(normalizeOrders(data.circles));
      setSelectedId((current) => data.circles?.some((circle) => circle.id === current) ? current : data.circles?.[0]?.id ?? "");
      if (data.storageMode) setStorageMode(data.storageMode);
      setStatus(`Spremljeno u ${data.storageMode === "supabase" ? "Supabase" : "lokalnu datoteku"}.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Spremanje nije uspjelo.");
    } finally {
      setSaving(false);
    }
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify(circles, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `krugovi-pakla-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setStatus("JSON izvezen.");
  }

  async function importJson(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const parsed = circlesSchema.parse(JSON.parse(await file.text()));
      setCircles(normalizeOrders(parsed));
      setSelectedId(parsed[0].id);
      setStatus("JSON je učitan u editor. Još nije spremljen.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "JSON nije valjan.");
    }
  }

  function updateSubregion(index: number, patch: Partial<Subregion>) {
    if (!selected) return;
    const next = selected.subregions.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item);
    updateSelected({ subregions: next });
  }

  function removeSubregion(index: number) {
    if (!selected) return;
    updateSelected({ subregions: selected.subregions.filter((_, itemIndex) => itemIndex !== index) });
  }

  async function logout() {
    await fetch("/api/pilot/logout", { method: "POST" });
    window.location.reload();
  }

  if (!selected) return null;

  return (
    <main className="pilot-shell">
      <header className="pilot-header">
        <div>
          <p className="eyebrow">AUTORSKI KONTROLNI SLOJ</p>
          <h1>PILOT / ARHITEKTURA PAKLA</h1>
        </div>
        <div className="pilot-header-actions">
          <span className={`storage-badge ${storageMode}`}>{dirtyLabel}</span>
          <a href="/" target="_blank" rel="noreferrer">JAVNI PREVIEW ↗</a>
          <button onClick={logout}>ODJAVA</button>
        </div>
      </header>

      <section className="pilot-stats" aria-label="Sažetak projekta">
        <span><b>{totals.all}</b> ukupno</span>
        <span><b>{totals.dante}</b> Dante</span>
        <span><b>{totals.custom}</b> autorski</span>
        <span><b>{totals.published}</b> objavljeno</span>
        <p>{status}</p>
      </section>

      <div className="pilot-workspace">
        <aside className="circle-manager">
          <div className="manager-actions">
            <button onClick={addCircle}>+ NOVI KRUG</button>
            <button onClick={duplicateCircle}>DUPLICIRAJ</button>
          </div>
          <ol>
            {circles.map((circle, index) => (
              <li key={circle.id} className={circle.id === selected.id ? "is-selected" : ""}>
                <button onClick={() => setSelectedId(circle.id)}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <div><b>{circle.title}</b><small>{circle.kind === "dante" ? "DANTE" : "AUTORSKI"} · {circle.published ? "JAVNO" : "SKRIVENO"}</small></div>
                </button>
              </li>
            ))}
          </ol>
          <div className="manager-bottom">
            <button onClick={() => move(-1)} disabled={selectedIndex === 0}>↑</button>
            <button onClick={() => move(1)} disabled={selectedIndex === circles.length - 1}>↓</button>
            <button className="danger" onClick={deleteCircle} disabled={circles.length === 1}>IZBRIŠI</button>
          </div>
        </aside>

        <section className="circle-editor">
          <div className="editor-toolbar">
            <div>
              <span className="circle-kind">{selected.kind === "dante" ? "KANONSKI SLOJ" : "AUTORSKI SLOJ"}</span>
              <b>#{selected.order} / {selected.id}</b>
            </div>
            <label className="publish-toggle">
              <input type="checkbox" checked={selected.published} onChange={(event) => updateSelected({ published: event.target.checked })} />
              <span>OBJAVLJENO</span>
            </label>
          </div>

          <div className="form-grid title-grid">
            <label><span>Rimski broj / oznaka</span><input value={selected.roman} onChange={(event) => updateSelected({ roman: event.target.value })} /></label>
            <label className="wide"><span>Ime kruga</span><input value={selected.title} onChange={(event) => updateSelected({ title: event.target.value, slug: slugify(event.target.value) || selected.slug })} /></label>
            <label className="wide"><span>Podnaslov</span><input value={selected.subtitle} onChange={(event) => updateSelected({ subtitle: event.target.value })} /></label>
            <label><span>Pjevanje / izvor</span><input value={selected.canto} onChange={(event) => updateSelected({ canto: event.target.value })} /></label>
            <label><span>Slug</span><input value={selected.slug} onChange={(event) => updateSelected({ slug: slugify(event.target.value) })} /></label>
          </div>

          <div className="form-grid">
            <label className="wide"><span>Vrsta krivnje</span><input value={selected.sin} onChange={(event) => updateSelected({ sin: event.target.value })} /></label>
            <label className="full"><span>Teza kruga</span><textarea rows={2} value={selected.thesis} onChange={(event) => updateSelected({ thesis: event.target.value })} /></label>
            <label className="full"><span>Ulazni narativ / sažetak</span><textarea rows={5} value={selected.summary} onChange={(event) => updateSelected({ summary: event.target.value })} /></label>
            <label className="full"><span>Krivnja</span><textarea rows={6} value={selected.guilt} onChange={(event) => updateSelected({ guilt: event.target.value })} /></label>
            <label className="full"><span>Kazna i metoda mučenja</span><textarea rows={8} value={selected.punishment} onChange={(event) => updateSelected({ punishment: event.target.value })} /></label>
            <label className="full contrapasso-input"><span>Contrapasso / precizna veza kazne i krivnje</span><textarea rows={6} value={selected.contrapasso} onChange={(event) => updateSelected({ contrapasso: event.target.value })} /></label>
          </div>

          <div className="editor-section-heading"><span>SCENOGRAFIJA I TRANSMEDIJA</span><button onClick={() => setAdvanced((value) => !value)}>{advanced ? "SAKRIJ TEHNIČKO" : "PRIKAŽI TEHNIČKO"}</button></div>
          <div className="form-grid">
            <label className="full"><span>Geografija kruga</span><textarea rows={4} value={selected.geography} onChange={(event) => updateSelected({ geography: event.target.value })} /></label>
            <label className="full"><span>Osjetilna slika</span><textarea rows={4} value={selected.senses} onChange={(event) => updateSelected({ senses: event.target.value })} /></label>
            <label className="full"><span>Scenska i scroll režija</span><textarea rows={4} value={selected.stageDirection} onChange={(event) => updateSelected({ stageDirection: event.target.value })} /></label>
            <label className="full"><span>Generativni zvuk</span><textarea rows={3} value={selected.ambient} onChange={(event) => updateSelected({ ambient: event.target.value })} /></label>
            <label><span>3D arhetip</span><select value={selected.visualMode} onChange={(event) => updateSelected({ visualMode: event.target.value as VisualMode })}>{visualModes.map((mode) => <option key={mode.value} value={mode.value}>{mode.label}</option>)}</select></label>
            <div className="palette-editor"><span>Paleta</span>{selected.palette.map((color, index) => <label key={`${color}-${index}`}><input type="color" value={color} onChange={(event) => { const palette = [...selected.palette] as [string, string, string]; palette[index] = event.target.value; updateSelected({ palette }); }} /><code>{color}</code></label>)}</div>
          </div>

          {advanced && (
            <div className="form-grid advanced-grid">
              <label><span>Čuvari, jedan po retku</span><textarea rows={6} value={selected.guardians.join("\n")} onChange={(event) => updateTextArray("guardians", event.target.value)} /></label>
              <label><span>Figure, jedna po retku</span><textarea rows={6} value={selected.inhabitants.join("\n")} onChange={(event) => updateTextArray("inhabitants", event.target.value)} /></label>
              <label><span>Tip zapisa</span><select value={selected.kind} onChange={(event) => updateSelected({ kind: event.target.value as "dante" | "custom" })}><option value="dante">Dante</option><option value="custom">Autorski</option></select></label>
              <label><span>Interni ID (samo čitanje)</span><input value={selected.id} readOnly aria-readonly="true" /></label>
            </div>
          )}

          <div className="editor-section-heading"><span>PODRAZINE / JARCI / PRSTENOVI</span><button onClick={() => updateSelected({ subregions: [...selected.subregions, emptySubregion()] })}>+ DODAJ PODRAZINU</button></div>
          <div className="subregion-editor">
            {selected.subregions.length === 0 && <p className="empty-state">Ovaj krug zasad nema podrazine. Pakao je, iznenađujuće, administrativno jednostavan.</p>}
            {selected.subregions.map((subregion, index) => (
              <article key={`${selected.id}-${index}`}>
                <header><b>{String(index + 1).padStart(2, "0")}</b><button onClick={() => removeSubregion(index)}>UKLONI</button></header>
                <label><span>Ime</span><input value={subregion.name} onChange={(event) => updateSubregion(index, { name: event.target.value })} /></label>
                <label><span>Osuđeni</span><textarea rows={2} value={subregion.condemned} onChange={(event) => updateSubregion(index, { condemned: event.target.value })} /></label>
                <label><span>Kazna</span><textarea rows={3} value={subregion.punishment} onChange={(event) => updateSubregion(index, { punishment: event.target.value })} /></label>
                <label><span>Značenje</span><textarea rows={3} value={subregion.meaning} onChange={(event) => updateSubregion(index, { meaning: event.target.value })} /></label>
              </article>
            ))}
          </div>
        </section>
      </div>

      <footer className="pilot-footer">
        <div>
          <button onClick={exportJson}>IZVEZI JSON</button>
          <button onClick={() => importRef.current?.click()}>UVEZI JSON</button>
          <input ref={importRef} type="file" accept="application/json" hidden onChange={importJson} />
          <button className="danger-ghost" onClick={() => window.confirm("Vratiti svih devet Danteovih krugova i ukloniti autorske dodatke?") && void persist({ action: "reset" })}>VRATI DANTEA</button>
        </div>
        <button className="save-button" disabled={saving} onClick={() => void persist({ circles })}>{saving ? "SPREMANJE..." : "SPREMI I OBJAVI PROMJENE"}</button>
      </footer>
    </main>
  );
}
