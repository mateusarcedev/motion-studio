#!/usr/bin/env python3
"""beat_map.py — BPM, batidas, tempos fortes e compassos de uma faixa, alinhados ao grid de frames.

Uso:
  python3 beat_map.py <audio> [--fps 30] [--bar-beats 4] [--min-bpm 60] [--max-bpm 180] [--bpm-hint BPM] [--out beats.json]

Dependências: numpy, scipy, ffmpeg no PATH (decodifica qualquer formato). Sem librosa.
Método:
  1. envelope de onset por fluxo espectral (log-magnitude, diferença positiva), hop de 10 ms;
  2. tempo por autocorrelação do envelope, ponderada para preferir 80–140 BPM; metade e dobro ficam em
     "tempoCandidates", e --bpm-hint escolhe entre eles (o áudio sozinho pode não decidir a oitava);
  3. rastreamento de batidas por programação dinâmica (custo de desvio do período + força do onset);
     cada batida é reposicionada no ataque medido na onda (passo de 1 ms): a janela da STFT adianta
     o onset em ~30 ms; pontas sem ataque são descartadas e o BPM final sai da regressão das batidas;
  4. tempo forte: fase do compasso com mais energia grave (< 150 Hz) nas batidas;
  5. seções por energia RMS suavizada (low/mid/high).
Saída determinística para a mesma entrada.
"""
import argparse
import json
import subprocess
import sys

import numpy as np
from scipy.signal import stft

SR = 22050
HOP = 220  # ~10 ms


def decode(path):
    cmd = ["ffmpeg", "-v", "error", "-i", path, "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"]
    raw = subprocess.run(cmd, capture_output=True, check=True).stdout
    a = np.frombuffer(raw, dtype=np.float32)
    if a.size < SR:
        raise SystemExit("áudio curto demais (< 1 s)")
    return a


def onset_envelope(a):
    _, _, Z = stft(a, fs=SR, nperseg=1024, noverlap=1024 - HOP, boundary=None, padded=False)
    mag = np.log1p(100 * np.abs(Z))
    flux = np.maximum(0.0, np.diff(mag, axis=1)).sum(axis=0)
    flux = np.concatenate([[0.0], flux])
    # remove tendência local e normaliza
    k = int(1.0 / (HOP / SR))
    local = np.convolve(flux, np.ones(k) / k, mode="same")
    env = np.maximum(0.0, flux - local)
    if env.max() > 0:
        env /= env.max()
    low = np.abs(Z[: int(150 / (SR / 1024)) + 1]).sum(axis=0)
    low = np.concatenate([[low[0]], low])[: env.size]
    return env, low / (low.max() or 1)


def estimate_period(env, min_bpm, max_bpm, hint=None):
    fps_env = SR / HOP
    lo, hi = int(fps_env * 60 / max_bpm), int(fps_env * 60 / min_bpm)
    e = env - env.mean()
    ac = np.correlate(e, e, mode="full")[e.size - 1:]
    ac /= ac[0] or 1
    lags = np.arange(lo, hi + 1)
    bpms = 60 * fps_env / lags
    weight = np.exp(-0.5 * (np.log2(bpms / 110.0) / 0.9) ** 2)  # prefere 80–140
    score = ac[lags] * weight
    if hint:
        ok = np.abs(np.log2(bpms / hint)) <= 0.08
        if not ok.any():
            raise SystemExit("--bpm-hint fora da faixa --min-bpm/--max-bpm")
        score = np.where(ok, ac[lags], -np.inf)
    i = int(np.argmax(score))
    # refinamento parabólico
    if 0 < i < len(lags) - 1 and np.isfinite(score[[i - 1, i + 1]]).all():
        y0, y1, y2 = score[i - 1], score[i], score[i + 1]
        d = 0.5 * (y0 - y2) / (y0 - 2 * y1 + y2 or 1)
        lag = lags[i] + d
    else:
        lag = float(lags[i])
    conf = float(max(0.0, ac[lags[i]]))
    return lag, conf, ac


