#!/usr/bin/env python3
"""Validated scene transitions built with FFmpeg's custom xfade expressions."""
import json
import math
import re
import shutil
import subprocess
import argparse
import sys
from pathlib import Path


TRANSITIONS = {
    "wipe": {"duration": 0.65, "description": "Wipe along a selected edge."},
    "push": {"duration": 0.7, "description": "The incoming scene pushes the outgoing scene."},
    "slide": {"duration": 0.65, "description": "The incoming scene slides over the outgoing scene."},
    "reveal": {"duration": 0.75, "description": "A centered radial reveal."},
    "mask-reveal": {"duration": 0.8, "description": "A deterministic tiled mask reveal."},
    "flash": {"duration": 0.45, "description": "A brief accent-color flash between scenes."},
    "split": {"duration": 0.7, "description": "Two-sided reveal from the center."},
    "directional": {"duration": 0.65, "description": "A direction-controlled wipe."},
}
EASINGS = {"linear", "ease-in", "ease-out", "ease-in-out", "cubic", "quint", "custom"}
DIRECTIONS = {"left", "right", "up", "down"}


def list_transitions():
    return [{"id": name, **config} for name, config in TRANSITIONS.items()]


def _finite_number(value, field, low, high):
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or not low <= value <= high:
        raise ValueError(f"{field} must be between {low} and {high}")
    return float(value)


def normalize_transition(config):
    if not isinstance(config, dict):
        raise ValueError("transition config must be an object")
    kind = config.get("kind", "wipe")
    if kind not in TRANSITIONS:
        raise ValueError(f"unknown transition kind: {kind}")
    duration = _finite_number(config.get("duration", TRANSITIONS[kind]["duration"]), "duration", 0.05, 10)
    offset = _finite_number(config.get("offset", 0), "offset", 0, 86400)
    direction = config.get("direction", "left")
    if direction not in DIRECTIONS:
        raise ValueError("direction must be left, right, up, or down")
    easing = config.get("easing", "ease-out")
    if easing not in EASINGS:
        raise ValueError(f"easing must be one of {', '.join(sorted(EASINGS))}")
    softness = _finite_number(config.get("softness", 0), "softness", 0, 0.25)
    mask_scale = config.get("maskScale", 32)
    if isinstance(mask_scale, bool) or not isinstance(mask_scale, int) or not 2 <= mask_scale <= 256:
        raise ValueError("maskScale must be an integer from 2 to 256")
    coefficients = config.get("easingCoefficients")
    if easing == "custom":
        if not isinstance(coefficients, list) or len(coefficients) != 3 or any(isinstance(x, bool) or not isinstance(x, (int, float)) or not math.isfinite(x) for x in coefficients):
            raise ValueError("custom easing requires three finite easingCoefficients")
        coefficients = [float(x) for x in coefficients]
        if abs(sum(coefficients) - 1) > 1e-6:
            raise ValueError("custom easing coefficients must sum to 1")
        for i in range(101):
            p = i / 100
            value = coefficients[0] * p**3 + coefficients[1] * p**2 + coefficients[2] * p
            if not -1e-6 <= value <= 1 + 1e-6:
                raise ValueError("custom easing must stay between 0 and 1")
            if i:
                prior = (coefficients[0] * (p - 0.01)**3 + coefficients[1] * (p - 0.01)**2 + coefficients[2] * (p - 0.01))
                if value + 1e-6 < prior:
                    raise ValueError("custom easing must be monotonic")
    accent = config.get("accentColor")
    if accent is not None and (not isinstance(accent, str) or not re.fullmatch(r"#[0-9a-fA-F]{6}", accent)):
        raise ValueError("accentColor must be a six-digit hex color")
    allowed = {"kind", "duration", "offset", "direction", "easing", "easingCoefficients", "softness", "maskScale", "accentColor"}
    unknown = set(config) - allowed
    if unknown:
        raise ValueError("unknown transition fields: " + ", ".join(sorted(unknown)))
    return {
        "kind": kind, "duration": duration, "offset": offset, "direction": direction,
        "easing": easing, "easingCoefficients": coefficients, "softness": softness,
        "maskScale": mask_scale, "accentColor": accent,
    }


def _ease(config):
    p = "(1-P)"
    curve = config["easing"]
    if curve == "linear":
        return p
    if curve == "ease-in":
        return f"pow({p},3)"
    if curve in ("ease-out", "cubic"):
        return f"(1-pow(1-{p},3))"
    if curve == "ease-in-out":
        return f"if(lt({p},0.5),4*pow({p},3),1-pow(-2*({p})+2,3)/2)"
    if curve == "quint":
        return f"(1-pow(1-{p},5))"
    a, b, c = config["easingCoefficients"]
    return f"({a:.9g}*pow({p},3)+{b:.9g}*pow({p},2)+{c:.9g}*{p})"


