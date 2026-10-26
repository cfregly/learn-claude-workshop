from __future__ import annotations

import hashlib
import json
import shutil
from contextlib import contextmanager
from pathlib import Path
from tempfile import TemporaryDirectory
from typing import Iterator


BUNDLE_NAME = "renewal-brief"
BUNDLE_FILES = (
    "SKILL.md",
    "references/OUTPUT_CONTRACT.md",
    "scripts/contract.py",
    "scripts/render_brief.py",
)


class BundleError(ValueError):
    pass


def default_skill_root() -> Path:
    return Path(__file__).resolve().parents[1]


def bundle_manifest(skill_root: Path) -> dict[str, object]:
    root = skill_root.resolve()
    entries: list[dict[str, object]] = []
    bundle_hasher = hashlib.sha256()
    for relative in BUNDLE_FILES:
        path = root / relative
        if not path.is_file() or path.is_symlink():
            raise BundleError(f"required regular bundle file is missing: {relative}")
        data = path.read_bytes()
        digest = hashlib.sha256(data).hexdigest()
        entries.append({"path": relative, "sha256": digest, "size_bytes": len(data)})
        bundle_hasher.update(relative.encode("utf-8"))
        bundle_hasher.update(b"\0")
        bundle_hasher.update(str(len(data)).encode("ascii"))
        bundle_hasher.update(b"\0")
        bundle_hasher.update(data)
        bundle_hasher.update(b"\0")
    return {
        "schema_version": 1,
        "name": BUNDLE_NAME,
        "files": entries,
        "bundle_sha256": bundle_hasher.hexdigest(),
    }


def verify_pin_bundle(pin: dict[str, object], skill_root: Path) -> dict[str, object]:
    manifest = bundle_manifest(skill_root)
    if pin.get("bundle_sha256") != manifest["bundle_sha256"]:
        raise BundleError(
            "Skill bundle differs from the bundle recorded in the pin file"
        )
    if pin.get("bundle_files") != manifest["files"]:
        raise BundleError("Skill bundle file manifest differs from the pin file")
    return manifest


@contextmanager
def staged_bundle(skill_root: Path) -> Iterator[Path]:
    root = skill_root.resolve()
    bundle_manifest(root)
    with TemporaryDirectory(prefix="renewal-brief-upload-") as temporary:
        destination = Path(temporary) / BUNDLE_NAME
        for relative in BUNDLE_FILES:
            source = root / relative
            target = destination / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(source, target)
        staged = sorted(
            str(path.relative_to(destination))
            for path in destination.rglob("*")
            if path.is_file()
        )
        if staged != sorted(BUNDLE_FILES):
            raise BundleError(f"staged bundle is not allowlisted: {json.dumps(staged)}")
        yield destination
