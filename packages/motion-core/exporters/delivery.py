#!/usr/bin/env python3
"""Versioned delivery contract, manifest, ZIP writer and ZIP verifier.

The contract describes the files a project intends to ship. The manifest only
records files that exist, while `required` requirements remain in the contract.
Both are stored in the ZIP; neither metadata file hashes itself.
"""
import argparse
import hashlib
import json
import mimetypes
import os
import re
import stat
import struct
import subprocess
import sys
import tempfile
import xml.etree.ElementTree as ET
import zipfile
import zlib
from pathlib import Path, PurePosixPath
from urllib.parse import unquote, urlparse

SCHEMA_VERSION = 1
MANIFEST_NAME = "assets.manifest.json"
CONTRACT_NAME = "delivery.contract.json"
SKIP_DIRS = {".git", "node_modules", ".cache", ".motion"}
SUPPORTED = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg", ".mp4", ".webm", ".mov", ".wav", ".mp3", ".ogg", ".html", ".htm", ".css", ".js", ".mjs", ".json", ".md", ".txt", ".pdf", ".woff", ".woff2", ".ttf", ".otf", ".py", ".tsx", ".ts", ".jsx", ".xml", ".srt", ".vtt", ".ass"}
MIME_OVERRIDES = {".ass": "text/x-ssa", ".js": "text/javascript", ".mjs": "text/javascript", ".md": "text/markdown", ".woff": "font/woff", ".woff2": "font/woff2", ".ttf": "font/ttf", ".otf": "font/otf"}


def sha256_file(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def sha256_stream(stream):
    h, size = hashlib.sha256(), 0
    for chunk in iter(lambda: stream.read(1024 * 1024), b""):
        h.update(chunk); size += len(chunk)
    return h.hexdigest(), size


def safe_relative(value):
    if not isinstance(value, str) or not value or "\\" in value or "\x00" in value:
        return False
    p = PurePosixPath(value)
    return not p.is_absolute() and all(x not in ("", ".", "..") for x in value.split("/")) and not re.match(r"^[A-Za-z]:", value)


def safe_source_path(root, rel):
    """Resolve a declared path without following links inside or outside the project."""
    current = root
    for part in PurePosixPath(rel).parts:
        current = current / part
        if current.is_symlink():
            return None
    try:
        current.resolve(strict=True).relative_to(root.resolve(strict=True))
    except (OSError, ValueError):
        return None
    return current


def atomic_write(path, data):
    """Replace a generated file without following an existing destination symlink."""
    path = Path(path)
    if path.is_symlink():
        raise ValueError(f"arquivo de saída não pode ser link simbólico: {path.name}")
    if path.exists() and not path.is_file():
        raise ValueError(f"arquivo de saída não é um arquivo regular: {path.name}")
    fd, temporary = tempfile.mkstemp(prefix=f".{path.name}.", suffix=".tmp", dir=path.parent)
    try:
        with os.fdopen(fd, "wb") as stream:
            stream.write(data)
            stream.flush()
            os.fsync(stream.fileno())
        # os.replace replaces a raced-in symlink itself; it never opens its target.
        os.replace(temporary, path)
    finally:
        try:
            os.unlink(temporary)
        except FileNotFoundError:
            pass


def read_project_metadata(path):
    """Read project metadata without following a symlink when the platform supports it."""
    path = Path(path)
    if path.is_symlink():
        raise ValueError(f"arquivo de metadados não pode ser link simbólico: {path.name}")
    flags = os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0)
    fd = os.open(path, flags)
    with os.fdopen(fd, "rb") as stream:
        if not stat.S_ISREG(os.fstat(stream.fileno()).st_mode):
            raise ValueError(f"arquivo de metadados não é regular: {path.name}")
        return stream.read()


def inferred_mime(path):
    return MIME_OVERRIDES.get(Path(path).suffix.lower()) or mimetypes.guess_type(path)[0] or "application/octet-stream"


