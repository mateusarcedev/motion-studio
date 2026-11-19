import pathlib
import sys
import unittest

CORE = pathlib.Path(__file__).resolve().parents[1] / "packages" / "motion-core"
sys.path.insert(0, str(CORE))

from transitions.ffmpeg import (  # noqa: E402
    build_xfade_filter,
    build_filter_graph,
    list_transitions,
    normalize_transition,
    transition_expression,
)


class TransitionContractTests(unittest.TestCase):
    def test_registry_contains_all_eight_transition_families(self):
        self.assertEqual(
            [row["id"] for row in list_transitions()],
            ["wipe", "push", "slide", "reveal", "mask-reveal", "flash", "split", "directional"],
        )

    def test_xfade_filter_uses_requested_duration_offset_direction_and_easing(self):
        result = build_xfade_filter({
            "kind": "directional", "duration": 0.8, "offset": 2.4,
            "direction": "right", "easing": "quint",
        })
        self.assertIn("xfade=transition=custom", result)
        self.assertIn("duration=0.800", result)
        self.assertIn("offset=2.400", result)
        self.assertIn("pow", result)
        self.assertIn("W*", result)

    def test_named_easing_curves_are_monotonic_at_endpoints(self):
        curves = ["linear", "ease-in", "ease-out", "ease-in-out", "cubic", "quint"]
        for curve in curves:
            config = normalize_transition({"kind": "wipe", "easing": curve})
            self.assertEqual(config["easing"], curve)
            self.assertIn("P", transition_expression(config))

    def test_custom_cubic_curve_is_bounded_and_rejects_filter_injection(self):
        valid = normalize_transition({"kind": "wipe", "easing": "custom", "easingCoefficients": [0, 0, 1]})
        self.assertIn("pow", transition_expression(valid))
        with self.assertRaises(ValueError):
            normalize_transition({"kind": "wipe", "easing": "custom", "easingCoefficients": [0, 0, 1], "direction": "right;movie=bad"})
        with self.assertRaises(ValueError):
            normalize_transition({"kind": "wipe", "easing": "custom", "easingCoefficients": [0, 2, -1]})

    def test_invalid_duration_and_offset_are_rejected(self):
        with self.assertRaises(ValueError):
            normalize_transition({"kind": "wipe", "duration": 0})
        with self.assertRaises(ValueError):
            build_xfade_filter({"kind": "wipe", "offset": -1})

    def test_consecutive_transitions_overlap_on_one_contiguous_timeline(self):
        graph, duration, offsets = build_filter_graph(
            [2.0, 2.0, 2.0], {"kind": "push", "duration": 0.5}, 30, 1920, 1080,
        )
        self.assertEqual(offsets, [1.5, 3.0])
        self.assertEqual(duration, 5.0)
        self.assertIn("[xf1][v2]xfade=", graph)
        self.assertIn("[xf2]scale=", graph)


if __name__ == "__main__":
    unittest.main()