def _accent(config):
    color = config["accentColor"] or "#FFFFFF"
    red, green, blue = (int(color[i:i + 2], 16) for i in (1, 3, 5))
    # xfade operates on gbrp planes in the composition graph: G, B, R.
    return f"if(eq(PLANE,0),{green},if(eq(PLANE,1),{blue},{red}))"


def _sample_a(x, y):
    return f"if(eq(PLANE,0),a0({x},{y}),if(eq(PLANE,1),a1({x},{y}),a2({x},{y})))"


def _sample_b(x, y):
    return f"if(eq(PLANE,0),b0({x},{y}),if(eq(PLANE,1),b1({x},{y}),b2({x},{y})))"


def transition_expression(input_config):
    config = input_config if "easingCoefficients" in input_config and "duration" in input_config else normalize_transition(input_config)
    e = f"({_ease(config)})"
    kind = config["kind"]
    direction = config["direction"]
    softness = config["softness"]
    if kind in ("wipe", "directional"):
        if direction == "left":
            edge = f"(W*{e})"
            base = f"if(lt(X,{edge}),B,A)"
        elif direction == "right":
            edge = f"(W*(1-{e}))"
            base = f"if(gt(X,{edge}),B,A)"
        elif direction == "up":
            edge = f"(H*{e})"
            base = f"if(lt(Y,{edge}),B,A)"
        else:
            edge = f"(H*(1-{e}))"
            base = f"if(gt(Y,{edge}),B,A)"
        if softness:
            axis, bound = ("X", "W") if direction in ("left", "right") else ("Y", "H")
            return f"if(lt(abs({axis}-{edge}),{bound}*{softness:.6g}),A*(1-clamp(abs({axis}-{edge})/({bound}*{softness:.6g}),0,1))+B*clamp(abs({axis}-{edge})/({bound}*{softness:.6g}),0,1),{base})"
        return base
    if kind == "push":
        if direction == "left":
            return f"if(lt(X,W*(1-{e})),{_sample_a(f'X+W*{e}', 'Y')},{_sample_b(f'X-W*(1-{e})', 'Y')})"
        if direction == "right":
            return f"if(gt(X,W*{e}),{_sample_a(f'X-W*{e}', 'Y')},{_sample_b(f'X+W*(1-{e})', 'Y')})"
        if direction == "up":
            return f"if(lt(Y,H*(1-{e})),{_sample_a('X', f'Y+H*{e}')},{_sample_b('X', f'Y-H*(1-{e})')})"
        return f"if(gt(Y,H*{e}),{_sample_a('X', f'Y-H*{e}')},{_sample_b('X', f'Y+H*(1-{e})')})"
    if kind == "slide":
        if direction == "left":
            return f"if(gt(X,W*(1-{e})),{_sample_b(f'X-W*(1-{e})', 'Y')},A)"
        if direction == "right":
            return f"if(lt(X,W*{e}),{_sample_b(f'X+W*(1-{e})', 'Y')},A)"
        if direction == "up":
            return f"if(gt(Y,H*(1-{e})),{_sample_b('X', f'Y-H*(1-{e})')},A)"
        return f"if(lt(Y,H*{e}),{_sample_b('X', f'Y+H*(1-{e})')},A)"
    if kind == "reveal":
        radius = "(sqrt(W*W+H*H)/2)"
        return f"if(lt(pow(X-W/2,2)+pow(Y-H/2,2),pow({radius}*{e},2)),B,A)"
    if kind == "mask-reveal":
        scale = config["maskScale"]
        mask = f"(0.5+0.25*sin(X/{scale}*12.9898+Y/{scale}*78.233)+0.25*sin(X/{scale}*4.1414-Y/{scale}*31.718))"
        return f"if(lt({mask},{e}),B,A)"
    if kind == "flash":
        color = _accent(config)
        return f"if(lt({e},0.5),A*(1-2*{e})+{color}*(2*{e}),B*(2*{e}-1)+{color}*(2-2*{e}))"
    if kind == "split":
        if direction in ("left", "right"):
            return f"if(lt(abs(X-W/2),W/2*{e}),B,A)"
        return f"if(lt(abs(Y-H/2),H/2*{e}),B,A)"
    raise ValueError(f"unsupported transition kind: {kind}")