def png_info(data):
    if not data.startswith(b"\x89PNG\r\n\x1a\n"):
        raise ValueError("assinatura PNG inválida")
    pos, width, height, ended = 8, None, None, False
    while pos + 12 <= len(data):
        size = struct.unpack(">I", data[pos:pos + 4])[0]
        kind = data[pos + 4:pos + 8]
        end = pos + 12 + size
        if end > len(data):
            raise ValueError("chunk PNG truncado")
        payload = data[pos + 8:pos + 8 + size]
        crc = struct.unpack(">I", data[pos + 8 + size:end])[0]
        if zlib.crc32(kind + payload) & 0xffffffff != crc:
            raise ValueError(f"CRC inválido no chunk PNG {kind.decode('ascii', 'replace')}")
        if kind == b"IHDR":
            if size != 13:
                raise ValueError("IHDR PNG inválido")
            width, height = struct.unpack(">II", payload[:8])
        if kind == b"IEND":
            ended = True
            if end != len(data):
                raise ValueError("dados extras após IEND PNG")
            break
        pos = end
    if width is None or height is None or not ended:
        raise ValueError("PNG incompleto")
    return width, height


def jpeg_info(data):
    if not data.startswith(b"\xff\xd8") or not data.endswith(b"\xff\xd9"):
        raise ValueError("assinatura JPEG inválida ou arquivo truncado")
    pos = 2
    while pos + 4 < len(data):
        if data[pos] != 0xff:
            pos += 1
            continue
        marker = data[pos + 1]
        pos += 2
        if marker in (0xd8, 0xd9) or 0xd0 <= marker <= 0xd7:
            continue
        if pos + 2 > len(data):
            break
        size = struct.unpack(">H", data[pos:pos + 2])[0]
        if size < 2 or pos + size > len(data):
            break
        if marker in (0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf):
            height, width = struct.unpack(">HH", data[pos + 3:pos + 7])
            return width, height
        pos += size
    raise ValueError("dimensões JPEG não encontradas")


def media_info(path):
    try:
        p = subprocess.run(["ffprobe", "-v", "error", "-show_format", "-show_streams", "-of", "json", str(path)], capture_output=True, text=True, timeout=30)
    except (OSError, subprocess.TimeoutExpired) as e:
        return None, f"ffprobe indisponível: {e}"
    if p.returncode:
        return None, (p.stderr.strip().splitlines() or ["ffprobe não reconheceu o arquivo"])[0]
    try:
        info = json.loads(p.stdout)
        video = next((x for x in info.get("streams", []) if x.get("codec_type") == "video"), None)
        if not video:
            return None, "stream de vídeo ausente"
        audio = next((x for x in info.get("streams", []) if x.get("codec_type") == "audio"), None)
        n, d = (video.get("avg_frame_rate") or "0/1").split("/", 1)
        fps = float(n) / float(d) if float(d) else 0
        result = {"width": video.get("width"), "height": video.get("height"), "durationSec": float(video.get("duration") or info.get("format", {}).get("duration") or 0), "fps": fps, "codec": video.get("codec_name")}
        if audio:
            result.update({"audioCodec": audio.get("codec_name"), "sampleRate": int(audio.get("sample_rate") or 0), "channels": audio.get("channels")})
        return result, None
    except (ValueError, TypeError, StopIteration, json.JSONDecodeError) as e:
        return None, f"metadados de vídeo inválidos: {e}"


