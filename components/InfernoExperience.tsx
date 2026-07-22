"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import type { InfernoCircle } from "@/lib/types";
import { AmbientAudio } from "@/components/AmbientAudio";

const InfernoScene = dynamic(() => import("@/components/InfernoScene").then((mod) => mod.InfernoScene), { ssr: false });

gsap.registerPlugin(ScrollTrigger);

export function InfernoExperience({ circles }: { circles: InfernoCircle[] }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [detailsOpen, setDetailsOpen] = useState<Record<string, boolean>>({});
  const rootRef = useRef<HTMLElement>(null);

  const activeCircle = circles[activeIndex] ?? circles[0];
  const progress = circles.length > 1 ? activeIndex / (circles.length - 1) : 0;

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const context = gsap.context(() => {
      const sections = gsap.utils.toArray<HTMLElement>("[data-circle-section]");
      sections.forEach((section, index) => {
        const content = section.querySelector(".circle-copy");
        if (content) {
          gsap.fromTo(
            content,
            { opacity: 0.12, y: 90, filter: "blur(10px)" },
            {
              opacity: 1,
              y: 0,
              filter: "blur(0px)",
              ease: "none",
              scrollTrigger: {
                trigger: section,
                start: "top 75%",
                end: "center 45%",
                scrub: 0.8
              }
            }
          );
        }

        ScrollTrigger.create({
          trigger: section,
          start: "top 55%",
          end: "bottom 45%",
          onEnter: () => setActiveIndex(index),
          onEnterBack: () => setActiveIndex(index)
        });
      });
    }, root);

    const hiddenPilot = (event: KeyboardEvent) => {
      if (event.altKey && event.shiftKey && event.code === "Digit9") window.location.assign("/pilot");
    };
    window.addEventListener("keydown", hiddenPilot);

    return () => {
      window.removeEventListener("keydown", hiddenPilot);
      context.revert();
    };
  }, [circles]);

  useEffect(() => {
    document.documentElement.style.setProperty("--active-a", activeCircle?.palette[0] ?? "#9b1d20");
    document.documentElement.style.setProperty("--active-b", activeCircle?.palette[1] ?? "#321417");
  }, [activeCircle]);

  const rail = useMemo(() => circles.map((circle, index) => ({ circle, index })), [circles]);

  function jumpTo(index: number) {
    document.getElementById(`krug-${circles[index].slug}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <main ref={rootRef} className="inferno-root">
      <InfernoScene circles={circles} activeIndex={activeIndex} />
      <div className="film-grain" aria-hidden="true" />
      <div className="edge-vignette" aria-hidden="true" />

      <header className="topbar">
        <div className="brand-mark" aria-label="Krugovi pakla">
          <span>KRUGOVI</span>
          <span>PAKLA</span>
        </div>
        <AmbientAudio activeIndex={activeIndex} circleCount={circles.length} />
      </header>

      <aside className="descent-rail" aria-label="Navigacija po krugovima">
        <div className="rail-line"><i style={{ transform: `scaleY(${Math.max(0.02, progress)})` }} /></div>
        {rail.map(({ circle, index }) => (
          <button
            key={circle.id}
            className={index === activeIndex ? "rail-node is-active" : "rail-node"}
            onClick={() => jumpTo(index)}
            aria-label={`Idi na ${circle.order}. krug: ${circle.title}`}
          >
            <span>{circle.roman || circle.order}</span>
            <em>{circle.title}</em>
          </button>
        ))}
      </aside>

      <section className="portal" aria-labelledby="portal-title">
        <div className="portal-copy">
          <p className="eyebrow">INTERAKTIVNI ANATOMSKI ATLAS KRIVNJE</p>
          <h1 id="portal-title">Ne ulaziš u pakao.<br />Pakao se organizira oko tebe.</h1>
          <p className="portal-lead">
            Devet krugova. Devet načina na koje odluka postaje prostor, tijelo i vječna radnja. Scroll je pad. Kazna je argument.
          </p>
          <p className="content-note">Sadrži grafičke opise kazne, tjelesnog nasilja i samoubojstva u književno-povijesnom kontekstu.</p>
          <div className="portal-instruction" aria-hidden="true">
            <span>SPUSTI SE</span><b>↓</b>
          </div>
        </div>
        <div className="portal-seal" aria-hidden="true"><span>9</span><small>CIRCULI</small></div>
      </section>

      <section className="ante-inferno">
        <div className="circle-copy compact-copy">
          <p className="eyebrow">PREDVORJE / NULTA RAZINA</p>
          <h2>Prije kazne dolazi izbor koji se nikada nije dogodio.</h2>
          <p>
            Dante prije prvog kruga smješta ravnodušne: one koji nisu stali ni uz dobro ni uz zlo, nego su cijeli život čuvali samo vlastitu sigurnost. Trče za praznom zastavom dok ih bodu kukci, a krv i suze hrane crve pod njihovim nogama. Nisu dovoljno odlučni ni za vlastitu osudu. Institucije ih ne pamte; pakao ih ne želi imenovati.
          </p>
        </div>
      </section>

      {circles.map((circle, index) => (
        <section
          id={`krug-${circle.slug}`}
          key={circle.id}
          data-circle-section
          className="circle-section"
          style={{ "--circle-a": circle.palette[0], "--circle-b": circle.palette[1], "--circle-c": circle.palette[2] } as React.CSSProperties}
        >
          <div className="circle-index" aria-hidden="true">
            <span>{circle.roman || circle.order}</span>
            <small>{String(index + 1).padStart(2, "0")}/{String(circles.length).padStart(2, "0")}</small>
          </div>

          <article className="circle-copy">
            <p className="eyebrow">{circle.canto} · {circle.kind === "dante" ? "DANTEOV KRUG" : "DODANI KRUG"}</p>
            <h2>{circle.title}</h2>
            <p className="circle-subtitle">{circle.subtitle}</p>
            <blockquote>{circle.thesis}</blockquote>

            <div className="core-grid">
              <div>
                <span className="label">KRIVNJA</span>
                <p>{circle.guilt}</p>
              </div>
              <div>
                <span className="label">KAZNA</span>
                <p>{circle.punishment}</p>
              </div>
              <div className="contrapasso-card">
                <span className="label">CONTRAPASSO</span>
                <p>{circle.contrapasso}</p>
              </div>
            </div>

            <button
              className="reveal-button"
              onClick={() => setDetailsOpen((state) => ({ ...state, [circle.id]: !state[circle.id] }))}
              aria-expanded={Boolean(detailsOpen[circle.id])}
            >
              {detailsOpen[circle.id] ? "ZATVORI ANATOMIJU KRUGA" : "OTVORI ANATOMIJU KRUGA"}
              <span>{detailsOpen[circle.id] ? "−" : "+"}</span>
            </button>

            {detailsOpen[circle.id] && (
              <div className="details-panel">
                <div><span className="label">PROSTOR</span><p>{circle.geography}</p></div>
                <div><span className="label">OSJETILA</span><p>{circle.senses}</p></div>
                <div><span className="label">SCENSKA UPUTA</span><p>{circle.stageDirection}</p></div>
                <div><span className="label">ZVUČNA SLIKA</span><p>{circle.ambient}</p></div>
                <div><span className="label">ČUVARI</span><p>{circle.guardians.join(" · ") || "Nema imenovanih čuvara."}</p></div>
                <div><span className="label">FIGURE</span><p>{circle.inhabitants.join(" · ") || "Anonimne duše."}</p></div>

                {circle.subregions.length > 0 && (
                  <div className="subregions">
                    {circle.subregions.map((subregion, subIndex) => (
                      <article key={`${circle.id}-${subIndex}`}>
                        <span>{String(subIndex + 1).padStart(2, "0")}</span>
                        <h3>{subregion.name}</h3>
                        <p><b>Osuđeni:</b> {subregion.condemned}</p>
                        <p><b>Kazna:</b> {subregion.punishment}</p>
                        <p><b>Značenje:</b> {subregion.meaning}</p>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            )}
          </article>
        </section>
      ))}

      <section className="exit-section">
        <div className="circle-copy compact-copy">
          <p className="eyebrow">ISPOD DNA / PREOKRET</p>
          <h2>Tek na samom dnu smjer se mijenja.</h2>
          <p>
            Dante i Vergilije prolaze uz Luciferovo tijelo kroz središte Zemlje. Ono što je do tada bilo spuštanje postaje uspon. Pakao ne završava pobjedom nad čudovištem, nego promjenom orijentacije: ista kretnja dobiva drugo značenje tek kada putnik prepozna gdje se nalazi.
          </p>
          <button className="return-button" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>VRATI SE NA POVRŠINU ↑</button>
        </div>
      </section>

      <footer>
        <span>KRUGOVI PAKLA / HRVATSKI WEB-ART PROJEKT</span>
        <span>DANTEOV MODEL + PROŠIRIVI PILOT SLOJ</span>
      </footer>
    </main>
  );
}