def build_xfade_filter(config, offset=None):
    normalized = normalize_transition(config)
    if offset is not None:
        normalized["offset"] = _finite_number(offset, "offset", 0, 86400)
    expression = transition_expression(normalized)
    return f"xfade=transition=custom:duration={normalized['duration']:.3f}:offset={normalized['offset']:.3f}:expr='{expression}'"


def _probe_video(path):
    result = subprocess.run([
        "ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "format=duration:stream=width,height",
        "-of", "json", str(path),
    ], capture_output=True, text=True, check=True)
    data = json.loads(result.stdout)
    stream = data["streams"][0]
    return float(data["format"]["duration"]), int(stream["width"]), int(stream["height"])


def build_filter_graph(durations, transition, fps, width, height):
    config = normalize_transition(transition)
    if len(durations) < 2:
        raise ValueError("at least two scenes are required")
    if any(duration <= config["duration"] for duration in durations):
        raise ValueError("each scene duration must exceed the transition duration")
    parts = [f"[{i}:v]fps={fps},scale={width}:{height}:flags=lanczos,setsar=1,format=gbrp,settb=AVTB[v{i}]" for i in range(len(durations))]
    active, accumulated = "v0", durations[0]
    first_offset = config["offset"] if "offset" in transition else accumulated - config["duration"]
    offsets = []
    for index in range(1, len(durations)):
        offset = first_offset if index == 1 else accumulated - config["duration"]
        if offset < 0 or offset + config["duration"] > accumulated + 1e-6:
            raise ValueError(f"transition offset {offset:.3f}s exceeds accumulated scene duration")
        offsets.append(offset)
        next_label = f"xf{index}"
        parts.append(f"[{active}][v{index}]{build_xfade_filter(config, offset)}[{next_label}]")
        active = next_label
        accumulated = offset + durations[index]
    parts.append(f"[{active}]scale=out_color_matrix=bt709:out_range=tv,format=yuv420p[outv]")
    return ";".join(parts), accumulated, offsets


def compose_videos(inputs, output, transition, fps=30, width=None, height=None, crf=18):
    if not isinstance(inputs, (list, tuple)) or len(inputs) < 2:
        raise ValueError("compose_videos requires at least two input clips")
    ffmpeg, ffprobe = shutil.which("ffmpeg"), shutil.which("ffprobe")
    if not ffmpeg or not ffprobe:
        raise RuntimeError("ffmpeg and ffprobe are required")
    durations, sizes = [], []
    for source in inputs:
        duration, source_width, source_height = _probe_video(source)
        durations.append(duration); sizes.append((source_width, source_height))
    width = int(width or sizes[0][0]); height = int(height or sizes[0][1])
    if min(width, height, int(fps)) <= 0 or int(fps) > 120:
        raise ValueError("width, height, and fps must be positive; fps must not exceed 120")
    graph, total_duration, offsets = build_filter_graph(durations, transition, int(fps), width, height)
    command = [ffmpeg, "-y", "-loglevel", "error"]
    for source in inputs:
        command += ["-i", str(source)]
    command += ["-filter_complex", graph, "-map", "[outv]", "-an", "-c:v", "libx264", "-crf", str(int(crf)),
                "-pix_fmt", "yuv420p", "-r", str(int(fps)), "-colorspace", "bt709", "-color_primaries", "bt709",
                "-color_trc", "bt709", "-movflags", "+faststart", str(output)]
    subprocess.run(command, check=True)
    return {"output": str(output), "fps": int(fps), "width": width, "height": height,
            "duration": round(total_duration, 6), "transition": normalize_transition(transition), "offsets": offsets}


def main(argv=None):
    parser = argparse.ArgumentParser(description="MOTION scene transitions via FFmpeg xfade")
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("list", help="list supported transition contracts")
    render = sub.add_parser("render", help="compose two or more scenes with one transition")
    render.add_argument("inputs", nargs="+")
    render.add_argument("--output", required=True)
    render.add_argument("--transition", default='{"kind":"wipe"}', help="transition JSON contract")
    render.add_argument("--fps", type=int, default=30)
    render.add_argument("--width", type=int)
    render.add_argument("--height", type=int)
    render.add_argument("--crf", type=int, default=18)
    args = parser.parse_args(argv)
    if args.command == "list":
        print(json.dumps(list_transitions(), ensure_ascii=False))
        return 0
    try:
        transition = json.loads(args.transition)
        result = compose_videos(args.inputs, args.output, transition, args.fps, args.width, args.height, args.crf)
        print(json.dumps(result, ensure_ascii=False))
        return 0
    except (ValueError, RuntimeError, subprocess.CalledProcessError, KeyError) as error:
        print(f"motion transition: {error}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())