def validate_file(root, spec):
    p = safe_source_path(root, spec["path"])
    if p is None:
        return {"status": "FAIL", "checks": [{"id": "file.symlink", "status": "FAIL", "details": "caminho simbólico ou fora do projeto não é portável"}]}, None
    checks = []
    try:
        st = p.lstat()
        if not stat.S_ISREG(st.st_mode):
            return {"status": "FAIL", "checks": [{"id": "file.type", "status": "FAIL", "details": "não é um arquivo regular"}]}, None
        ext = p.suffix.lower()
        content_types = {".png", ".jpg", ".jpeg", ".html", ".htm", ".css", ".js", ".mjs", ".json", ".md", ".txt", ".svg", ".xml"}
        if ext in content_types:
            data = p.read_bytes()
        else:
            with p.open("rb") as stream:
                data = stream.read(32)
        digest = sha256_file(p)
    except OSError as e:
        return {"status": "FAIL", "checks": [{"id": "file.read", "status": "FAIL", "details": str(e)}]}, None

    mime = spec.get("mediaType") or inferred_mime(spec["path"])
    ext_mime = inferred_mime(spec["path"])
    if mime != "application/octet-stream" and ext_mime != "application/octet-stream" and mime != ext_mime:
        checks.append({"id": "mediaType.extension", "status": "FAIL", "details": f"{mime} não corresponde à extensão ({ext_mime})"})
    else:
        checks.append({"id": "mediaType.extension", "status": "PASS"})
    metadata = {}
    ext = p.suffix.lower()
    try:
        if ext == ".png":
            metadata["width"], metadata["height"] = png_info(data)
        elif ext in (".jpg", ".jpeg"):
            metadata["width"], metadata["height"] = jpeg_info(data)
        elif ext == ".mp4":
            if len(data) < 12 or data[4:8] != b"ftyp":
                raise ValueError("assinatura MP4/ftyp ausente")
        elif ext == ".pdf" and not data.startswith(b"%PDF-"):
            raise ValueError("assinatura PDF inválida")
        elif ext == ".svg":
            svg = ET.fromstring(data)
            if svg.tag.rsplit("}", 1)[-1].lower() != "svg":
                raise ValueError("raiz XML não é <svg>")
        elif ext == ".woff" and not data.startswith(b"wOFF"):
            raise ValueError("assinatura WOFF inválida")
        elif ext == ".woff2" and not data.startswith(b"wOF2"):
            raise ValueError("assinatura WOFF2 inválida")
        elif ext == ".ttf" and not (data.startswith(b"\x00\x01\x00\x00") or data.startswith(b"true")):
            raise ValueError("assinatura TrueType inválida")
        elif ext == ".otf" and not data.startswith(b"OTTO"):
            raise ValueError("assinatura OpenType inválida")
        elif mime.startswith("text/") or ext in (".json", ".svg", ".xml"):
            data.decode("utf-8")
            if ext == ".json":
                json.loads(data)
        checks.append({"id": "file.format", "status": "PASS"})
    except (ValueError, UnicodeDecodeError, json.JSONDecodeError, ET.ParseError) as e:
        checks.append({"id": "file.format", "status": "FAIL", "details": str(e)})

    if ext in (".png", ".jpg", ".jpeg"):
        checks.append({"id": "media.dimensions", "status": "PASS", "details": f"{metadata['width']}×{metadata['height']}"})
    if ext in (".mp4", ".mov", ".webm") and spec.get("spec"):
        probed, err = media_info(p)
        if err:
            checks.append({"id": "media.probe", "status": "BLOCKED" if "indisponível" in err else "FAIL", "details": err})
        else:
            metadata.update(probed)
            checks.append({"id": "media.probe", "status": "PASS"})
    for key in ("width", "height", "fps", "codec", "durationSec", "audioCodec", "sampleRate", "channels"):
        expected = (spec.get("spec") or {}).get(key)
        if expected is None:
            continue
        actual = metadata.get(key)
        if key in ("codec", "audioCodec") and actual is not None:
            ok = str(actual).lower() == str(expected).lower()
        elif key in ("fps", "durationSec") and actual is not None:
            tolerance = float((spec.get("spec") or {}).get(f"{key}Tolerance", 0.01 if key == "fps" else 0.1))
            ok = abs(float(actual) - float(expected)) <= tolerance
        else:
            ok = actual == expected
        checks.append({"id": f"spec.{key}", "status": "PASS" if ok else "FAIL", "details": f"esperado {expected}; encontrado {actual}"})
    status = "FAIL" if any(c["status"] == "FAIL" for c in checks) else "BLOCKED" if any(c["status"] == "BLOCKED" for c in checks) else "PASS"
    record = {"path": spec["path"], "mediaType": mime, "bytes": st.st_size, "sha256": digest, "role": spec.get("role", "deliverable"), "required": bool(spec["required"]), "validation": {"status": status, "checks": checks}}
    record.update({k: metadata[k] for k in ("width", "height", "durationSec", "fps", "codec", "audioCodec", "sampleRate", "channels") if k in metadata})
    return record["validation"], record