def tempo_candidates(ac, lag):
    """Tempo escolhido, metade e dobro, com a autocorrelação medida em cada um (sem ponderação)."""
    out = []
    for rel, f in (("chosen", 1.0), ("half", 2.0), ("double", 0.5)):
        c = lag * f
        bpm = 60 * SR / HOP / c
        if 30 <= bpm <= 300 and int(c) + 2 < ac.size:
            lo = max(1, int(round(c)) - 1)
            out.append({"relation": rel, "bpm": round(float(bpm), 2), "score": round(float(ac[lo:lo + 3].max()), 3)})
    return out


def refine_beats(a, idx):
    """Posição do ataque na onda, em segundos; nan onde não há ataque claro."""
    step, win = SR // 1000, 64
    sq = np.concatenate([[0.0], np.cumsum(np.diff(a, prepend=a[:1]).astype(np.float64) ** 2)])
    starts = np.arange(0, a.size - win, step)
    level = np.log10((sq[starts + win] - sq[starts]) / win + 1e-9)
    # subida em 4 ms; o ataque entra na última amostra da janela em que ela ainda cresce
    rise = np.concatenate([np.zeros(4), level[4:] - level[:-4]])
    out = []
    for b in idx:
        c = int(b * HOP / step)
        lo, hi = max(0, c - 15), min(rise.size, c + 65)
        seg = rise[lo:hi]
        if seg.size == 0 or seg.max() < 0.5:
            out.append(np.nan)
            continue
        k = int(np.argmax(seg >= 0.9 * seg.max()))
        out.append((lo + k) * step / SR + (win - 1) / SR - 0.002)
    return np.array(out)


def final_times(a, env, idx, period):
    """Descarta pontas sem ataque e devolve (índices, tempos em s)."""
    t = refine_beats(a, idx)
    good = np.flatnonzero(~np.isnan(t))
    shift = float(np.median(t[good] - idx[good] * HOP / SR)) if good.size else 0.029
    est = np.where(np.isnan(t), idx * HOP / SR + shift, t)
    if good.size >= 4:
        idx, est, t = idx[good[0]:good[-1] + 1], est[good[0]:good[-1] + 1], t[good[0]:good[-1] + 1]
        # ponta que não respeita o período não é batida
        while est.size > 4 and abs(est[1] - est[0] - period) > 0.12 * period:
            idx, est, t = idx[1:], est[1:], t[1:]
        while est.size > 4 and abs(est[-1] - est[-2] - period) > 0.12 * period:
            idx, est, t = idx[:-1], est[:-1], t[:-1]
    # recompõe pontas: enquanto houver ataque onde o período prevê uma batida
    if est.size >= 4:
        for side in (0, -1):
            while True:
                nxt = est[side] + (period if side else -period)
                if nxt < 0 or nxt >= a.size / SR:
                    break
                guess = int(round((nxt - 0.029) * SR / HOP))
                if not 0 <= guess < env.size:
                    break
                got = refine_beats(a, [guess])[0]
                if np.isnan(got) or abs(got - nxt) > 0.06 * period:
                    break
                idx = np.append(idx, guess) if side else np.insert(idx, 0, guess)
                est = np.append(est, got) if side else np.insert(est, 0, got)
    return idx, est


def track_beats(env, period, tightness=100.0):
    n = env.size
    score = env.copy()
    back = -np.ones(n, dtype=int)
    p = period
    for t in range(n):
        lo, hi = int(t - 2 * p), int(t - p / 2)
        if hi <= 0:
            continue
        lo = max(lo, 0)
        cand = np.arange(lo, hi)
        pen = -tightness * (np.log((t - cand) / p)) ** 2
        tot = score[cand] + pen
        j = int(np.argmax(tot))
        score[t] = env[t] + tot[j]
        back[t] = cand[j]
    # termina no melhor ponto do último período
    tail = np.arange(max(0, n - int(p)), n)
    t = int(tail[np.argmax(score[tail])])
    beats = []
    while t >= 0:
        beats.append(t)
        t = back[t]
    return np.array(beats[::-1])


