# OpenBuildings.ch

**Swiss building data. Open in theory. Now open in practice.**

---

## What It Is

A free platform to explore, understand, and download Swiss building data. No GIS skills required.

Enter any address. See the building's footprint, volume, year of construction. Compare it to neighbors. Download the data. Done.

---

## The Problem

Switzerland has world-class open geodata. The GWR, the cadastral survey, swissALTI3D – it's all technically public.

But "technically public" isn't the same as usable.

Today, if you want to answer a simple question – *What's the total building volume in my commune?* – you need GIS software, technical skills, and hours of work. The data is open. The barrier is expertise.

This creates an invisible divide: specialists can access it, everyone else cannot.

---

## Why It Matters

**For transparency:** Public data collected with public resources should be publicly understandable. Not just for those who can afford consultants or have technical training.

**For climate:** Buildings account for ~40% of CO₂ emissions. Every path to net zero requires decarbonizing the building stock. But you can't decarbonize what you can't measure.

Municipalities need to know what they have. Building owners need baselines. Planners need context. Today, that means spreadsheets, guesswork, or expensive consultants.

Quality building data shouldn't be a luxury.

---

## How It Works

We connect to authoritative Swiss sources:

| Source | What It Provides |
|--------|------------------|
| **GWR** | Building and dwelling register – age, use, heating |
| **Amtliche Vermessung** | Cadastral footprints |
| **swissALTI3D** | Elevation model for volume calculation |

We calculate meaningful metrics, normalize the formats, and present it simply.

The result: decision-ready building information, accessible to anyone.

---

## Who It's For

**Primary:** Small municipalities without GIS staff who need building stock overviews for planning and climate reporting.

**Secondary:** Building owners, researchers, planners, journalists – anyone who needs to understand Swiss buildings without becoming a geodata specialist.

---

## Roadmap

| Phase | Scope | Status |
|-------|-------|--------|
| **1. Volume** | Building volumes from swissALTI3D + cadastral footprints | In progress |
| **2. Registry** | Integrate GWR data (age, use, dwellings) | Planned |
| **3. Energy** | Heating systems, energy certificates, solar potential | Future |
| **4. Expand** | Additional cantons, eventually national coverage | Future |

---

## Business Model

The core platform is free. Forever.

| Layer | Access | What You Get |
|-------|--------|--------------|
| **Explore** | Free | Search any building, view key metrics, browse the map |
| **Download** | Free | Individual building data, small exports |
| **API** | Freemium | Programmatic access, rate-limited free tier |
| **Bulk & Reports** | Paid | Municipal datasets, portfolio analysis, PDF reports |

Premium revenue funds ongoing development. The open core stays open.

---

## Why Switzerland First

Switzerland offers the best open geodata infrastructure in the world:

- Unified federal APIs (geo.admin.ch)
- High-precision elevation models
- Authoritative cadastral data
- National building register

It's the ideal proving ground. But the problem – open data that isn't truly accessible – exists everywhere.

---

## What Exists Today

| Option | The Gap |
|--------|---------|
| **geo.admin.ch** | Powerful but technical – requires GIS knowledge |
| **swisstopo tools** | Raw data, not decision-ready information |
| **Commercial providers** | Expensive, proprietary, not open |

OpenBuildings.ch sits in the middle: accessible like a consumer product, open like public infrastructure.

---

## Principles

- **Open in practice, not just theory.** If you need GIS skills to use it, we've failed.
- **Less data, more insight.** We curate what matters for decisions.
- **Transparency by default.** Methodology, sources, limitations – all public.
- **No lock-in.** Open source, standard formats, your data is yours.

---

## Success Metrics (12 months)

- Buildings indexed: 1M+
- Monthly active users: 1,000+
- Cantonal coverage: 5+
- Municipal users: 10+

---

## Get Involved

This is an open project.

- **Repository:** [github.com/davras5/swissALTI3D-Volumen](https://github.com/davras5/swissALTI3D-Volumen)
- **Documentation:** Public
- **Contributions:** Welcome – code, data, feedback

---

*Building data belongs to everyone. We're making that real.*