def load_contract(root, extensions=None):
    p = root / CONTRACT_NAME
    if p.is_symlink():
        raise ValueError(f"arquivo de contrato não pode ser link simbólico: {CONTRACT_NAME}")
    if p.exists():
        if not p.is_file():
            raise ValueError(f"arquivo de contrato não é regular: {CONTRACT_NAME}")
        contract_bytes = read_project_metadata(p)
        obj = json.loads(contract_bytes)
        if not isinstance(obj, dict):
            raise ValueError("contrato inválido: raiz JSON deve ser um objeto")
        if type(obj.get("schemaVersion")) is not int or obj.get("schemaVersion") != SCHEMA_VERSION or not isinstance(obj.get("artifacts"), list):
            raise ValueError(f"contrato inválido: schemaVersion deve ser {SCHEMA_VERSION} e artifacts deve ser uma lista")
        if not isinstance(obj.get("producedRoots", []), list) or not isinstance(obj.get("fonts", []), list) or not isinstance(obj.get("filteredOut", []), list):
            raise ValueError("contrato inválido: producedRoots, fonts e filteredOut devem ser listas")
        if "portable" in obj and not isinstance(obj["portable"], bool):
            raise ValueError("contrato inválido: portable deve ser booleano")
        return obj, contract_bytes
    files, filtered_out = [], []
    for p in sorted(root.rglob("*")):
        if not p.is_file() or p.is_symlink() or p.name in (MANIFEST_NAME, CONTRACT_NAME) or p.suffix.lower() not in SUPPORTED:
            continue
        if any(x in SKIP_DIRS for x in p.parts) or p.suffix.lower() == ".zip":
            continue
        if extensions and p.suffix.lower().lstrip(".") not in extensions:
            filtered_out.append(p.relative_to(root).as_posix())
            continue
        files.append({"path": p.relative_to(root).as_posix(), "role": "deliverable", "required": True})
    obj = {"schemaVersion": SCHEMA_VERSION, "project": root.name, "generated": True, "producedRoots": [], "artifacts": files, "filteredOut": filtered_out}
    return obj, (json.dumps(obj, ensure_ascii=False, indent=2) + "\n").encode()


