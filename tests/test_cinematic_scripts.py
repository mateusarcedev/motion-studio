"""cinematic-product-director scripts, on synthetic fixtures only (nothing is versioned)."""
import hashlib
import json
import os
import pathlib
import subprocess
import sys
import tempfile
import unittest
import wave

import numpy as np  # declared in the Skill's scripts/requirements.txt; missing = failure, never a skip
import scipy  # noqa: F401

SCRIPTS = pathlib.Path(__file__).resolve().parents[1] / "packages/motion-skills/skills/cinematic-product-director/scripts"
SR = 44100
OFFSET = 0.5


def ffmpeg(*args):
    subprocess.run(["ffmpeg", "-v", "error", "-y", *map(str, args)], check=True)


def sha(path):
    return hashlib.sha256(pathlib.Path(path).read_bytes()).hexdigest()


def write_wav(path, x):
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((np.clip(x, -1, 1) * 32767).astype("<i2").tobytes())


def track(bpm, seconds=32, eighths=False):
    """Kick on the downbeat, hat on every beat (and on the eighths). Returns samples and beat times."""
    def tone(freq, dur, amp, decay=30):
        t = np.arange(int(SR * dur)) / SR
        return amp * np.sin(2 * np.pi * freq * t) * np.exp(-t * decay)
    x = np.random.default_rng(1).normal(0, 1e-3, int(SR * (seconds + 1)))
    beats = np.arange(OFFSET, seconds - 0.3, 60 / bpm)
    for i, b in enumerate(beats):
        hits = [(b, tone(1500, 0.06, 0.4))]
        if i % 4 == 0:
            hits.append((b, tone(60, 0.25, 0.8)))
        if eighths:
            hits.append((b + 30 / bpm, tone(5000, 0.03, 0.2)))
        for t, s in hits:
            k = int(t * SR)
            x[k:k + s.size] += s
    return x[:int(SR * seconds)], beats


class Base(unittest.TestCase):
    def setUp(self):
        tmp = tempfile.TemporaryDirectory(prefix="motion-cinematic-")
        self.addCleanup(tmp.cleanup)
        self.dir = pathlib.Path(tmp.name)

    def py(self, script, *args):
        return subprocess.run([sys.executable, str(SCRIPTS / script), *map(str, args)],
                              capture_output=True, text=True, cwd=self.dir)


