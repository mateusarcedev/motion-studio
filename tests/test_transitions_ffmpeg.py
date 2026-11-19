import json
import pathlib
import subprocess
import tempfile
import unittest

CORE = pathlib.Path(__file__).resolve().parents[1] / "packages" / "motion-core"
import sys
sys.path.insert(0, str(CORE))

from transitions.ffmpeg import compose_videos, list_transitions  # noqa: E402


def decoded_pixel(video, at_end=False):
    args = ["ffmpeg", "-v", "error"]
    if at_end:
        args += ["-sseof", "-0.1"]
    args += ["-i", str(video), "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgb24", "pipe:1"]
    frame = subprocess.check_output(args)
    offset = (36 * 128 + 64) * 3
    return frame[offset:offset + 3]


class FfmpegTransitionTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory(prefix="motion-transitions-")
        cls.root = pathlib.Path(cls.temp.name)
        cls.a = cls.root / "scene-a.mp4"
        cls.b = cls.root / "scene-b.mp4"
        for color, target in (("red", cls.a), ("blue", cls.b)):
            subprocess.run([
                "ffmpeg", "-y", "-v", "error", "-f", "lavfi", "-i",
                f"color=c={color}:s=128x72:r=10:d=2", "-c:v", "libx264", "-pix_fmt", "yuv420p", str(target),
            ], check=True)

    @classmethod
    def tearDownClass(cls):
        cls.temp.cleanup()

    def test_every_transition_keeps_boundary_frames_duration_and_geometry(self):
        for transition in list_transitions():
            with self.subTest(kind=transition["id"]):
                output = self.root / f"{transition['id']}.mp4"
                result = compose_videos(
                    [self.a, self.b], output,
                    {"kind": transition["id"], "duration": 0.5, "direction": "left", "easing": "ease-in-out", "accentColor": "#FFCC22"},
                    fps=10, width=128, height=72,
                )
                probe = json.loads(subprocess.check_output([
                    "ffprobe", "-v", "error", "-show_entries", "stream=width,height,r_frame_rate:format=duration", "-of", "json", str(output),
                ], text=True))
                self.assertEqual((probe["streams"][0]["width"], probe["streams"][0]["height"]), (128, 72))
                self.assertEqual(probe["streams"][0]["r_frame_rate"], "10/1")
                self.assertAlmostEqual(float(probe["format"]["duration"]), 3.5, delta=0.12)
                first, last = decoded_pixel(output), decoded_pixel(output, at_end=True)
                self.assertGreater(first[0], first[2] * 2, "first frame should retain scene A")
                self.assertGreater(last[2], last[0] * 2, "last frame should retain scene B")
                self.assertGreater(result["duration"], 3.4)

    def test_consecutive_transitions_keep_duration_without_black_gaps(self):
        output = self.root / "consecutive.mp4"
        result = compose_videos(
            [self.a, self.b, self.a], output,
            {"kind": "push", "duration": 0.5, "direction": "up", "easing": "cubic"},
            fps=10, width=128, height=72,
        )
        self.assertEqual(result["offsets"], [1.5, 3.0])
        self.assertAlmostEqual(result["duration"], 5.0, delta=0.001)
        self.assertGreater(decoded_pixel(output)[0], 160)
        self.assertGreater(decoded_pixel(output, at_end=True)[0], 160)


if __name__ == "__main__":
    unittest.main()