def inspect_contract(root, contract):
    findings, records = [], []
    for omitted in contract.get("filteredOut", []):
        findings.append({"id": "produced.omitted", "status": "FAIL", "path": omitted, "details": "arquivo compatível foi removido pelo filtro legado; declare a entrega explicitamente no contrato"})
    artifacts = contract.get("artifacts", [])
    seen, folded = set(), set()
    valid_specs = []
    for item in artifacts:
        rel = item.get("path") if isinstance(item, dict) else None
        if not safe_relative(rel):
            findings.append({"id": "contract.path", "status": "FAIL", "path": rel, "details": "caminho absoluto, vazio ou traversal"})
            continue
        if rel in seen or rel.casefold() in folded:
            findings.append({"id": "contract.duplicate", "status": "FAIL", "path": rel, "details": "caminho duplicado"})
            continue
        seen.add(rel); folded.add(rel.casefold())
        if rel in (MANIFEST_NAME, CONTRACT_NAME):
            findings.append({"id": "contract.metadata", "status": "FAIL", "path": rel, "details": "metadados de integridade não podem ser artefatos"})
            continue
        if not isinstance(item.get("required"), bool):
            findings.append({"id": "contract.required", "status": "FAIL", "path": rel, "details": "required deve ser booleano explícito"})
            continue
        if item.get("role") is not None and not isinstance(item.get("role"), str):
            findings.append({"id": "contract.role", "status": "FAIL", "path": rel, "details": "role deve ser texto"})
            continue
        if item.get("mediaType") is not None and not isinstance(item.get("mediaType"), str):
            findings.append({"id": "contract.mediaType", "status": "FAIL", "path": rel, "details": "mediaType deve ser texto"})
            continue
        if item.get("spec") is not None and not isinstance(item.get("spec"), dict):
            findings.append({"id": "contract.spec", "status": "FAIL", "path": rel, "details": "spec deve ser um objeto"})
            continue
        valid_specs.append(item)
        p = root.joinpath(*PurePosixPath(rel).parts)
        if not p.exists():
            if item["required"]:
                findings.append({"id": "required.missing", "status": "FAIL", "path": rel, "details": "arquivo obrigatório não existe"})
            continue
        result, record = validate_file(root, item)
        if record:
            records.append(record)
        for check in result["checks"]:
            if check["status"] != "PASS":
                findings.append({"id": check["id"], "status": check["status"], "path": rel, "details": check.get("details")})
    for root_rel in contract.get("producedRoots", []):
        if not safe_relative(root_rel):
            findings.append({"id": "producedRoot.path", "status": "FAIL", "path": root_rel, "details": "caminho inválido"})
            continue
        base = root.joinpath(*PurePosixPath(root_rel).parts)
        if not base.is_dir():
            findings.append({"id": "producedRoot.missing", "status": "FAIL", "path": root_rel, "details": "diretório de saída obrigatório não existe"})
            continue
        actual = {p.relative_to(root).as_posix() for p in base.rglob("*") if p.is_file() or p.is_symlink()}
        if not actual:
            findings.append({"id": "producedRoot.empty", "status": "FAIL", "path": root_rel, "details": "diretório de saída não contém arquivos"})
        for omitted in sorted(actual - seen):
            findings.append({"id": "produced.omitted", "status": "FAIL", "path": omitted, "details": "arquivo produzido não foi declarado no contrato"})
    for font in contract.get("fonts", []):
        rel = font.get("path") if isinstance(font, dict) else None
        if not isinstance(font, dict):
            findings.append({"id": "font.entry", "status": "FAIL", "details": "cada fonte deve ser um objeto"})
            continue
        if not safe_relative(rel):
            findings.append({"id": "font.path", "status": "FAIL", "path": rel, "details": "caminho de fonte inválido"})
            continue
        if not font.get("family") or not font.get("license") or not font.get("origin"):
            findings.append({"id": "font.provenance", "status": "FAIL", "path": rel, "details": "fonte precisa de família, licença e origem registradas"})
        if font.get("redistributable") is not True:
            findings.append({"id": "font.redistribution", "status": "FAIL", "path": rel, "details": "redistribuição da fonte não foi explicitamente autorizada"})
        if not (root.joinpath(*PurePosixPath(rel).parts).is_file()):
            if font.get("required", True):
                findings.append({"id": "font.missing", "status": "FAIL", "path": rel, "details": "fonte declarada não está disponível"})
        elif rel not in seen:
            findings.append({"id": "font.not-delivered", "status": "FAIL", "path": rel, "details": "fonte existe, mas não foi declarada como artefato"})
        license_file = font.get("licenseFile")
        if license_file:
            if not safe_relative(license_file):
                findings.append({"id": "font.license.path", "status": "FAIL", "path": license_file, "details": "caminho do arquivo de licença inválido"})
            elif not (root / license_file).is_file():
                findings.append({"id": "font.license.missing", "status": "FAIL", "path": license_file, "details": "arquivo com o texto da licença não existe"})
            elif license_file not in seen:
                findings.append({"id": "font.license.not-delivered", "status": "FAIL", "path": license_file, "details": "arquivo da licença não foi declarado para entrega"})
    declared = {x.get("path") for x in artifacts if isinstance(x, dict)}

    def check_reference(source_rel, raw_url, kind):
        raw = raw_url.strip()
        parsed = urlparse(raw)
        if raw.startswith(("#", "data:", "blob:", "javascript:", "mailto:", "tel:")):
            return
        if parsed.scheme or parsed.netloc:
            if contract.get("portable", True) and kind in ("src", "stylesheet", "resource"):
                findings.append({"id": "resource.reference.external", "status": "FAIL", "path": source_rel, "details": f"recurso externo impede reprodução autocontida: {raw}"})
            return
        target_raw = unquote(parsed.path)
        if not target_raw:
            return
        base = PurePosixPath("") if target_raw.startswith("/") else PurePosixPath(source_rel).parent
        combined = (base / target_raw.lstrip("/")).as_posix()
        normalized = []
        for part in combined.split("/"):
            if part in ("", "."):
                continue
            if part == "..":
                if not normalized:
                    findings.append({"id": "resource.reference.path", "status": "FAIL", "path": source_rel, "details": f"recurso usa path traversal: {raw}"})
                    return
                normalized.pop()
            else:
                normalized.append(part)
        target = "/".join(normalized)
        if not (root / target).is_file():
            findings.append({"id": "resource.reference.missing", "status": "FAIL", "path": source_rel, "details": f"recurso local ausente: {raw}"})
        elif target not in declared:
            findings.append({"id": "resource.reference.omitted", "status": "FAIL", "path": source_rel, "details": f"recurso local não foi declarado para entrega: {target}"})

    for item in artifacts:
        rel = item.get("path") if isinstance(item, dict) else None
        if not safe_relative(rel) or Path(rel).suffix.lower() not in (".html", ".htm", ".css"):
            continue
        source = root.joinpath(*PurePosixPath(rel).parts)
        if not source.is_file():
            continue
        try:
            content = source.read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError):
            continue
        if Path(rel).suffix.lower() in (".html", ".htm"):
            for tag in re.findall(r"<(?:script|img|video|source|audio|iframe|link)\b[^>]*>", content, flags=re.I | re.S):
                kind_match = re.match(r"<(\w+)", tag)
                kind = kind_match.group(1).lower() if kind_match else "resource"
                for attr, raw_url in re.findall(r"\b(src|href|poster)\s*=\s*['\"]([^'\"]+)['\"]", tag, flags=re.I):
                    if kind == "link" and not re.search(r"rel\s*=\s*['\"]stylesheet['\"]", tag, flags=re.I):
                        continue
                    check_reference(rel, raw_url, "stylesheet" if kind == "link" else "src")
        for raw_url in re.findall(r"url\(\s*['\"]?([^)'\"]+)['\"]?\s*\)", content, flags=re.I):
            check_reference(rel, raw_url, "resource")
        for match in re.finditer(r"@import\s+(?:url\()?\s*['\"]([^'\"]+)['\"]", content, flags=re.I):
            check_reference(rel, match.group(1), "stylesheet")
        for face in re.findall(r"@font-face\s*\{([^}]+)\}", content, flags=re.I | re.S):
            for raw_url in re.findall(r"url\(\s*['\"]?([^)'\"]+)['\"]?\s*\)", face, flags=re.I):
                parsed = urlparse(raw_url.strip())
                if parsed.scheme or parsed.netloc or raw_url.startswith(("/", "data:")):
                    continue
                font_path = (PurePosixPath(rel).parent / unquote(parsed.path)).as_posix()
                normalized = []
                invalid = False
                for part in font_path.split("/"):
                    if part in ("", "."):
                        continue
                    if part == "..":
                        if not normalized:
                            invalid = True; break
                        normalized.pop()
                    else:
                        normalized.append(part)
                target = "/".join(normalized)
                if invalid or not target or not (root / target).is_file():
                    findings.append({"id": "font.reference.missing", "status": "FAIL", "path": rel, "details": f"@font-face aponta para fonte ausente: {raw_url}"})
                elif target not in declared:
                    findings.append({"id": "font.reference.omitted", "status": "FAIL", "path": rel, "details": f"fonte local existe, mas não foi declarada para entrega: {target}"})
    return records, findings


