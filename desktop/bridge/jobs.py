# -*- coding: utf-8 -*-
"""
Job Finder — job postings from global, Arab and Gulf job boards through Agent Reach (Exa).

Fans a role query out over the major boards and target locations, parses each hit into a job
posting (title, company, location, country, url, source, snippet), streamed as NDJSON so the app
can show results live and plot hiring demand on the world map.

Concatenated after search.py + leads.py at build time; may use their helpers:
now(), ch_exa(), domain(), emit_line().
"""
import re

# Boards: global + Arab + Gulf. Included in the query text to bias Exa toward real postings.
BOARDS = [
    # global
    "site:linkedin.com/jobs", "linkedin jobs", "indeed.com", "glassdoor jobs", "wellfound jobs",
    "ziprecruiter.com", "monster.com", "dice.com", "simplyhired.com", "themuse.com jobs",
    "lever.co jobs", "greenhouse.io jobs", "workable.com jobs", "jobvite.com", "smartrecruiters.com",
    # remote-first
    "remoteok.com", "weworkremotely.com", "remote.co jobs", "remotive.com", "workingnomads.com",
    # Europe / UK
    "reed.co.uk", "totaljobs.com", "cv-library.co.uk", "stepstone.de", "xing.com jobs", "welcometothejungle.com",
    # India / Asia
    "naukri.com", "foundit.in", "instahyre.com", "jobstreet.com", "jobsdb.com", "seek.com.au",
    # Arab + Gulf
    "bayt.com", "wuzzuf.net", "gulftalent.com", "naukrigulf.com", "tanqeeb.com", "forasna.com",
    "laimoon.com", "dubizzle jobs", "akhtaboot.com", "mihnati.com", "rozee.pk", "tan9eeb.com",
    "hirint.com", "wadhefa.com", "khaleejtimes jobs", "gulfnews jobs", "monstergulf.com",
]
# location -> country for map aggregation
LOC_COUNTRY = {
    "egypt": "Egypt", "cairo": "Egypt", "saudi": "Saudi Arabia", "riyadh": "Saudi Arabia", "jeddah": "Saudi Arabia",
    "uae": "United Arab Emirates", "dubai": "United Arab Emirates", "abu dhabi": "United Arab Emirates",
    "qatar": "Qatar", "doha": "Qatar", "kuwait": "Kuwait", "bahrain": "Bahrain", "oman": "Oman", "muscat": "Oman",
    "jordan": "Jordan", "amman": "Jordan", "morocco": "Morocco", "tunisia": "Tunisia", "lebanon": "Lebanon",
    "united kingdom": "United Kingdom", "london": "United Kingdom", "uk": "United Kingdom",
    "germany": "Germany", "berlin": "Germany", "france": "France", "paris": "France", "netherlands": "Netherlands",
    "united states": "United States", "usa": "United States", "new york": "United States", "san francisco": "United States",
    "canada": "Canada", "toronto": "Canada", "remote": "Remote", "india": "India", "singapore": "Singapore",
}
COUNTRY_LATLON = {
    "Egypt": (26.8, 30.8), "Saudi Arabia": (23.9, 45.1), "United Arab Emirates": (23.4, 53.8), "Qatar": (25.3, 51.2),
    "Kuwait": (29.3, 47.5), "Bahrain": (26.0, 50.5), "Oman": (21.5, 55.9), "Jordan": (31.2, 36.5), "Morocco": (31.8, -7.1),
    "Tunisia": (33.9, 9.6), "Lebanon": (33.9, 35.9), "United Kingdom": (55.4, -3.4), "Germany": (51.2, 10.5),
    "France": (46.2, 2.2), "Netherlands": (52.1, 5.3), "United States": (37.1, -95.7), "Canada": (56.1, -106.3),
    "India": (20.6, 78.9), "Singapore": (1.35, 103.8), "Remote": (0.0, 0.0), "Unknown": (0.0, 0.0),
}

DEFAULT_LOCS = ["", "Saudi Arabia", "UAE Dubai", "Egypt", "Qatar", "Remote", "United Kingdom", "United States", "Germany"]


def detect_country(text):
    low = (text or "").lower()
    for k, v in LOC_COUNTRY.items():
        if k in low:
            return v
    return "Unknown"


