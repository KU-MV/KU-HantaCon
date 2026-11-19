# HantaCon documentation

Reference documentation for [HantaCon](README.md). See the README for installation and a quick start.

## Contents

- [Architecture](#architecture)
- [Directory layout](#directory-layout)
- [Bioinformatics tools](#bioinformatics-tools)
- [Consensus workflow](#consensus-workflow)
- [Phylodynamics workflow](#phylodynamics-workflow)
- [Supported location names](#supported-location-names)
- [Reference database](#reference-database)
- [Running from source](#running-from-source)
- [Building distributable packages](#building-distributable-packages)
- [Rebuilding the backend](#rebuilding-the-backend)
- [Troubleshooting](#troubleshooting)
- [Tool references](#tool-references)

## Architecture

HantaCon has two parts.

The **front end** is an Electron application. `main.js` creates the window, prepares the working directory, and handles file dialogs. `src/renderer.js` and `src/index.html` provide the five tabs. Analyses run in a worker thread (`workerWorkflow.js`) so the interface stays responsive, and the worker streams log lines back to the renderer.

The **backend** is two Docker Compose services, defined in `resources/docker/docker-compose.yml`:

| Service | Container | Image | Role |
|---|---|---|---|
| `hantacon_core` | `hantacon_core_env` | built locally from `resources/docker/dockerfile` | read mapping, variant calling, consensus generation, MAFFT alignment |
| `hantacon_nextstrain` | `hantacon_nextstrain_env` | `nextstrain/base` | Augur build and the Auspice server on port 4000 |

`hantacon_core` is built on `mambaorg/micromamba:1.5.8`, with the conda environment `HantaCon` defined in `resources/docker/env.yml`.

Workflow steps are declared as data in `workflow.js`, as a list of shell commands with placeholders. The worker substitutes paths and parameters and runs each command with `docker compose exec -T`.

## Directory layout

On first launch HantaCon creates `~/Desktop/HantaCon` and copies `.env`, `docker-compose.yml`, `dockerfile`, `env.yml`, and `scripts/filter_indel_with_sr.py` into it. Existing files are not overwritten.

```
~/Desktop/HantaCon/
├── .env                      # UID and GID used by the containers (Linux: set to your account automatically)
├── docker-compose.yml
├── dockerfile
├── env.yml
├── scripts/
│   └── filter_indel_with_sr.py
└── workspace/                # mounted into both containers as /workspace
    ├── auspice/              # Auspice JSONs served at localhost:4000
    ├── result/
    │   └── <YYYYMMDD_HHMMSS>/   # one directory per run
    └── work/
        ├── sequence/<run id>/
        └── phylodynamics/<run id>/
```

Each run creates a new timestamped directory, so earlier results are never overwritten. Intermediate files under `work/` can be deleted once a run has finished.

## Bioinformatics tools

Installed in the `hantacon_core` image from `resources/docker/env.yml`:

| Package | Version | Role |
|---|---|---|
| python | 3.10 | script runtime |
| medaka | 2.2.1 | read alignment (`mini_align`) and consensus variant calling |
| minimap2 | 2.31 | read mapping, used by `mini_align` |
| samtools | 1.23.1 | BAM sorting, indexing, segment extraction |
| bcftools | 1.24 | variant filtering and consensus application |
| htslib | 1.23.1 | `bgzip` and `tabix` |
| bedtools | 2.31.1 | coverage calculation and low-coverage masking |
| seqkit | 2.14.0 | installed; not used by the current workflow |
| mafft | 7.526 | multiple sequence alignment |
| vcfpy | 0.13.6 | used by `filter_indel_with_sr.py` |
| k8 | 1.2 | JavaScript runtime required by `mini_align` |

Augur, IQ-TREE, TreeTime, and Snakemake come from the `nextstrain/base` image and are not installed in `hantacon_core`.

All versions are pinned in `env.yml`, and packages come only from the conda-forge and bioconda channels. The same versions are installed on Intel (linux-64) and Apple silicon or ARM (linux-aarch64) machines. This set was tested in November 2026: the consensus workflow completed and recovered all variants in a simulated test dataset. The `nextstrain/base` image is not pinned and is downloaded at its latest version.

## Consensus workflow

Defined in `workflow.js` as `Sequence`. The three segments are processed by identical steps.

1. **Map reads.** The L, M, and S reference FASTA files for the selected reference are concatenated, reads are aligned with `mini_align -m -f -M 2 -S 4 -O 4,24 -E 2,1`, and the sorted BAM is split per segment with `samtools view` on the reference sequence name.
2. **Call variants.** `medaka inference` with model `r941_prom_sup_variant_g507`, then `medaka vcf` and `medaka tools annotate --dpsp`.
3. **Filter.** `bcftools view -i 'QUAL>{quality} & INFO/DP>{depth}'`, then `filter_indel_with_sr.py`, which keeps an indel only when the strand-read support for the reference allele is lower than for the alternate allele.
4. **Build consensus.** `bcftools consensus` against the segment reference.
5. **Mask low coverage.** `bedtools genomecov -bga`, positions below the low-coverage threshold are merged with `bedtools merge` and masked with `bedtools maskfasta`.
6. **Label.** The FASTA header is rewritten as `><prefix>_<segment> low_cov_thrs=… var_qual_thrs=… var_depth_thrs=…`.

Bundled references, under `resources/reference/`:

| Key | Strain | Available in the interface |
|---|---|---|
| `HTNV_76-118` | HTNV 76-118 | yes |
| `HTNV_Ac20-5` | HTNV Ac20-5 | yes |
| `DOBV`, `PUUV`, `SEOV`, `SNV` | Dobrava, Puumala, Seoul, Sin Nombre | bundled, not selectable in the current interface |

## Phylodynamics workflow

Defined in `workflow.js` as `Phylodynamic`.

The template for the selected segment (`resources/template/htv_L`, `htv_M`, or `htv_S`) is copied into the run directory. The first record of the selected consensus FASTA is appended to `data/sequence.fasta`, and a metadata row built from the form fields is appended to `data/metadata.tsv`. Any further records in the file are ignored. The strain name is the first FASTA header, up to the first space. It must not duplicate a strain already in the reference dataset.

The metadata columns, in order:

```
strain, host, genetic exchange, lineage, hybrid zone, accession, date,
province, country, city, town, db, title, journal, paper_url
```

Then MAFFT aligns `data/sequence.fasta` in the `hantacon_core` container, and `snakemake -c 4` runs the Augur build in the `hantacon_nextstrain` container. The Snakefile runs `augur index`, `filter`, `tree`, `refine` (time tree, marginal date inference, `opt` coalescent), `traits` (on `province`, with confidence), `ancestral` (joint), `translate`, `export v2`, and `frequencies` (KDE).

The resulting `auspice/htv_<segment>.json` and its two sidecar files, `htv_<segment>_tip-frequencies.json` and `htv_<segment>_root-sequence.json`, are copied to the run result directory and to `workspace/auspice/`, where the Auspice server picks them up. Without the tip-frequencies file Auspice shows `Failed to fetch tip frequencies`.

## Supported location names

A sequence is placed on the Geography panel only when its `country`, `province`, `city`, and `town` values match an entry in `config/lat_longs.tsv`. The table is identical for all three segments. Matching ignores capitalization but is otherwise exact, including spacing and hyphens. A value with no entry is reported by Augur as `did not have an associated lat/long value` and is not placed at that level; it also appears as a separate category in the colour legend. For example, entering `Korea` instead of `South Korea` splits the country legend into two entries. Leave a level blank rather than typing a placeholder such as `unknown`.

**Country (3)**
China, Russia, South Korea

**Province (30)**
Anhui, Chungbuk, Daegu, Fuyuan, Gangwon, Guizhou, Gyeongbuk, Gyeonggi, Gyeongnam, Gyeongsang, Heilongjiang, Henan, Hubei, Hunan, Jeju, Jeollabuk, Jeonnam, Jiangsu, Jiangxi, Jilin, Khabarovsk, Liaoning, Longquan, Seoul, Shaanxi, Shandong, Shichuan, Tianjin, Yunan, Zhejiang

**City (37)**
Anhui, Boseong, Cheorwon, Chuncheon, Dongducheon, Fuyuan, Guizhou, Gwangju, Heilongjiang, Henan, Hongcheon, Hubei, Hunan, Hwacheon, Inje, Jeju, Jiangsu, Jiangxi, Jilin, Khabarovsk, Liaoning, Longquan, Muju, Paju, Pocheon, Pyeongchang, Pyeongtaek, Seogwipo, Seoul, Shaanxi, Shandong, Shichuan, Tianjin, Yanggu, Yeoncheon, Yunan, Zhejiang

**Town (41)**
Baegyeon-ri, Bongseong-ri, Dochang-ri, Dongi-ri, Dosin-ri, Duil-ri, Gaekhyeon-ri, Gapdun-ri, Guun-ri, Gwanu-ri, Hogeun-dong, Hyeonga-ri, Icheon-ri, Jajak-ri, Jangam-ri, Jangjwa-ri, Jikcheon-ri, Majeon-ri, Mandae-ri, Mugeon-ri, Munhye-ri, Nogok-ri, Ohyeon-ri, Oji-ri, Okgye-ri, Ora-2-dong, Pungam-ri, Pungsan-ri, Samil-ri, Sang-ri, Sangdae-ri, Sangsa-ri, Sanyang-ri, Seongok-ri, Sinchon-ri, Sindap-ri, Tonghyeon-ri, Uncheon-ri, Wacho-ri, Wangnim-ri, Yuli-ri

To add a location, append a row to `config/lat_longs.tsv` in each segment template, in the form `level<TAB>name<TAB>latitude<TAB>longitude`.

## Reference database

Each segment template under `resources/template/` carries its own dataset:

| Segment | Sequences in `data/sequence.fasta` | Rows in `data/metadata.tsv` |
|---|---|---|
| L | 162 | 163 |
| M | 163 | 164 |
| S | 164 | 165 |

The extra metadata row in each case is HTNV 76-118, which is supplied as the annotated reference (`config/reference.gb`) rather than as a dataset sequence.

Sequences and metadata were retrieved from GenBank on 30 August 2025. `config/colors.tsv` assigns colors for the country, province, host, lineage, genetic exchange, and hybrid zone categories. `config/dropped_strains.txt` is empty, so no strain is excluded at the filter step.

<!-- TODO: add the inclusion and exclusion criteria used when assembling the dataset. -->

## Running from source

Installation steps for macOS and Ubuntu are in the [README](README.md#installation).

Electron is pinned to 45.3.4, which requires Node.js 22.12 or later (`engines` in `package.json`). `package-lock.json` is committed, so `npm install` installs the same dependency versions on every machine.

Packaged builds take their icon from `package.json` (see below). When run with `npm start`, `main.js` sets the same icon on the window and, on macOS, the Dock.

## Building distributable packages

```bash
npm run build:linux   # .deb, written to dist/
npm run build:mac     # .dmg and .zip for x64 and arm64
npm run build         # both
```

Icons come from `build.mac.icon` (`resources/icons/mac/icon.icns`) and `build.linux.icon` (`resources/256x256.png`) in `package.json`. macOS builds are ad-hoc signed (`identity: "-"`, `hardenedRuntime: false`), not signed with a Developer ID or notarized, so the first launch of a downloaded package must be allowed under System Settings, Privacy & Security (**Open Anyway**). Without ad-hoc signing of the whole bundle, macOS rejects a downloaded package as damaged. Build the macOS package on a Mac; electron-builder does not support building it on Linux.

## Rebuilding the backend

**Restart Services** in the Settings tab runs:

```bash
docker compose -f ~/Desktop/HantaCon/docker-compose.yml up -d --remove-orphans
```

**Reinstall Services** runs:

```bash
docker compose -f ~/Desktop/HantaCon/docker-compose.yml pull
docker compose -f ~/Desktop/HantaCon/docker-compose.yml up -d --force-recreate
```

Neither rebuilds the locally built `hantacon_core` image. After editing `dockerfile` or `env.yml`, rebuild it from a terminal:

```bash
cd ~/Desktop/HantaCon
docker compose build --no-cache hantacon_core
docker compose up -d --force-recreate hantacon_core
```

Note that HantaCon copies the Docker files into `~/Desktop/HantaCon` only when they are absent. Editing the copies in `resources/docker/` in the repository has no effect on an existing installation unless the corresponding files in `~/Desktop/HantaCon` are deleted first.

## Troubleshooting

**`node -v` prints a version lower than 22.12, or `npm install` reports an unsupported engine.**
Install the current LTS release of Node.js as described in the [README](README.md#prerequisites). On Ubuntu, `sudo apt install nodejs` without the NodeSource step installs a version that is too old.

**`permission denied while trying to connect to the Docker daemon socket` (Linux).**
Your account is not yet in the `docker` group. Run `sudo usermod -aG docker $USER`, log out, log back in, and try again.

**`npm start` stops with `The SUID sandbox helper binary was found, but is not configured correctly` (Ubuntu 24.04 or later).**
Run once, inside the `KU-HantaCon` folder:

```bash
sudo chown root:root node_modules/electron/dist/chrome-sandbox
sudo chmod 4755 node_modules/electron/dist/chrome-sandbox
```

Repeat after `npm install` replaces the Electron runtime.

**An analysis fails with `[Docker Error] exit 127`.**
The `docker` command was not found. Install Docker Desktop and open it once. On macOS, HantaCon looks for `docker` in `~/.docker/bin`, `/Applications/Docker.app/Contents/Resources/bin`, `/usr/local/bin`, and `/opt/homebrew/bin`, because applications opened from Finder do not see the Terminal `PATH`. Packages built before this search was added show this error when opened from Applications; rebuild and reinstall as in the [README](README.md#updating).

**An analysis fails immediately with a Docker error.**
Check that Docker is running (macOS: Docker Desktop shows **Engine running**) and that `docker compose version` works in Terminal. Then press **Restart Services** in the Settings tab.

**The first analysis seems stuck.**
On first use the `hantacon_core` image is built and the `nextstrain/base` image is downloaded, several GB in total. The log may show no new lines for several minutes. Wait until the status bar changes.

**The Nextstrain build stops with `Sequence ids must be unique`.**
The strain name taken from your FASTA header already exists in the reference dataset, for example when re-analyzing a GenBank sequence that is part of the database. Rename the FASTA header and run again.

**Only one of several specimens was analyzed in the Phylodynamics tab.**
Only the first record of the selected FASTA file is read. Put each specimen in its own file and run them one at a time.

**A new sequence does not appear on the map, or the country legend shows two entries.**
Its location names must match `config/lat_longs.tsv`. See [Supported location names](#supported-location-names).

**The offline viewer shows nothing, or a new run is missing.**
Press **Refresh**. Confirm that `hantacon_nextstrain_env` is running (`docker ps`) and that no other program uses port 4000. At least one completed Phylodynamics run is needed.

**Result files cannot be edited or deleted (Linux, older installations).**
Older versions wrote `UID=1000` and `GID=1000` to `~/Desktop/HantaCon/.env`. Set them to the output of `id -u` and `id -g`, then run `cd ~/Desktop/HantaCon && docker compose up -d --force-recreate`.

## Tool references

- Hadfield J, et al. Nextstrain: real-time tracking of pathogen evolution. *Bioinformatics* 34, 4121-4123 (2018).
- Huddleston J, et al. Augur: a bioinformatics toolkit for phylogenetic analyses of human pathogens. *J Open Source Softw* 6, 2906 (2021).
- Li H. Minimap2: pairwise alignment for nucleotide sequences. *Bioinformatics* 34, 3094-3100 (2018).
- Danecek P, et al. Twelve years of SAMtools and BCFtools. *GigaScience* 10, giab008 (2021).
- Quinlan AR, Hall IM. BEDTools: a flexible suite of utilities for comparing genomic features. *Bioinformatics* 26, 841-842 (2010).
- Katoh K, Standley DM. MAFFT multiple sequence alignment software version 7. *Mol Biol Evol* 30, 772-780 (2013).
- Minh BQ, et al. IQ-TREE 2: new models and efficient methods for phylogenetic inference in the genomic era. *Mol Biol Evol* 37, 1530-1534 (2020).
- Sagulenko P, Puller V, Neher RA. TreeTime: maximum-likelihood phylodynamic analysis. *Virus Evol* 4, vex042 (2018).
- Mölder F, et al. Sustainable data analysis with Snakemake. *F1000Research* 10, 33 (2021).
- Medaka. Oxford Nanopore Technologies. https://github.com/nanoporetech/medaka
