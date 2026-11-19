"""Small deterministic SVG/audio assets for the Rose preview."""
from pathlib import Path
import math
import struct
import wave

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "src" / "generated"
ASSETS.mkdir(parents=True, exist_ok=True)

def scene_svg(path, end=False):
    label = 'Pequenos detalhes, grandes momentos.' if end else 'Um detalhe especial começa aqui'
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920" viewBox="0 0 1080 1920">
<rect width="1080" height="1920" fill="#FFF9F6"/>
<path d="M0 1410 Q260 1270 540 1435 T1080 1430 L1080 1920 L0 1920Z" fill="#F9E8EA"/>
<ellipse cx="135" cy="505" rx="85" ry="110" fill="#F38FA8" opacity=".82"/><path d="M135 615 Q146 715 115 815" fill="none" stroke="#D5A94E" stroke-width="4"/>
<ellipse cx="925" cy="640" rx="88" ry="114" fill="#62C8EA" opacity=".78"/><path d="M925 754 Q902 839 945 923" fill="none" stroke="#D5A94E" stroke-width="4"/>
<circle cx="847" cy="365" r="9" fill="#D5A94E"/><circle cx="226" cy="1090" r="7" fill="#62C8EA"/>
<path d="M720 300 l12 29 29 12 -29 12 -12 29 -12 -29 -29 -12 29 -12z" fill="#D5A94E" opacity=".78"/>
<path d="M289 1290 l10 24 24 10 -24 10 -10 24 -10 -24 -24 -10 24 -10z" fill="#F38FA8" opacity=".7"/>
<text x="540" y="1005" text-anchor="middle" fill="#173C5B" font-family="DejaVu Sans" font-size="40">{label}</text>
</svg>'''
    (ASSETS / path).write_text(svg, encoding="utf-8")

scene_svg("intro.svg")
scene_svg("outro.svg", True)

texts = {
    "name1": "MINI FESTA",
    "name2": "da Rose",
    "tagline": "Pequenos detalhes,",
    "tagline2": "grandes momentos.",
    "services1": "Mini Festas  •  Decoração",
    "services2": "Personalizados  •  Lembrancinhas",
    "kind1": "Festa infantil",
    "kind2": "Chá de bebê",
    "kind3": "Aniversários e celebrações",
    "promise1": "Sua festa,",
    "promise2": "do jeitinho que você sonhou!",
    "cta1": "Faça sua reserva pelo WhatsApp",
    "phone": "(97) 98441-6729",
    "handle": "@minifestadarose",
}
for name, value in texts.items():
    (ASSETS / f"{name}.txt").write_text(value, encoding="utf-8")

# Quiet, original instrumental bed: soft plucked chords and a small bell on transitions.
rate = 44100
duration = 15.0
notes = {"C4": 261.63, "E4": 329.63, "G4": 392.00, "B4": 493.88,
         "A3": 220.00, "D4": 293.66, "F4": 349.23, "C5": 523.25,
         "G3": 196.00, "D5": 587.33}
chords = [
    (0.0, ["C4", "E4", "G4", "B4"]),
    (3.75, ["A3", "C4", "E4", "G4"]),
    (7.5, ["F4", "A3", "C5", "E4"]),
    (11.25, ["G3", "B4", "D5", "F4"]),
]
events = []
for start, chord in chords:
    for step in range(8):
        events.append((start + step * .46875, notes[chord[step % 4]], .095))
bells = [1.15, 2.0, 4.85, 8.0, 9.55, 11.0, 12.2, 14.55]

samples = bytearray()
for i in range(int(duration * rate)):
    t = i / rate
    value = 0.0
    for start, freq, amp in events:
        d = t - start
        if 0 <= d < 1.35:
            env = (1 - math.exp(-d * 55)) * math.exp(-d * 3.3)
            value += amp * env * (math.sin(2 * math.pi * freq * d) + .24 * math.sin(4 * math.pi * freq * d))
    for start in bells:
        d = t - start
        if 0 <= d < .7:
            value += .045 * math.exp(-d * 9) * math.sin(2 * math.pi * 1174.66 * d)
    value *= min(1, t / .35, (duration - t) / .6)
    samples += struct.pack("<h", int(max(-1, min(1, value)) * 32767))
with wave.open(str(ASSETS / "trilha-preview.wav"), "wb") as out:
    out.setnchannels(1)
    out.setsampwidth(2)
    out.setframerate(rate)
    out.writeframes(samples)