class BeatMap(Base):
    def run_map(self, x, *args, out="beats.json"):
        write_wav(self.dir / "a.wav", x)
        r = self.py("beat_map.py", "a.wav", "--out", out, *args)
        self.assertEqual(r.returncode, 0, r.stderr)
        return json.loads((self.dir / out).read_text()), r.stderr

    def assert_aligned(self, m, beats):
        for got, want in (([b["t"] for b in m["beats"]], beats), ([b["t"] for b in m["bars"]], beats[::4])):
            self.assertEqual(len(got), len(want))
            self.assertLess(np.abs(np.array(got) - want).max(), 0.010)

    def test_known_tempos_with_hint(self):
        for bpm in (60, 92, 128, 174):
            for eighths in (False, True):
                with self.subTest(bpm=bpm, eighths=eighths):
                    x, beats = track(bpm, eighths=eighths)
                    m, _ = self.run_map(x, "--bpm-hint", bpm)
                    self.assertLess(abs(m["bpm"] - bpm), 0.5)
                    self.assertFalse(m["tempoAmbiguous"])
                    self.assert_aligned(m, beats)

    def test_rough_hint_is_enough(self):
        x, beats = track(174)
        m, _ = self.run_map(x, "--bpm-hint", 170)
        self.assertLess(abs(m["bpm"] - 174), 0.5)
        self.assert_aligned(m, beats)

    def test_without_hint_the_right_tempo_or_an_octave_warning(self):
        for bpm in (60, 92, 128, 174):
            for eighths in (False, True):
                with self.subTest(bpm=bpm, eighths=eighths):
                    m, err = self.run_map(track(bpm, eighths=eighths)[0])
                    cands = [c["bpm"] for c in m["tempoCandidates"]]
                    self.assertTrue(any(abs(c - bpm) < 0.5 for c in cands), cands)
                    if abs(m["bpm"] - bpm) >= 0.5:
                        self.assertTrue(m["tempoAmbiguous"])
                        self.assertIn("--bpm-hint", err)

    def test_noise_short_audio_and_determinism(self):
        m, err = self.run_map(np.random.default_rng(3).normal(0, 0.1, SR * 20))
        self.assertLess(m["confidence"], 0.3)
        self.assertIn("confiança baixa", err)
        write_wav(self.dir / "s.wav", np.zeros(SR // 2))
        self.assertNotEqual(self.py("beat_map.py", "s.wav").returncode, 0)
        x, _ = track(92)
        self.run_map(x, out="1.json")
        self.run_map(x, out="2.json")
        self.assertEqual(sha(self.dir / "1.json"), sha(self.dir / "2.json"))

    def test_silence_does_not_crash(self):
        m, _ = self.run_map(np.zeros(SR * 10))
        self.assertLess(m["confidence"], 0.3)


class RefAnalyze(Base):
    CUTS = [1.0, 2.5, 4.0]

    def video(self, overlay=""):
        ffmpeg("-f", "lavfi", "-i", "testsrc2=s=540x960:r=30:d=1", "-f", "lavfi", "-i", "smptebars=s=540x960:r=30:d=1.5",
               "-f", "lavfi", "-i", "mandelbrot=s=540x960:r=30", "-f", "lavfi", "-i", "color=c=0x224466:s=540x960:r=30:d=2",
               "-filter_complex", "[2]trim=duration=1.5,setpts=PTS-STARTPTS[m];[0][1][m][3]concat=n=4:v=1:a=0,format=yuv420p" + overlay,
               "-c:v", "libx264", "-crf", "18", self.dir / "v.mp4")

    def analyze(self):
        r = self.py("ref_analyze.py", "v.mp4", "--out", "o")
        self.assertEqual(r.returncode, 0, r.stderr)
        return json.loads((self.dir / "o/ref-analysis.json").read_text())

    def assert_cuts(self, a, want):
        self.assertEqual(len(a["cuts"]), len(want), a["cuts"])
        for got, w in zip(a["cuts"], want):
            self.assertLessEqual(abs(got - w), 1 / 30 + 1e-3)

    def test_plain_cuts(self):
        self.video()
        a = self.analyze()
        self.assert_cuts(a, self.CUTS)
        self.assertEqual((a["reviewCandidates"], a["overlayChanges"]), ([], []))

    def test_big_overlay_is_a_review_candidate_and_small_one_an_overlay(self):
        self.video(",drawbox=x=40:y=400:w=460:h=120:color=white:t=fill:enable='gte(t,1.8)',"
                   "drawbox=x=40:y=700:w=300:h=60:color=yellow:t=fill:enable='gte(t,5)'")
        a = self.analyze()
        self.assert_cuts(a, self.CUTS)
        self.assertEqual(len(a["reviewCandidates"]), 1)
        self.assertAlmostEqual(a["reviewCandidates"][0]["t"], 1.8, delta=0.04)
        self.assertEqual(len(a["overlayChanges"]), 1)

    def test_half_frame_card_is_not_a_cut(self):
        self.video(",drawbox=x=0:y=0:w=540:h=480:color=white:t=fill:enable='gte(t,1.8)'")
        a = self.analyze()
        self.assertFalse([c for c in a["cuts"] if abs(c - 1.8) < 0.1])
        self.assertTrue([c for c in a["reviewCandidates"] if abs(c["t"] - 1.8) < 0.04])

    def test_no_cuts(self):
        ffmpeg("-f", "lavfi", "-i", "mandelbrot=s=270x480:r=30", "-t", "3", "-pix_fmt", "yuv420p", self.dir / "v.mp4")
        self.assert_cuts(self.analyze(), [])

    def test_missing_or_corrupt_file_fails(self):
        self.assertNotEqual(self.py("ref_analyze.py", "none.mp4").returncode, 0)
        (self.dir / "bad.mp4").write_bytes(b"not a video")
        self.assertNotEqual(self.py("ref_analyze.py", "bad.mp4").returncode, 0)


class ExportWhatsapp(Base):
    def master(self, name="m.mp4", size="540x960", dur=3, audio=True, vf="null", rate=30):
        a = ["-f", "lavfi", "-i", f"sine=f=220:d={dur}", "-c:a", "aac"] if audio else []
        ffmpeg("-f", "lavfi", "-i", f"testsrc2=s={size}:r={rate}:d={dur},{vf}", *a, "-c:v", "libx264",
               "-preset", "ultrafast", "-pix_fmt", "yuv420p", self.dir / name)
        return self.dir / name

    def export(self, *args):
        return subprocess.run(["sh", str(SCRIPTS / "export_whatsapp.sh"), *map(str, args)],
                              capture_output=True, text=True, cwd=self.dir, stdin=subprocess.DEVNULL)

    def probe(self, f):
        return json.loads(subprocess.check_output(["ffprobe", "-v", "error", "-of", "json", "-show_streams", "-show_format", str(f)]))

    def test_sixty_seconds_stay_below_the_target(self):
        m = self.master(size="1080x1920", dur=60, rate=10, vf="noise=alls=25:allf=t")
        before = sha(m)
        self.assertGreater(m.stat().st_size, 9.5 * 1048576)
        r = self.export("m.mp4", "9.5", "o.mp4")
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertEqual(json.loads(r.stdout)["status"], "PASS")
        self.assertLessEqual((self.dir / "o.mp4").stat().st_size, 9.5 * 1048576)
        p = self.probe(self.dir / "o.mp4")
        self.assertEqual({s["codec_name"] for s in p["streams"]}, {"h264", "aac"})
        self.assertEqual(min(p["streams"][0]["width"], p["streams"][0]["height"]), 720)
        self.assertAlmostEqual(float(p["format"]["duration"]), 60, delta=0.2)
        self.assertEqual(sha(m), before)

    def test_never_writes_over_the_master(self):
        m = self.master()
        before = sha(m)
        (self.dir / "sym.mp4").symlink_to("m.mp4")
        os.link(m, self.dir / "hard.mp4")
        (self.dir / "d").mkdir()
        (self.dir / "d/up").symlink_to("..")
        for out in ("m.mp4", "./m.mp4", str(m), "sym.mp4", "hard.mp4", "d/../m.mp4", "d/up/m.mp4"):
            for force in ([], ["--force"]):
                with self.subTest(out=out, force=bool(force)):
                    r = self.export(*force, "m.mp4", "9.5", out)
                    self.assertEqual(r.returncode, 2, r.stdout)
                    self.assertEqual(sha(m), before)
        r = self.export("--force", "sym.mp4", "9.5", "./m.mp4")
        self.assertEqual((r.returncode, sha(m)), (2, before))

    def test_existing_destination_needs_force(self):
        self.master()
        out = self.dir / "o.mp4"
        out.write_text("keep")
        self.assertEqual(self.export("m.mp4", "9.5", "o.mp4").returncode, 2)
        self.assertEqual(out.read_text(), "keep")
        self.assertEqual(self.export("--force", "m.mp4", "9.5", "o.mp4").returncode, 0)
        self.assertEqual(self.probe(out)["streams"][0]["width"], 720)

    def test_impossible_target_fails_without_leaving_files(self):
        self.master()
        r = self.export("m.mp4", "0.02", "o.mp4")
        self.assertEqual((r.returncode, json.loads(r.stdout)["status"]), (1, "FAIL"))
        self.assertEqual([p.name for p in self.dir.iterdir()], ["m.mp4"])

    def test_failed_force_keeps_the_previous_file(self):
        self.master()
        (self.dir / "o.mp4").write_text("keep")
        self.assertEqual(self.export("--force", "m.mp4", "0.02", "o.mp4").returncode, 1)
        self.assertEqual((self.dir / "o.mp4").read_text(), "keep")

    def test_landscape_without_audio_and_quoted_name(self):
        self.master(size="1280x720", audio=False)
        r = self.export("m.mp4", "9.5", 'a "b".mp4')
        self.assertEqual(r.returncode, 0, r.stderr)
        j = json.loads(r.stdout)
        self.assertEqual((j["out"], j["width"], j["height"], j["audioKbps"]), ('a "b".mp4', 1280, 720, 0))

    def test_bad_input(self):
        self.master()
        (self.dir / "bad.mp4").write_text("x")
        for args in (["none.mp4"], ["bad.mp4"], ["m.mp4", "abc"], ["m.mp4", "0"], ["m.mp4", "9", "."]):
            with self.subTest(args=args):
                self.assertNotEqual(self.export(*args).returncode, 0)


if __name__ == "__main__":
    unittest.main()
