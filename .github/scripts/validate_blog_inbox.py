#!/usr/bin/env python3
"""Validate CMO blog-inbox posts before they may touch web/content/blog/.

This script is the hard jail for the marketing automation (the OpenClaw VPS):
the CMO holds NO credential for this repo — it can only drop .mdx files into
its own repo's blog-inbox/, and the blog-sync workflow runs THIS validator
(code the CMO cannot modify) before anything is copied into the site. See
docs/infrastructure/OPENCLAW_CMO_VPS.md.

Enforced contract (stricter than web/src/lib/blog/schema.ts, which is the
runtime safety net — new posts must also satisfy the WRITING_GUIDE AEO set):
  * filename: lowercase-hyphenated slug, .mdx, ≤ 200 KB; `_`-prefixed ignored
  * frontmatter: required base fields + required AEO fields, length-checked
  * slug == filename stem; author must exist in web/content/authors/
  * body: pure markdown — no JSX/HTML tags, no MDX {expressions},
    no import/export lines (eliminates the MDX-XSS class entirely)

Usage: validate_blog_inbox.py <inbox_dir> <published_dir>
Exit 0 and print a JSON summary line (CHANGED=<json>) when every inbox post
is valid; exit 1 listing every violation otherwise (all-or-nothing).
"""
import json
import os
import re
import sys

import yaml

# Mirrors web/src/lib/blog/categories.ts (CATEGORY_SLUGS).
CATEGORIES = {"tips", "advice", "takes", "behind"}
FILENAME_RE = re.compile(r"^[a-z0-9][a-z0-9-]{2,79}\.mdx$")
MAX_BYTES = 200_000

# Body jail: any of these fails the post. `<` is allowed only for autolinks
# (<https://…>); everything tag-like is rejected, as are MDX expressions and
# ESM lines. Pure markdown only.
BODY_BANS = (
    (re.compile(r"^\s*import\s", re.M), "import statement"),
    (re.compile(r"^\s*export\s", re.M), "export statement"),
    (re.compile(r"<(?!https?://)[A-Za-z/!?]"), "JSX/HTML tag (pure markdown only)"),
    (re.compile(r"[{}]"), "MDX expression braces (pure markdown only)"),
)

STR_FIELDS = {  # field: (min_len, max_len)
    "title": (3, 120),
    "excerpt": (40, 280),
    "tldr": (40, 600),
    "primaryQuestion": (5, 200),
    "citableClaim": (10, 400),
}
LIST_FIELDS = {  # field: (min_items, max_items, item_min, item_max)
    "secondaryQuestions": (1, 8, 3, 200),
    "entities": (1, 5, 2, 80),
}
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def field_str(fm, field, lo, hi, errors):
    v = fm.get(field)
    if not isinstance(v, str) or not (lo <= len(v.strip()) <= hi):
        errors.append(f"frontmatter.{field}: required string of {lo}-{hi} chars")


def validate_frontmatter(fm, stem, authors, errors):
    for field, (lo, hi) in STR_FIELDS.items():
        field_str(fm, field, lo, hi, errors)
    if fm.get("slug") != stem:
        errors.append(f"frontmatter.slug must equal filename stem ({stem!r})")
    for field in ("date", "lastReviewed"):
        if not DATE_RE.match(str(fm.get(field, ""))):
            errors.append(f"frontmatter.{field}: required YYYY-MM-DD date")
    if fm.get("author") not in authors:
        errors.append(f"frontmatter.author must be one of {sorted(authors)}")
    if fm.get("category") not in CATEGORIES:
        errors.append(f"frontmatter.category must be one of {sorted(CATEGORIES)}")
    if not isinstance(fm.get("tags"), list) or not fm["tags"]:
        errors.append("frontmatter.tags: required non-empty list")
    if fm.get("draft") not in (False,):
        errors.append("frontmatter.draft must be false (the inbox IS the publish step)")
    for field, (lo, hi, ilo, ihi) in LIST_FIELDS.items():
        v = fm.get(field)
        if (not isinstance(v, list) or not (lo <= len(v) <= hi)
                or not all(isinstance(i, str) and ilo <= len(i) <= ihi for i in v)):
            errors.append(f"frontmatter.{field}: required list of {lo}-{hi} strings ({ilo}-{ihi} chars)")
    faq = fm.get("faq")
    if not isinstance(faq, list) or not (1 <= len(faq) <= 8):
        errors.append("frontmatter.faq: required list of 1-8 {question, answer} entries")
    else:
        for i, entry in enumerate(faq):
            if (not isinstance(entry, dict)
                    or not isinstance(entry.get("question"), str)
                    or not (3 <= len(entry["question"]) <= 200)
                    or not isinstance(entry.get("answer"), str)
                    or not (40 <= len(entry["answer"]) <= 600)):
                errors.append(f"frontmatter.faq[{i}]: question 3-200 chars + answer 40-600 chars")


def validate_post(path, authors):
    errors = []
    name = os.path.basename(path)
    if not FILENAME_RE.match(name):
        errors.append("filename must be lowercase-hyphenated slug + .mdx")
    if os.path.getsize(path) > MAX_BYTES:
        errors.append(f"file exceeds {MAX_BYTES} bytes")
        return errors
    raw = open(path, encoding="utf-8").read()
    m = re.match(r"\A---\n(.*?)\n---\n(.*)\Z", raw, re.S)
    if not m:
        return errors + ["missing ----delimited YAML frontmatter"]
    try:
        fm = yaml.safe_load(m.group(1)) or {}
    except yaml.YAMLError as exc:
        return errors + [f"frontmatter is not valid YAML: {exc}"]
    body = m.group(2)
    validate_frontmatter(fm, name[:-4], authors, errors)
    if len(body.strip()) < 1500:
        errors.append("body under 1500 chars — not a real post")
    for pattern, label in BODY_BANS:
        hit = pattern.search(body)
        if hit:
            line = body[: hit.start()].count("\n") + 1
            errors.append(f"body line {line}: banned — {label}")
    return errors


def main():
    inbox, published = sys.argv[1], sys.argv[2]
    authors = {f[:-5] for f in os.listdir("web/content/authors") if f.endswith(".json")}
    if not os.path.isdir(inbox):
        print("no inbox directory — nothing to publish")
        print("CHANGED=[]")
        return 0
    failures, changed = {}, []
    for name in sorted(os.listdir(inbox)):
        if name.startswith("_") or not name.endswith(".mdx"):
            continue
        path = os.path.join(inbox, name)
        errors = validate_post(path, authors)
        if errors:
            failures[name] = errors
            continue
        target = os.path.join(published, name)
        if os.path.exists(target) and open(target, encoding="utf-8").read() == open(path, encoding="utf-8").read():
            continue  # already published, unchanged
        changed.append(name)
    if failures:
        print("VALIDATION FAILED — nothing will be published this run:")
        for name, errors in failures.items():
            for e in errors:
                print(f"  {name}: {e}")
        return 1
    print(f"valid inbox posts to publish: {changed or 'none'}")
    print(f"CHANGED={json.dumps(changed)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
