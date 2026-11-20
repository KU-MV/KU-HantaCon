<img src="src/img/lab.png" alt="Song Lab" width="120" align="right">

# HantaCon

![Platform](https://img.shields.io/badge/platform-Linux%20%7C%20macOS-brightgreen)
![Version](https://img.shields.io/badge/version-1.1.5-blue)
[![Download](https://img.shields.io/github/v/release/KU-MV/KU-HantaCon?label=download)](https://github.com/KU-MV/KU-HantaCon/releases/latest)

### [Download](https://github.com/KU-MV/KU-HantaCon/releases/latest) · [Install](#installation) · [Quick start](#quick-start) · [Documentation](DOCS.md) · [Changelog](CHANGELOG.md) · [Citation](#citation) · [Issues](https://github.com/KU-MV/KU-HantaCon/issues)

**HantaCon** is an integrated desktop application for genomic surveillance and phylogeographic visualization of **Hantaan virus (HTNV)**.

<img src="src/img/screenshots/1.png" alt="HantaCon home screen" width="820">

HantaCon combines automated consensus genome generation from Oxford Nanopore sequencing reads, a curated geographically annotated Korean HTNV reference database, and localized Nextstrain visualization within a graphical desktop environment.

**From reads to consensus genomes.**
HantaCon generates L-, M-, and S-segment consensus sequences from Oxford Nanopore sequencing reads using the KU-ONT-HTNV-consensus workflow. Reads are aligned to the tripartite genome of HTNV strain 76-118 (GenBank NC_005222, NC_005219, and NC_005218 for the L, M, and S segments), and consensus sequences are called with user-adjustable thresholds.

**From genomes to geographic context.**
Newly generated HTNV sequences can be analyzed together with a curated Korean reference database containing geographic, temporal, host, and lineage metadata. Specimen metadata are entered through the interface, so no external metadata file needs to be prepared.

**Interactive phylogeographic visualization.**
Segment-specific phylogenetic analyses are performed using a localized Nextstrain workflow and visualized interactively with Auspice, including a phylogenetic tree, a geographic map, a genome-wide nucleotide diversity panel, and a tip frequency panel.

**A desktop workflow.**
HantaCon integrates an Electron-based graphical user interface with a Docker-containerized bioinformatics backend, reducing the need to operate individual command-line tools. Prepared HTNV FASTA sequences can also be analyzed directly, bypassing the consensus-generation step.

## Installation

HantaCon is a desktop application. Download the package for your computer from [Releases](https://github.com/KU-MV/KU-HantaCon/releases/latest) and install it; no build is needed. Docker must be installed first, because all bioinformatics tools run inside Docker.

| Computer | Package |
|---|---|
| macOS, Apple silicon (M-series) | `HantaCon-<version>-arm64.dmg` |
| macOS, Intel | `HantaCon-<version>.dmg` |
| Ubuntu 22.04 or later, x86-64 | `hantacon_<version>_amd64.deb` |

Disk space: the HantaCon Docker images use about 6.5 GB. An internet connection is needed for the installation and the first analysis.

Runtime reference (benchmark hardware, not a minimum requirement): for the datasets described in the associated study, analysis of the L, M, and S segments, from prepared FASTQ reads through consensus generation to localized Nextstrain visualization, completed within approximately 15 minutes on a MacBook Pro (Apple M3 Pro, 36 GB RAM), excluding sequencing and manual gap-filling time.

### macOS

1. Install Docker Desktop for your chip from [docs.docker.com/desktop/setup/install/mac-install](https://docs.docker.com/desktop/setup/install/mac-install/). Open `Docker.dmg`, drag Docker to Applications, and open Docker. Signing in is optional (press **Skip**). Wait until Docker Desktop shows **Engine running**.
2. Open the downloaded HantaCon `.dmg` and drag HantaCon to Applications.
3. Open HantaCon from Applications. The application is not notarized, so at the first launch macOS reports that Apple cannot verify that HantaCon is free of malware. Press **Done**, open System Settings > Privacy & Security, press **Open Anyway** next to the message about HantaCon, and confirm with your password.

### Ubuntu Linux

1. Install Docker:

   ```bash
   sudo apt update
   sudo apt install -y curl
   curl -fsSL https://get.docker.com -o get-docker.sh
   sudo sh get-docker.sh
   sudo usermod -aG docker $USER
   ```

2. **Log out and log back in**, so that Docker can be used without `sudo`. Check that `docker run hello-world` prints a "Hello from Docker!" message.
3. Install the downloaded package from the folder it was downloaded to:

   ```bash
   cd ~/Downloads
   sudo apt install ./hantacon_*_amd64.deb
   ```

   On Ubuntu installed in another language, the Downloads folder may have a translated name (for example `~/다운로드`); use that folder instead. `apt` also installs the system libraries HantaCon needs, and on Ubuntu 24.04 and later the package installs the AppArmor profile that the application's sandbox requires there.

4. Open HantaCon from the applications menu, or run `hantacon` in a terminal.

To build HantaCon from source instead, see [Building from source](DOCS.md#building-from-source). Updating and uninstalling are described in [DOCS.md](DOCS.md#updating).

## Quick start

### First launch

Make sure Docker is running before opening HantaCon (macOS: Docker Desktop shows **Engine running**; Ubuntu: `docker info` prints no error).

On launch, HantaCon creates its working directory at `~/Desktop/HantaCon` (on Ubuntu installed in another language, this is a separate `Desktop` folder in your home folder, not the translated desktop folder; **Open result** opens it) and writes its Docker Compose configuration there. Analysis inputs, intermediate files, and results are all kept under that directory.

The backend containers are built the first time an analysis is started, not at launch. The first Sequence run builds the `hantacon_core` image, and the first Phylodynamics run downloads the `nextstrain/base` image. Together these download several GB. During the download the application log may show no new lines for several minutes; this is normal. Later runs start immediately.

### Example: full analysis

**Example data.** The example uses public Oxford Nanopore reads of sample Aa19-167 (SRA run SRR22029858, BioProject PRJNA893834) from:

> Park K, Lee S-H, Kim J, et al. Multiplex PCR-Based Nanopore Sequencing and Epidemiological Surveillance of *Hantaan orthohantavirus* in *Apodemus agrarius*, Republic of Korea. *Viruses* 13, 847 (2021). https://doi.org/10.3390/v13050847

Download the reads (about 95 MB; this can take several minutes) into the Downloads folder. The server sometimes drops the connection; `--retry` restarts the download automatically.

On Ubuntu installed in another language, use your Downloads folder's actual name in place of `~/Downloads` here and below.

```bash
cd ~/Downloads
curl -O --retry 5 --retry-all-errors https://ftp.sra.ebi.ac.uk/vol1/fastq/SRR220/058/SRR22029858/SRR22029858_1.fastq.gz
gunzip SRR22029858_1.fastq.gz
```

1. **Sequence tab**: Generate consensus genomes
   - Prefix: `Example_Aa19-167`. A prefix may contain only letters, numbers, `-` and `_`.
   - **Select FASTQ**: `Downloads/SRR22029858_1.fastq`
   - Reference: `HTNV_76-118`. Leave the three thresholds at their defaults.
   - Press **Generate**. When the status bar shows **COMPLETE**, `Example_Aa19-167_L.fasta`, `Example_Aa19-167_M.fasta`, and `Example_Aa19-167_S.fasta` are in `~/Desktop/HantaCon/workspace/result/<date_time>/`.

2. **Phylodynamics tab**: Run the analysis on the L segment
   - **Select FASTA**: `Example_Aa19-167_L.fasta` from the result folder of step 1
   - Segment: `L`
   - Host: `Apodemus agrarius`
   - Location: Country `South Korea`, Province `Gyeonggi`, City `Yeoncheon`, Town `Sang-ri`
   - Collection Date: `2019`, `11`, `19`
   - Press **Generate metadata**. Wait until the status bar shows **COMPLETE**.

3. **Visualization tab**: Open the result in Auspice
   - Set **Mode** to **Offline**.
   - Click the dataset under **Available datasets**. Its name is the run date and time, for example `20261118/214347/htv/L`. If it is not listed, press **Refresh**.

The reference database already contains this sample as `HTNV_Aa19-167`.

Location names must be spelled as in the bundled coordinate table (capitalization is ignored), for example `South Korea`, not `Korea`. Leave a field empty if it is unknown. The list of accepted names is in [DOCS.md](DOCS.md#supported-location-names).

Each tab and its parameters are described in [Usage](DOCS.md#usage).

## Reference database

HantaCon includes a curated reference database of *Orthohantavirus hantanense* sequences from the Republic of Korea, designed for segment-specific phylogeographic comparison of the L, M, and S genomic segments.

| | |
|---|---|
| Source | Publicly available HTNV and Soochong virus sequences retrieved from GenBank (accessed 30 August 2025) |
| Size | 162 L-segment, 163 M-segment, and 164 S-segment sequences, plus the HTNV 76-118 reference genome |
| Temporal range | 1997 to 2023 (HTNV 76-118 reference: 1976) |
| Spatial resolution | Town (ri or dong), municipality (si or gun), and province |
| Metadata fields | Strain name, lineage designation, host species, collection date, GenBank accession number, and locality (country, province, city, town) |

<!-- TODO: add inclusion and exclusion criteria to DOCS.md -->

## Citation

If you use HantaCon in your research, please cite:

<!-- TODO: replace with the full citation and DOI once published -->
> Park K, Kim J, Lee J, et al. Genomic surveillance of Hantaan virus for exposure-site investigation of haemorrhagic fever with renal syndrome: an integrated desktop workflow applied to military cases in the Republic of Korea. [Journal] ([Year]).

HantaCon builds on Nextstrain, minimap2, SAMtools, BCFtools, BEDTools, MAFFT, IQ-TREE, TreeTime, Medaka, and Snakemake. Please also cite them where appropriate; full references are listed in [DOCS.md](DOCS.md).

## License

<!-- TODO: choose a license, add a LICENSE file, and state it here. package.json currently declares ISC. -->
License information will be added soon.

## Developed by

**Song Lab, Hantavirus Genomics and Epidemiology**
Department of Microbiology and Institute for Viral Diseases
Korea University College of Medicine, Seoul, Republic of Korea

Reference viral genomic sequences used in this program were obtained from the GenBank database.

This work was supported by the National Research Foundation of Korea (grant number 2023R1A2C2006105) and the Agency for Defense Development (grant numbers UE242006TD and 411FF5-912A01201).

## Contact

Questions and bug reports are best submitted through [Issues](https://github.com/KU-MV/KU-HantaCon/issues).

- Program operation and maintenance: Kyungmin Park, PhD (kmpark0131@korea.ac.kr)
- Scientific inquiries and use of original genomic sequences or project-derived results in publications: Jin-Won Song, MD, PhD (jwsong@korea.ac.kr)