def parse_job(hit):
    title = (hit.get("title") or "").strip()
    raw = hit.get("snippet_full") or hit.get("snippet") or ""
    url = hit["url"]
    src = domain(url)
    # company: "Company hiring Role" (LinkedIn), or after " at "/" - "/" | "
    company = ""
    m = re.match(r"([A-Z][\w&.,'\- ]{1,50}?)\s+hiring\b", title)
    if m:
        company = m.group(1).strip()
    if not company:
        m = re.search(r"\b(?:at|@|\-|–|\|)\s+([A-Z][\w&.,'\- ]{1,50})", title)
        if m:
            company = m.group(1).strip(" -|")
    if not company:
        m = re.search(r"(?:at|@)\s+([A-Z][\w&.\- ]{1,50})", raw)
        company = m.group(1).strip() if m else ""
    if company.lower() in ("you", "we", "the company", "a "):
        company = ""
    # location
    loc = ""
    m = re.search(r"(?:in|·|,)\s+([A-Z][A-Za-z .'-]+,?\s*(?:Egypt|Saudi Arabia|UAE|United Arab Emirates|Qatar|Kuwait|Bahrain|Oman|Jordan|Morocco|Tunisia|Lebanon|United Kingdom|Germany|France|Netherlands|United States|USA|Canada|India|Singapore|Remote))", title + " " + raw)
    if m:
        loc = m.group(1).strip()
    country = detect_country(loc or title + " " + raw)
    # clean role title (strip "Company hiring " prefix and trailing company/location noise)
    role_src = title
    hm = re.search(r"\bhiring\s+(.+)$", title)
    if hm:
        role_src = hm.group(1)
    role = re.split(r"\s+[-|]\s+", role_src)[0].strip()
    role = re.sub(r"\s+(?:at|@)\s+[A-Z].*$", "", role).strip()
    blob = title + " " + raw
    low = blob.lower()
    # employment type
    etypes = []
    for kw, label in [("full-time", "Full-time"), ("full time", "Full-time"), ("part-time", "Part-time"), ("part time", "Part-time"),
                      ("contract", "Contract"), ("freelance", "Freelance"), ("internship", "Internship"), ("temporary", "Temporary")]:
        if kw in low and label not in etypes:
            etypes.append(label)
    remote_mode = "Remote" if re.search(r"\bremote\b|work from home|wfh", low) else ("Hybrid" if "hybrid" in low else ("On-site" if re.search(r"on[- ]site|onsite", low) else ""))
    # seniority
    sen = ""
    for kw, label in [("intern", "Intern"), ("junior", "Junior"), ("entry level", "Entry"), ("entry-level", "Entry"),
                      ("mid-level", "Mid"), ("senior", "Senior"), ("staff", "Staff"), ("principal", "Principal"),
                      ("lead", "Lead"), ("head of", "Head"), ("director", "Director"), ("vp ", "VP"), ("chief", "C-level")]:
        if kw in low:
            sen = label
            break
    # salary
    sal = ""
    ms = re.search(r"([$€£₹]|USD|EUR|GBP|AED|SAR|EGP|QAR|KWD|INR)\s?[\d.,]{2,}\s?[kK]?(?:\s?[-–to]{1,3}\s?[$€£₹]?[\d.,]{2,}\s?[kK]?)?(?:\s?(?:per|/)\s?(?:year|yr|annum|month|mo|hour|hr))?", blob)
    if ms:
        sal = ms.group(0).strip()
    # posted
    posted = ""
    mp = re.search(r"(\d+)\s+(hour|day|week|month)s?\s+ago|(today|yesterday|just posted)", low)
    if mp:
        posted = mp.group(0)
    dom = domain(url)
    return {
        "id": "JOB-" + str(abs(hash(url.split("?")[0])) % (10 ** 8)).zfill(8),
        "title": title, "role": role or title, "company": company, "location": loc, "country": country,
        "url": url, "source": src, "snippet": raw[:1800], "channel": "exa", "fetched_at": now(),
        "employment_type": etypes[0] if etypes else "", "work_mode": remote_mode, "seniority": sen,
        "salary": sal, "posted": posted,
        "logo": "https://www.google.com/s2/favicons?domain=" + dom + "&sz=64",
    }


def find_jobs(query, target=200, max_calls=None):
    import os as _os
    if max_calls is None:
        try:
            max_calls = int(_os.environ.get("ORBIT_EXA_CALLS_PER_RUN") or 25)
        except ValueError:
            max_calls = 25
    variants = []
    for loc in DEFAULT_LOCS:
        for board in BOARDS:
            variants.append(" ".join(x for x in [query, "jobs hiring", loc, board] if x))
    plan = variants[:max_calls]
    emit_line({"type": "start", "query": query, "target": target, "planned_calls": len(plan), "percent": 0})
    seen, jobs, weak = set(), [], 0
    for i, v in enumerate(plan):
        if len(jobs) >= target:
            break
        emit_line({"type": "call", "index": i + 1, "planned_calls": len(plan), "query": v, "count": len(jobs), "target": target, "percent": _pct(len(jobs), target, i, len(plan))})
        try:
            hits = ch_exa(v, 100)
        except Exception as e:  # noqa
            fatal = "not installed" in str(e) or "not configured" in str(e) or "rate limit" in str(e).lower()
            emit_line({"type": "error", "index": i + 1, "query": v, "error": str(e)[:300], "fatal": fatal and not jobs, "stopped": fatal})
            if fatal:
                break
            continue
        batch = []
        for h in hits:
            key = h["url"].split("?")[0].rstrip("/").lower()
            if key in seen:
                continue
            # keep only board/posting-looking URLs
            if not any(b.split(":")[-1].split(" ")[0] in h["url"] for b in BOARDS if "." in b) and "/jobs" not in h["url"] and "/job/" not in h["url"] and "/vacancy" not in h["url"]:
                continue
            seen.add(key)
            job = parse_job(h)
            jobs.append(job)
            batch.append(job)
        emit_line({"type": "batch", "index": i + 1, "planned_calls": len(plan), "query": v, "returned": len(hits), "new": len(batch), "count": len(jobs), "target": target, "percent": _pct(len(jobs), target, i + 1, len(plan)), "leads": batch})
        weak = weak + 1 if len(batch) < 3 else 0
        if weak >= 3:
            emit_line({"type": "log", "line": "Stopping early: recent boards returned little new (saves your Exa quota)."})
            break
    # aggregate demand by country for the map
    by_country = {}
    for j in jobs:
        by_country[j["country"]] = by_country.get(j["country"], 0) + 1
    demand = [{"country": c, "count": n, "lat": COUNTRY_LATLON.get(c, (0, 0))[0], "lon": COUNTRY_LATLON.get(c, (0, 0))[1]} for c, n in sorted(by_country.items(), key=lambda x: -x[1])]
    return {"query": query, "count": len(jobs), "jobs": jobs, "demand": demand, "engine": "agent-reach/exa", "fetched_at": now()}


def _pct(count, target, calls_done, planned):
    a = count / target if target else 1
    b = calls_done / planned if planned else 1
    return int(min(100, round(max(a, b) * 100)))