def sections(a, step_s=0.5):
    w = int(SR * step_s)
    n = a.size // w
    rms = np.sqrt((a[: n * w].reshape(n, w) ** 2).mean(axis=1) + 1e-12)
    db = 20 * np.log10(rms)
    db = np.convolve(db, np.ones(5) / 5, mode="same")
    q1, q2 = np.percentile(db, [33, 66])
    labels = np.where(db < q1, "low", np.where(db < q2, "mid", "high"))
    out, last = [], None
    for i, lab in enumerate(labels):
        if lab != last:
            out.append({"t": round(i * step_s, 2), "energy": str(lab)})
            last = lab
    # funde trechos < 2 s
    merged = []
    for s in out:
        if merged and s["t"] - merged[-1]["t"] < 2.0:
            merged[-1]["energy"] = s["energy"]
        else:
            merged.append(s)
    return merged


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("audio")
    ap.add_argument("--fps", type=float, default=30.0)
    ap.add_argument("--bar-beats", type=int, default=4)
    ap.add_argument("--min-bpm", type=float, default=60.0)
    ap.add_argument("--max-bpm", type=float, default=180.0)
    ap.add_argument("--out", default="beats.json")
    ap.add_argument("--bpm-hint", type=float, default=None, help="BPM aproximado: resolve metade/dobro")
    args = ap.parse_args()
    if args.bpm_hint:
        args.min_bpm = min(args.min_bpm, args.bpm_hint * 0.9)
        args.max_bpm = max(args.max_bpm, args.bpm_hint * 1.1)

    a = decode(args.audio)
    env, low = onset_envelope(a)
    lag, conf, ac = estimate_period(env, args.min_bpm, args.max_bpm, args.bpm_hint)
    hop_s = HOP / SR
    beats_idx, times = final_times(a, env, track_beats(env, lag), lag * hop_s)
    bpm = 60.0 / (lag * hop_s)
    if times.size >= 8:
        fit = 60.0 / float(np.polyfit(np.arange(times.size), times, 1)[0])
        if abs(fit / bpm - 1) < 0.02:
            bpm = fit
    candidates = tempo_candidates(ac, lag)
    ambiguous = any((c["relation"] == "double" and c["score"] >= 0.7 * conf) or (c["relation"] == "half" and c["score"] > conf)
                    for c in candidates)

    # fase do compasso: offset com mais energia grave
    nb = args.bar_beats
    lowb = np.array([low[b:b + 6].max() for b in beats_idx])
    phase_score = [lowb[k::nb].sum() if lowb[k::nb].size else 0 for k in range(nb)]
    phase = int(np.argmax(phase_score))

    strength = env[beats_idx]
    smax = strength.max() or 1
    beats, bars = [], []
    for i, t in enumerate(times):
        t = float(t)
        down = (i - phase) % nb == 0
        beats.append({"t": round(t, 3), "frame": int(round(t * args.fps)),
                      "strength": round(float(strength[i] / smax), 3), "downbeat": bool(down)})
        if down:
            bars.append({"index": len(bars), "t": round(t, 3), "frame": int(round(t * args.fps))})

    result = {
        "source": args.audio, "fps": args.fps, "durationSec": round(a.size / SR, 3),
        "bpm": round(bpm, 2), "beatSec": round(60.0 / bpm, 4), "barBeats": nb,
        "confidence": round(conf, 3), "bpmHint": args.bpm_hint,
        "tempoCandidates": candidates, "tempoAmbiguous": bool(ambiguous and not args.bpm_hint),
        "beats": beats, "bars": bars, "sections": sections(a),
        "method": "spectral-flux + autocorrelation + DP beat tracking (beat_map.py v2)",
    }
    with open(args.out, "w") as f:
        json.dump(result, f, indent=1)
    print(json.dumps({"bpm": result["bpm"], "confidence": result["confidence"], "beats": len(beats),
                      "bars": len(bars), "out": args.out}))
    if result["tempoAmbiguous"]:
        print("aviso: metade/dobro do tempo também é plausível; confira tempoCandidates e use --bpm-hint", file=sys.stderr)
    if conf < 0.3:
        print("aviso: confiança baixa — faixa sem pulso claro; marque viradas manualmente", file=sys.stderr)


if __name__ == "__main__":
    main()
