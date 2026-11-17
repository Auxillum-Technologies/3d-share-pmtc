import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, DoorOpen, MapPin } from "lucide-react";
import HospitalHubCanvas from "@/components/HospitalHubCanvas";
import PhoneControlsGuide from "@/components/PhoneControlsGuide";
import type { HubMoveDirection, HubRoom } from "@/game/HospitalHub";

export default function HospitalHub() {
  const [, navigate] = useLocation();
  const [nearRoom, setNearRoom] = useState<HubRoom | null>(null);
  const returnedRoom = (() => {
    const match = window.location.hash.match(/[?&]returnLevel=(\d+)/);
    const levelIndex = match ? Number(match[1]) : null;
    return levelIndex !== null && levelIndex >= 0 && levelIndex < 5 ? levelIndex : undefined;
  })();
  const touch = {
    onMove: (dir: HubMoveDirection, pressed: boolean) => window.dispatchEvent(new CustomEvent("das-hub-move", { detail: { dir, pressed } })),
  };

  return (
    <main className="fixed inset-0 overflow-hidden bg-[#06131a] text-white">
      <HospitalHubCanvas
        onDoorChange={setNearRoom}
        onEnterRoom={(levelIndex) => navigate(`/adventure?level=${levelIndex}`)}
        touchHandlers={touch}
        startRoomIndex={returnedRoom}
      />
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between bg-gradient-to-b from-[#041218]/95 to-transparent px-4 pb-4 pt-[max(1rem,env(safe-area-inset-top))] sm:px-7 short:pb-2 short:pt-[max(0.5rem,env(safe-area-inset-top))] pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]">
        <div>
          <p className="font-telemetry text-[10px] uppercase tracking-[0.28em] text-cyan-300">DAS Hospital · Open Training Wing</p>
          <h1 className="mt-1 font-display text-xl font-bold sm:text-2xl short:text-lg">Explore hospital. Enter room. Train level.</h1>
        </div>
        <button onClick={() => navigate("/")} className="pointer-events-auto flex min-h-11 items-center gap-2 border border-cyan-700/70 bg-slate-950/80 px-3 py-2 font-telemetry text-xs text-cyan-100 hover:bg-cyan-950">
          <ArrowLeft className="h-4 w-4" /> Console
        </button>
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-[#041218]/95 to-transparent px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-16 sm:px-7 short:pt-4 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]">
        <div className="mx-auto max-w-xl border border-cyan-700/60 bg-[#08212a]/90 p-3 text-center shadow-2xl sm:p-4 touch:max-w-sm short:p-2">
          {nearRoom ? (
            <>
              <div className="flex items-center justify-center gap-2 font-telemetry text-xs uppercase tracking-[0.18em]" style={{ color: nearRoom.tint }}>
                <MapPin className="h-4 w-4" /> Level {nearRoom.levelIndex + 1} door
              </div>
              <div className="mt-1 font-display text-lg font-bold">{nearRoom.name}</div>
              <div className="mt-1 hidden text-xs text-cyan-100/80 touch:block">Tap ENTER at bottom right to enter.</div>
              <div className="mt-1 text-xs text-cyan-100/80 touch:hidden">Press <kbd className="border border-amber-300/70 px-1.5 py-0.5 font-bold text-amber-200">E</kbd> or <kbd className="border border-amber-300/70 px-1.5 py-0.5 font-bold text-amber-200">Enter</kbd> to enter.</div>
            </>
          ) : (
            <div className="flex items-center justify-center gap-2 font-telemetry text-xs uppercase tracking-[0.16em] text-cyan-200"><DoorOpen className="h-4 w-4 text-amber-300" /> {returnedRoom === undefined ? <><span className="touch:hidden">Use WASD or arrow keys to explore the hospital</span><span className="hidden touch:inline">Use the arrow pad to explore the hospital</span></> : `Returned from Level ${returnedRoom + 1}. Choose next room.`}</div>
          )}
        </div>
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-[max(1.25rem,env(safe-area-inset-bottom))] z-20 hidden items-end justify-between pl-[max(1.25rem,env(safe-area-inset-left))] pr-[max(1.25rem,env(safe-area-inset-right))] touch:flex">
        <div className="grid grid-cols-3 gap-2">
          <span />
          <TouchButton label="▲" onPress={(pressed) => touch.onMove("forward", pressed)} />
          <span />
          <TouchButton label="◀" onPress={(pressed) => touch.onMove("left", pressed)} />
          <TouchButton label="▼" onPress={(pressed) => touch.onMove("backward", pressed)} />
          <TouchButton label="▶" onPress={(pressed) => touch.onMove("right", pressed)} />
        </div>
        <TouchButton label="ENTER" onPress={(pressed) => pressed && window.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyE" }))} />
      </div>
      <PhoneControlsGuide route="hub" />
    </main>
  );
}

function TouchButton({ label, onPress }: { label: string; onPress: (pressed: boolean) => void }) {
  return (
    <button
      className="pointer-events-auto flex h-12 min-w-12 touch-none select-none items-center justify-center border border-cyan-500/70 bg-slate-950/90 px-3 font-telemetry text-xs font-bold text-cyan-100 active:scale-95"
      onPointerDown={(event) => { event.preventDefault(); onPress(true); }}
      onPointerUp={() => onPress(false)}
      onPointerLeave={() => onPress(false)}
    >
      {label}
    </button>
  );
}
