import { useEffect, useState } from "react";
import { HelpCircle, Smartphone } from "lucide-react";

export type PhoneGuideRoute = "hub" | "ward";

const STORAGE_KEY = "das-phone-guide-seen";
const PHONE_QUERY = "(pointer: coarse)";
const PORTRAIT_QUERY = "(pointer: coarse) and (orientation: portrait)";

const CONTROLS: Record<PhoneGuideRoute, { title: string; items: { keys: string; text: string }[] }> = {
  hub: {
    title: "Hospital lobby",
    items: [
      { keys: "▲ ▼ ◀ ▶", text: "Hold the arrow pad at bottom left to walk." },
      { keys: "ENTER", text: "Tap at bottom right when you stand at a ward door." },
    ],
  },
  ward: {
    title: "Ward round",
    items: [
      { keys: "◀ ▶", text: "Hold at bottom left to walk along the beds." },
      { keys: "▲", text: "Tap at bottom right to jump." },
      { keys: "Card", text: "The patient card opens at each bed. Tap an answer." },
    ],
  },
};

function readSeen(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function writeSeen() {
  try {
    window.localStorage.setItem(STORAGE_KEY, "1");
  } catch {
    /* storage blocked: the guide shows again next visit */
  }
}

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const list = window.matchMedia(query);
    const onChange = () => setMatches(list.matches);
    onChange();
    list.addEventListener("change", onChange);
    return () => list.removeEventListener("change", onChange);
  }, [query]);
  return matches;
}

// Best effort: iOS Safari has no orientation.lock, the rotate overlay covers that case.
async function tryLockLandscape() {
  try {
    if (!document.fullscreenElement && document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
    const orientation = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
    await orientation.lock?.("landscape");
  } catch {
    /* unsupported or refused */
  }
}

export default function PhoneControlsGuide({ route }: { route: PhoneGuideRoute }) {
  const isPhone = useMediaQuery(PHONE_QUERY);
  const isPortrait = useMediaQuery(PORTRAIT_QUERY);
  const [open, setOpen] = useState(() => !readSeen());

  if (!isPhone) return null;

  if (isPortrait) {
    return (
      <div
        role="alertdialog"
        aria-label="Rotate your phone"
        className="fixed inset-0 z-[100] flex touch-none flex-col items-center justify-center gap-5 bg-[#06131a] p-8 text-center text-cyan-100"
        onPointerDownCapture={(e) => e.stopPropagation()}
      >
        <Smartphone className="h-16 w-16 rotate-90 text-amber-300" />
        <h2 className="font-display text-2xl font-bold">Rotate your phone</h2>
        <p className="font-telemetry text-sm text-cyan-200/80">This game plays in landscape. Turn your phone sideways to continue.</p>
      </div>
    );
  }

  const controls = CONTROLS[route];
  const close = () => {
    writeSeen();
    setOpen(false);
    void tryLockLandscape();
  };

  return (
    <>
      <button
        aria-label="Show phone controls"
        onClick={() => setOpen(true)}
        className="clay-button absolute left-[max(0.75rem,env(safe-area-inset-left))] top-1/2 z-30 flex h-11 w-11 -translate-y-1/2 items-center justify-center bg-stone-100 text-[#3b3340]"
      >
        <HelpCircle className="h-6 w-6" />
      </button>
      {open && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-[#3b3340]/40 p-[max(0.75rem,env(safe-area-inset-left))] backdrop-blur-sm">
          <div role="dialog" aria-label="Phone controls" className="clay-card max-h-full w-full max-w-md overflow-y-auto p-5">
            <p className="font-telemetry text-xs uppercase tracking-[0.2em] text-[#7d7081]">Phone controls</p>
            <h2 className="mt-1 font-display text-2xl font-bold">{controls.title}</h2>
            <ul className="mt-3 space-y-2">
              {controls.items.map((item) => (
                <li key={item.keys} className="clay-inset flex items-center gap-3 px-3 py-2 text-base">
                  <span className="min-w-16 font-telemetry font-bold text-amber-700">{item.keys}</span>
                  <span>{item.text}</span>
                </li>
              ))}
            </ul>
            <button onClick={close} className="clay-button mt-4 h-12 w-full bg-amber-300 font-semibold text-[#3b3340] hover:bg-amber-200">
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
}