def status_of(findings):
    if any(x["status"] == "FAIL" for x in findings): return "FAIL"
    if any(x["status"] == "BLOCKED" for x in findings): return "BLOCKED"
    if any(x["status"] == "WARN" for x in findings): return "WARN"
    return "PASS"


def build_manifest(root, contract, contract_bytes):
    records, findings = inspect_contract(root, contract)
    manifest = {
        "schemaVersion": SCHEMA_VERSION,
        "generatedBy": "@technomanceer/motion-core delivery-integrity",
        "contract": {"path": CONTRACT_NAME, "schemaVersion": contract["schemaVersion"], "sha256": hashlib.sha256(contract_bytes).hexdigest()},
        "fonts": contract.get("fonts", []),
        "files": records,
        "validation": {"status": status_of(findings), "findings": findings},
    }
    return manifest


def validate_zip(root, zip_path, contract_bytes, manifest_bytes, manifest):
    findings = list(manifest.get("validation", {}).get("findings", []))
    expected = {x["path"] for x in manifest.get("files", [])}
    expected |= {MANIFEST_NAME, CONTRACT_NAME}
    try:
        with zipfile.ZipFile(zip_path, "r") as z:
            infos = z.infolist()
            names = [x.filename for x in infos]
            if len(names) != len(set(names)):
                findings.append({"id": "zip.duplicate", "status": "FAIL", "details": "entradas duplicadas no ZIP"})
            folded_names = [x.casefold() for x in names]
            if len(folded_names) != len(set(folded_names)):
                findings.append({"id": "zip.duplicate.case", "status": "FAIL", "details": "entradas que colidem sem diferenciar maiúsculas/minúsculas"})
            for info in infos:
                name = info.filename.rstrip("/")
                if not safe_relative(name):
                    findings.append({"id": "zip.path", "status": "FAIL", "path": info.filename, "details": "caminho absoluto ou traversal"})
                mode = info.external_attr >> 16
                if stat.S_ISLNK(mode):
                    findings.append({"id": "zip.symlink", "status": "FAIL", "path": info.filename, "details": "link simbólico no pacote"})
                if info.is_dir():
                    findings.append({"id": "zip.directory", "status": "FAIL", "path": info.filename, "details": "diretório vazio/entrada de diretório não é permitido"})
            for extra in sorted(set(names) - expected):
                findings.append({"id": "zip.unexpected", "status": "FAIL", "path": extra, "details": "entrada inesperada"})
            for missing in sorted(expected - set(names)):
                findings.append({"id": "zip.missing", "status": "FAIL", "path": missing, "details": "arquivo esperado ausente do ZIP"})
            corrupt = z.testzip()
            if corrupt:
                findings.append({"id": "zip.crc", "status": "FAIL", "path": corrupt, "details": "CRC inválido; arquivo corrompido"})
            if MANIFEST_NAME in names and z.read(MANIFEST_NAME) != manifest_bytes:
                findings.append({"id": "zip.manifest.drift", "status": "FAIL", "path": MANIFEST_NAME, "details": "manifesto do ZIP diverge do projeto"})
            if CONTRACT_NAME in names and z.read(CONTRACT_NAME) != contract_bytes:
                findings.append({"id": "zip.contract.drift", "status": "FAIL", "path": CONTRACT_NAME, "details": "contrato do ZIP diverge do projeto"})
            for item in manifest.get("files", []):
                if item["path"] not in names:
                    continue
                with z.open(item["path"]) as entry:
                    digest, size = sha256_stream(entry)
                if size != item["bytes"]:
                    findings.append({"id": "zip.size", "status": "FAIL", "path": item["path"], "details": "tamanho divergente"})
                if digest != item["sha256"]:
                    findings.append({"id": "zip.sha256", "status": "FAIL", "path": item["path"], "details": "SHA-256 divergente"})
    except (OSError, zipfile.BadZipFile, RuntimeError, zlib.error) as e:
        findings.append({"id": "zip.open", "status": "FAIL", "details": f"ZIP ilegível: {e}"})
    return {"schemaVersion": SCHEMA_VERSION, "status": status_of(findings), "project": str(root), "zip": str(zip_path), "files": len(manifest.get("files", [])), "findings": findings}


def export(root, zip_path, extensions=None):
    contract, contract_bytes = load_contract(root, extensions)
    if not (root / CONTRACT_NAME).exists():
        atomic_write(root / CONTRACT_NAME, contract_bytes)
    manifest = build_manifest(root, contract, contract_bytes)
    manifest_bytes = (json.dumps(manifest, ensure_ascii=False, indent=2) + "\n").encode()
    atomic_write(root / MANIFEST_NAME, manifest_bytes)
    if manifest["validation"]["status"] != "PASS":
        return {"schemaVersion": SCHEMA_VERSION, "status": manifest["validation"]["status"], "project": str(root), "zip": str(zip_path), "files": len(manifest["files"]), "findings": manifest["validation"]["findings"]}
    zip_path.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED, allowZip64=True) as z:
        z.writestr(CONTRACT_NAME, contract_bytes)
        z.writestr(MANIFEST_NAME, manifest_bytes)
        for item in manifest["files"]:
            z.write(root.joinpath(*PurePosixPath(item["path"]).parts), item["path"])
    return validate_zip(root, zip_path, contract_bytes, manifest_bytes, manifest)


def manifest_only(root, output_path=None):
    contract, contract_bytes = load_contract(root)
    if not (root / CONTRACT_NAME).exists():
        atomic_write(root / CONTRACT_NAME, contract_bytes)
    manifest = build_manifest(root, contract, contract_bytes)
    target = output_path or (root / MANIFEST_NAME)
    target.parent.mkdir(parents=True, exist_ok=True)
    atomic_write(target, (json.dumps(manifest, ensure_ascii=False, indent=2) + "\n").encode())
    return {"schemaVersion": SCHEMA_VERSION, "status": manifest["validation"]["status"], "project": str(root), "manifest": str(target), "files": len(manifest["files"]), "findings": manifest["validation"]["findings"]}


def verify(root, zip_path):
    try:
        contract, contract_bytes = load_contract(root)
        manifest_bytes = read_project_metadata(root / MANIFEST_NAME)
        manifest = json.loads(manifest_bytes)
    except (OSError, ValueError, json.JSONDecodeError) as e:
        return {"schemaVersion": SCHEMA_VERSION, "status": "FAIL", "project": str(root), "zip": str(zip_path), "files": 0, "findings": [{"id": "manifest.read", "status": "FAIL", "details": str(e)}]}
    if not isinstance(manifest, dict):
        return {"schemaVersion": SCHEMA_VERSION, "status": "FAIL", "project": str(root), "zip": str(zip_path), "files": 0, "findings": [{"id": "manifest.schema", "status": "FAIL", "details": "raiz JSON do manifesto deve ser um objeto"}]}
    if type(manifest.get("schemaVersion")) is not int or manifest.get("schemaVersion") != SCHEMA_VERSION:
        return {"schemaVersion": SCHEMA_VERSION, "status": "FAIL", "project": str(root), "zip": str(zip_path), "files": 0, "findings": [{"id": "manifest.schema", "status": "FAIL", "details": f"schemaVersion deve ser {SCHEMA_VERSION}"}]}
    if not isinstance(manifest.get("contract"), dict) or not isinstance(manifest.get("files"), list) or not isinstance(manifest.get("validation"), dict):
        return {"schemaVersion": SCHEMA_VERSION, "status": "FAIL", "project": str(root), "zip": str(zip_path), "files": 0, "findings": [{"id": "manifest.schema", "status": "FAIL", "details": "contract, files e validation devem ter os tipos do schema v1"}]}
    malformed = []
    paths = set()
    folded_paths = set()
    for item in manifest["files"]:
        if not isinstance(item, dict) or not safe_relative(item.get("path")) or not isinstance(item.get("bytes"), int) or isinstance(item.get("bytes"), bool) or item.get("bytes") < 0 or not isinstance(item.get("sha256"), str) or not re.fullmatch(r"[0-9a-f]{64}", item["sha256"]):
            malformed.append({"id": "manifest.file", "status": "FAIL", "details": "entrada do manifesto inválida: path, bytes ou SHA-256"})
            continue
        if item["path"] in paths or item["path"].casefold() in folded_paths:
            malformed.append({"id": "manifest.duplicate", "status": "FAIL", "path": item["path"], "details": "caminho duplicado no manifesto"})
        paths.add(item["path"])
        folded_paths.add(item["path"].casefold())
        if not isinstance(item.get("validation"), dict) or item["validation"].get("status") not in ("PASS", "WARN", "FAIL", "BLOCKED"):
            malformed.append({"id": "manifest.validation", "status": "FAIL", "path": item["path"], "details": "status de validação do arquivo inválido"})
    validation_findings = manifest["validation"].get("findings")
    if not isinstance(validation_findings, list) or manifest["validation"].get("status") not in ("PASS", "WARN", "FAIL", "BLOCKED"):
        malformed.append({"id": "manifest.validation", "status": "FAIL", "details": "validação geral do manifesto inválida"})
    elif any(not isinstance(item, dict) or item.get("status") not in ("PASS", "WARN", "FAIL", "BLOCKED") for item in validation_findings):
        malformed.append({"id": "manifest.validation", "status": "FAIL", "details": "finding de validação do manifesto inválido"})
    if malformed:
        return {"schemaVersion": SCHEMA_VERSION, "status": "FAIL", "project": str(root), "zip": str(zip_path), "files": len(manifest["files"]), "findings": malformed}
    findings = []
    if manifest.get("contract", {}).get("sha256") != hashlib.sha256(contract_bytes).hexdigest():
        findings.append({"id": "manifest.contract.sha256", "status": "FAIL", "details": "hash do contrato divergente"})
    current, current_findings = inspect_contract(root, contract)
    findings.extend(current_findings)
    recorded = {x["path"]: (x.get("bytes"), x.get("sha256")) for x in manifest.get("files", [])}
    now = {x["path"]: (x.get("bytes"), x.get("sha256")) for x in current}
    if recorded != now:
        findings.append({"id": "source.manifest.drift", "status": "FAIL", "details": "arquivos da pasta de produção divergem do manifesto"})
    if manifest.get("validation", {}).get("status") != "PASS":
        findings.extend(manifest.get("validation", {}).get("findings", []))
    result = validate_zip(root, zip_path, contract_bytes, manifest_bytes, manifest)
    result["findings"] = findings + result["findings"]
    result["status"] = status_of(result["findings"])
    return result


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("action", choices=("export", "verify", "manifest"))
    ap.add_argument("project", type=Path)
    ap.add_argument("zip", type=Path, nargs="?")
    ap.add_argument("--out", type=Path, help="manifest output path")
    ap.add_argument("--ext", default="", help="legacy extension filter used only when no project contract exists")
    a = ap.parse_args()
    root = a.project.resolve()
    ext = {x.strip().lower().lstrip(".") for x in a.ext.split(",") if x.strip()} or None
    try:
        if a.action == "manifest":
            report = manifest_only(root, a.out.resolve() if a.out else None)
        else:
            if not a.zip:
                ap.error(f"{a.action} requires a ZIP path")
            zip_path = a.zip.resolve()
            report = export(root, zip_path, ext) if a.action == "export" else verify(root, zip_path)
    except (OSError, ValueError, TypeError, KeyError) as e:
        report = {"schemaVersion": SCHEMA_VERSION, "status": "FAIL", "project": str(root), "zip": str(a.zip.resolve()) if a.zip else None, "files": 0, "findings": [{"id": "delivery.input", "status": "FAIL", "details": str(e)}]}
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if report["status"] == "PASS" else 3 if report["status"] == "BLOCKED" else 2


if __name__ == "__main__":
    sys.exit(main())
